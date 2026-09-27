import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { usePortrait, landscapeStyle } from '../moba/landscape';
import { useLoop, useLater } from '../sports/sportsKit';
import { castFx, impactFx, novaFx, styleBurst } from '../moba/skillFx';
import { createQuest, step, hudOf, switchLead, applyItem, quickHeal, buyItem, goToTown, travelTo, applyEvolution, setEvolutionPlan, SKILLS, ULT_MAX } from '../../utils/quest/engine';
import { saveQuest } from '../../utils/quest/save';
import { claimReward, ITEMS, RARITY } from '../../utils/quest/items';
import { apiPlan } from '../../utils/quest/species';
import { fetchEvolutionChain } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { createArt, drawGround, drawFog, prewarm } from './questArt';
import { createFx, drawScene, drawMinimap, tickFx, burstFx, sparkle, numberFx, ringFx, levelUpFx, typeColor } from './questDraw';
import { SkillButton, PartyBar, BossBar, LeadInfo } from './QuestHud';
import { BagPanel, ShopPanel, CenterPanel, BoardPanel } from './QuestPanels';
import { QuestEvolution } from './QuestEvolution';
import { GoldReward } from '../kidgames/Common';
import { itemIcon } from './questUi';

const SIM_DT = 1 / 60;
const VIEW_H = 470; // world units visible from top to bottom
const JOY_R = 55;
const SAVE_EVERY = 15;
const KEYMOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

/**
 * The quest itself (landscape, turns itself when the phone is upright).
 * start: { team } for a new journey or { save } to continue.
 */
export function QuestWorld({ start, random = Math.random, onGold, onExit }) {
  const portrait = usePortrait();
  const later = useLater();
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const [initial] = useState(() => createQuest({ ...start, random }));
  const stateRef = useRef(initial);
  const fxRef = useRef(null);
  const artRef = useRef({ area: null, art: null });
  const input = useRef({ joy: { x: 0, y: 0 }, keys: new Set(), cast: null });
  const camera = useRef({ x: 0, y: 0, snap: true });
  const acc = useRef(0);
  const clock = useRef({ time: 0, hudT: 0, saveT: 0, lastPop: 0, lastCoin: 0, spot: null, evoShown: false });
  const joyEl = useRef(null);
  const [hud, setHud] = useState(() => hudOf(initial));
  const [banner, setBanner] = useState(null);
  const [small, setSmall] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [panel, setPanel] = useState(null);
  const [evo, setEvo] = useState(null);
  const [actClear, setActClear] = useState(null);
  const [joyShow, setJoyShow] = useState(null);
  const [goldToast, setGoldToast] = useState(null);

  const refresh = () => setHud(hudOf(stateRef.current));
  const toast = (text, tone = 'gold') => {
    const id = Math.random();
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    later(() => setToasts((list) => list.filter((t) => t.id !== id)), 2400);
  };
  const say = (text, tone = 'gold') => {
    const id = Math.random();
    setSmall({ id, text, tone });
    later(() => setSmall((b) => (b?.id === id ? null : b)), 1800);
  };
  const payReward = () => {
    const pay = claimReward(stateRef.current.reward);
    if (pay > 0) {
      onGold?.(pay);
      setGoldToast({ id: Math.random(), amount: pay });
      later(() => setGoldToast(null), 3200);
    }
    return pay;
  };
  const save = () => saveQuest(stateRef.current);

  useEffect(() => {
    fxRef.current = createFx();
    const s = stateRef.current;
    setBanner({ id: 1, name: s.area.name, act: s.actDef.name, actNo: s.act + 1, kind: s.area.kind });
    save();
  }, []);

  // Evolution data from PokeAPI (cached); the built-in table is used until it arrives
  useEffect(() => {
    let alive = true;
    for (const m of stateRef.current.party) {
      if (!m.dex) continue;
      const key = m.key;
      const dex = m.dex;
      fetchEvolutionChain(dex)
        .then((nodes) => {
          if (!alive) return;
          const plan = apiPlan(nodes, dex);
          if (plan?.length && setEvolutionPlan(stateRef.current, key, plan)) setHud(hudOf(stateRef.current));
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, []);

  const exit = () => {
    save();
    payReward();
    onExit?.();
  };

  const pickLead = (i) => {
    if (switchLead(stateRef.current, i)) {
      sounds.playPop();
      refresh();
    }
  };
  const applyBag = (id) => {
    if (applyItem(stateRef.current, id)) {
      sounds.playMunch();
      if (id === 'stone') setPanel(null);
      refresh();
    }
  };
  const heal = () => {
    const id = quickHeal(stateRef.current);
    if (id) {
      sounds.playMunch();
      toast(`${itemIcon(id)} ${ITEMS[id].name}: cả đội hồi máu!`, 'green');
    } else sounds.playOops();
    refresh();
  };
  const town = () => {
    if (goToTown(stateRef.current, 'portal')) refresh();
  };

  // Keyboard (desktop)
  useEffect(() => {
    const down = (e) => {
      if (KEYMOVE[e.code]) {
        input.current.keys.add(e.code);
        e.preventDefault();
      } else if (e.code === 'KeyQ' || e.code === 'KeyJ') input.current.cast = 's1';
      else if (e.code === 'KeyE' || e.code === 'KeyK') input.current.cast = 's2';
      else if (e.code === 'KeyR' || e.code === 'Space') {
        input.current.cast = 'ult';
        e.preventDefault();
      } else if (e.code === 'KeyH') heal();
      else if (e.code === 'KeyB') setPanel((p) => (p === 'bag' ? null : 'bag'));
      else if (/^Digit[1-5]$/.test(e.code)) pickLead(Number(e.code.slice(5)) - 1);
      else if (e.code === 'Escape') setPanel(null);
    };
    const up = (e) => input.current.keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  // Floating joystick on the left of the screen (screen moves are turned back when the game is rotated)
  const toLocal = (dx, dy) => (portrait ? { x: dy, y: -dx } : { x: dx, y: dy });
  const onJoyDown = (e) => {
    const rect = stageRef.current.getBoundingClientRect();
    const local = portrait ? { x: (e.clientY - rect.top) / rect.height, y: (rect.right - e.clientX) / rect.width } : { x: (e.clientX - rect.left) / (rect.width || 1), y: (e.clientY - rect.top) / (rect.height || 1) };
    if (local.x > 0.5) return;
    joyEl.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY };
    setJoyShow({ x: local.x * 100, y: local.y * 100, dx: 0, dy: 0 });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onJoyMove = (e) => {
    const j = joyEl.current;
    if (!j || j.id !== e.pointerId) return;
    const d = toLocal(e.clientX - j.sx, e.clientY - j.sy);
    const len = Math.hypot(d.x, d.y);
    const k = len > JOY_R ? JOY_R / len : 1;
    input.current.joy = { x: (d.x * k) / JOY_R, y: (d.y * k) / JOY_R };
    setJoyShow((s) => (s ? { ...s, dx: d.x * k, dy: d.y * k } : s));
  };
  const onJoyUp = (e) => {
    if (joyEl.current?.id !== e.pointerId) return;
    joyEl.current = null;
    input.current.joy = { x: 0, y: 0 };
    setJoyShow(null);
  };

  const playEvents = (s, fx) => {
    const c = clock.current;
    let changed = false;
    const pop = () => {
      if (c.time - c.lastPop > 0.07) {
        c.lastPop = c.time;
        sounds.playPop();
      }
    };
    for (const e of s.events) {
      switch (e.kind) {
        case 'hit': {
          const col = typeColor(e.type);
          burstFx(fx, e.x, e.y + 8, col, { count: e.crit ? 9 : 4, speed: e.crit ? 230 : 150, size: e.crit ? 4.5 : 3.2, life: 0.45 });
          styleBurst(fx, e.type, e.x, e.y + 8, { count: e.crit ? 8 : 3, speed: 180, size: 3.5, life: 0.45 });
          numberFx(fx, e.x, e.boss ? e.y - 30 : e.y, `${e.crit ? '💥' : ''}${e.amount}`, e.crit ? '#fde047' : e.eff >= 2 ? '#fb923c' : '#ffffff', e.crit ? 24 : e.eff >= 2 ? 20 : 16, 0.9, e.boss ? 120 : 16);
          fx.flash[`e${e.target}`] = 1;
          pop();
          break;
        }
        case 'hurt':
          numberFx(fx, e.x, e.y, `-${e.amount}`, '#f87171', e.crit ? 20 : 15, 0.8);
          fx.flash[`p${e.idx}`] = 1;
          break;
        case 'cast':
          castFx(fx, e.type, e.x, e.y, { x: e.dx, y: e.dy });
          if (!e.quiet) sounds.playWhoosh();
          break;
        case 'nova':
          novaFx(fx, e.type, e.x, e.y, e.r);
          sounds.playWhoosh();
          break;
        case 'ult':
          ringFx(fx, e.x, e.y, typeColor(e.type), 10, 140, 0.6, 14, true);
          sparkle(fx, e.x, e.y - 30, ['#ffffff', typeColor(e.type), '#fde047'], 30, 260);
          say(`⚡ ${e.name}!`, 'blue');
          sounds.playEnergySurge();
          break;
        case 'ult-pulse':
          novaFx(fx, e.type, e.x, e.y, e.r);
          ringFx(fx, e.x, e.y, e.last ? '#ffffff' : typeColor(e.type), 20, e.r, 0.5, e.last ? 14 : 8, e.last);
          if (e.last) burstFx(fx, e.x, e.y - 20, typeColor(e.type), { count: 40, speed: 380, size: 5, life: 0.8 });
          break;
        case 'slash':
          fx.slashes.push({ x: e.x, y: e.y, dx: e.dx, dy: e.dy, color: typeColor(e.type), life: 0.22, max: 0.22 });
          styleBurst(fx, e.type, e.x, e.y, { count: 4, speed: 160, size: 3, life: 0.35 });
          break;
        case 'bite':
          fx.slashes.push({ x: e.x, y: e.y, dx: 0, dy: 1, color: '#f87171', life: 0.2, max: 0.2 });
          if (e.big) ringFx(fx, e.x, e.y + 14, '#fca5a5', 10, 60, 0.35, 6);
          break;
        case 'pop':
          if (e.big) impactFx(fx, e.type, e.x, e.y);
          else burstFx(fx, e.x, e.y, e.side === 'enemy' ? '#fb7185' : typeColor(e.type), { count: 4, speed: 110, size: 3, life: 0.3 });
          fx.trails.delete(e.id);
          break;
        case 'ko':
          burstFx(fx, e.x, e.y - 20, typeColor(e.type), { count: e.elite ? 40 : 20, speed: e.elite ? 320 : 240, size: 4.5, life: 0.7 });
          sparkle(fx, e.x, e.y - 20, ['#ffffff', '#fde047'], e.elite ? 20 : 8, 160);
          ringFx(fx, e.x, e.y, '#ffffff', 8, e.elite ? 90 : 55, 0.4, 5);
          if (e.elite) {
            toast(`👑 Hạ ${e.name} đầu đàn!`, 'gold');
            sounds.playSuccessFanfare();
          } else pop();
          changed = true;
          break;
        case 'faint':
          fx.balls.push({ from: { x: e.x, y: e.y - 20 }, to: { x: s.trainer.x, y: s.trainer.y - 20 }, t: 0, dur: 0.6 });
          ringFx(fx, e.x, e.y, '#f87171', 10, 60, 0.45, 6);
          burstFx(fx, e.x, e.y - 20, '#fecaca', { count: 16, speed: 180, size: 4 });
          toast(`💤 ${e.name} mệt rồi, về bóng nghỉ`, 'red');
          sounds.playOops();
          changed = true;
          break;
        case 'levelup': {
          const m = s.party[e.idx];
          const at = m && !m.fainted ? m : s.trainer;
          levelUpFx(fx, at.x, at.y, e.level);
          toast(`⭐ ${e.name} LÊN CẤP ${e.level}!`, 'gold');
          sounds.playNote(660, { duration: 0.15, volume: 0.12 });
          sounds.playNote(880, { duration: 0.15, delay: 0.1, volume: 0.12 });
          sounds.playNote(1320, { duration: 0.3, delay: 0.2, volume: 0.12 });
          changed = true;
          break;
        }
        case 'evolved': {
          const m = s.party[e.idx];
          fx.beams.push({ x: m.x, y: m.y + 12, life: 1.2, max: 1.2, color: '#ffffff', w: 44, h: 280 });
          sparkle(fx, m.x, m.y - 30, ['#ffffff', '#fde047', '#a5f3fc'], 40, 260);
          changed = true;
          break;
        }
        case 'drop':
          if (e.rarity === 'rare' || e.rarity === 'epic') sparkle(fx, e.x, e.y - 10, [RARITY[e.rarity].color, '#ffffff'], 14, 150);
          break;
        case 'pickup':
          if (e.coin) {
            numberFx(fx, e.x, e.y, `+${e.amount} 🪙`, '#fde047', 16, 0.9);
            if (c.time - c.lastCoin > 0.12) {
              c.lastCoin = c.time;
              sounds.playCoin();
            }
          } else {
            numberFx(fx, e.x, e.y - 14, `+1 ${e.name}`, RARITY[e.rarity]?.color || '#ffffff', 16, 1.2);
            sparkle(fx, e.x, e.y + 20, [RARITY[e.rarity]?.color || '#ffffff', '#ffffff'], 12, 140);
            if (e.rarity !== 'common') toast(`${itemIcon(e.item)} Nhặt được ${e.name}!`, e.rarity === 'epic' ? 'purple' : 'blue');
            sounds.playCoin();
          }
          changed = true;
          break;
        case 'chest':
          ringFx(fx, e.x, e.y, '#fde047', 10, 90, 0.6, 8, true);
          sparkle(fx, e.x, e.y - 20, ['#fde047', '#ffffff', '#fbbf24'], 30, 240);
          toast('🎁 Mở rương báu!', 'gold');
          sounds.playEnergySurge();
          break;
        case 'area':
          artRef.current = { area: null, art: null };
          camera.current.snap = true;
          fx.particles.length = 0;
          fx.trails.clear();
          fx.novas.length = 0;
          setBanner({ id: Math.random(), name: e.name, act: e.actName, actNo: e.act + 1, kind: e.areaKind });
          setPanel(null);
          clock.current.spot = null;
          fx.beams.push({ x: s.trainer.x, y: s.trainer.y + 10, life: 0.8, max: 0.8, color: '#7dd3fc', w: 40, h: 220 });
          save();
          if (e.areaKind === 'town') payReward();
          changed = true;
          break;
        case 'portal':
          sounds.playWhoosh();
          break;
        case 'heal':
          for (const m of s.party) {
            ringFx(fx, m.x, m.y + 10, '#4ade80', 6, 44, 0.6, 5, true);
            sparkle(fx, m.x, m.y - 20, ['#86efac', '#ffffff', '#f9a8d4'], 8, 120);
          }
          if (e.full) sounds.playSuccessFanfare();
          changed = true;
          break;
        case 'revive':
          fx.beams.push({ x: e.x, y: e.y + 12, life: 0.8, max: 0.8, color: '#fde047', w: 30, h: 200 });
          sparkle(fx, e.x, e.y - 20, ['#fde047', '#ffffff'], 16, 160);
          changed = true;
          break;
        case 'use':
          ringFx(fx, e.x, e.y + 10, '#86efac', 8, 70, 0.5, 6, true);
          changed = true;
          break;
        case 'buy':
          sounds.playCoin();
          changed = true;
          break;
        case 'spot':
          sounds.playPop();
          break;
        case 'poof':
          burstFx(fx, e.x, e.y - 16, '#e2e8f0', { count: 10, speed: 120, size: 5, life: 0.5 });
          break;
        case 'lead':
          if (e.auto) toast(`${s.party[e.idx].name} dẫn đầu!`, 'blue');
          changed = true;
          break;
        case 'boss-wake':
          setBanner({ id: Math.random(), name: e.title, act: 'Boss xuất hiện!', boss: true });
          sounds.playEnergySurge();
          changed = true;
          break;
        case 'boss-warn':
          sounds.playScanBeep();
          break;
        case 'boss-slam':
          ringFx(fx, e.x, e.y, '#fecaca', 20, e.r, 0.5, 16, true);
          ringFx(fx, e.x, e.y, typeColor(e.type), 10, e.r * 0.7, 0.35, 10);
          styleBurst(fx, e.type, e.x, e.y, { count: 40, speed: 380, size: 5, life: 0.7 });
          sounds.playEnergySurge();
          break;
        case 'boss-meteor':
          ringFx(fx, e.x, e.y, '#fb923c', 10, e.r, 0.4, 12, true);
          styleBurst(fx, e.type, e.x, e.y, { count: 22, speed: 300, size: 5, life: 0.6 });
          pop();
          break;
        case 'boss-charge':
          say(`${e.name} lao tới!`, 'red');
          sounds.playWhoosh();
          break;
        case 'boss-ring':
          ringFx(fx, e.x, e.y - 20, typeColor(e.type), 30, 140, 0.45, 10);
          sounds.playWhoosh();
          break;
        case 'boss-enrage':
          say('BOSS NỔI GIẬN! 🔥', 'red');
          ringFx(fx, e.x, e.y - 20, '#ef4444', 40, 220, 0.7, 14, true);
          sounds.playEnergySurge();
          break;
        case 'boss-summon':
          say(`${e.name} gọi đồng bọn!`, 'red');
          break;
        case 'boss-down':
          burstFx(fx, e.x, e.y - 30, '#fde047', { count: 90, speed: 480, size: 6, life: 1.2 });
          sparkle(fx, e.x, e.y - 40, ['#fde047', '#ffffff', '#f472b6', '#60a5fa'], 60, 380);
          ringFx(fx, e.x, e.y - 30, '#ffffff', 20, 300, 0.9, 18, true);
          sounds.playSuccessFanfare();
          changed = true;
          break;
        case 'act-clear': {
          const info = e;
          save();
          later(() => {
            const gold = payReward();
            setActClear({ ...info, gold });
            try {
              confetti({ particleCount: 160, spread: 100, origin: { y: 0.4 }, zIndex: 9999 });
            } catch {
              // decoration
            }
          }, 1600);
          break;
        }
        case 'wipe':
          sounds.playOops();
          changed = true;
          break;
        case 'wiped-home':
          toast('💖 Cả đội đã được chữa lành ở Trung tâm Pokémon!', 'green');
          changed = true;
          break;
        default:
          break;
      }
    }
    s.events.length = 0;
    return changed;
  };

  const paused = !!evo || panel === 'bag' || !!actClear;

  useLoop((rawDt) => {
    const s = stateRef.current;
    const fx = fxRef.current;
    if (!fx) return;
    const c = clock.current;
    c.time += rawDt;
    let changed = false;
    if (!paused) {
      acc.current += rawDt;
      let guard = 0;
      while (acc.current >= SIM_DT && guard++ < 5) {
        acc.current -= SIM_DT;
        const k = input.current.keys;
        let mx = input.current.joy.x;
        let my = input.current.joy.y;
        for (const code of k) {
          mx += KEYMOVE[code][0];
          my += KEYMOVE[code][1];
        }
        const len = Math.hypot(mx, my);
        if (len > 1) {
          mx /= len;
          my /= len;
        }
        step(s, SIM_DT, { move: { x: mx, y: my }, cast: input.current.cast });
        input.current.cast = null;
        if (playEvents(s, fx)) changed = true;
        if (s.pendingEvolution) break;
      }
      if (acc.current > SIM_DT * 5) acc.current = 0;
      c.saveT += rawDt;
      if (c.saveT > SAVE_EVERY) {
        c.saveT = 0;
        save();
      }
    } else acc.current = 0;
    if (s.events.length && playEvents(s, fx)) changed = true;
    // An evolution waits for its sequence
    if (s.pendingEvolution && !c.evoShown) {
      c.evoShown = true;
      setEvo({ ...s.pendingEvolution, id: Math.random() });
    }
    // Town panels open when the trainer walks onto the door mat
    if (s.townSpot !== c.spot) {
      const before = c.spot;
      c.spot = s.townSpot;
      if (s.townSpot) setPanel(s.townSpot);
      else if (before) setPanel((p) => (p === before ? null : p));
    }
    c.hudT += rawDt;
    if (changed || c.hudT > 0.1) {
      c.hudT = 0;
      setHud(hudOf(s));
    }
    tickFx(fx, rawDt);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return;
    const cw = canvas.clientWidth || 800;
    const ch = canvas.clientHeight || 450;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    if (artRef.current.area !== s.area) {
      const art = createArt(s.area);
      if (art) prewarm(art, s.trainer.x, s.trainer.y);
      artRef.current = { area: s.area, art };
    }
    const art = artRef.current.art;
    const area = s.area;
    const scale = ch / (area.kind === 'town' ? VIEW_H * 1.2 : VIEW_H);
    const view = { w: cw / scale, h: ch / scale };
    const cam = camera.current;
    const clampX = (x) => (area.w <= view.w ? (area.w - view.w) / 2 : Math.max(0, Math.min(area.w - view.w, x)));
    const clampY = (y) => (area.h <= view.h ? (area.h - view.h) / 2 : Math.max(0, Math.min(area.h - view.h, y)));
    const tx = clampX(s.trainer.x - view.w / 2);
    const ty = clampY(s.trainer.y - 20 - view.h / 2);
    if (cam.snap) {
      cam.x = tx;
      cam.y = ty;
      cam.snap = false;
    } else {
      const k = Math.min(1, rawDt * 7);
      cam.x += (tx - cam.x) * k;
      cam.y += (ty - cam.y) * k;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = art?.theme.bg || '#0f172a';
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-cam.x, -cam.y);
    if (art) drawGround(ctx, art, cam, view);
    drawScene(ctx, s, fx, c.time, paused ? 0 : rawDt, { cam, w: view.w, h: view.h });
    if (art && area.kind !== 'town' && area.kind !== 'lair') drawFog(ctx, art, s.fog);
    ctx.restore();
    // Dungeons are a little darker round the edges (the light follows the trainer)
    if (area.kind === 'dungeon') {
      const sx = (s.trainer.x - cam.x) * scale;
      const sy = (s.trainer.y - 20 - cam.y) * scale;
      const vg = ctx.createRadialGradient(sx, sy, ch * 0.3, sx, sy, Math.max(cw, ch) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (art) {
      drawMinimap(ctx, s, art, cw - 158, 50, 150, 104, c.time);
    }
  }, true);

  const lead = hud.party[hud.lead];
  const inTown = hud.areaKind === 'town';
  const moveColor = typeColor(lead?.types[0]);

  return (
    <div className="fixed inset-0 z-[80] bg-black select-none touch-none" role="dialog" aria-label="Hành trình Huấn luyện viên" data-testid="quest-world" data-area={`${hud.act}-${hud.areaIdx}`} data-x={hud.x} data-y={hud.y} data-portrait={portrait}>
      <div ref={stageRef} style={landscapeStyle(portrait)} className="overflow-hidden" onPointerDown={onJoyDown} onPointerMove={onJoyMove} onPointerUp={onJoyUp} onPointerCancel={onJoyUp} data-testid="quest-stage">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" data-testid="quest-canvas" />

        {/* Top left: the team, gold and where we are */}
        <div className="absolute top-2 left-2 flex flex-col items-start gap-1.5">
          <PartyBar party={hud.party} lead={hud.lead} onPick={pickLead} />
          <div className="flex items-center gap-1.5 pointer-events-none">
            <span className="px-2 py-0.5 rounded-full bg-slate-950/75 border border-amber-300/40 text-xs font-black text-amber-200 tabular-nums" data-testid="quest-gold">
              🪙 {hud.gold}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-950/75 text-[10px] font-black text-white/90 truncate max-w-[210px]" data-testid="quest-area-name">
              Màn {hud.act + 1} · {hud.areaName}
            </span>
          </div>
        </div>

        {/* Top right: bag, town, exit (the minimap is drawn under them) */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <button type="button" onPointerDown={(e) => { e.stopPropagation(); setPanel((p) => (p === 'bag' ? null : 'bag')); }} aria-label="Túi đồ" data-testid="quest-bag-btn" className="h-9 px-2.5 rounded-full bg-slate-950/75 border border-white/25 text-white text-sm font-black active:scale-90">
            🎒
          </button>
          {!inTown && (
            <button type="button" onPointerDown={(e) => { e.stopPropagation(); town(); }} aria-label="Về làng" data-testid="quest-town-btn" className="h-9 px-2.5 rounded-full bg-slate-950/75 border border-white/25 text-white text-xs font-black active:scale-90">
              🏠 Về làng
            </button>
          )}
          <button type="button" onPointerDown={(e) => { e.stopPropagation(); exit(); }} aria-label="Lưu và thoát" data-testid="quest-exit" className="h-9 px-3 rounded-full bg-slate-950/75 border border-white/25 text-white text-xs font-black active:scale-90">
            ✕ Thoát
          </button>
        </div>

        {hud.boss && (
          <div className="absolute top-2 left-[312px] right-[250px] min-w-[150px]">
            <BossBar boss={hud.boss} />
          </div>
        )}

        {/* Joystick */}
        {joyShow ? (
          <div className="absolute w-[120px] h-[120px] -ml-[60px] -mt-[60px] rounded-full border-4 border-white/40 bg-white/10 pointer-events-none" style={{ left: `${joyShow.x}%`, top: `${joyShow.y}%` }}>
            <span className="absolute left-1/2 top-1/2 w-14 h-14 -ml-7 -mt-7 rounded-full bg-white/70 shadow-xl" style={{ transform: `translate(${joyShow.dx}px, ${joyShow.dy}px)` }} />
          </div>
        ) : (
          <div className="absolute left-6 bottom-6 w-[110px] h-[110px] rounded-full border-4 border-dashed border-white/30 flex items-center justify-center text-white/60 text-xs font-black pointer-events-none">
            Kéo để đi
          </div>
        )}

        {/* Bottom right: items, skills of the lead, the team ultimate */}
        <div className="absolute right-3 bottom-3 flex items-end gap-2.5" data-testid="quest-skills">
          <div className="flex flex-col gap-2 mb-1">
            {hud.anyFainted && hud.inventory.revive > 0 && (
              <button type="button" onPointerDown={(e) => { e.stopPropagation(); applyBag('revive'); }} aria-label="Hồi sinh" data-testid="quest-revive" className="pop-in relative w-12 h-12 rounded-full bg-gradient-to-b from-amber-300 to-orange-500 border-2 border-white/80 text-xl shadow-lg active:scale-90">
                💎
                <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-slate-900 text-[10px] font-black text-white">{hud.inventory.revive}</span>
              </button>
            )}
            <button type="button" onPointerDown={(e) => { e.stopPropagation(); heal(); }} aria-label="Hồi máu" data-testid="quest-heal" className="relative w-12 h-12 rounded-full bg-gradient-to-b from-fuchsia-400 to-purple-700 border-2 border-white/70 text-xl shadow-lg active:scale-90">
              🧪
              <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-slate-900 text-[10px] font-black text-white">{(hud.inventory.berry || 0) + (hud.inventory.potion || 0) + (hud.inventory.superPotion || 0)}</span>
            </button>
          </div>
          {!inTown && lead && (
            <>
              <div className="flex flex-col gap-2 mb-1">
                <SkillButton label="1" name={hud.moves[0]} cd={hud.cd.s1} max={SKILLS.s1.cd} ready={hud.cd.s1 <= 0 && !lead.fainted} color={moveColor} onPress={() => (input.current.cast = 's1')} testId="quest-s1" keyHint="Q" />
                <SkillButton label="2" name={hud.moves[1]} cd={hud.cd.s2} max={SKILLS.s2.cd} ready={hud.cd.s2 <= 0 && !lead.fainted} color={moveColor} onPress={() => (input.current.cast = 's2')} testId="quest-s2" keyHint="E" />
              </div>
              <SkillButton label="⚡" name={hud.moves[2]} big ready={hud.ultReady} charge={hud.ult / ULT_MAX} color={hud.ultReady ? '#f59e0b' : '#64748b'} onPress={() => (input.current.cast = 'ult')} testId="quest-ult" keyHint="R" />
            </>
          )}
        </div>
        {!inTown && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-2 hidden sm:block">
            <LeadInfo member={lead} />
          </div>
        )}

        {/* Area banner (entering an area, boss appearing) */}
        {banner && (
          <div key={banner.id} className="quest-area-banner absolute left-1/2 top-[26%] z-30 pointer-events-none text-center" data-testid="quest-banner">
            <span className={`block text-xs sm:text-sm font-black tracking-widest uppercase ${banner.boss ? 'text-rose-200' : 'text-amber-200'}`}>{banner.boss ? banner.act : `Màn ${banner.actNo} · ${banner.act}`}</span>
            <span className={`block text-3xl sm:text-4xl font-black text-white sport-banner whitespace-nowrap ${banner.boss ? 'quest-boss-title' : ''}`}>{banner.name}</span>
            {banner.kind === 'town' && <span className="block mt-1 text-xs font-bold text-white/85">🏥 Trung tâm Pokémon · 🛒 Cửa hàng · 🗺️ Bảng hành trình</span>}
          </div>
        )}
        {small && (
          <div key={small.id} className="absolute z-30 left-1/2 -translate-x-1/2 top-[74px] pointer-events-none">
            <span className={`pop-in block px-3 py-1 rounded-full text-xs sm:text-sm border border-white/70 text-white font-black whitespace-nowrap shadow-xl bg-gradient-to-r ${small.tone === 'blue' ? 'from-sky-400 to-blue-700' : small.tone === 'red' ? 'from-rose-500 to-red-800' : 'from-amber-300 to-orange-600'}`}>{small.text}</span>
          </div>
        )}

        {/* Toasts: level ups, items, faints */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-11 z-30 flex flex-col items-center gap-1 pointer-events-none" data-testid="quest-toasts">
          {toasts.map((t) => (
            <span key={t.id} className={`quest-toast px-3 py-1 rounded-full text-xs font-black text-white shadow-lg whitespace-nowrap ${t.tone === 'red' ? 'bg-rose-600/90' : t.tone === 'green' ? 'bg-emerald-600/90' : t.tone === 'blue' ? 'bg-sky-600/90' : t.tone === 'purple' ? 'bg-fuchsia-600/90' : 'bg-amber-500/95 text-slate-900'}`} data-testid={t.text.includes('LÊN CẤP') ? 'quest-levelup' : undefined}>
              {t.text}
            </span>
          ))}
        </div>
        {goldToast && (
          <div key={goldToast.id} className="absolute left-2 top-[100px] z-30 pointer-events-none pop-in" data-testid="quest-reward">
            <GoldReward amount={goldToast.amount} dark />
          </div>
        )}

        {/* Panels */}
        {panel === 'bag' && <BagPanel hud={hud} onUse={applyBag} onClose={() => setPanel(null)} />}
        {panel === 'shop' && inTown && <ShopPanel hud={hud} onBuy={(id) => buyItem(stateRef.current, id) && refresh()} onClose={() => setPanel(null)} />}
        {panel === 'center' && inTown && <CenterPanel hud={hud} onClose={() => setPanel(null)} />}
        {panel === 'board' && inTown && (
          <BoardPanel
            hud={hud}
            onTravel={(i) => {
              if (travelTo(stateRef.current, i)) refresh();
            }}
            onClose={() => setPanel(null)}
          />
        )}

        {hud.wipe && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/70 pointer-events-none" data-testid="quest-wipe">
            <span className="quest-area-banner-static text-5xl">💤</span>
            <p className="pop-in mt-2 px-6 text-center text-xl sm:text-2xl font-black text-white">Cả đội mệt rồi! Về Trung tâm Pokémon nghỉ nhé</p>
            <p className="mt-1 text-sm font-bold text-white/80">Không sao đâu, đồ và cấp độ vẫn giữ nguyên 💖</p>
          </div>
        )}

        {evo && (
          <QuestEvolution
            key={evo.id}
            evo={evo}
            onDone={() => {
              const s = stateRef.current;
              applyEvolution(s);
              clock.current.evoShown = false;
              playEvents(s, fxRef.current);
              setEvo(null);
              toast(`✨ ${evo.fromName} → ${evo.toName}!`, 'purple');
              save();
              refresh();
            }}
          />
        )}

        {actClear && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3" role="dialog" aria-label="Hoàn thành màn" data-testid="quest-act-clear" onPointerDown={(e) => e.stopPropagation()}>
            <div className="pop-in max-w-md w-full rounded-3xl border-4 border-amber-300 bg-gradient-to-b from-amber-500/30 via-slate-900 to-slate-950 p-4 text-center shadow-2xl">
              <p className="text-5xl">🏆</p>
              <p className="sport-banner text-2xl sm:text-3xl font-black text-amber-200">{actClear.final ? 'HOÀN THÀNH HÀNH TRÌNH!' : `HOÀN THÀNH MÀN ${actClear.act + 1}!`}</p>
              <p className="mt-1 text-sm font-bold text-white/85">{actClear.final ? 'Bé là Huấn luyện viên huyền thoại! Mewtwo đã chịu thua 🌟' : `Bé đã vượt qua ${actClear.name}.`}</p>
              {actClear.next && <p className="mt-1 text-sm font-black text-sky-300">🔓 Mở ra: {actClear.next} – đi vào cổng vàng nhé!</p>}
              {actClear.gold > 0 && (
                <div className="mt-3 flex justify-center">
                  <GoldReward amount={actClear.gold} dark />
                </div>
              )}
              <button type="button" onClick={() => setActClear(null)} className="mt-4 px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 text-lg font-black shadow-lg active:scale-95">
                Tiếp tục
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
