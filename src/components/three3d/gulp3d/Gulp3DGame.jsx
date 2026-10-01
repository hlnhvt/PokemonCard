import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, Lock, RotateCcw } from '../../icons/PokeIcons';
import { MAPS, KINDS, DT, GULP3D_GAME, POWER_NAMES, createGulp3D, step, greedyBot, snap, starsFor, cityPercent, kindName, clamp } from '../../../utils/three3d/gulp3d';
import { loadGulp3d, saveGulp3d } from '../../../utils/three3d/gulp3dStore';
import { getProgress, recordStars, goldForLevel, totalStars, isUnlocked } from '../../../utils/progress';
import { artworkUrl } from '../../../services/pokemonOnlineService';
import { sounds } from '../../../utils/soundEffects';
import { StarRow, GoldReward } from '../../kidgames/Common';
import { Countdown } from '../../carnival/CarnivalCommon';
import { useLoop, useLater } from '../../sports/sportsKit';
import { createGulp3DScene } from './Gulp3DScene';

const SNORLAX_ART = artworkUrl(143);
const MUNCHLAX_ART = artworkUrl(446);
const JOY_R = 56; // joystick radius in px
const MAP_STYLE = ['from-lime-200 via-emerald-200 to-sky-300', 'from-sky-200 via-indigo-200 to-violet-300', 'from-cyan-200 via-amber-100 to-teal-300'];
const POWER_ICON = { gold: '🍓', speed: '👟', magnet: '🧲' };
const POWER_CHIP = { gold: 'bg-amber-400 text-amber-950', speed: 'bg-rose-500 text-white', magnet: 'bg-sky-500 text-white' };
const RESULT_TITLE = ['Snorlax vẫn còn đói!', 'No bụng rồi!', 'Ngon tuyệt!', 'Nuốt cả thành phố!'];
const MAX_POPS = 7;
const fmtTime = (t) => {
  const s = Math.ceil(Math.max(0, t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtNum = (n) => Math.round(n).toLocaleString('vi-VN');

/** Pick-a-town screen: three maps, each opens when the one before has a star. */
function MapPicker({ progress, best, onPlay }) {
  const next = MAPS.findIndex((m, i) => isUnlocked(MAPS, progress, i) && !progress[m.id]);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-2 pb-6" data-testid="gulp3d-maps">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2 rounded-3xl bg-white/85 p-3 shadow">
          <div className="relative w-20 h-16 shrink-0">
            <img src={SNORLAX_ART} alt="Snorlax" draggable={false} className="gulp3d-float absolute inset-0 w-full h-full object-contain drop-shadow" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black text-slate-800 leading-tight">Snorlax đói bụng quá!</p>
            <p className="text-xs font-bold text-slate-600">Ăn đồ nhỏ để lớn lên, rồi nuốt nhà, xe và cả tòa tháp. Mỗi vòng 2 phút!</p>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-100 text-sm font-black text-amber-600">⭐ {totalStars(progress)}/{MAPS.length * 3}</span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {MAPS.map((m, i) => {
            const open = isUnlocked(MAPS, progress, i);
            const stars = Number(progress[m.id]) || 0;
            return (
              <button
                key={m.id}
                onClick={() => open && onPlay(i)}
                disabled={!open}
                aria-label={open ? m.name : `${m.name} (chưa mở)`}
                data-testid={`gulp3d-map-${i + 1}`}
                className={`relative flex items-center gap-3 p-3 rounded-3xl text-left bg-gradient-to-br ${MAP_STYLE[i]} ${open ? 'shadow-md active:scale-95' : 'opacity-50 grayscale'} ${i === next ? 'ring-4 ring-amber-300 hint-pulse' : ''}`}
              >
                <span className="w-14 h-14 shrink-0 rounded-2xl bg-white/90 flex items-center justify-center text-3xl shadow-inner">{open ? m.icon : <Lock className="w-6 h-6 text-slate-500" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-black text-slate-600">Bản đồ {i + 1}</span>
                  <span className="block text-lg font-black leading-tight text-slate-900">{m.name}</span>
                  <span className="block text-xs font-bold text-slate-600 truncate">{open ? m.tip : 'Cần 1⭐ ở bản đồ trước'}</span>
                </span>
                <span className="shrink-0 flex flex-col items-end gap-0.5">
                  <StarRow stars={stars} size="w-4 h-4" />
                  {best[m.id] > 0 && <span className="text-[11px] font-black text-slate-700">🏆 {fmtNum(best[m.id])}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * "Snorlax nuốt cả thành phố": a 3D Snorlax walks around a toy town and swallows everything smaller
 * than itself, growing until it can eat the giant tower. Drag anywhere = joystick; arrows / WASD.
 * `autopilot` lets a greedy bot play (tests, demos); `roundTime` shortens a round (demos).
 */
export function Gulp3DGame({ player, onClose, onGold, random = Math.random, autopilot = false, roundTime }) {
  const [progress, setProgress] = useState(() => getProgress(GULP3D_GAME));
  const [best, setBest] = useState(() => loadGulp3d().best);
  const [mapIndex, setMapIndex] = useState(null);
  const [phase, setPhaseState] = useState('maps'); // maps | ready | countdown | play | sleep | result | nogl
  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);
  const [pops, setPops] = useState([]);
  const [banner, setBanner] = useState(null);
  const [hint, setHint] = useState(null);
  const phaseRef = useRef('maps');
  const game = useRef(null);
  const sceneRef = useRef(null);
  const joyRef = useRef(null);
  const knobRef = useRef(null);
  const input = useRef({ joy: null, keys: {} });
  const acc = useRef(0);
  const hudT = useRef(0);
  const paid = useRef(false);
  const popId = useRef(0);
  const munchT = useRef(0);
  const hintT = useRef(0);
  const later = useLater();

  const setPhase = (p) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const pop = (text, x, y, color = '#ffffff', big = false) => {
    popId.current += 1;
    const id = popId.current;
    setPops((list) => [...list.slice(-(MAX_POPS - 1)), { id, text, x, y, color, big }]);
    later(() => setPops((list) => list.filter((p) => p.id !== id)), big ? 1300 : 900);
  };

  const showBanner = (title, sub, color) => {
    popId.current += 1;
    const id = popId.current;
    setBanner({ id, title, sub, color });
    later(() => setBanner((b) => (b && b.id === id ? null : b)), 1800);
  };

  const begin = (i) => {
    game.current = createGulp3D(i, { random, ...(roundTime ? { time: roundTime } : {}) });
    acc.current = 0;
    paid.current = false;
    input.current.joy = null;
    setMapIndex(i);
    setResult(null);
    setPops([]);
    setBanner(null);
    setHint(null);
    setHud(snap(game.current));
    setRunId((r) => r + 1);
    setPhase('ready');
  };

  const toMaps = () => {
    game.current = null;
    setMapIndex(null);
    setResult(null);
    setHud(null);
    setPhase('maps');
  };

  // The 3D town for the chosen map: built when the stage mounts (keyed by the run)
  const mountStage = useCallback((node) => {
    if (!node || !game.current) return undefined;
    let scene = null;
    try {
      scene = createGulp3DScene(node, { state: game.current });
    } catch (err) {
      console.warn('[gulp3d] WebGL unavailable:', err);
      phaseRef.current = 'nogl';
      setPhaseState('nogl');
      return undefined;
    }
    sceneRef.current = scene;
    return () => {
      if (sceneRef.current === scene) sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  // Keyboard
  useEffect(() => {
    const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
    const down = (e) => {
      if (e.key === 'Escape') return onClose();
      const k = map[e.key];
      if (!k) return undefined;
      if (phaseRef.current === 'play') e.preventDefault();
      input.current.keys[k] = true;
      return undefined;
    };
    const up = (e) => {
      const k = map[e.key];
      if (k) input.current.keys[k] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onClose]);

  const readInput = (s) => {
    if (autopilot) return greedyBot(s);
    const i = input.current;
    let x = 0;
    let z = 0;
    if (i.joy) {
      x = i.joy.vx;
      z = i.joy.vy;
    }
    if (i.keys.left) x -= 1;
    if (i.keys.right) x += 1;
    if (i.keys.up) z -= 1;
    if (i.keys.down) z += 1;
    return { x: clamp(x, -1, 1), z: clamp(z, -1, 1) };
  };

  const finish = (s) => {
    const m = MAPS[s.mapIndex];
    const stars = starsFor(s.score, m);
    const saved = saveGulp3d(m.id, s.score);
    setBest(saved.best);
    let gold = 0;
    let improved = false;
    if (stars > 0) {
      const rec = recordStars(GULP3D_GAME, m.id, stars);
      setProgress(rec.progress);
      improved = rec.improved;
      gold = goldForLevel(stars, rec.improved);
      if (!paid.current) {
        paid.current = true;
        onGold?.(gold);
      }
    }
    setHud(snap(s));
    setPhase('sleep');
    // Lullaby while Snorlax dozes off
    [523.25, 440, 392, 329.63].forEach((f, i) => later(() => sounds.playNote(f, { duration: 0.6, volume: 0.16 }), i * 320));
    const r = {
      stars,
      gold,
      improved,
      score: s.score,
      percent: cityPercent(s),
      eaten: s.eaten,
      biggest: s.biggest ? `${KINDS[s.biggest].emoji} ${kindName(m, s.biggest)}` : null,
      combo: s.bestCombo,
      rival: s.rival ? s.rival.score : null,
      isBest: saved.isNew,
      best: saved.best[m.id],
    };
    later(() => {
      setResult(r);
      setPhase('result');
      if (stars > 0) {
        sounds.playSuccessFanfare();
        try {
          confetti({ particleCount: 60 + stars * 40, spread: 90, origin: { y: 0.4 }, zIndex: 9999 });
        } catch {
          // decoration
        }
      } else sounds.playOops();
    }, 2400);
  };

  const at = (x, y, z) => sceneRef.current?.project?.(x, y, z) || { x: 50, y: 40 };

  const handleEvents = (s) => {
    const scene = sceneRef.current;
    for (const e of s.events.splice(0)) {
      scene?.fx(e, s);
      if (e.type === 'eat') {
        if (e.by === 'rival') continue;
        if (munchT.current <= 0) {
          sounds.playMunch?.();
          munchT.current = 0.09;
        }
        const p = at(e.x, KINDS[e.kind].size + 0.8, e.z);
        pop(`+${e.pts}`, p.x, p.y, e.gold ? '#fde047' : '#ffffff', KINDS[e.kind].size > 1);
      } else if (e.type === 'combo') {
        sounds.playPop();
        pop(`Ngon quá! x${e.n}`, 50, 30, '#f9a8d4', true);
      } else if (e.type === 'levelup') {
        sounds.playPop();
        sounds.playNote(659.25, { duration: 0.35, volume: 0.18 });
        sounds.playNote(987.77, { duration: 0.5, delay: 0.12, volume: 0.16 });
        const ids = e.kindIds || [];
        const last = ids[ids.length - 1];
        showBanner('Lớn hơn rồi!', last ? `Giờ ăn được: ${KINDS[last].emoji} ${kindName(s.map, last)}` : '', '#fde047');
      } else if (e.type === 'bump') {
        sounds.playNote(196, { duration: 0.25, volume: 0.12 });
        if (hintT.current <= 0) {
          hintT.current = 2.2;
          setHint(`Chưa đủ to! ${KINDS[e.kind].emoji} ${kindName(s.map, e.kind)} còn to quá`);
          later(() => setHint(null), 1500);
        }
      } else if (e.type === 'power') {
        sounds.playCoin();
        if (e.power === 'speed') sounds.playWhoosh();
        showBanner(`${POWER_ICON[e.power]} ${POWER_NAMES[e.power]}!`, e.power === 'gold' ? 'Điểm x2 trong 8 giây' : e.power === 'speed' ? 'Chạy nhanh trong 6 giây' : 'Hút đồ ăn nhỏ trong 6 giây', '#a5f3fc');
      } else if (e.type === 'sniff') {
        sounds.playNote(1046.5, { duration: 0.2, volume: 0.12 });
        const p = at(e.x, 1.8, e.z);
        pop('Hít hít ♥', p.x, p.y, '#fda4af');
      } else if (e.type === 'finish') finish(s);
    }
  };

  useLoop((dt) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    const s = game.current;
    if (!s) return;
    munchT.current -= dt;
    hintT.current -= dt;
    if (phaseRef.current === 'play') {
      acc.current += dt;
      while (acc.current >= DT && s.status === 'play') {
        step(s, DT, readInput(s));
        acc.current -= DT;
      }
      if (s.events.length) handleEvents(s);
      hudT.current += dt;
      if (hudT.current > 0.1) {
        hudT.current = 0;
        setHud(snap(s));
      }
    }
    sceneRef.current?.update(s, dt);
  }, mapIndex != null && phase !== 'nogl');

  // Virtual joystick: wherever the finger goes down
  const onDown = (e) => {
    if (phaseRef.current !== 'play' || input.current.joy) return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // not supported
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    input.current.joy = { id: e.pointerId, ox, oy, vx: 0, vy: 0 };
    if (joyRef.current) {
      joyRef.current.style.opacity = '1';
      joyRef.current.style.left = `${ox}px`;
      joyRef.current.style.top = `${oy}px`;
    }
    if (knobRef.current) knobRef.current.style.transform = 'translate(-50%, -50%)';
  };
  const onMove = (e) => {
    const j = input.current.joy;
    if (!j || j.id !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let dx = e.clientX - rect.left - j.ox;
    let dy = e.clientY - rect.top - j.oy;
    const len = Math.hypot(dx, dy);
    if (len > JOY_R) {
      dx = (dx / len) * JOY_R;
      dy = (dy / len) * JOY_R;
    }
    const dead = len < 6 ? 0 : 1;
    j.vx = (dx / JOY_R) * dead;
    j.vy = (dy / JOY_R) * dead;
    if (knobRef.current) knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };
  const onUp = (e) => {
    const j = input.current.joy;
    if (!j || j.id !== e.pointerId) return;
    input.current.joy = null;
    if (joyRef.current) joyRef.current.style.opacity = '0';
  };

  const m = mapIndex != null ? MAPS[mapIndex] : null;
  const hasNext = mapIndex != null && mapIndex + 1 < MAPS.length && isUnlocked(MAPS, progress, mapIndex + 1);
  const playing = (phase === 'play' || phase === 'sleep') && hud;
  const nextStar = m && hud ? m.stars.find((v) => v > hud.score) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-emerald-300 select-none overflow-hidden"
      role="dialog"
      aria-label="Snorlax nuốt cả thành phố"
      data-phase={phase}
      data-map={mapIndex != null ? mapIndex + 1 : 0}
      data-score={hud ? hud.score : 0}
      data-percent={hud ? hud.percent : 0}
    >
      {mapIndex == null ? (
        <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-sky-300 via-emerald-200 to-lime-200">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-lg font-black text-slate-800 drop-shadow-sm">😋 Snorlax nuốt cả thành phố</span>
            <button onClick={onClose} aria-label="Đóng trò chơi" className="ml-auto p-2 rounded-full bg-white text-slate-700 shadow">
              <X className="w-5 h-5" />
            </button>
          </div>
          <MapPicker progress={progress} best={best} onPlay={begin} />
        </div>
      ) : (
        <div className="relative flex-1 min-h-0">
          <div key={`run${runId}`} ref={mountStage} className="absolute inset-0" data-testid="gulp3d-stage" />
          <div className="absolute inset-0 z-10 touch-none" data-testid="gulp3d-touch" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
          <div ref={joyRef} className="pointer-events-none absolute z-20 w-28 h-28 -ml-14 -mt-14 rounded-full border-4 border-white/75 bg-white/15 opacity-0 transition-opacity" aria-hidden="true" data-testid="gulp3d-joystick">
            <span ref={knobRef} className="absolute left-1/2 top-1/2 w-12 h-12 rounded-full bg-white/85 shadow-lg" style={{ transform: 'translate(-50%, -50%)' }} />
          </div>

          {/* HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-2 pt-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <button onClick={toMaps} className="pointer-events-auto px-2.5 py-1.5 rounded-full bg-white/90 text-xs font-black text-slate-700 shadow active:scale-95" aria-label="Về chọn bản đồ">
                ← Bản đồ
              </button>
              <span className="min-w-0 truncate px-2.5 py-1 rounded-full bg-black/40 text-sm font-black text-white">
                {m.icon} {m.name}
              </span>
              <button onClick={onClose} aria-label="Đóng trò chơi" className="pointer-events-auto ml-auto shrink-0 p-2 rounded-full bg-white/90 text-slate-700 shadow">
                <X className="w-5 h-5" />
              </button>
            </div>
            {hud && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2.5 py-1 rounded-full text-base font-black tabular-nums shadow ${hud.timeLeft < 15 && phase === 'play' ? 'bg-rose-500 text-white hint-pulse' : 'bg-white/90 text-slate-800'}`} data-testid="gulp3d-time">
                    ⏱ {fmtTime(hud.timeLeft)}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white/90 text-base font-black text-amber-600 tabular-nums shadow" data-testid="gulp3d-score">
                    ⭐ {fmtNum(hud.score)}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-white/80 text-sm font-black text-emerald-700 tabular-nums shadow" data-testid="gulp3d-percent">
                    🏙️ {hud.percent}%
                  </span>
                  {hud.rival != null && (
                    <span className="ml-auto flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-full bg-slate-800/70 text-xs font-black text-white tabular-nums shadow" data-testid="gulp3d-rival">
                      <img src={MUNCHLAX_ART} alt="" className="w-6 h-6 object-contain" draggable={false} />
                      {fmtNum(hud.rival)}
                    </span>
                  )}
                </div>
                <div className="self-start flex items-center gap-1.5 max-w-full">
                  <div className="flex items-center gap-1.5 rounded-full bg-white/85 pl-2 pr-2.5 py-1 shadow min-w-0" data-testid="gulp3d-size">
                    <span className="text-xs font-black text-slate-700 whitespace-nowrap">Cỡ {hud.level}</span>
                    <div className="w-20 h-2.5 rounded-full bg-slate-200 overflow-hidden shrink-0" aria-hidden="true">
                      <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500" style={{ width: `${Math.round((hud.goal ? hud.goal.progress : 1) * 100)}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 truncate">{hud.goal ? `→ ${KINDS[hud.goal.kind].emoji} ${hud.goal.name}` : 'To nhất rồi!'}</span>
                  </div>
                  {nextStar && (
                    <span className="shrink-0 px-2 py-1 rounded-full bg-amber-100/90 text-[11px] font-black text-amber-700 shadow tabular-nums">
                      {'⭐'.repeat(m.stars.indexOf(nextStar) + 1)} {fmtNum(nextStar)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {Object.entries(hud.powers)
                    .filter(([, v]) => v > 0)
                    .map(([k, v]) => (
                      <span key={k} className={`gulp3d-chip px-2 py-0.5 rounded-full text-xs font-black shadow ${POWER_CHIP[k]}`} data-testid={`gulp3d-power-${k}`}>
                        {POWER_ICON[k]} {Math.ceil(v)}s
                      </span>
                    ))}
                  {hud.combo >= 2 && <span className="px-2 py-0.5 rounded-full bg-pink-500 text-white text-xs font-black shadow">🔥 x{hud.combo}</span>}
                </div>
              </>
            )}
          </div>

          {/* +points popups at the eaten things */}
          <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
            {pops.map((p) => (
              <span key={p.id} className={`gulp3d-pop absolute whitespace-nowrap font-black sport-banner ${p.big ? 'text-3xl' : 'text-xl'}`} style={{ left: `${clamp(p.x, 8, 92)}%`, top: `${clamp(p.y, 18, 90)}%`, color: p.color }}>
                {p.text}
              </span>
            ))}
          </div>
          {banner && (
            <div key={banner.id} className="pointer-events-none absolute inset-x-0 top-[24%] z-30 flex flex-col items-center px-4" data-testid="gulp3d-banner">
              <span className="gulp3d-banner text-4xl sm:text-5xl font-black sport-banner text-center" style={{ color: banner.color }}>
                {banner.title}
              </span>
              {banner.sub && <span className="gulp3d-banner mt-1 px-3 py-1 rounded-full bg-black/45 text-white text-sm font-black text-center">{banner.sub}</span>}
            </div>
          )}
          {hint && playing && (
            <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-4" data-testid="gulp3d-hint">
              <span className="gulp3d-hint px-4 py-2 rounded-2xl bg-slate-900/65 text-white text-sm font-black text-center">{hint}</span>
            </div>
          )}
          {phase === 'play' && hud && hud.t < 8 && !autopilot && (
            <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex justify-center px-4">
              <span className="gulp3d-hint px-4 py-2 rounded-2xl bg-white/80 text-slate-700 text-sm font-black text-center shadow">👆 Kéo ngón tay để dẫn Snorlax đi ăn!</span>
            </div>
          )}
          {phase === 'sleep' && (
            <div className="pointer-events-none absolute inset-x-0 top-[30%] z-30 flex justify-center px-4" data-testid="gulp3d-sleep">
              <span className="gulp3d-banner text-4xl font-black sport-banner text-sky-100">Zzz… No quá!</span>
            </div>
          )}

          {phase === 'ready' && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 px-4">
              <div className="result-rise w-full max-w-sm rounded-3xl bg-white/95 p-4 text-center shadow-2xl" data-testid="gulp3d-ready">
                <img src={SNORLAX_ART} alt="Snorlax" className="mx-auto w-20 h-20 object-contain gulp3d-float" draggable={false} />
                <p className="text-xl font-black text-slate-800">
                  {m.icon} {m.name}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-600">{m.tip}</p>
                <ul className="mt-2 text-left text-xs font-bold text-slate-600 space-y-0.5">
                  <li>👆 Kéo ngón tay ở đâu cũng được để dẫn Snorlax đi.</li>
                  <li>😋 Chạm vào đồ nhỏ hơn mình để nuốt. Đồ to quá thì lớn thêm đã!</li>
                  <li>🐭 Pokémon nhỏ chỉ được hít hít thôi – bạn ấy sẽ tặng quả mọng.</li>
                  <li>🍓 x2 điểm · 👟 chạy nhanh · 🧲 hút đồ ăn</li>
                </ul>
                <p className="mt-2 text-xs font-black text-amber-600">
                  ⭐ {fmtNum(m.stars[0])} · ⭐⭐ {fmtNum(m.stars[1])} · ⭐⭐⭐ {fmtNum(m.stars[2])}
                </p>
                {player?.name && (
                  <p className="mt-1 flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500">
                    {player.image && <img src={player.image} alt="" className="w-6 h-6 object-contain" draggable={false} />}
                    {player.name} cổ vũ Snorlax!
                  </p>
                )}
                <button onClick={() => setPhase('countdown')} className="mt-3 w-full py-3 rounded-2xl bg-gradient-to-b from-teal-400 to-teal-600 text-white text-xl font-black shadow-lg active:scale-95" data-testid="gulp3d-start">
                  Ăn thôi! 😋
                </button>
              </div>
            </div>
          )}
          {phase === 'countdown' && <Countdown text="ĂN NÀO!" onDone={() => setPhase('play')} />}

          {phase === 'result' && result && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 px-4" data-testid="gulp3d-result" data-stars={result.stars}>
              <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-teal-50 to-white p-4 text-center shadow-2xl flex flex-col items-center gap-2">
                <p className="result-rise text-2xl font-black text-slate-800">{RESULT_TITLE[result.stars]}</p>
                <div className="result-rise" style={{ animationDelay: '100ms' }}>
                  <StarRow stars={result.stars} size="w-12 h-12" animate />
                </div>
                <p className="result-rise text-3xl font-black text-amber-500 tabular-nums" style={{ animationDelay: '150ms' }} data-testid="gulp3d-final">
                  {fmtNum(result.score)} điểm
                </p>
                {result.isBest && <span className="px-3 py-0.5 rounded-full bg-amber-400 text-amber-950 text-xs font-black">🏆 Kỷ lục mới!</span>}
                <div className="result-rise grid grid-cols-2 gap-1.5 w-full text-sm font-black text-slate-700" style={{ animationDelay: '200ms' }}>
                  <span className="rounded-xl bg-emerald-100 px-2 py-1">🏙️ Đã ăn: {result.percent}%</span>
                  <span className="rounded-xl bg-sky-100 px-2 py-1">😋 {result.eaten} món</span>
                  <span className="rounded-xl bg-pink-100 px-2 py-1">🔥 Liên hoàn x{result.combo}</span>
                  <span className="rounded-xl bg-amber-100 px-2 py-1 truncate">🏆 {fmtNum(result.best)}</span>
                  {result.biggest && <span className="col-span-2 rounded-xl bg-violet-100 px-2 py-1 truncate">To nhất: {result.biggest}</span>}
                  {result.rival != null && (
                    <span className="col-span-2 rounded-xl bg-slate-100 px-2 py-1 flex items-center justify-center gap-1">
                      <img src={MUNCHLAX_ART} alt="" className="w-6 h-6 object-contain" draggable={false} />
                      Munchlax: {fmtNum(result.rival)} {result.score >= result.rival ? '– Snorlax thắng!' : '– lần sau nhé!'}
                    </span>
                  )}
                </div>
                {result.stars < 3 && <p className="text-xs font-bold text-slate-500">Lần tới: ăn đồ nhỏ thật nhanh để lớn sớm, rồi tìm đồ to hơn!</p>}
                {result.gold > 0 && (
                  <div className="result-rise" style={{ animationDelay: '260ms' }}>
                    <GoldReward amount={result.gold} />
                  </div>
                )}
                <div className="result-rise flex flex-wrap justify-center gap-2 mt-1" style={{ animationDelay: '340ms' }}>
                  <button onClick={() => begin(mapIndex)} className="px-4 py-2.5 rounded-2xl bg-teal-500 text-white text-base font-black flex items-center gap-1.5 shadow active:scale-95" data-testid="gulp3d-replay">
                    <RotateCcw className="w-5 h-5" /> Chơi lại
                  </button>
                  {hasNext && (
                    <button onClick={() => begin(mapIndex + 1)} className="px-4 py-2.5 rounded-2xl bg-emerald-500 text-white text-base font-black shadow active:scale-95" data-testid="gulp3d-next">
                      Bản đồ tiếp ➜
                    </button>
                  )}
                  <button onClick={toMaps} className="px-4 py-2.5 rounded-2xl bg-sky-600 text-white text-base font-black shadow active:scale-95">
                    Bản đồ
                  </button>
                </div>
              </div>
            </div>
          )}

          {phase === 'nogl' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-teal-400 to-sky-600 px-6" data-testid="gulp3d-nogl">
              <div className="max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
                <img src={SNORLAX_ART} alt="Snorlax" className="mx-auto w-24 h-24 object-contain" />
                <p className="mt-2 text-lg font-black text-slate-800">Ối! Máy này chưa vẽ được thế giới 3D.</p>
                <p className="mt-1 text-sm font-bold text-slate-600">Snorlax đang ngủ trưa. Bé thử trò chơi khác hoặc dùng máy khác nhé!</p>
                <button onClick={onClose} className="mt-3 px-6 py-2.5 rounded-2xl bg-teal-600 text-white text-base font-black shadow active:scale-95">
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
