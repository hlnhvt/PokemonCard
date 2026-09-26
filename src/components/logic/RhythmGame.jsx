import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { LANES, LANE_INFO, FALL_TIME, RHYTHM_SONGS, createRun, tapLane, sweepMisses, rhythmStars, accuracy } from '../../utils/logic/rhythm';
import { songById, NOTES } from '../../utils/logic/music';
import { goldForStars } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { KidGameShell, SessionSummary } from '../kidgames/Common';
import { useLoop, useLater, useCanvas, burst, updateParticles } from '../sports/sportsKit';

const W = 360;
const H = 520;
const RING_Y = 440;
const LANE_W = W / LANES;
const JUDGE_TEXT = { perfect: { text: 'PERFECT!', cls: 'text-amber-300' }, good: { text: 'GOOD', cls: 'text-sky-300' }, miss: { text: 'MISS', cls: 'text-slate-300' } };
const SONG_ICONS = { hotcross: '🥐', twinkle: '⭐', mary: '🐑', joy: '🎉' };
const KEYS = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3, d: 0, f: 1, j: 2, k: 3 };

const laneX = (lane) => LANE_W * (lane + 0.5);

/**
 * "Pokémon nhảy theo nhạc": notes fall in 4 lanes; tap the lane when a note reaches the
 * ring. Every hit plays the song's own note and makes the Pokemon dance; combos grow.
 */
export function RhythmGame({ player, onClose, onGold }) {
  const canvasRef = useRef(null);
  const getCtx = useCanvas(canvasRef, W, H);
  const [screen, setScreen] = useState('pick'); // pick | play | done
  const [ui, setUi] = useState({ combo: 0, score: 0, judge: null, run: null });
  const game = useRef(null);
  const paid = useRef(false);
  const later = useLater();

  const start = (songId) => {
    paid.current = false;
    game.current = { run: createRun(songId), t: 0, particles: [], flash: Array(LANES).fill(0), lastNote: -1 };
    setUi({ combo: 0, score: 0, judge: null, run: game.current.run });
    setScreen('play');
  };

  const judge = (kind, lane) => setUi((u) => ({ ...u, judge: { kind, lane, id: (u.judge?.id || 0) + 1 } }));

  const tap = (lane) => {
    const g = game.current;
    if (!g || screen !== 'play') return;
    g.flash[lane] = 1;
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
      onGold?.(goldForStars(stars));
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
      ctx.font = '26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.55;
      ctx.fillText(LANE_INFO[l].arrow, laneX(l), RING_Y);
      ctx.globalAlpha = 1;
    }
    // Falling notes (with a trail)
    for (const n of g.run.chart) {
      if (g.run.judged[n.id]) continue;
      const k = 1 - (n.time - g.t) / FALL_TIME;
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
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(x - 7, y - 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText(LANE_INFO[n.lane].arrow, x, y + 1);
    }
    ctx.textBaseline = 'alphabetic';
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
        <div className="px-4 py-5 space-y-3">
          <div className="flex items-center gap-3">
            <img src={player.image} alt={player.name} className="w-20 h-20 object-contain drop-shadow-xl dance-bob" />
            <p className="bubble-pop px-4 py-2 rounded-3xl bg-white text-base font-black text-purple-800 shadow">Chạm đúng lúc nốt nhạc rơi vào vòng tròn nhé! 🎶</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {RHYTHM_SONGS.map((s, i) => {
              const song = songById(s.id);
              return (
                <button key={s.id} onClick={() => start(s.id)} aria-label={`Nhảy bài ${song.title}`} className="pop-in p-3 rounded-3xl bg-white/95 shadow-lg text-left active:scale-95" style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="text-4xl">{SONG_ICONS[s.id]}</span>
                  <p className="mt-1 text-base font-black text-purple-800 leading-tight">{song.title}</p>
                  <p className="text-xs font-bold text-fuchsia-600">{song.melody.length} nốt · {['Dễ', 'Dễ', 'Vừa', 'Khó'][i]}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {screen === 'done' && run && (
        <div className="bg-white/95 m-3 rounded-3xl">
          <SessionSummary
            title={stars === 3 ? 'Siêu sao nhảy múa! 🌟' : 'Nhảy giỏi lắm! 💃'}
            stars={stars}
            maxStars={3}
            gold={goldForStars(stars)}
            detail={`Perfect ${run.counts.perfect} · Good ${run.counts.good} · Miss ${run.counts.miss} · Combo cao nhất ${run.maxCombo} · Chính xác ${Math.round(accuracy(run) * 100)}%`}
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
          <div className="grid grid-cols-4 gap-2" data-testid="rhythm-pads">
            {LANE_INFO.map((l, i) => (
              <button key={i} onPointerDown={(e) => { e.preventDefault(); tap(i); }} aria-label={`Làn ${i + 1}`} className="py-4 rounded-2xl text-3xl shadow-lg active:scale-90 border-b-4 border-black/30" style={{ background: `linear-gradient(180deg, ${l.color}, ${l.color}bb)` }}>
                {l.arrow}
              </button>
            ))}
          </div>
        </div>
      )}
    </KidGameShell>
  );
}
