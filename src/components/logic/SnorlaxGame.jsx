import React, { useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Lightbulb, Lock, RotateCcw, Star } from '../icons/PokeIcons';
import { SNORLAX_W as W, SNORLAX_H as H, DT, LEVELS, WORLDS, createSnorlax, stepOnce, swipe, tapAt, hintFor, worldOf } from '../../utils/logic/snorlax';
import { getProgress, recordStars, goldForLevel, totalStars, isUnlocked } from '../../utils/progress';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { KidGameShell, StarRow, GoldReward } from '../kidgames/Common';
import { useLoop, useLater, useCanvas, canvasPoint, loadImage, burst } from '../sports/sportsKit';
import { drawSnorlaxScene } from './snorlaxDraw';

const GAME = 'snorlax';
const SNORLAX_ART = artworkUrl(143);
const CHEERS = ['Măm măm! Ngon quá! 😋', 'Snorlax no căng bụng! 🫐', 'Giỏi quá đi! 🎉', 'Bé cắt dây siêu đỉnh! ✂️'];
const LOST_TEXT = { spike: 'Ối! Quả mọng vỡ mất rồi!', fell: 'Ối! Quả mọng rơi mất rồi!', flew: 'Ối! Bong bóng bay mất rồi!' };
// The hint says where, and also when: "wait", "ready", then "NOW" at the solution's moment
const HINT_NOW = { cut: 'Cắt NGAY! ✂️', pop: 'Chạm NGAY! 🫧', puff: 'Chạm NGAY! 💨' };
const HINT_WHERE = { cut: 'Cắt ở đây ✂️', pop: 'Chạm bong bóng 🫧', puff: 'Chạm Jigglypuff 💨' };
const hintStage = (now, t) => (now < t - 0.6 ? 'wait' : now < t - 0.15 ? 'ready' : now <= t + 0.2 ? 'now' : 'late');
const hintLabel = (h) => (h.stage === 'wait' ? 'Chờ chút… ⏳' : h.stage === 'ready' ? 'Sẵn sàng… 👀' : h.stage === 'now' ? HINT_NOW[h.kind] : HINT_WHERE[h.kind]);
const WORLD_STYLE = [
  'from-sky-300 to-lime-200',
  'from-sky-400 to-cyan-200',
  'from-pink-300 to-violet-200',
  'from-green-800 to-lime-400',
  'from-indigo-900 to-violet-600',
];

const newFx = () => ({ time: 0, dt: 0, particles: [], floats: [], trail: [], player: { mood: 'idle', hop: 0 }, squash: 0, spin: 0, open: 0, wonAt: null });

/** Level map: five worlds of six levels, each opens when the one before has a star. */
function LevelMap({ progress, onPlay }) {
  const next = LEVELS.findIndex((l, i) => isUnlocked(LEVELS, progress, i) && !progress[l.id]);
  return (
    <div className="px-3 pt-3 pb-5 space-y-3" data-testid="snorlax-map">
      <div className="flex items-center gap-3 rounded-3xl bg-white/70 p-3 shadow">
        <img src={SNORLAX_ART} alt="Snorlax" draggable={false} className="snorlax-float w-16 h-16 object-contain drop-shadow" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black text-slate-800 leading-tight">Snorlax đói bụng rồi!</p>
          <p className="text-xs font-bold text-slate-600">Vuốt cắt dây cho quả mọng rơi vào miệng Snorlax. Nhặt đủ 3 ngôi sao nhé!</p>
        </div>
        <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-100 text-sm font-black text-amber-600">⭐ {totalStars(progress)}/{LEVELS.length * 3}</span>
      </div>
      {WORLDS.map((w, wi) => (
        <section key={w.id} className={`rounded-3xl bg-gradient-to-br ${WORLD_STYLE[wi]} p-2.5 shadow-inner`} aria-label={`Thế giới ${w.name}`}>
          <p className={`px-1 text-sm font-black ${wi >= 3 ? 'text-white' : 'text-slate-800'}`}>
            {w.icon} {w.name}
          </p>
          <div className="mt-1.5 grid grid-cols-6 gap-1.5">
            {LEVELS.map((lv, i) => {
              if (lv.world !== wi) return null;
              const open = isUnlocked(LEVELS, progress, i);
              const stars = Number(progress[lv.id]) || 0;
              return (
                <button
                  key={lv.id}
                  onClick={() => open && onPlay(i)}
                  disabled={!open}
                  aria-label={open ? `Màn ${i + 1}` : `Màn ${i + 1} (chưa mở)`}
                  className={`relative flex flex-col items-center gap-0.5 py-1.5 rounded-2xl ${open ? 'bg-white/95 shadow active:scale-95' : 'bg-white/40'} ${i === next ? 'ring-4 ring-amber-300 hint-pulse' : ''}`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${open ? 'bg-gradient-to-b from-sky-400 to-blue-600 text-white' : 'bg-slate-300 text-slate-500'}`}>
                    {open ? i + 1 : <Lock className="w-4 h-4" />}
                  </span>
                  <StarRow stars={stars} size="w-2.5 h-2.5" />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * "Cho Snorlax ăn": a Cut the Rope style puzzle. Swipe across the ropes so the Oran berry
 * falls into sleeping Snorlax's mouth; bubbles, Jigglypuff puffs, springy mushrooms,
 * Ferrothorn thorns and Spinarak webs join in over 30 levels in five worlds.
 */
export function SnorlaxGame({ player, onClose, onGold, random = Math.random }) {
  const [progress, setProgress] = useState(() => getProgress(GAME));
  const [level, setLevel] = useState(null); // index, null on the map
  const [phase, setPhase] = useState('map'); // map | play | won | lost
  const [collected, setCollected] = useState(0);
  const [result, setResult] = useState(null); // { stars, gold, improved, cheer } once the card shows
  const [hint, setHintState] = useState(null);
  const hintRef = useRef(null);
  const setHint = (h) => {
    hintRef.current = h;
    setHintState(h);
  };
  const [tip, setTip] = useState(null);
  const [lostText, setLostText] = useState(null);
  const game = useRef(null);
  const fx = useRef(newFx());
  const acc = useRef(0);
  const run = useRef(0);
  const finger = useRef(null);
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const later = useLater();
  const img = loadImage(player.image);

  const start = (i) => {
    run.current += 1;
    game.current = createSnorlax(i);
    fx.current = newFx();
    acc.current = 0;
    finger.current = null;
    setLevel(i);
    setPhase('play');
    setCollected(0);
    setResult(null);
    setHint(null);
    setLostText(null);
    const t = LEVELS[i].tip;
    setTip(t ? { id: run.current, text: t } : null);
    if (t) {
      const id = run.current;
      later(() => setTip((x) => (x && x.id === id ? null : x)), 3200);
    }
  };

  const toMap = () => {
    run.current += 1;
    game.current = null;
    setLevel(null);
    setPhase('map');
    setResult(null);
    setHint(null);
    setTip(null);
  };

  const win = (s) => {
    const v = fx.current;
    v.wonAt = v.time;
    v.player.mood = 'win';
    sounds.playMunch();
    later(() => sounds.playSuccessFanfare(), 450);
    burst(v.particles, s.mouth.x, s.mouth.y, { count: 26, colors: ['#93c5fd', '#fde047', '#f9a8d4', '#ffffff'], speed: 200, gravity: 200 });
    v.floats.push({ x: s.mouth.x, y: s.mouth.y - 50, text: 'Măm măm!', color: '#fde047', life: 1.3, max: 1.3 });
    setPhase('won');
    setHint(null);
    const stars = s.earned;
    const saved = recordStars(GAME, LEVELS[s.level].id, stars);
    setProgress(saved.progress);
    const gold = goldForLevel(stars, saved.improved);
    onGold?.(gold);
    const cheer = CHEERS[Math.floor(random() * CHEERS.length) % CHEERS.length];
    const id = run.current;
    later(() => {
      if (run.current !== id) return;
      setResult({ stars, gold, improved: saved.improved, cheer });
      try {
        confetti({ particleCount: 90 + stars * 30, spread: 80, origin: { y: 0.4 }, zIndex: 9999 });
      } catch {
        // decoration
      }
    }, 1300);
  };

  const lose = (s, e) => {
    const v = fx.current;
    v.player.mood = 'fail';
    sounds.playOops();
    if (e.reason === 'spike') burst(v.particles, e.x, e.y, { count: 22, colors: ['#3b82f6', '#93c5fd', '#1e3a8a'], speed: 180, gravity: 320 });
    setPhase('lost');
    setHint(null);
    setLostText(LOST_TEXT[e.reason] || LOST_TEXT.fell);
    const id = run.current;
    const i = s.level;
    later(() => run.current === id && start(i), 1300);
  };

  const handleEvents = (s) => {
    const v = fx.current;
    for (const e of s.events.splice(0)) {
      if (e.type === 'cut') {
        sounds.playWhoosh();
        burst(v.particles, e.x, e.y, { count: 8, colors: ['#c98b4a', '#fef3c7', '#ffffff'], speed: 90, gravity: 300, size: 3 });
        setHint(null);
      } else if (e.type === 'star') {
        sounds.playCoin();
        burst(v.particles, e.x, e.y, { count: 18, colors: ['#fde047', '#facc15', '#ffffff'], speed: 170, gravity: 120 });
        v.floats.push({ x: e.x, y: e.y - 10, text: '+⭐', color: '#fde047', life: 0.9, max: 0.9 });
        v.player.hop = 1;
        setCollected(e.count);
      } else if (e.type === 'bubble') {
        sounds.playNote(880, { duration: 0.25, volume: 0.16 });
      } else if (e.type === 'pop') {
        sounds.playPop();
        burst(v.particles, e.x, e.y, { count: 14, colors: ['#e0f2fe', '#ffffff', '#7dd3fc'], speed: 140, gravity: 60, size: 3 });
        setHint(null);
      } else if (e.type === 'puff') {
        sounds.playWhoosh();
        const p = s.puffers[e.puffer];
        for (let k = 0; k < 12; k++) {
          const a = p.angle + (k / 11 - 0.5) * 0.7;
          const sp = 160 + (k % 4) * 45;
          v.particles.push({ x: p.x + Math.cos(p.angle) * 22, y: p.y + Math.sin(p.angle) * 22, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, max: 0.5, size: 3 + (k % 3), color: 'rgba(255,255,255,0.9)', gravity: 0 });
        }
        setHint(null);
      } else if (e.type === 'bounce') {
        sounds.playNote(520, { duration: 0.2, volume: 0.18 });
        v.squash = 1;
        burst(v.particles, e.x, e.y, { count: 10, colors: ['#fb7185', '#ffffff', '#fde047'], speed: 120, gravity: 200, size: 3 });
      } else if (e.type === 'web') {
        sounds.playScanBeep();
        burst(v.particles, e.x, e.y, { count: 10, colors: ['#f8fafc', '#cbd5e1'], speed: 100, gravity: 0, size: 2.5 });
      } else if (e.type === 'won') win(s);
      else if (e.type === 'lost') lose(s, e);
    }
  };

  useLoop((dt) => {
    const s = game.current;
    if (!s) return;
    const v = fx.current;
    v.time += dt;
    v.dt = dt;
    acc.current += dt;
    while (acc.current >= DT) {
      stepOnce(s);
      acc.current -= DT;
      if (s.events.length) handleEvents(s);
    }
    v.player.hop = Math.max(0, v.player.hop - dt * 2.2);
    v.squash = Math.max(0, v.squash - dt * 4);
    while (v.trail.length && v.time - v.trail[0].t > 0.3) v.trail.shift();
    // Keep the hint on its rope (ropes swing) and tell when the moment comes
    const h = hintRef.current;
    if (h && s.status === 'play') {
      const now = hintFor(s);
      const stage = hintStage(s.t, h.t);
      if (now && (stage !== h.stage || Math.hypot(now.x - h.x, now.y - h.y) > 4)) setHint({ ...h, x: now.x, y: now.y, stage });
    }
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawSnorlaxScene(ctx, s, v, img);
  }, level != null);

  const pointAt = (e) => canvasPoint(canvasRef.current, e, W, H);
  const onDown = (e) => {
    const s = game.current;
    if (!s || s.status !== 'play') return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // not supported
    }
    const p = pointAt(e);
    if (tapAt(s, p.x, p.y)) {
      handleEvents(s);
      return;
    }
    finger.current = p;
    fx.current.trail.push({ x: p.x, y: p.y, t: fx.current.time });
  };
  const onMove = (e) => {
    const s = game.current;
    const last = finger.current;
    if (!s || !last) return;
    const p = pointAt(e);
    swipe(s, last.x, last.y, p.x, p.y);
    if (s.events.length) handleEvents(s);
    finger.current = p;
    fx.current.trail.push({ x: p.x, y: p.y, t: fx.current.time });
  };
  const onUp = () => {
    finger.current = null;
  };

  const showHint = () => {
    const s = game.current;
    if (!s || s.status !== 'play') return;
    let h = hintFor(s);
    if (!h) return;
    // Missed the moment? Start the level again so the hint can show exactly when
    let t = s.t;
    if (t > h.t + 0.3) {
      start(level);
      h = hintFor(game.current);
      t = 0;
    }
    sounds.playPop();
    setHint({ ...h, id: Date.now(), stage: hintStage(t, h.t) });
  };

  const lv = level != null ? LEVELS[level] : null;
  const world = lv ? WORLDS[worldOf(level)] : null;
  const hasNext = level != null && level + 1 < LEVELS.length;

  return (
    <KidGameShell
      title="😴 Cho Snorlax ăn"
      label="Cho Snorlax ăn"
      round={collected}
      rounds={3}
      onClose={onClose}
      background="bg-gradient-to-b from-sky-200 via-indigo-100 to-emerald-100"
      dataAttrs={{ 'data-phase': phase, 'data-level': level != null ? level + 1 : 0, 'data-stars': collected, 'data-score': result ? result.stars : 0 }}
    >
      {level == null ? (
        <LevelMap progress={progress} onPlay={start} />
      ) : (
        <div className="px-2 pt-2 pb-3 flex flex-col items-center gap-2">
          <div className="w-full flex items-center gap-1.5">
            <button onClick={toMap} className="px-2.5 py-1.5 rounded-full bg-white/90 text-xs font-black text-slate-600 shadow active:scale-95" aria-label="Về bản đồ màn">
              ← Màn
            </button>
            <span className="px-2.5 py-1 rounded-full bg-white/90 text-sm font-black text-sky-700 shadow whitespace-nowrap" data-testid="snorlax-level">
              {world.icon} Màn {level + 1}
            </span>
            <span className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-white/90 shadow" aria-label={`Đã nhặt ${collected}/3 sao`} data-testid="snorlax-stars">
              {[0, 1, 2].map((i) => (
                <Star key={i} className={`w-4 h-4 transition-transform ${i < collected ? 'fill-amber-400 text-amber-500 scale-110' : 'text-slate-300'}`} />
              ))}
            </span>
            <button onClick={() => start(level)} aria-label="Chơi lại màn" data-testid="snorlax-restart" className="ml-auto w-9 h-9 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow active:scale-95">
              <RotateCcw className="w-5 h-5" />
            </button>
            <button onClick={showHint} disabled={phase !== 'play'} aria-label="Gợi ý" data-testid="snorlax-hint-btn" className="w-9 h-9 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center shadow active:scale-95 disabled:opacity-50">
              <Lightbulb className="w-5 h-5" />
            </button>
          </div>

          <div className="relative w-full mx-auto rounded-3xl overflow-hidden border-4 border-white shadow-xl touch-none select-none" style={{ maxWidth: `min(100%, calc((100dvh - 170px) * ${W / H}))` }}>
            <canvas
              ref={canvasRef}
              className="block w-full h-auto touch-none"
              style={{ aspectRatio: `${W} / ${H}` }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerLeave={onUp}
              data-testid="snorlax-stage"
              aria-label="Vuốt để cắt dây"
            />
            {hint && (
              <div key={hint.id} className="absolute pointer-events-none" style={{ left: `${(hint.x / W) * 100}%`, top: `${(hint.y / H) * 100}%` }} data-testid="snorlax-hint" data-kind={hint.kind} data-stage={hint.stage}>
                <span className="snorlax-hint-ring absolute left-0 top-0 block w-12 h-12 rounded-full border-4 border-amber-300" />
                <span className="snorlax-hint-arrow absolute left-0 top-0 flex flex-col items-center whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-black shadow transition-colors ${hint.stage === 'now' ? 'bg-emerald-500 text-white scale-110' : 'bg-amber-400 text-slate-900'}`}>{hintLabel(hint)}</span>
                  <span className="text-3xl leading-none drop-shadow">👇</span>
                </span>
              </div>
            )}
            {tip && phase === 'play' && (
              <div key={tip.id} className="pop-in absolute inset-x-3 top-3 pointer-events-none rounded-2xl bg-white/90 px-3 py-2 text-center text-sm font-black text-slate-800 shadow-lg" data-testid="snorlax-tip">
                💡 {tip.text}
              </div>
            )}
            {phase === 'lost' && lostText && (
              <div className="bubble-pop absolute inset-x-6 top-[38%] pointer-events-none rounded-2xl bg-rose-500/90 px-3 py-2 text-center text-white font-black shadow-xl" data-testid="snorlax-lost">
                {lostText}
                <span className="block text-xs font-bold text-rose-100">Thử lại nào! 💪</span>
              </div>
            )}
            {result && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4" data-testid="snorlax-win">
                <div className="pop-in w-full max-w-[17rem] rounded-3xl bg-white p-4 text-center shadow-2xl space-y-2">
                  <img src={SNORLAX_ART} alt="Snorlax" draggable={false} className="battle-victory mx-auto -mt-12 w-24 h-24 object-contain drop-shadow-xl" />
                  <p className="text-xl font-black text-sky-600">{result.cheer}</p>
                  <div className="flex justify-center">
                    <StarRow stars={result.stars} size="w-10 h-10" animate />
                  </div>
                  <div className="flex justify-center">
                    <GoldReward amount={result.gold} />
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center pt-1">
                    <button onClick={toMap} className="px-3 py-2.5 rounded-2xl bg-slate-200 text-slate-700 font-black active:scale-95">
                      Bản đồ
                    </button>
                    <button onClick={() => start(level)} className="px-3 py-2.5 rounded-2xl bg-amber-100 text-amber-700 font-black active:scale-95" aria-label="Chơi lại màn này">
                      ↻
                    </button>
                    {hasNext && (
                      <button onClick={() => start(level + 1)} className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black shadow-lg active:scale-95">
                        Màn tiếp ➜
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </KidGameShell>
  );
}
