import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { LANES, LANE_INFO, RHYTHM_LEVELS, TIERS, SPEEDS, levelOpen, speedValue, levelTitle, createRun, tapLane, sweepMisses, rhythmStars, accuracy } from '../../utils/logic/rhythm';
import { NOTES } from '../../utils/logic/music';
import { getProgress, recordStars, goldForLevel, totalStars } from '../../utils/progress';
import { sounds } from '../../utils/soundEffects';
import { KidGameShell, SessionSummary, StarRow } from '../kidgames/Common';
import { useLoop, useLater, useCanvas, burst, updateParticles } from '../sports/sportsKit';

const W = 360;
const H = 520;
const RING_Y = 440;
const LANE_W = W / LANES;
const JUDGE_TEXT = { perfect: { text: 'PERFECT!', cls: 'text-amber-300' }, good: { text: 'GOOD', cls: 'text-sky-300' }, miss: { text: 'MISS', cls: 'text-slate-300' } };
const SONG_ICONS = { hotcross: '🥐', twinkle: '⭐', mary: '🐑', joy: '🎉', clair: '🌙', oldmac: '🐄', london: '🌉', row: '🚣', jingle: '🔔', twinklefull: '🌟' };
const GAME = 'rhythm';
const SPEED_KEY = 'pokescan_rhythm_speed';
const readSpeed = () => {
  try {
    const id = localStorage.getItem(SPEED_KEY);
    return SPEEDS.some((s) => s.id === id) ? id : 'normal';
  } catch {
    return 'normal';
  }
};
const KEYS = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, d: 0, f: 1, j: 2, k: 3 };

const laneX = (lane) => LANE_W * (lane + 0.5);

// A bold arrow (shaft + head) pointing right in a 24 x 24 box; rotated per lane
const ARROW_PATH = 'M3 10.2h10.2V5.4L21 12l-7.8 6.6v-4.8H3z';
const arrowShape = typeof Path2D === 'function' ? new Path2D(ARROW_PATH) : null;

function drawArrow(ctx, x, y, size, rot, fill, stroke) {
  if (!arrowShape) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.scale(size / 24, size / 24);
  ctx.translate(-12, -12);
  ctx.lineJoin = 'round';
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.stroke(arrowShape);
  }
  ctx.fillStyle = fill;
  ctx.fill(arrowShape);
  ctx.restore();
}

/** Round glassy pad with a glowing ring in the lane colour and a vector arrow. */
function Pad({ lane, pressed, onTap }) {
  const { color, rot, name } = LANE_INFO[lane];
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onTap(lane);
      }}
      aria-label={`Làn ${lane + 1} (${name})`}
      className={`relative mx-auto w-[70px] h-[70px] rounded-full p-[3px] touch-none select-none transition-transform duration-100 ${pressed ? 'scale-90' : 'active:scale-90'}`}
      style={{
        background: `conic-gradient(from 210deg, ${color}, #ffffffcc, ${color}, ${color}88, ${color})`,
        boxShadow: pressed ? `0 0 28px 8px ${color}` : `0 0 14px 2px ${color}88, 0 6px 14px rgba(0,0,0,0.45)`,
      }}
    >
      <span className="flex w-full h-full items-center justify-center rounded-full" style={{ background: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.35), rgba(30,27,75,0.92) 58%, rgba(15,12,40,0.98))` }}>
        <svg viewBox="0 0 24 24" className="w-9 h-9 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
          <path d={ARROW_PATH} fill={color} stroke="#ffffff" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

/**
 * "Pokémon nhảy theo nhạc": notes fall in 4 lanes; tap the lane when a note reaches the
 * ring. Every hit plays the song's own note and makes the Pokemon dance; combos grow.
 */
export function RhythmGame({ player, onClose, onGold }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [screen, setScreen] = useState('pick'); // pick | play | done
  const [speed, setSpeed] = useState(readSpeed);
  const [progress, setProgress] = useState(() => getProgress(GAME));
  const [reward, setReward] = useState(null);
  const [ui, setUi] = useState({ combo: 0, score: 0, judge: null, run: null });
  const [pressed, setPressed] = useState(-1);
  const game = useRef(null);
  const paid = useRef(false);
  const later = useLater();

  const start = (songId) => {
    paid.current = false;
    game.current = { run: createRun(songId, { speed: speedValue(speed) }), t: 0, particles: [], flash: Array(LANES).fill(0), lastNote: -1 };
    setUi({ combo: 0, score: 0, judge: null, run: game.current.run });
    setScreen('play');
  };

  const judge = (kind, lane) => setUi((u) => ({ ...u, judge: { kind, lane, id: (u.judge?.id || 0) + 1 } }));

  const tap = (lane) => {
    const g = game.current;
    if (!g || screen !== 'play') return;
    g.flash[lane] = 1;
    setPressed(lane);
    later(() => setPressed((p) => (p === lane ? -1 : p)), 120);
    const { state, judgement, note } = tapLane(g.run, lane, g.t);
    if (!judgement) {
      sounds.playNote(NOTES[lane * 2].freq, { duration: 0.2, volume: 0.08 });
      return;
    }
    g.run = state;
    sounds.playNote(NOTES[note.note].freq, { duration: 0.5 });
    burst(g.particles, laneX(lane), RING_Y, { count: judgement === 'perfect' ? 18 : 10, colors: [LANE_INFO[lane].color, '#ffffff', '#fde047'], speed: 150, size: 3.5 });
    judge(judgement, lane);
    setUi((u) => ({ ...u, combo: state.combo, score: state.score }));
    if (state.combo > 0 && state.combo % 10 === 0) {
      sounds.playCoin();
      burst(g.particles, W / 2, 120, { count: 30, speed: 220, colors: ['#fde047', '#f472b6', '#60a5fa', '#ffffff'] });
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const lane = KEYS[e.key];
      if (lane != null && screen === 'play') {
        e.preventDefault();
        tap(lane);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const finish = () => {
    const run = game.current.run;
    const stars = rhythmStars(run);
    if (!paid.current) {
      paid.current = true;
      const saved = recordStars(GAME, run.levelId, stars);
      setProgress(saved.progress);
      // Faster than normal pays a little more the first time
      const gold = Math.round(goldForLevel(stars, saved.improved) * (saved.improved ? Math.max(1, run.speed) : 1));
      setReward({ gold, improved: saved.improved });
      onGold?.(gold);
    }
    sounds.playSuccessFanfare();
    try {
      confetti({ particleCount: 110, spread: 85, origin: { y: 0.45 }, zIndex: 9999 });
    } catch {
      // decoration
    }
    setUi((u) => ({ ...u, run }));
    setScreen('done');
  };

  useLoop((dt) => {
    const g = game.current;
    if (!g) return;
    g.t += dt;
    const { state, missed } = sweepMisses(g.run, g.t);
    if (missed.length) {
      g.run = state;
      judge('miss', missed[missed.length - 1].lane);
      setUi((u) => ({ ...u, combo: 0 }));
    } else if (state !== g.run) g.run = state;
    if (g.run.done) {
      later(finish, 300);
      game.current = { ...g, finished: true };
      return;
    }
    g.flash = g.flash.map((f) => Math.max(0, f - dt * 4));

    const ctx = getCtx();
    if (!ctx) return;
    // Stage: dark gradient, lane stripes lit when tapped, beat pulse
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#581c87');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    for (let l = 0; l < LANES; l++) {
      const x = l * LANE_W;
      const lane = ctx.createLinearGradient(0, 0, 0, H);
      lane.addColorStop(0, 'rgba(255,255,255,0)');
      lane.addColorStop(1, `${LANE_INFO[l].color}${Math.round((0.12 + g.flash[l] * 0.45) * 255).toString(16).padStart(2, '0')}`);
      ctx.fillStyle = lane;
      ctx.fillRect(x + 3, 0, LANE_W - 6, H);
    }
    // Rings
    for (let l = 0; l < LANES; l++) {
      ctx.strokeStyle = LANE_INFO[l].color;
      ctx.lineWidth = 4 + g.flash[l] * 4;
      ctx.shadowColor = LANE_INFO[l].color;
      ctx.shadowBlur = 10 + g.flash[l] * 20;
      ctx.beginPath();
      ctx.arc(laneX(l), RING_Y, 30 + g.flash[l] * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.45 + g.flash[l] * 0.55;
      drawArrow(ctx, laneX(l), RING_Y, 30, LANE_INFO[l].rot, LANE_INFO[l].color);
      ctx.globalAlpha = 1;
    }
    // Falling notes (with a trail)
    for (const n of g.run.chart) {
      if (g.run.judged[n.id]) continue;
      const k = 1 - (n.time - g.t) / g.run.fall;
      if (k < 0 || k > 1.25) continue;
      const y = RING_Y * k;
      const x = laneX(n.lane);
      const c = LANE_INFO[n.lane].color;
      const trail = ctx.createLinearGradient(x, y - 70, x, y);
      trail.addColorStop(0, 'rgba(255,255,255,0)');
      trail.addColorStop(1, `${c}99`);
      ctx.fillStyle = trail;
      ctx.fillRect(x - 10, y - 70, 20, 70);
      ctx.fillStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(x - 7, y - 8, 7, 0, Math.PI * 2);
      ctx.fill();
      drawArrow(ctx, x, y, 28, LANE_INFO[n.lane].rot, '#ffffff', 'rgba(0,0,0,0.25)');
    }
    updateParticles(ctx, g.particles, dt);
  }, screen === 'play');

  const run = ui.run;
  const stars = run ? rhythmStars(run) : 1;

  return (
    <KidGameShell
      title="💃 Nhảy theo nhạc"
      label="Pokémon nhảy theo nhạc"
      round={screen === 'pick' ? 0 : screen === 'play' ? 1 : 2}
      rounds={3}
      onClose={onClose}
      background="bg-gradient-to-b from-indigo-950 via-purple-900 to-fuchsia-800"
      dataAttrs={{ 'data-screen': screen, 'data-combo': ui.combo, 'data-score': ui.score }}
    >
      {screen === 'pick' && (
        <div className="px-4 py-4 space-y-3" data-testid="rhythm-map">
          <div className="flex items-center gap-3">
            <img src={player.image} alt={player.name} className="w-16 h-16 object-contain drop-shadow-xl dance-bob" />
            <p className="bubble-pop flex-1 px-4 py-2 rounded-3xl bg-white text-sm font-black text-purple-800 shadow">Chạm đúng lúc nốt nhạc rơi vào vòng tròn nhé! 🎶</p>
            <span className="shrink-0 px-2 py-1 rounded-full bg-white/90 text-xs font-black text-amber-600">⭐ {totalStars(progress)}/{RHYTHM_LEVELS.length * 3}</span>
          </div>
          <div className="rounded-3xl bg-white/10 p-2">
            <p className="px-1 text-sm font-black text-white">Tốc độ</p>
            <div className="mt-1 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Tốc độ">
              {SPEEDS.map((s) => (
                <button
                  key={s.id}
                  role="radio"
                  aria-checked={speed === s.id}
                  aria-label={s.label}
                  onClick={() => {
                    setSpeed(s.id);
                    try {
                      localStorage.setItem(SPEED_KEY, s.id);
                    } catch {
                      // ignore
                    }
                  }}
                  className={`flex flex-col items-center py-1.5 rounded-2xl font-black transition-all active:scale-95 ${speed === s.id ? 'bg-gradient-to-b from-amber-300 to-orange-500 text-slate-900 scale-105 shadow-lg' : 'bg-white/10 text-white'}`}
                >
                  <span className="text-xl leading-none">{s.icon}</span>
                  <span className="text-[11px]">{s.label}</span>
                  <span className="text-[9px] opacity-75">×{s.value}</span>
                </button>
              ))}
            </div>
          </div>
          {TIERS.map((tier) => (
            <section key={tier.id} className="rounded-3xl bg-white/10 p-2" aria-label={`Màn ${tier.label}`}>
              <p className="px-1 text-sm font-black text-white">
                {tier.icon} {tier.label}
              </p>
              <div className="mt-1.5 grid grid-cols-4 gap-2">
                {RHYTHM_LEVELS.map((lv, i) => {
                  if (lv.tier !== tier.id) return null;
                  const open = levelOpen(progress, i);
                  const stars = Number(progress[lv.id]) || 0;
                  const title = levelTitle(lv);
                  return (
                    <button
                      key={lv.id}
                      onClick={() => open && start(lv.id)}
                      disabled={!open}
                      aria-label={open ? `Nhảy bài ${title}` : `Màn ${i + 1} (chưa mở)`}
                      title={title}
                      className={`relative flex flex-col items-center p-1.5 rounded-2xl transition-transform ${open ? 'bg-white/95 shadow-lg active:scale-95' : 'bg-white/20 opacity-60'}`}
                    >
                      <span className="absolute left-1 top-0.5 text-[10px] font-black text-purple-400">{i + 1}</span>
                      <span className="text-2xl leading-none mt-1">{open ? SONG_ICONS[lv.songId] : '🔒'}</span>
                      <span className="w-full text-center text-[9px] font-black text-purple-800 leading-tight line-clamp-2 min-h-[22px]">{title}</span>
                      <StarRow stars={stars} size="w-3 h-3" />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {screen === 'done' && run && (
        <div className="bg-white/95 m-3 rounded-3xl">
          <SessionSummary
            title={stars === 3 ? 'Siêu sao nhảy múa! 🌟' : 'Nhảy giỏi lắm! 💃'}
            stars={stars}
            maxStars={3}
            gold={reward?.gold ?? 0}
            detail={`${levelTitle(RHYTHM_LEVELS.find((l) => l.id === run.levelId))} · tốc độ ×${run.speed} · Perfect ${run.counts.perfect} · Good ${run.counts.good} · Miss ${run.counts.miss} · Combo cao nhất ${run.maxCombo} · Chính xác ${Math.round(accuracy(run) * 100)}%`}
            onReplay={() => setScreen('pick')}
            onClose={onClose}
          />
        </div>
      )}

      {screen === 'play' && (
        <div className="relative px-2 pt-2 pb-4 flex flex-col gap-2">
          <div className="relative">
            <canvas ref={canvasRef} data-testid="rhythm-canvas" className="w-full h-auto rounded-3xl shadow-2xl" style={{ aspectRatio: `${W} / ${H}` }} onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (rect.width) tap(Math.min(LANES - 1, Math.floor(((e.clientX - rect.left) / rect.width) * LANES)));
            }} />
            {/* Dancing Pokemon, score and combo over the stage */}
            <div className="absolute inset-x-0 top-2 flex flex-col items-center pointer-events-none">
              <img key={ui.combo >= 10 ? 'party' : 'dance'} src={player.image} alt={player.name} className={`w-16 h-16 object-contain drop-shadow-2xl opacity-80 dance-bob ${ui.combo >= 10 ? 'battle-victory' : ''}`} />
              <p className="text-lg font-black text-white drop-shadow" data-testid="rhythm-score">{ui.score}</p>
              {ui.combo >= 2 && (
                <p key={`c-${ui.combo}`} className="chain-pop text-3xl font-black text-amber-300 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">{ui.combo} COMBO</p>
              )}
            </div>
            {ui.judge && (
              <span key={`j-${ui.judge.id}`} className={`judge-pop absolute text-2xl font-black drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] pointer-events-none ${JUDGE_TEXT[ui.judge.kind].cls}`} style={{ left: `${((ui.judge.lane + 0.5) / LANES) * 100}%`, top: `${(RING_Y / H) * 100 - 16}%` }} data-testid="judge">
                {JUDGE_TEXT[ui.judge.kind].text}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 py-1" data-testid="rhythm-pads">
            {LANE_INFO.map((l, i) => (
              <Pad key={i} lane={i} pressed={pressed === i} onTap={tap} />
            ))}
          </div>
        </div>
      )}
    </KidGameShell>
  );
}
