import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { createPlaygroundScene } from './PlaygroundScene';
import { composePhoto } from './photoFrame';
import { revealPose, revealEvents, REVEAL, QUICK_START } from '../../utils/playground3d/reveal';
import { ACTIVITIES, createActivity, PHOTO_FRAMES, photoFileName, activityById, THROW_ROUNDS, HIDE_ROUNDS } from '../../utils/playground3d/activities';
import { themeFor } from '../../utils/playground3d/themes';
import { sounds } from '../../utils/soundEffects';
import { playCry } from '../../utils/cries';
import { BERRIES, BERRY_TYPES } from '../../utils/friendship';
import { BerryIcon } from '../BerryIcon';
import { PokeballIcon } from '../PokeballIcon';

const RESULT_MS = 2600;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const prefersReducedMotion = () => {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * 3D playground for one Pokémon: Poké Ball reveal, a floating diorama themed by its type and
 * eight short 3D activities. Rendering lives in PlaygroundScene (three.js); the rules live in
 * utils/playground3d. Rewards go through the buddy's callbacks:
 *  onTapPokemon()      – a tap on the Pokémon (the buddy pets: cry, hearts, onPet with its daily limit)
 *  onPetReward()       – a finished activity (one onPet), returns the storage outcome
 *  onFeedBerry(berry)  – a berry dropped on the Pokémon (onFeed), returns the outcome
 *  onAte(outcome)      – after the eating animation (the buddy shows +gain / level up)
 *  onFail()            – WebGL could not start: the buddy shows the 2D version
 * The ref exposes react(kind) so actions from the buddy panel (feeding buttons, gifts) animate here.
 */
export const Playground3D = forwardRef(function Playground3D(
  {
    pokemon,
    image,
    shiny = false,
    revealKind = 'open',
    paused = false,
    care = { enabled: false },
    onTapPokemon,
    onPetReward,
    onFeedBerry,
    onAte,
    onFail,
    message,
    worn,
    overlay,
    levelLabel,
  },
  ref,
) {
  const name = pokemon?.name || 'Pokémon';
  const theme = themeFor(pokemon);
  const [phase, setPhaseState] = useState('loading');
  const phaseRef = useRef('loading');
  const setPhase = (p) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [expanded, setExpanded] = useState(revealKind === 'scan');
  const [stageEl, setStageEl] = useState(null);
  const [sceneOn, setSceneOn] = useState(0);
  const [status, setStatus] = useState('loading');
  const [actId, setActId] = useState(null);
  const [hud, setHud] = useState({ progress: 0, hint: '', extra: '' });
  const [result, setResult] = useState(null);
  const [bubble, setBubble] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [frameId, setFrameId] = useState(PHOTO_FRAMES[0].id);
  const [dragType, setDragType] = useState(null);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');

  const sceneRef = useRef(null);
  const actRef = useRef(null);
  const revealRef = useRef({ t: 0 });
  const revealDone = useRef(false);
  const lookRef = useRef(0);
  const dragRef = useRef(null);
  const downRef = useRef(null);
  const flashRef = useRef(null);
  const wornRef = useRef(null);
  const domImgRef = useRef(null);
  const hudT = useRef(0);
  const statT = useRef(0);
  const rootRef = useRef(null);
  const timers = useRef([]);
  const alive = useRef(true);
  const cbs = useRef({});
  cbs.current = { onTapPokemon, onPetReward, onFeedBerry, onAte, onFail, care, pokemon };
  const later = (fn, ms) => timers.current.push(setTimeout(() => alive.current && fn(), ms));
  useEffect(() => {
    alive.current = true;
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach(clearTimeout);
    };
  }, []);

  const say = useCallback((text, ms = 2200) => {
    setBubble({ text, key: Date.now() + Math.random() });
    later(() => setBubble((b) => (b && b.text === text ? null : b)), ms);
  }, []);

  // ------------------------------------------------------------------ scene lifecycle
  const sceneKey = `${pokemon?.id || pokemon?.name}|${pokemon?.pokedexNumber}|${image}|${shiny ? 1 : 0}`;
  useEffect(() => {
    let scene;
    try {
      scene = createPlaygroundScene({
        pokemon: { name: pokemon?.name, types: pokemon?.types, pokedexNumber: pokemon?.pokedexNumber, speciesName: pokemon?.speciesName, id: pokemon?.id },
        image,
        shiny,
        onStatus: (s) => alive.current && setStatus(s),
      });
    } catch (err) {
      console.warn('[playground3d] WebGL unavailable, using 2D:', err);
      cbs.current.onFail?.();
      return undefined;
    }
    sceneRef.current = scene;
    setSceneOn((n) => n + 1);
    let started = false;
    const start = () => {
      if (started || !alive.current) return;
      started = true;
      if (!revealDone.current && revealKind !== 'none') {
        revealRef.current.t = revealKind === 'scan' && !prefersReducedMotion() ? 0 : QUICK_START;
        setPhase('reveal');
      } else setPhase('idle');
    };
    const timer = setTimeout(start, 2500);
    Promise.resolve(scene.ready).then(() => {
      clearTimeout(timer);
      start();
    });
    return () => {
      started = true;
      clearTimeout(timer);
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  // Put the canvas into whichever stage is mounted (inline or full screen) and keep it sized
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !stageEl) return undefined;
    stageEl.prepend(scene.canvas);
    const fit = () => {
      const r = stageEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) scene.resize(r.width, r.height);
    };
    fit();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(fit);
      ro.observe(stageEl);
    }
    let io = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)), { threshold: 0.05 });
      io.observe(stageEl);
    }
    return () => {
      ro?.disconnect();
      io?.disconnect();
    };
  }, [stageEl, sceneOn]);

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  useEffect(() => {
    if (expanded) setInView(true);
  }, [expanded]);

  // ------------------------------------------------------------------ events → sounds & FX
  const fx = (type, data) => sceneRef.current?.fx(type, data);

  function finishReveal() {
    revealDone.current = true;
    setPhase('idle');
    fx('hearts', { count: 3 });
    say(`Chào bé! Mình là ${name}! 👋`, 2600);
  }
  function skipReveal() {
    const t0 = revealRef.current.t;
    if (t0 < REVEAL.cry) playCry(cbs.current.pokemon);
    revealRef.current.t = REVEAL.end;
    fx('burst');
    finishReveal();
  }
  function onRevealEvent(e) {
    switch (e.type) {
      case 'impact':
        sounds.playPop();
        if (e.strength === 1) fx('dust', { x: 0, z: 0 });
        break;
      case 'wobble':
        sounds.playNote(880 - e.index * 120, { duration: 0.22, volume: 0.18 });
        break;
      case 'burst':
        sounds.playEnergySurge();
        sounds.playWhoosh();
        fx('burst');
        break;
      case 'land':
        fx('dust', { x: 0, z: 0 });
        break;
      case 'cry':
        playCry(cbs.current.pokemon);
        break;
      case 'done':
        finishReveal();
        break;
      default:
    }
  }

  function finishActivity(act) {
    const res = act.result || { stars: 1 };
    let gainText = '';
    if (res.reward === 'pet' && cbs.current.care?.enabled) {
      const outcome = cbs.current.onPetReward?.();
      if (outcome?.gain) gainText = `+${outcome.gain} ❤️ thân thiết`;
    }
    if (act.id === 'feed' && act.outcome?.gain) gainText = act.outcome.favorite ? `+${act.outcome.gain} ❤️ Món yêu thích!` : `+${act.outcome.gain} ❤️`;
    setResult({ stars: res.stars, title: res.stars >= 3 ? 'Tuyệt vời!' : res.stars === 2 ? 'Giỏi quá!' : 'Vui ghê!', gainText, id: act.id });
    setPhase('result');
    sounds.playSuccessFanfare();
    fx('confetti', { count: 50 });
    fx('hop');
    try {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: theme.aura.colors });
    } catch {
      // ignore
    }
    later(() => {
      if (phaseRef.current !== 'result') return;
      setResult(null);
      actRef.current = null;
      setActId(null);
      setPhase('idle');
    }, RESULT_MS);
  }

  const bubbleThrottle = useRef(0);
  function handle(events) {
    const act = actRef.current;
    if (!act) return;
    for (const e of events) {
      switch (e.type) {
        case 'heart':
          fx('hearts', { count: 1 });
          fx('wiggle');
          sounds.playNote(e.pitch, { duration: 0.35, volume: 0.16 });
          break;
        case 'miss':
          sounds.playPop();
          say(`Thả quả vào ${name} nhé! 🍓`);
          break;
        case 'feedRequest': {
          const outcome = cbs.current.onFeedBerry?.(e.berry);
          handle(act.resolve?.(outcome) || []);
          break;
        }
        case 'eatStart':
          fx('eat');
          if (e.favorite) say('Ngon tuyệt! Món yêu thích! 😋');
          break;
        case 'refuse':
          fx('wiggle');
          if (e.result === 'full') say(`${name} no căng bụng rồi! 😊`);
          else if (e.result === 'max') say(`${name} đã là bạn thân nhất rồi! ❤️`);
          else if (e.result === 'noBerry') say('Hết quả này rồi! Chơi Chạy Nhảy để nhặt thêm nhé.');
          else say('Chưa cho ăn được, thử lại nhé.');
          break;
        case 'munch':
          sounds.playMunch();
          fx('crumbs', { berry: act.berry || 'razz' });
          break;
        case 'ate':
          fx('hearts', { count: e.favorite ? 6 : 3 });
          cbs.current.onAte?.(act.outcome);
          break;
        case 'throw':
          sounds.playWhoosh();
          break;
        case 'bounce':
          sounds.playPop();
          fx('ring', { x: act.target?.x, z: act.target?.z, r: 0.6 });
          break;
        case 'catch':
          sounds.playJump?.();
          fx('stars', { count: 8 });
          break;
        case 'bring':
          sounds.playCoin();
          fx('hearts', { count: 2 });
          if (e.round < THROW_ROUNDS) say(`Bắt được rồi! Ném nữa nào (${e.round}/${THROW_ROUNDS})`);
          break;
        case 'beat':
          sounds.playNote(e.freq, { duration: 0.28, volume: e.cue ? 0.2 : 0.12 });
          if (e.cue) fx('ring', { r: 1.2, color: theme.aura.colors[e.index % theme.aura.colors.length] });
          break;
        case 'hit':
          fx('stars', { count: e.perfect ? 7 : 4 });
          if (e.perfect) fx('confetti', { count: 10 });
          break;
        case 'hide':
          sounds.playWhoosh();
          break;
        case 'swap':
          sounds.playPop();
          break;
        case 'guess':
          say('Bạn ấy trốn ở đâu nhỉ? Chạm vào bụi cây!');
          break;
        case 'empty':
          sounds.playNote(330, { duration: 0.25, volume: 0.14 });
          say('Hihi, không phải chỗ này! Thử chỗ khác nhé 🌿', 1600);
          break;
        case 'found':
          playCry(cbs.current.pokemon);
          fx('hearts', { count: 4 });
          fx('stars', { count: 10 });
          say('Tìm thấy rồi! Hihi! 😆', 1400);
          break;
        case 'bubble':
          fx('bubbles', { count: e.count });
          if (performance.now() - bubbleThrottle.current > 160) {
            bubbleThrottle.current = performance.now();
            sounds.playNote(900 + Math.random() * 500, { duration: 0.12, volume: 0.08 });
          }
          break;
        case 'rinse':
          sounds.playWhoosh();
          say('Bọt nhiều quá! Giờ xoa để xả nước nào 🚿');
          break;
        case 'shine':
          sounds.playEnergySurge();
          fx('sparkle', { count: 26 });
          say(`${name} sạch bóng rồi! ✨`);
          break;
        case 'note':
          sounds.playNote(e.freq, { duration: 1.1, volume: 0.13 });
          fx('note');
          break;
        case 'zzz':
          fx('zzz');
          break;
        case 'snuggle':
          fx('hearts', { count: 1 });
          break;
        case 'dawn':
          sounds.playNote(660, { duration: 0.6, volume: 0.15 });
          break;
        case 'wake':
          fx('hop');
          playCry(cbs.current.pokemon);
          say('Chào buổi sáng! ☀️');
          break;
        case 'snap':
          takePhoto(e.frame);
          break;
        case 'finish':
          finishActivity(act);
          break;
        default:
      }
    }
  }

  async function takePhoto(frame) {
    const shot = sceneRef.current?.capture();
    sounds.playScanBeep();
    if (flashRef.current) {
      flashRef.current.style.transition = 'none';
      flashRef.current.style.opacity = '0.9';
      window.requestAnimationFrame?.(() => {
        if (!flashRef.current) return;
        flashRef.current.style.transition = 'opacity 0.5s';
        flashRef.current.style.opacity = '0';
      });
    }
    const url = await composePhoto(shot, frame, name);
    if (alive.current && url) setPhoto({ url, file: photoFileName(name) });
  }

  // ------------------------------------------------------------------ frame loop
  const active = phase !== 'loading' && !paused && inView && pageVisible && sceneOn > 0;
  const frame = useRef(null);
  frame.current = (dt) => {
    const scene = sceneRef.current;
    if (!scene) return;
    let view = {};
    if (phaseRef.current === 'reveal') {
      const r = revealRef.current;
      const t0 = r.t;
      r.t += dt;
      view.reveal = revealPose(r.t);
      if (flashRef.current) flashRef.current.style.opacity = String(view.reveal.flash * 0.75);
      for (const e of revealEvents(t0, r.t)) onRevealEvent(e);
    } else if (actRef.current && (phaseRef.current === 'activity' || phaseRef.current === 'result')) {
      const act = actRef.current;
      if (phaseRef.current === 'activity') handle(act.tick(dt));
      view = { ...act.view() };
      hudT.current += dt;
      if (hudT.current > 0.12 && phaseRef.current === 'activity') {
        hudT.current = 0;
        setHud(hudFor(act));
      }
    }
    view.look = lookRef.current;
    view.dragBerry = dragRef.current;
    scene.update(dt, view);
    statT.current += dt;
    if (statT.current > 1 && rootRef.current && scene.stats) {
      statT.current = 0;
      const st = scene.stats();
      rootRef.current.dataset.calls = st.calls;
      rootRef.current.dataset.pr = st.pixelRatio;
      rootRef.current.dataset.ms = st.frameMs;
    }
    if (wornRef.current || domImgRef.current) {
      const a = scene.anchors?.();
      if (a && wornRef.current) {
        wornRef.current.style.left = `${a.head.x * 100}%`;
        wornRef.current.style.top = `${a.head.y * 100}%`;
        wornRef.current.style.opacity = a.visible ? '1' : '0';
      }
      if (a && domImgRef.current) {
        const h = Math.max(0.05, a.feet.y - a.head.y);
        Object.assign(domImgRef.current.style, { left: `${a.feet.x * 100}%`, top: `${a.head.y * 100}%`, height: `${h * 100}%`, opacity: a.visible ? '1' : '0' });
      }
    }
  };
  useEffect(() => {
    if (!active) return undefined;
    const raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : (f) => setTimeout(() => f(performance.now()), 16);
    const cancel = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : clearTimeout;
    let id;
    let last = null;
    const tick = (now) => {
      const dt = last == null ? 1 / 60 : Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      try {
        frame.current(dt);
      } catch (err) {
        console.warn('[playground3d] frame failed', err);
      }
      id = raf(tick);
    };
    id = raf(tick);
    return () => cancel(id);
  }, [active]);

  function hudFor(act) {
    const meta = activityById(act.id);
    let hint = meta?.hint(name) || '';
    let extra = '';
    if (act.id === 'throw') extra = `Lần ${Math.min(THROW_ROUNDS, act.round + 1)}/${THROW_ROUNDS}`;
    if (act.id === 'hide') {
      extra = `Vòng ${Math.min(HIDE_ROUNDS, act.round + 1)}/${HIDE_ROUNDS}`;
      if (act.phase === 'guess') hint = `${name} trốn sau bụi nào? Chạm vào đó!`;
      if (act.phase === 'shuffle') hint = 'Nhìn kỹ nhé… đổi chỗ nè!';
    }
    if (act.id === 'dance') extra = act.combo > 1 ? `Combo x${act.combo}` : `${act.hits} nhịp`;
    if (act.id === 'bath') hint = act.phase === 'soap' ? 'Xoa lên bạn ấy để tạo bọt!' : act.phase === 'rinse' ? 'Xoa để xả nước cho sạch!' : 'Sạch bong! ✨';
    if (act.id === 'sleep') hint = act.phase === 'dawn' ? 'Trời sáng rồi…' : `Suỵt… ${name} đang ngủ 💤`;
    return { progress: act.progress || 0, hint, extra };
  }

  // ------------------------------------------------------------------ imperative (buddy panel)
  useImperativeHandle(ref, () => ({
    react(kind, data = {}) {
      if (kind === 'eat') {
        fx('eat');
        fx('crumbs', { berry: data.berry });
        later(() => fx('hearts', { count: 3 }), 400);
      } else if (kind === 'hearts') fx('hearts', { count: data.count || 2 });
      else if (kind === 'toy') {
        fx('hop');
        fx('stars', { count: 8 });
      } else if (kind === 'sparkle') {
        fx('sparkle', { count: 20 });
        fx('stars', { count: 8 });
      } else if (kind === 'levelup') fx('confetti', { count: 60 });
    },
  }));

  // ------------------------------------------------------------------ actions
  function startActivity(id) {
    if (phaseRef.current === 'reveal') skipReveal();
    if (id === 'feed' && !care.enabled) {
      say(`Quét thẻ ${name} để cho bạn ấy ăn nhé!`);
      return;
    }
    const act = createActivity(id);
    actRef.current = act;
    setActId(id);
    setResult(null);
    setPhoto(null);
    setHud(hudFor(act));
    setPhase('activity');
    sounds.playPop();
    if (id === 'dance') say('Nhạc lên! Chạm theo nhịp nhé 🎵', 1800);
  }
  function stopActivity() {
    actRef.current = null;
    setActId(null);
    setResult(null);
    setPhoto(null);
    dragRef.current = null;
    setDragType(null);
    if (phaseRef.current !== 'loading') setPhase('idle');
  }

  const stagePoint = (e) => {
    const r = stageEl?.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
    const w = r.width || 300;
    const h = r.height || 300;
    const cx = Number.isFinite(e.clientX) ? e.clientX : r.left + w / 2;
    const cy = Number.isFinite(e.clientY) ? e.clientY : r.top + h / 2;
    return { nx: r.width ? (cx - r.left) / w : 0.5, ny: r.height ? (cy - r.top) / h : 0.5, w, h };
  };
  const pickAt = (p) => sceneRef.current?.pick?.(p.nx, p.ny) || { pokemon: false, bush: -1 };

  function tapPokemon() {
    fx('hop');
    fx('hearts', { count: 2 });
    cbs.current.onTapPokemon?.();
  }

  function onPointerDown(e) {
    if (phaseRef.current === 'reveal') {
      skipReveal();
      return;
    }
    const p = stagePoint(e);
    downRef.current = { ...p, last: p, moved: 0, at: Date.now() };
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    const act = actRef.current;
    if (act && phaseRef.current === 'activity' && act.id === 'dance') handle(act.input({ type: 'tap' }));
  }
  function onPointerMove(e) {
    const p = stagePoint(e);
    const a = sceneRef.current?.anchors?.();
    lookRef.current = clamp(((p.nx - (a?.feet?.x ?? 0.5)) * 3), -1, 1);
    const d = downRef.current;
    if (!d) return;
    const dist = Math.hypot((p.nx - d.last.nx) * p.w, (p.ny - d.last.ny) * p.h) / Math.max(p.w, p.h);
    const dxN = p.nx - d.last.nx;
    const dyN = p.ny - d.last.ny;
    d.moved += dist;
    d.last = p;
    const act = actRef.current;
    if (!act || phaseRef.current !== 'activity') return;
    if (act.id === 'pet' || act.id === 'bath') handle(act.input({ type: 'rub', amount: dist, onPokemon: pickAt(p).pokemon }));
    else if (act.id === 'photo') act.input({ type: 'orbit', dx: dxN, dy: dyN });
  }
  function onPointerUp(e) {
    const d = downRef.current;
    downRef.current = null;
    if (!d) return;
    const p = stagePoint(e);
    const tap = d.moved < 0.03;
    const act = actRef.current;
    if (phaseRef.current === 'idle') {
      if (tap && pickAt(p).pokemon) tapPokemon();
      return;
    }
    if (!act || phaseRef.current !== 'activity') return;
    switch (act.id) {
      case 'throw': {
        const dy = p.ny - d.ny;
        if (dy < -0.06) handle(act.input({ type: 'swipe', dx: p.nx - d.nx, dy }));
        else if (tap) handle(act.input({ type: 'tap' }));
        break;
      }
      case 'hide':
        if (tap) {
          const hit = pickAt(p);
          if (hit.bush >= 0) handle(act.input({ type: 'pick', bush: hit.bush }));
        }
        break;
      case 'sleep':
        if (tap && pickAt(p).pokemon) handle(act.input({ type: 'tap' }));
        break;
      case 'pet':
      case 'bath':
        // a tap counts as a small rub (little hands)
        if (tap) handle(act.input({ type: 'rub', amount: 0.05, onPokemon: act.id === 'bath' && act.phase === 'rinse' ? true : pickAt(p).pokemon }));
        break;
      default:
    }
  }

  // Berry drag from the bag (feed activity)
  const berryDrag = useRef({ moved: 0, startX: 0, startY: 0, byPointer: false });
  function dropBerry(type, onPokemon) {
    const act = actRef.current;
    if (!act || act.id !== 'feed') return;
    handle(act.input({ type: 'drop', berry: type, onPokemon }));
  }
  function onBerryDown(e, type) {
    const act = actRef.current;
    if (!act || act.id !== 'feed' || act.phase !== 'pick') return;
    if ((care.berries?.[type] || 0) <= 0) {
      say('Hết quả này rồi! Chơi Chạy Nhảy để nhặt thêm nhé.');
      return;
    }
    e.preventDefault?.();
    berryDrag.current = { moved: 0, startX: e.clientX, startY: e.clientY, byPointer: true };
    const p = stagePoint(e);
    dragRef.current = { type, nx: p.nx, ny: p.ny };
    setDragType(type);
    const move = (ev) => {
      const q = stagePoint(ev);
      berryDrag.current.moved = Math.max(berryDrag.current.moved, Math.hypot(ev.clientX - berryDrag.current.startX, ev.clientY - berryDrag.current.startY) || 0);
      if (dragRef.current) dragRef.current = { type, nx: q.nx, ny: q.ny };
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const q = stagePoint(ev);
      dragRef.current = null;
      setDragType(null);
      if (berryDrag.current.moved < 10) {
        dropBerry(type, true); // a simple tap feeds too
        return;
      }
      const hit = pickAt(q).pokemon;
      const a = sceneRef.current?.anchors?.();
      const near = a ? Math.hypot(q.nx - a.head.x, q.ny - (a.head.y + (a.feet.y - a.head.y) * 0.35)) < 0.18 : false;
      dropBerry(type, hit || near);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  function onBerryClick(e, type) {
    // keyboard / assistive click (no pointer sequence)
    if (berryDrag.current.byPointer) {
      berryDrag.current.byPointer = false;
      return;
    }
    if ((care.berries?.[type] || 0) <= 0) {
      say('Hết quả này rồi! Chơi Chạy Nhảy để nhặt thêm nhé.');
      return;
    }
    dropBerry(type, true);
  }

  useEffect(() => {
    if (message) say(message, 2400);
  }, [message, say]);

  // ------------------------------------------------------------------ render
  const actMeta = actId ? activityById(actId) : null;
  const showBar = phase !== 'loading';
  const stage = (
    <div ref={rootRef} className={`pg3d-root ${expanded ? 'pg3d-full' : ''}`} data-phase={phase} data-activity={actId || ''} data-status={status} data-testid="pg3d-root">
      <div
        ref={setStageEl}
        className={`pg3d-stage pg3d-type-${theme.type}`}
        data-testid="pg3d-stage"
        role="application"
        aria-label={`Sân chơi 3D của ${name}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (downRef.current = null)}
        onPointerLeave={() => (lookRef.current = 0)}
      >
        <div ref={flashRef} className="pg3d-flash" aria-hidden="true" />
        {status === 'billboard-dom' && image && <img ref={domImgRef} src={image} alt="" className="pg3d-domimg" draggable={false} />}
        {worn && (
          <span ref={wornRef} className="pg3d-worn" aria-label={`Đang đội ${worn.name}`}>
            {worn.emoji}
          </span>
        )}

        {phase === 'loading' && (
          <div className="pg3d-loading" role="status">
            <PokeballIcon className="w-14 h-14 pg3d-spin" />
            <span>{name} đang tới…</span>
          </div>
        )}

        <div className="pg3d-top">
          <span className="pg3d-chip" style={phase === 'activity' ? { visibility: 'hidden' } : undefined}>
            {theme.diorama.name} · {levelLabel || 'Mới quen'}
          </span>
          <button type="button" className="pg3d-iconbtn" onPointerDown={(e) => e.stopPropagation()} onClick={() => setExpanded((x) => !x)} aria-label={expanded ? 'Thu nhỏ sân chơi' : 'Mở toàn màn hình'}>
            {expanded ? '✕' : '⛶'}
          </button>
        </div>

        {phase === 'reveal' && <div className="pg3d-skip">Chạm để bỏ qua ⏭</div>}

        {phase === 'activity' && actMeta && (
          <div className="pg3d-hud" data-testid="pg3d-hud">
            <div className="pg3d-hud-row">
              <span className="pg3d-hud-title">
                {actMeta.icon} {actMeta.title}
              </span>
              {hud.extra && <span className="pg3d-hud-extra">{hud.extra}</span>}
            </div>
            <div className="pg3d-hud-hint">{hud.hint}</div>
            <div className="pg3d-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.progress * 100)}>
              <div style={{ width: `${Math.round(hud.progress * 100)}%` }} />
            </div>
          </div>
        )}

        {bubble && (
          <div key={bubble.key} className="pg3d-bubble" role="status">
            {bubble.text}
          </div>
        )}

        {result && (
          <div className="pg3d-result" role="status" data-testid="pg3d-result" data-stars={result.stars}>
            <div className="pg3d-result-title">{result.title}</div>
            <div className="pg3d-stars" aria-label={`${result.stars} sao`}>
              {[0, 1, 2].map((i) => (
                <span key={i} className={i < result.stars ? 'on' : ''} style={{ animationDelay: `${i * 0.15}s` }}>
                  ★
                </span>
              ))}
            </div>
            {result.gainText && <div className="pg3d-gain">{result.gainText}</div>}
          </div>
        )}

        {photo && (
          <div className="pg3d-photo" data-testid="pg3d-photo">
            <img src={photo.url} alt={`Ảnh ${name}`} />
            <div className="pg3d-photo-actions">
              <a href={photo.url} download={photo.file} className="pg3d-pill pg3d-pill-hot" onPointerDown={(e) => e.stopPropagation()}>
                ⬇️ Tải ảnh về
              </a>
              <button type="button" className="pg3d-pill" onPointerDown={(e) => e.stopPropagation()} onClick={() => setPhoto(null)}>
                Chụp tiếp
              </button>
            </div>
          </div>
        )}
        {actId === 'photo' && phase === 'activity' && !photo && <div className={`pg3d-frame-overlay frame-${frameId}`} aria-hidden="true" />}
        {overlay}
      </div>

      {showBar && (
        <div className="pg3d-bar" style={phase === 'reveal' ? { visibility: 'hidden' } : undefined} onPointerDown={(e) => e.stopPropagation()}>
          {phase === 'activity' || phase === 'result' ? (
            <div className="pg3d-controls">
              <button type="button" className="pg3d-pill" onClick={stopActivity} aria-label="Dừng hoạt động">
                ✕ Xong
              </button>
              {actId === 'feed' && (
                <div className="pg3d-berries" aria-label="Túi quả mọng">
                  {BERRY_TYPES.map((type) => {
                    const count = care.berries?.[type] || 0;
                    return (
                      <button
                        key={type}
                        type="button"
                        className={`pg3d-berry ${count ? '' : 'empty'} ${dragType === type ? 'dragging' : ''}`}
                        onPointerDown={(e) => onBerryDown(e, type)}
                        onClick={(e) => onBerryClick(e, type)}
                        aria-label={`Kéo quả ${BERRIES[type].name} cho ${name} ăn (còn ${count})`}
                      >
                        <BerryIcon type={type} className="w-8 h-8" />
                        <span>x{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {actId === 'dance' && (
                <button type="button" className="pg3d-pill pg3d-pill-hot pg3d-beat" onPointerDown={() => actRef.current && handle(actRef.current.input({ type: 'tap' }))} aria-label="Nhún theo nhịp">
                  🎵 Nhún!
                </button>
              )}
              {actId === 'sleep' && (
                <button type="button" className="pg3d-pill" onClick={() => actRef.current && handle(actRef.current.input({ type: 'wake' }))}>
                  ☀️ Đánh thức
                </button>
              )}
              {actId === 'throw' && (
                <button type="button" className="pg3d-pill pg3d-pill-hot" onClick={() => actRef.current && handle(actRef.current.input({ type: 'tap' }))} aria-label="Ném bóng">
                  ⚾ Ném!
                </button>
              )}
              {actId === 'photo' && (
                <>
                  <div className="pg3d-frames" role="group" aria-label="Khung ảnh">
                    {PHOTO_FRAMES.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={frameId === f.id}
                        aria-label={`Khung ${f.name}`}
                        className={`pg3d-frame ${frameId === f.id ? 'on' : ''}`}
                        onClick={() => {
                          setFrameId(f.id);
                          actRef.current?.input({ type: 'frame', id: f.id });
                        }}
                      >
                        {f.emoji}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="pg3d-snap" aria-label="Chụp ảnh" onClick={() => actRef.current && handle(actRef.current.input({ type: 'snap' }))}>
                    📸
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="pg3d-acts" role="group" aria-label={`Chơi 3D với ${name}`}>
              {ACTIVITIES.map((a) => (
                <button key={a.id} type="button" className={`pg3d-act bg-gradient-to-br ${a.color} ${a.id === 'feed' && !care.enabled ? 'dim' : ''}`} onClick={() => startActivity(a.id)} aria-label={a.title} data-testid={`pg3d-act-${a.id}`}>
                  <span className="pg3d-act-icon" aria-hidden="true">
                    {a.icon}
                  </span>
                  <span className="pg3d-act-label">{a.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (!expanded) return stage;
  return (
    <>
      <button type="button" className="pg3d-placeholder" onClick={() => setExpanded(false)}>
        🎮 Đang chơi toàn màn hình — chạm để thu nhỏ
      </button>
      {createPortal(
        <div className="pg3d-overlay" role="dialog" aria-modal="true" aria-label={`Sân chơi 3D của ${name}`}>
          {stage}
        </div>,
        document.body,
      )}
    </>
  );
});

export default Playground3D;
