import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, Lock } from '../icons/PokeIcons';
import { StarRow, GoldReward } from '../kidgames/Common';
import { sounds } from '../../utils/soundEffects';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { TD_W as W, TD_H as H, LEVELS, THEMES } from '../../utils/towerdef/levels';
import { LINES, LINE_IDS, HERO, lineUnlocked } from '../../utils/towerdef/towers';
import { createGame, step, snap, build, evolve, sell, callWave, collectCandy, feedCandy, starsFor, canBuild } from '../../utils/towerdef/engine';
import { loadProgress, saveResult, levelOpen, totalStars, goldFor } from '../../utils/towerdef/progress';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, burst } from '../sports/sportsKit';
import { drawFrame, LINE_COLOR } from './tdDraw';

const TAP_R = 28;
const EVO_MS = 2600;
const LEVEL_GRADIENT = {
  forest: 'from-emerald-400 to-green-700',
  beach: 'from-sky-300 to-amber-300',
  cave: 'from-stone-400 to-stone-700',
  city: 'from-lime-400 to-slate-500',
  volcano: 'from-orange-500 to-red-800',
  snow: 'from-sky-100 to-blue-300',
  rocket: 'from-slate-500 to-rose-900',
  indigo: 'from-violet-400 to-purple-900',
};
const HIT_COLOR = { fire: ['#fde047', '#fb923c', '#ffffff'], water: ['#93c5fd', '#3b82f6', '#ffffff'], grass: ['#86efac', '#22c55e', '#a855f7'], electric: ['#fde047', '#ffffff', '#facc15'], psychic: ['#f0abfc', '#d946ef', '#ffffff'], hero: ['#fde047', '#ffffff', '#fbbf24'] };

const newFx = () => ({ particles: [], floats: [], attacks: [], recoil: new Map(), time: 0, dt: 0, centerHurt: 0, selected: null, lastSound: {} });

function LevelSelect({ progress, onPlay }) {
  const next = LEVELS.findIndex((l, i) => levelOpen(progress, i) && !progress.stars[i]);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-6" data-testid="td-map">
      <div className="flex items-center justify-between mb-2">
        <p className="text-lg font-black text-white">Chọn màn bảo vệ</p>
        <span className="px-3 py-1 rounded-full bg-white/15 text-sm font-black text-amber-300">⭐ {totalStars(progress)}/{LEVELS.length * 3}</span>
      </div>
      <p className="mb-3 text-xs font-bold text-white/80 leading-snug">Team Rocket thả Pokémon hoang tới phá Trung tâm Pokémon! Đặt Pokémon lên ô Poké Ball ✨, đánh để tích Năng lượng rồi cho chúng tiến hóa!</p>
      <div className="grid grid-cols-2 gap-2.5">
        {LEVELS.map((lv, i) => {
          const open = levelOpen(progress, i);
          const stars = Number(progress.stars[i]) || 0;
          return (
            <button
              key={lv.id}
              type="button"
              onClick={() => open && onPlay(i)}
              disabled={!open}
              aria-label={open ? `Màn ${i + 1}: ${lv.name}` : `Màn ${i + 1} (chưa mở)`}
              data-testid={`td-level-${i + 1}`}
              className={`relative overflow-hidden rounded-2xl p-2.5 text-left shadow-lg border-2 transition-transform ${open ? `bg-gradient-to-br ${LEVEL_GRADIENT[lv.theme]} border-white/70 active:scale-95` : 'bg-slate-700 border-slate-600 opacity-70'} ${i === next ? 'ring-4 ring-amber-300 hint-pulse' : ''}`}
            >
              <span className="block text-[11px] font-black text-white/90 drop-shadow">Màn {i + 1} · {lv.waves.length} đợt</span>
              <span className="block text-sm font-black text-white drop-shadow leading-tight">{lv.name}</span>
              <span className="block text-[11px] font-bold text-white/85">{THEMES[lv.theme].name}</span>
              <span className="mt-1 flex items-center justify-between">
                {open ? <StarRow stars={stars} size="w-4 h-4" /> : <Lock className="w-5 h-5 text-white/80" />}
                {i === LEVELS.length - 1 && <img src={artworkUrl(150)} alt="" className="w-9 h-9 object-contain drop-shadow" draggable={false} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EnergyBar({ value, need, full }) {
  const k = need ? Math.min(1, value / need) : 1;
  return (
    <div className="w-full h-3 rounded-full bg-slate-900/70 overflow-hidden border border-white/30" aria-label={`Năng lượng tiến hóa ${Math.round(k * 100)}%`}>
      <div className={`h-full rounded-full transition-[width] duration-200 ${full ? 'bg-gradient-to-r from-violet-500 via-amber-300 to-yellow-200 td-glow' : 'bg-gradient-to-r from-violet-500 to-sky-400'}`} style={{ width: `${k * 100}%` }} />
    </div>
  );
}

function BuildMenu({ ui, level, player, onBuild }) {
  const options = [...LINE_IDS, 'hero'];
  return (
    <div className="grid grid-cols-3 gap-1.5" data-testid="td-build-menu">
      {options.map((line) => {
        const hero = line === 'hero';
        const L = hero ? null : LINES[line];
        const locked = !hero && !lineUnlocked(line, level);
        const used = hero && ui.heroUsed;
        const cost = hero ? 0 : L.cost;
        const afford = ui.coins >= cost;
        const ok = !locked && !used && afford;
        const name = hero ? player.name : L.stages[0].name;
        return (
          <button
            key={line}
            type="button"
            disabled={!ok}
            onClick={() => onBuild(line)}
            data-testid={`td-build-${line}`}
            aria-label={`Đặt ${name}${hero ? ' (miễn phí)' : ` (${cost} xu)`}`}
            className={`relative flex items-center gap-1 rounded-xl px-1 py-1 border-2 text-left transition-transform ${ok ? 'bg-white/95 border-white active:scale-95' : 'bg-white/40 border-white/30 opacity-60'}`}
            style={ok ? { boxShadow: `0 0 0 2px ${LINE_COLOR[line]} inset` } : undefined}
          >
            <img src={hero ? player.image : artworkUrl(L.stages[0].dex)} alt="" className="w-9 h-9 shrink-0 object-contain" draggable={false} />
            <span className="min-w-0">
              <span className="block text-[11px] font-black text-slate-800 truncate">{name}</span>
              <span className="block text-[10px] font-black text-amber-700">{locked ? `🔒 Màn ${L.unlock + 1}` : hero ? (used ? 'Đã dùng' : '⭐ Miễn phí') : `🪙 ${cost}`}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TowerCard({ tower, ui, player, onEvolve, onSell, onCandy, onClose }) {
  const hero = tower.line === 'hero';
  const line = hero ? HERO : LINES[tower.line];
  const nextName = !hero && tower.stage < 2 ? line.stages[tower.stage + 1].name : null;
  const img = hero ? player.image : artworkUrl(tower.dex);
  const canPay = ui.coins >= tower.cost;
  return (
    <div className="flex items-center gap-2" data-testid="td-tower-panel" data-name={tower.name} data-stage={tower.stage} aria-label={`${tower.name} – ${hero ? `${tower.stage + 1} sao` : `dạng ${tower.stage + 1}`}`}>
      <div className={`relative w-14 h-14 shrink-0 rounded-2xl bg-white/90 flex items-center justify-center ${tower.full ? 'td-glow' : ''}`}>
        <img src={img} alt={tower.name} className="w-12 h-12 object-contain" draggable={false} />
        {hero && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-black text-amber-500 drop-shadow">{'★'.repeat(tower.stage + 1)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-white truncate" data-testid="td-tower-name">
          {tower.name} {nextName && <span className="text-[11px] text-white/70">→ {nextName}</span>}
          {hero && tower.stage < 2 && <span className="text-[11px] text-white/70"> → ★{tower.stage + 2}</span>}
        </p>
        {tower.stage < 2 ? (
          <>
            <p className="text-[10px] font-bold text-white/75">Năng lượng tiến hóa {tower.full ? '– ĐẦY! ✨' : ''}</p>
            <EnergyBar value={tower.energy} need={tower.need} full={tower.full} />
          </>
        ) : (
          <p className="text-[11px] font-black text-amber-300">{hero ? '★★★ Mạnh nhất!' : 'Đã tiến hóa hết! 🌟'}</p>
        )}
        <div className="mt-1 flex gap-1.5">
          {tower.stage < 2 && (
            <button
              type="button"
              disabled={!tower.full || !canPay}
              onClick={onEvolve}
              data-testid="td-evolve"
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black shadow ${tower.full && canPay ? 'bg-gradient-to-r from-amber-300 to-pink-400 text-slate-900 td-glow active:scale-95' : 'bg-slate-600 text-white/60'}`}
            >
              {hero ? 'Lên sao!' : 'Tiến hóa!'} 🪙{tower.cost}
            </button>
          )}
          {ui.candies > 0 && tower.stage < 2 && !tower.full && (
            <button type="button" onClick={onCandy} data-testid="td-candy-use" className="px-2 py-1.5 rounded-xl bg-sky-400 text-slate-900 text-xs font-black shadow active:scale-95">
              🍬 Kẹo hiếm
            </button>
          )}
          <button type="button" onClick={onSell} data-testid="td-sell" className="px-2 py-1.5 rounded-xl bg-white/20 text-white text-xs font-black active:scale-95">
            Bán +{tower.sell}
          </button>
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Đóng bảng" className="self-start p-1 rounded-full bg-white/20 text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function EvolutionOverlay({ evo }) {
  return (
    <div key={evo.id} className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-slate-950/55" data-testid="td-evolution">
      <div className="td-evo-rays absolute w-[150%] aspect-square" />
      <div className="relative w-44 h-44">
        <img src={evo.fromImg} alt="" className="td-evo-old absolute inset-0 w-full h-full object-contain" draggable={false} />
        <img src={evo.toImg} alt={evo.to} className="td-evo-new absolute inset-0 w-full h-full object-contain drop-shadow-2xl" draggable={false} />
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="td-evo-spark absolute left-1/2 top-1/2 text-xl" style={{ '--a': `${i * 36}deg`, animationDelay: `${1300 + (i % 4) * 60}ms` }}>
            ✨
          </span>
        ))}
      </div>
      <div className="td-evo-flash absolute inset-0 bg-white" />
      <p className="td-evo-title absolute bottom-[14%] inset-x-0 text-center">
        <span className="block text-3xl font-black text-amber-300 drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">{evo.hero ? 'Lên sao!' : 'Tiến hóa!'}</span>
        <span className="block text-base font-black text-white drop-shadow">{evo.from} → {evo.to}</span>
      </p>
    </div>
  );
}

const sameUi = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Thủ thành Pokémon: tower defence. Team Rocket's wild Pokémon walk to the Pokémon Center;
 * the child places starter Pokémon on Poké Ball pads, they gain evolution energy by
 * fighting and evolve into stronger forms. 8 levels with saved stars.
 */
export function TowerDefenseGame({ player, onClose, onGold, random = Math.random }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const game = useRef(null);
  const fx = useRef(newFx());
  const paid = useRef(false);
  const later = useLater();
  const [progress, setProgress] = useState(() => loadProgress());
  const [screen, setScreen] = useState('map');
  const [ui, setUi] = useState(null);
  const [selected, setSelected] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [banner, setBanner] = useState(null);
  const [evo, setEvo] = useState(null);
  const [result, setResult] = useState(null);
  const [fit, setFit] = useState(null);
  const heroImg = loadImage(player.image);

  const say = (text, tone = 'gold') => setBanner((b) => ({ id: (b?.id || 0) + 1, text, tone }));
  const sync = () => {
    if (!game.current) return;
    const next = snap(game.current);
    setUi((prev) => (prev && sameUi(prev, next) ? prev : next));
  };

  // Fit the portrait map into the space between the HUD and the panel
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const k = Math.min(r.width / W, r.height / H);
      setFit({ w: Math.floor(W * k), h: Math.floor(H * k) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [screen]);

  const play = (level) => {
    game.current = createGame({ level, player, random });
    fx.current = newFx();
    paid.current = false;
    setSelected(null);
    setResult(null);
    setEvo(null);
    setBanner(null);
    setScreen('play');
    setUi(snap(game.current));
    sounds.playWhoosh();
    say(`Màn ${level + 1}: ${LEVELS[level].name}`, 'blue');
  };

  const toMap = () => {
    game.current = null;
    setScreen('map');
    setUi(null);
    setSelected(null);
    setEvo(null);
    setProgress(loadProgress());
  };

  const quiet = (key, gap) => {
    const v = fx.current;
    if (v.time - (v.lastSound[key] ?? -9) < gap) return false;
    v.lastSound[key] = v.time;
    return true;
  };

  const finish = (s, status) => {
    if (paid.current) return;
    paid.current = true;
    const won = status === 'won';
    const stars = starsFor(s.lives, s.maxLives, won);
    const saved = won ? saveResult(s.level, stars) : { improved: false, progress: loadProgress() };
    const gold = goldFor({ stars, won, improved: saved.improved, level: s.level, wavesHeld: Math.max(0, s.wave - 1) });
    setProgress(saved.progress);
    onGold?.(gold);
    if (won) {
      sounds.playSuccessFanfare();
      say(stars === 3 ? 'BẢO VỆ HOÀN HẢO! 🏆' : 'THẮNG RỒI! 🎉', 'gold');
      try {
        confetti({ particleCount: 140, spread: 90, origin: { y: 0.35 }, zIndex: 9999 });
      } catch {
        // decoration
      }
    } else {
      sounds.playOops();
      say('Ôi, Trung tâm bị phá rồi!', 'red');
    }
    later(() => {
      setResult({ won, stars, gold, improved: saved.improved, level: s.level, wave: s.wave, waves: s.waves });
      setScreen('result');
    }, 1300);
  };

  const handleEvents = (s) => {
    const v = fx.current;
    for (const e of s.events.splice(0)) {
      switch (e.type) {
        case 'shot':
          v.recoil.set(e.tower, 1);
          if (quiet('shot', 0.18)) sounds.playNote(e.line === 'water' ? 520 : e.line === 'psychic' ? 760 : 620, { duration: 0.05, volume: 0.04 });
          break;
        case 'land':
          burst(v.particles, e.x, e.y, { count: 5 + e.stage * 2, colors: HIT_COLOR[e.line] || HIT_COLOR.hero, speed: 90, life: 0.35, size: 2.5, gravity: 120 });
          if (e.splash) v.attacks.push({ type: 'splash', x: e.x, y: e.y, r: e.splash, color: LINE_COLOR[e.line], life: 0.3, max: 0.3 });
          break;
        case 'cone':
          v.recoil.set(e.tower, 0.6);
          v.attacks.push({ ...e, life: 0.24, max: 0.24 });
          if (quiet('cone', 0.3)) sounds.playWhoosh();
          break;
        case 'beam':
          v.recoil.set(e.tower, 1);
          v.attacks.push({ ...e, life: 0.35, max: 0.35 });
          burst(v.particles, e.tx, e.ty, { count: 10, colors: ['#ecfccb', '#bef264', '#ffffff'], speed: 120, life: 0.4, size: 3, gravity: 60 });
          if (quiet('beam', 0.3)) sounds.playEnergySurge();
          break;
        case 'chain':
          v.recoil.set(e.tower, 0.8);
          v.attacks.push({ ...e, life: 0.18 + e.stage * 0.04, max: 0.18 + e.stage * 0.04 });
          for (const p of e.points.slice(1)) burst(v.particles, p.x, p.y, { count: 4, colors: HIT_COLOR.electric, speed: 110, life: 0.3, size: 2, gravity: 0 });
          if (quiet('chain', 0.2)) sounds.playNote(1200, { duration: 0.04, volume: 0.04 });
          break;
        case 'psywave':
          v.recoil.set(e.tower, 0.5);
          v.attacks.push({ ...e, life: 0.55, max: 0.55 });
          break;
        case 'hit':
          if (v.floats.length < 36) {
            v.floats.push({ x: e.x + (Math.random() - 0.5) * 12, y: e.y, text: e.eff === 'super' ? `${e.amount}!` : String(e.amount), color: e.eff === 'super' ? '#fde047' : e.eff === 'weak' ? '#cbd5e1' : '#ffffff', size: e.eff === 'super' ? 16 : 12, life: 0.7, max: 0.7, rise: 26 });
          }
          break;
        case 'faint':
          v.attacks.push({ type: 'poof', x: e.x, y: e.y, size: e.size, life: 0.6, max: 0.6 });
          burst(v.particles, e.x, e.y - e.size * 0.4, { count: e.boss ? 40 : 12, colors: ['#ffffff', '#fde047', '#f472b6'], speed: e.boss ? 220 : 130, life: 0.6, size: 3, gravity: 160 });
          v.floats.push({ x: e.x, y: e.y - e.size * 0.6, text: `+${e.coins} 🪙`, color: '#fde047', size: 15, life: 0.9, max: 0.9, rise: 34 });
          if (e.boss) {
            sounds.playSuccessFanfare();
            say('Hạ được trùm! 🎉', 'gold');
          } else if (quiet('coin', 0.12)) sounds.playCoin();
          break;
        case 'leak':
          v.centerHurt = 0.6;
          {
            const end = s.lv.path.pts[s.lv.path.pts.length - 1];
            v.floats.push({ x: end.x, y: end.y - 34, text: `-${e.lives} ❤️`, color: '#fca5a5', size: 18, life: 1, max: 1, rise: 30 });
          }
          if (quiet('leak', 0.4)) sounds.playOops();
          break;
        case 'wave':
          sounds.playWhoosh();
          say(e.boss ? `⚠️ Đợt ${e.wave}: Trùm ${e.boss}!` : `Đợt ${e.wave}/${s.waves}!`, e.boss ? 'red' : 'blue');
          break;
        case 'waveClear':
          sounds.playCoin();
          v.floats.push({ x: W / 2, y: 70, text: `Xong đợt ${e.wave}! +${e.bonus} 🪙`, color: '#fde047', size: 17, life: 1.4, max: 1.4, rise: 24 });
          break;
        case 'early':
          say(`Gọi sớm: +${e.bonus} xu! 🪙`, 'gold');
          sounds.playCoin();
          break;
        case 'candyDrop':
          sounds.playScanBeep();
          say('🍬 Kẹo hiếm! Chạm để nhặt', 'blue');
          break;
        case 'candy':
          sounds.playCoin();
          burst(v.particles, e.x, e.y, { count: 18, colors: ['#93c5fd', '#3b82f6', '#ffffff'], speed: 150, life: 0.6, size: 3 });
          break;
        case 'candyUsed':
          sounds.playEnergySurge();
          v.attacks.push({ type: 'ring', x: e.x, y: e.y - 10, r: 30, color: '#93c5fd', life: 0.6, max: 0.6 });
          burst(v.particles, e.x, e.y - 10, { count: 24, colors: ['#93c5fd', '#fde047', '#ffffff'], speed: 170, life: 0.7, size: 3, gravity: 60 });
          break;
        case 'build':
          sounds.playPop();
          v.attacks.push({ type: 'ring', x: e.x, y: e.y, r: 24, color: LINE_COLOR[e.line], life: 0.5, max: 0.5 });
          burst(v.particles, e.x, e.y - 10, { count: 16, colors: HIT_COLOR[e.line] || HIT_COLOR.hero, speed: 140, life: 0.6, size: 3 });
          break;
        case 'sell':
          sounds.playCoin();
          v.floats.push({ x: e.x, y: e.y - 20, text: `+${e.refund} 🪙`, color: '#fde047', size: 16, life: 0.9, max: 0.9, rise: 30 });
          break;
        case 'evolve':
          v.attacks.push({ type: 'ring', x: e.x, y: e.y - 14, r: 40, color: '#fde047', life: 0.9, max: 0.9 });
          burst(v.particles, e.x, e.y - 14, { count: 40, colors: ['#ffffff', '#fde047', '#f0abfc', '#93c5fd'], speed: 220, life: 0.9, size: 3.5, gravity: 40 });
          break;
        case 'end':
          finish(s, e.status);
          break;
        default:
      }
    }
  };

  useLoop((dt) => {
    const s = game.current;
    if (!s) return;
    const v = fx.current;
    v.time += dt;
    v.dt = dt;
    v.selected = selected;
    // The battle waits while an evolution plays
    if (!evo && screen === 'play') {
      for (let i = 0; i < speed; i++) step(s, dt);
      handleEvents(s);
      sync();
    }
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawFrame(ctx, s, v, heroImg);
  }, screen !== 'map' && screen !== 'result');

  const tapStage = (e) => {
    const s = game.current;
    if (!s || screen !== 'play' || !canvasRef.current) return;
    const p = canvasPoint(canvasRef.current, e, W, H);
    // Rare Candy first: it is small and tapping it should never open a pad
    const drop = s.drops.find((d) => Math.hypot(d.x - p.x, d.y - 10 - p.y) <= TAP_R);
    if (drop) {
      collectCandy(s, drop.id);
      handleEvents(s);
      say('Nhặt được 🍬 Kẹo hiếm! Chọn một Pokémon để cho ăn', 'blue');
      sync();
      return;
    }
    let best = null;
    let bd = TAP_R;
    for (const pad of s.lv.pads) {
      const d = Math.hypot(pad.x - p.x, pad.y - 8 - p.y);
      if (d <= bd) {
        bd = d;
        best = pad;
      }
    }
    if (best) {
      sounds.playPop();
      setSelected(best.id === selected ? null : best.id);
    } else setSelected(null);
  };

  const doBuild = (line) => {
    const s = game.current;
    if (!s || selected == null || !canBuild(s, selected, line)) return;
    build(s, selected, line);
    handleEvents(s);
    sync();
  };

  const tower = ui && selected != null ? ui.towers.find((t) => t.pad === selected) : null;

  const doEvolve = () => {
    const s = game.current;
    if (!s || !tower) return;
    const before = s.towers.find((t) => t.id === tower.id);
    const fromImg = before.line === 'hero' ? player.image : artworkUrl(before.dex);
    const from = before.name;
    if (!evolve(s, tower.id)) return;
    const after = s.towers.find((t) => t.id === tower.id);
    const hero = after.line === 'hero';
    sounds.playEnergySurge();
    later(() => sounds.playSuccessFanfare(), 1300);
    setEvo({ id: Date.now(), from, to: hero ? `${after.name} ★${after.stage + 1}` : after.name, fromImg, toImg: hero ? player.image : artworkUrl(after.dex), hero });
    handleEvents(s);
    sync();
    later(() => setEvo(null), EVO_MS);
  };

  const doSell = () => {
    const s = game.current;
    if (!s || !tower) return;
    sell(s, tower.id);
    handleEvents(s);
    setSelected(null);
    sync();
  };

  const doCandy = () => {
    const s = game.current;
    if (!s || !tower) return;
    if (feedCandy(s, tower.id)) {
      handleEvents(s);
      say('Năng lượng đầy! Tiến hóa thôi! ✨', 'gold');
      sync();
    }
  };

  const doWave = () => {
    const s = game.current;
    if (!s) return;
    if (callWave(s)) {
      handleEvents(s);
      sync();
    }
  };

  const level = ui ? LEVELS[ui.level] : null;
  const hasNext = result && result.won && result.level + 1 < LEVELS.length;
  const toneClass = { gold: 'from-amber-300 to-orange-500', blue: 'from-sky-400 to-indigo-500', red: 'from-rose-500 to-red-600', green: 'from-emerald-400 to-teal-500' };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 select-none text-white"
      role="dialog"
      aria-label="Thủ thành Pokémon"
      data-screen={screen}
      data-status={ui ? ui.status : 'map'}
      data-level={ui ? ui.level + 1 : 0}
      data-coins={ui ? ui.coins : 0}
      data-lives={ui ? ui.lives : 0}
      data-wave={ui ? ui.wave : 0}
      data-speed={speed}
    >
      {/* Header / HUD */}
      <div className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 shadow-lg">
        {screen === 'map' ? (
          <span className="text-base font-black truncate">🛡️ Thủ thành Pokémon</span>
        ) : (
          <>
            <button type="button" onClick={toMap} className="px-2 py-1 rounded-full bg-white/20 text-xs font-black" aria-label="Về chọn màn">
              ← Màn
            </button>
            {ui && (
              <>
                <span key={`l${ui.lives}`} className={`px-2 py-0.5 rounded-full bg-black/30 text-sm font-black tabular-nums ${ui.lives < ui.maxLives ? 'score-bump' : ''}`} data-testid="td-lives">
                  ❤️ {ui.lives}
                </span>
                <span key={`c${ui.coins}`} className="px-2 py-0.5 rounded-full bg-black/30 text-sm font-black tabular-nums text-amber-200 score-bump" data-testid="td-coins">
                  🪙 {ui.coins}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/30 text-xs font-black tabular-nums" data-testid="td-wave">
                  🌊 {ui.wave}/{ui.waves}
                </span>
                {ui.candies > 0 && <span className="px-2 py-0.5 rounded-full bg-sky-400/90 text-slate-900 text-xs font-black">🍬{ui.candies}</span>}
              </>
            )}
          </>
        )}
        <button type="button" onClick={onClose} aria-label="Đóng trò chơi" className="ml-auto p-1.5 rounded-full bg-white text-slate-700 shadow">
          <X className="w-5 h-5" />
        </button>
      </div>

      {screen === 'map' && <LevelSelect progress={progress} onPlay={play} />}

      {screen !== 'map' && ui && (
        <>
          {ui.boss && (
            <div className="shrink-0 flex items-center gap-2 px-3 py-1 bg-slate-900" data-testid="td-boss">
              <img src={artworkUrl(ui.boss.dex)} alt="" className="w-7 h-7 object-contain" draggable={false} />
              <span className="text-xs font-black text-rose-300 shrink-0">Trùm {ui.boss.name}</span>
              <div className="flex-1 h-3.5 rounded-full bg-slate-700 overflow-hidden border border-rose-300/60">
                <div className="h-full bg-gradient-to-r from-rose-600 to-orange-400 transition-[width] duration-150" style={{ width: `${(ui.boss.hp / ui.boss.maxHp) * 100}%` }} />
              </div>
            </div>
          )}
          <div ref={stageRef} className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden" data-testid="td-stage-wrap">
            <canvas
              ref={canvasRef}
              onPointerDown={tapStage}
              data-testid="td-stage"
              className="touch-none rounded-lg shadow-2xl"
              style={fit ? { width: fit.w, height: fit.h } : { width: '100%', maxWidth: W, aspectRatio: `${W} / ${H}`, maxHeight: '100%' }}
            />
            {ui.status === 'build' && !evo && (
              <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none">
                <div className="pop-in w-[86%] max-w-xs rounded-2xl bg-black/65 px-3 py-2 text-center" data-testid="td-intro">
                  <p className="text-base font-black text-amber-300">{level.name}</p>
                  <p className="text-xs font-bold text-white/90">Chạm ô Poké Ball ✨ để đặt Pokémon, rồi bấm “Bắt đầu!”</p>
                </div>
              </div>
            )}
            {banner && (
              <div key={banner.id} className={`banner-slam absolute left-1/2 top-[38%] z-20 pointer-events-none whitespace-nowrap px-4 py-1.5 rounded-2xl bg-gradient-to-r ${toneClass[banner.tone] || toneClass.gold} text-white text-lg font-black shadow-xl border-2 border-white`}>
                {banner.text}
              </div>
            )}
            {evo && <EvolutionOverlay evo={evo} />}
            {screen === 'result' && result && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-5" data-testid="td-result">
                <div className="result-rise w-full max-w-xs rounded-3xl bg-white p-5 text-center text-slate-800 shadow-2xl space-y-2">
                  <img src={player.image} alt={player.name} className="mx-auto w-20 h-20 object-contain poke-hop" draggable={false} />
                  <p className={`text-2xl font-black ${result.won ? 'text-emerald-600' : 'text-rose-600'}`}>{result.won ? 'Bảo vệ thành công!' : 'Thua mất rồi!'}</p>
                  <p className="text-sm font-bold text-slate-600">{result.won ? `Còn ❤️ ${ui.lives}/${ui.maxLives}` : `Giữ được ${Math.max(0, result.wave - 1)}/${result.waves} đợt – tiến hóa nhiều hơn nhé!`}</p>
                  <div className="flex justify-center">
                    <StarRow stars={result.stars} size="w-10 h-10" animate />
                  </div>
                  <div className="flex justify-center">
                    <GoldReward amount={result.gold} />
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center pt-1">
                    <button type="button" onClick={toMap} className="px-4 py-2.5 rounded-2xl bg-slate-200 text-slate-700 font-black active:scale-95">
                      Bản đồ
                    </button>
                    <button type="button" onClick={() => play(result.level)} className="px-4 py-2.5 rounded-2xl bg-rose-500 text-white font-black active:scale-95" data-testid="td-replay">
                      Chơi lại
                    </button>
                    {hasNext && (
                      <button type="button" onClick={() => play(result.level + 1)} className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black shadow-lg active:scale-95" data-testid="td-next">
                        Màn sau ➜
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom panel: waves, speed and the build / tower card */}
          <div className="shrink-0 px-2 pt-1.5 pb-2 bg-gradient-to-b from-slate-800 to-slate-900 border-t-2 border-white/10" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <button
                type="button"
                onClick={doWave}
                disabled={!ui.canCall}
                data-testid="td-call-wave"
                className={`flex-1 py-2 rounded-xl text-sm font-black shadow transition-transform ${ui.canCall ? `bg-gradient-to-r from-emerald-400 to-green-600 text-white active:scale-95 ${ui.status === 'build' ? 'td-glow' : ''}` : 'bg-slate-700 text-white/60'}`}
              >
                {ui.status === 'build' ? '▶ Bắt đầu!' : ui.canCall ? `⏩ Gọi đợt sau +${ui.bonus}🪙${ui.nextIn != null ? ` (${ui.nextIn}s)` : ''}` : ui.wave >= ui.waves ? 'Đợt cuối!' : `Đợt ${ui.wave} đang tới…`}
              </button>
              <button type="button" onClick={() => setSpeed((x) => (x === 1 ? 2 : 1))} data-testid="td-speed" aria-label={`Tốc độ x${speed}`} className={`w-14 py-2 rounded-xl text-sm font-black shadow active:scale-95 ${speed === 2 ? 'bg-amber-400 text-slate-900' : 'bg-white/15 text-white'}`}>
                x{speed}
              </button>
            </div>
            <div className="min-h-[92px]">
              {selected == null && (
                <p className="pt-3 text-center text-xs font-bold text-white/75">
                  Chạm ô <span className="text-amber-300">Poké Ball ✨</span> để đặt Pokémon. Pokémon có <span className="text-amber-300">!</span> là đã đủ năng lượng tiến hóa!
                </p>
              )}
              {selected != null && !tower && <BuildMenu ui={ui} level={ui.level} player={player} onBuild={doBuild} />}
              {tower && <TowerCard tower={tower} ui={ui} player={player} onEvolve={doEvolve} onSell={doSell} onCandy={doCandy} onClose={() => setSelected(null)} />}
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
