import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, Lock, RotateCcw, Zap } from '../../icons/PokeIcons';
import { LEVELS, DT, SKY3D_GAME, createSky3D, step, autopilot as autopilotInput, snap, clamp } from '../../../utils/three3d/sky3d';
import { getProgress, recordStars, goldForLevel, totalStars, isUnlocked } from '../../../utils/progress';
import { artworkUrl } from '../../../services/pokemonOnlineService';
import { sounds } from '../../../utils/soundEffects';
import { StarRow, GoldReward } from '../../kidgames/Common';
import { Countdown } from '../../carnival/CarnivalCommon';
import { useLoop, useLater } from '../../sports/sportsKit';
import { createSky3DScene } from './Sky3DScene';

const CHARIZARD_ART = artworkUrl(6);
const JOY_R = 56; // joystick radius in px
// Rising chime per ring (a major scale)
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24, 26];
const chime = (n, gold) => {
  const f = 523.25 * Math.pow(2, SCALE[Math.min(SCALE.length - 1, n)] / 12);
  sounds.playNote(f, { duration: 0.5, volume: 0.22 });
  if (gold) sounds.playNote(f * 1.5, { duration: 0.6, delay: 0.08, volume: 0.16 });
};
const TOD_STYLE = {
  morning: 'from-rose-200 to-sky-300',
  noon: 'from-sky-300 to-sky-500',
  afternoon: 'from-amber-200 to-sky-400',
  sunset: 'from-orange-300 to-indigo-500',
  dusk: 'from-fuchsia-400 to-indigo-800',
  night: 'from-indigo-800 to-slate-950',
};
const RESULT_TITLE = ['Hết giờ rồi!', 'Hoàn thành!', 'Giỏi lắm!', 'Tuyệt đỉnh!'];
const isCharizard = (p) => /charizard/i.test(p?.name || '');
const fmt = (t) => `${Math.ceil(Math.max(0, t))}`;

/** Level map: ten courses, each opens once the one before has a star. */
function LevelMap({ progress, player, onPlay }) {
  const next = LEVELS.findIndex((l, i) => isUnlocked(LEVELS, progress, i) && !progress[l.id]);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-2 pb-6" data-testid="sky3d-map">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2 rounded-3xl bg-white/80 p-3 shadow">
          <div className="relative w-20 h-16 shrink-0">
            <img src={CHARIZARD_ART} alt="Charizard" draggable={false} className="sky3d-float absolute inset-0 w-full h-full object-contain drop-shadow" />
            {!isCharizard(player) && player?.image && <img src={player.image} alt={player.name} draggable={false} className="sky3d-float absolute left-5 -top-2 w-10 h-10 object-contain drop-shadow" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black text-slate-800 leading-tight">Cưỡi Charizard bay lượn!</p>
            <p className="text-xs font-bold text-slate-600">Bay xuyên qua các vòng sáng theo thứ tự trước khi hết giờ.</p>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-100 text-sm font-black text-amber-600">⭐ {totalStars(progress)}/{LEVELS.length * 3}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LEVELS.map((lv, i) => {
            const open = isUnlocked(LEVELS, progress, i);
            const stars = Number(progress[lv.id]) || 0;
            return (
              <button
                key={lv.id}
                onClick={() => open && onPlay(i)}
                disabled={!open}
                aria-label={open ? `Màn ${i + 1}` : `Màn ${i + 1} (chưa mở)`}
                data-testid={`sky3d-level-${i + 1}`}
                className={`relative flex items-center gap-2 p-2 rounded-2xl text-left bg-gradient-to-br ${TOD_STYLE[lv.tod]} ${open ? 'shadow active:scale-95' : 'opacity-50 grayscale'} ${i === next ? 'ring-4 ring-amber-300 hint-pulse' : ''}`}
              >
                <span className="w-10 h-10 shrink-0 rounded-full bg-white/90 flex items-center justify-center text-xl shadow-inner">{open ? lv.icon : <Lock className="w-5 h-5 text-slate-500" />}</span>
                <span className="min-w-0">
                  <span className={`block text-[11px] font-black ${['dusk', 'night', 'sunset'].includes(lv.tod) ? 'text-white/80' : 'text-slate-700/80'}`}>Màn {i + 1}</span>
                  <span className={`block text-sm font-black leading-tight ${['dusk', 'night', 'sunset'].includes(lv.tod) ? 'text-white' : 'text-slate-900'}`}>{lv.name}</span>
                  <StarRow stars={stars} size="w-3.5 h-3.5" />
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
 * "Cưỡi Charizard bay lượn": the child's Pokemon rides Charizard through glowing rings over a
 * floating sky archipelago. Drag like a joystick (or tilt), boost, collect stars, dodge Team Rocket.
 * `autopilot` flies by itself (tests and demos).
 */
export function Sky3DGame({ player, onClose, onGold, random = Math.random, autopilot = false }) {
  const [progress, setProgress] = useState(() => getProgress(SKY3D_GAME));
  const [level, setLevel] = useState(null);
  const [phase, setPhaseState] = useState('map'); // map | ready | countdown | play | result | nogl
  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [flash, setFlash] = useState(0);
  const [tilt, setTilt] = useState(false);
  const [tiltMsg, setTiltMsg] = useState(null);
  const [info, setInfo] = useState(null); // { timeLimit, star3 } of the current course
  const phaseRef = useRef('map');
  const game = useRef(null);
  const sceneRef = useRef(null);
  const arrowRef = useRef(null);
  const glareRef = useRef(null);
  const joyRef = useRef(null);
  const knobRef = useRef(null);
  const input = useRef({ joy: null, keys: {}, tilt: null, boost: false });
  const acc = useRef(0);
  const hudT = useRef(0);
  const paid = useRef(false);
  const toastId = useRef(0);
  const later = useLater();

  const setPhase = (p) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const toast = (text, color = '#fde047') => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, color }]);
    later(() => setToasts((t) => t.filter((x) => x.id !== id)), 1300);
  };

  const begin = (i) => {
    game.current = createSky3D(i, { random });
    acc.current = 0;
    paid.current = false;
    input.current.joy = null;
    input.current.boost = false;
    setLevel(i);
    setResult(null);
    setToasts([]);
    setHud(snap(game.current));
    setInfo({ timeLimit: game.current.course.timeLimit, star3: game.current.course.star3 });
    setRunId((r) => r + 1);
    setPhase('ready');
  };

  const toMap = () => {
    game.current = null;
    setLevel(null);
    setResult(null);
    setHud(null);
    setPhase('map');
  };

  // The 3D world for the chosen level: built when the stage mounts (it is keyed by the run)
  const playerImage = player?.image;
  const riderIsCharizard = isCharizard(player);
  const mountStage = useCallback(
    (node) => {
      if (!node || !game.current) return undefined;
      let scene = null;
      try {
        scene = createSky3DScene(node, { course: game.current.course, playerImage, riderIsCharizard });
      } catch (err) {
        console.warn('[sky3d] WebGL unavailable:', err);
        phaseRef.current = 'nogl';
        setPhaseState('nogl');
        return undefined;
      }
      sceneRef.current = scene;
      return () => {
        if (sceneRef.current === scene) sceneRef.current = null;
        scene.dispose();
      };
    },
    [playerImage, riderIsCharizard]
  );

  // Keyboard
  useEffect(() => {
    const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'boost', Shift: 'boost' };
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

  // Device tilt (optional)
  useEffect(() => {
    if (!tilt) return undefined;
    let base = null;
    const inp = input.current;
    const onTilt = (e) => {
      if (e.beta == null || e.gamma == null) return;
      const angle = window.screen?.orientation?.angle ?? window.orientation ?? 0;
      let steer;
      let pitch;
      if (angle === 90) {
        steer = e.beta;
        pitch = -e.gamma;
      } else if (angle === -90 || angle === 270) {
        steer = -e.beta;
        pitch = e.gamma;
      } else {
        steer = e.gamma;
        pitch = e.beta;
      }
      if (base == null) base = pitch;
      inp.tilt = { turn: clamp(steer / 25, -1, 1), climb: clamp((pitch - base) / 20, -1, 1) };
    };
    window.addEventListener('deviceorientation', onTilt);
    return () => {
      window.removeEventListener('deviceorientation', onTilt);
      inp.tilt = null;
    };
  }, [tilt]);

  const toggleTilt = async () => {
    if (tilt) {
      setTilt(false);
      return;
    }
    try {
      const D = window.DeviceOrientationEvent;
      if (!D) throw new Error('none');
      if (typeof D.requestPermission === 'function') {
        const r = await D.requestPermission();
        if (r !== 'granted') throw new Error('denied');
      }
      setTilt(true);
      setTiltMsg('Nghiêng máy để lái! Kéo tay vẫn dùng được.');
    } catch {
      setTiltMsg('Máy này chưa nghiêng được, bé kéo tay để lái nhé!');
    }
    later(() => setTiltMsg(null), 2600);
  };

  const readInput = (s) => {
    if (autopilot) return autopilotInput(s);
    const i = input.current;
    let turn = 0;
    let climb = 0;
    if (i.tilt) {
      turn = i.tilt.turn;
      climb = i.tilt.climb;
    }
    if (i.joy) {
      turn = i.joy.vx;
      climb = -i.joy.vy;
    }
    if (i.keys.left) turn -= 1;
    if (i.keys.right) turn += 1;
    if (i.keys.up) climb += 1;
    if (i.keys.down) climb -= 1;
    return { turn: clamp(turn, -1, 1), climb: clamp(climb, -1, 1), boost: i.boost || !!i.keys.boost };
  };

  const finish = (s) => {
    const lv = LEVELS[s.level];
    const stars = s.earned;
    let gold = 0;
    let improved = false;
    if (stars > 0) {
      const saved = recordStars(SKY3D_GAME, lv.id, stars);
      setProgress(saved.progress);
      improved = saved.improved;
      gold = goldForLevel(stars, saved.improved);
      if (!paid.current) {
        paid.current = true;
        onGold?.(gold);
      }
    }
    setPhase('result');
    const r = { stars, gold, improved, hits: s.hits, total: s.rings.length, timeLeft: s.timeLeft, items: s.stars + s.balls, combo: s.bestCombo, finished: s.status === 'done', trail: s.trailSeconds };
    later(() => {
      setResult(r);
      if (stars > 0) {
        sounds.playSuccessFanfare();
        try {
          confetti({ particleCount: 60 + stars * 40, spread: 90, origin: { y: 0.4 }, zIndex: 9999 });
        } catch {
          // decoration
        }
      } else sounds.playOops();
    }, 700);
  };

  const handleEvents = (s) => {
    const scene = sceneRef.current;
    for (const e of s.events.splice(0)) {
      scene?.fx(e, s);
      if (e.type === 'ring') {
        chime(e.count - 1, e.gold);
        toast(e.gold ? `Vòng vàng! +${e.bonus}s` : `+${e.bonus}s`, e.gold ? '#fbbf24' : '#a5f3fc');
      } else if (e.type === 'combo') {
        if (e.n >= 3) sounds.playPop();
        toast(`Liên hoàn x${e.n}!`, '#f9a8d4');
      } else if (e.type === 'miss') {
        sounds.playNote(220, { duration: 0.3, volume: 0.12 });
        toast('Hụt vòng rồi!', '#cbd5e1');
      } else if (e.type === 'item') {
        sounds.playCoin();
        toast(e.kind === 'star' ? '+1 ⭐' : '+1 Poké Ball', '#fde68a');
      } else if (e.type === 'bump') {
        sounds.playOops();
        toast(e.kind === 'storm' ? 'Ối! Mây giông! −3s' : 'Ối! Bóng Rocket! −3s', '#fca5a5');
      } else if (e.type === 'cloud') {
        setFlash((f) => f + 1);
      } else if (e.type === 'wind') {
        sounds.playWhoosh();
      } else if (e.type === 'trail' && e.seconds % 3 === 0) {
        sounds.playNote(880, { duration: 0.2, volume: 0.1 });
        toast(`Bay theo bạn! +${e.seconds}`, '#c4b5fd');
      } else if (e.type === 'finish' || e.type === 'timeout') finish(s);
    }
  };

  useLoop((dt) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    const s = game.current;
    if (!s) return;
    if (phaseRef.current === 'play') {
      acc.current += dt;
      const inp = readInput(s);
      if (inp.boost && !s.boosting && !s.boostLocked && s.boost > 0.05) sounds.playEnergySurge?.();
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
    const scene = sceneRef.current;
    if (!scene) return;
    const hints = scene.update(s, dt) || {};
    const a = arrowRef.current;
    if (a) {
      if (hints.arrow && phaseRef.current === 'play') {
        a.style.display = 'block';
        a.style.left = `${hints.arrow.x}%`;
        a.style.top = `${hints.arrow.y}%`;
        a.style.transform = `translate(-50%, -50%) rotate(${-hints.arrow.angle}rad)`;
      } else a.style.display = 'none';
    }
    const g = glareRef.current;
    if (g) {
      if (hints.glare) {
        g.style.opacity = String(hints.glare.a * 0.8);
        g.style.left = `${hints.glare.x}%`;
        g.style.top = `${hints.glare.y}%`;
      } else g.style.opacity = '0';
    }
  }, level != null && phase !== 'nogl');

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
    const dead = (v) => (Math.abs(v) < 0.1 ? 0 : v);
    j.vx = dead(dx / JOY_R);
    j.vy = dead(dy / JOY_R);
    if (knobRef.current) knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };
  const onUp = (e) => {
    const j = input.current.joy;
    if (!j || j.id !== e.pointerId) return;
    input.current.joy = null;
    if (joyRef.current) joyRef.current.style.opacity = '0';
  };

  const boostOn = (e) => {
    e.stopPropagation();
    input.current.boost = true;
  };
  const boostOff = () => {
    input.current.boost = false;
  };

  const lv = level != null ? LEVELS[level] : null;
  const hasNext = level != null && level + 1 < LEVELS.length && isUnlocked(LEVELS, progress, level + 1);
  const playing = phase === 'play' && hud;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-sky-300 select-none overflow-hidden"
      role="dialog"
      aria-label="Cưỡi Charizard bay lượn"
      data-phase={phase}
      data-level={level != null ? level + 1 : 0}
      data-rings={hud ? hud.hits : 0}
      data-score={result ? result.stars : 0}
    >
      {level == null ? (
        <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-sky-300 via-sky-200 to-emerald-200">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-lg font-black text-slate-800 drop-shadow-sm">🔥 Cưỡi Charizard bay lượn</span>
            <button onClick={onClose} aria-label="Đóng trò chơi" className="ml-auto p-2 rounded-full bg-white text-slate-700 shadow">
              <X className="w-5 h-5" />
            </button>
          </div>
          <LevelMap progress={progress} player={player} onPlay={begin} />
        </div>
      ) : (
        <div className="relative flex-1 min-h-0">
          {/* 3D world */}
          <div key={`run${runId}`} ref={mountStage} className="absolute inset-0" data-testid="sky3d-stage" />
          {/* Touch layer: drag anywhere like a joystick */}
          <div className="absolute inset-0 z-10 touch-none" data-testid="sky3d-touch" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
          <div ref={joyRef} className="pointer-events-none absolute z-20 w-28 h-28 -ml-14 -mt-14 rounded-full border-4 border-white/70 bg-white/15 opacity-0 transition-opacity" aria-hidden="true" data-testid="sky3d-joystick">
            <span ref={knobRef} className="absolute left-1/2 top-1/2 w-12 h-12 rounded-full bg-white/85 shadow-lg" style={{ transform: 'translate(-50%, -50%)' }} />
          </div>
          {/* Sun glare, speed lines, cloud puff */}
          <div ref={glareRef} className="pointer-events-none absolute z-10 w-[120vmax] h-[120vmax] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0" style={{ background: 'radial-gradient(circle, rgba(255,248,220,0.75) 0%, rgba(255,230,170,0.25) 18%, rgba(255,255,255,0) 45%)' }} aria-hidden="true" />
          {playing && hud.boosting && <div className="sky3d-speedlines pointer-events-none absolute inset-0 z-10" aria-hidden="true" data-testid="sky3d-speedlines" />}
          {flash > 0 && <div key={`puff${flash}`} className="sky3d-cloudflash pointer-events-none absolute inset-0 z-10 bg-white" aria-hidden="true" />}
          {/* Arrow to the next ring when it is off screen */}
          <div ref={arrowRef} className="pointer-events-none absolute z-20 hidden" aria-hidden="true" data-testid="sky3d-arrow">
            <span className="sky3d-arrow block text-4xl text-amber-300 drop-shadow-[0_0_6px_rgba(0,0,0,0.6)]">➤</span>
          </div>

          {/* HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-2 pt-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <button onClick={toMap} className="pointer-events-auto px-2.5 py-1.5 rounded-full bg-white/90 text-xs font-black text-slate-700 shadow active:scale-95" aria-label="Về bản đồ màn">
                ← Màn
              </button>
              <span className="min-w-0 truncate px-2.5 py-1 rounded-full bg-black/40 text-sm font-black text-white" data-testid="sky3d-level">
                {lv.icon} {level + 1}. {lv.name}
              </span>
              <button onClick={onClose} aria-label="Đóng trò chơi" className="pointer-events-auto ml-auto shrink-0 p-2 rounded-full bg-white/90 text-slate-700 shadow">
                <X className="w-5 h-5" />
              </button>
            </div>
            {hud && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-base font-black tabular-nums shadow ${hud.timeLeft < 10 ? 'bg-rose-500 text-white hint-pulse' : 'bg-white/90 text-slate-800'}`} data-testid="sky3d-time">
                  ⏱ {fmt(hud.timeLeft)}s
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/90 text-base font-black text-sky-700 tabular-nums shadow" data-testid="sky3d-rings">
                  ◎ {hud.hits}/{hud.total}
                </span>
                <span className="px-2 py-1 rounded-full bg-white/80 text-sm font-black text-amber-600 tabular-nums shadow">
                  ⭐ {hud.stars} · 🔴 {hud.balls}
                </span>
                <button onClick={toggleTilt} className={`pointer-events-auto ml-auto px-2.5 py-1 rounded-full text-xs font-black shadow active:scale-95 ${tilt ? 'bg-emerald-500 text-white' : 'bg-white/80 text-slate-700'}`} aria-pressed={tilt} data-testid="sky3d-tilt">
                  📱 Nghiêng {tilt ? 'BẬT' : 'TẮT'}
                </button>
              </div>
            )}
            {tiltMsg && <p className="self-center px-3 py-1 rounded-full bg-black/60 text-xs font-bold text-white">{tiltMsg}</p>}
          </div>

          {/* Floating texts */}
          <div className="pointer-events-none absolute left-1/2 top-[30%] z-30 -translate-x-1/2 flex flex-col items-center gap-1" aria-live="polite">
            {toasts.map((t) => (
              <span key={t.id} className="sky3d-toast whitespace-nowrap text-2xl font-black sport-banner" style={{ color: t.color }}>
                {t.text}
              </span>
            ))}
          </div>
          {playing && hud.outside && (
            <div className="pointer-events-none absolute inset-x-0 top-[44%] z-30 flex justify-center" data-testid="sky3d-wind">
              <span className="sky3d-wind px-4 py-2 rounded-2xl bg-sky-900/60 text-white text-base font-black">🌬️ Gió đưa bé quay lại đường bay!</span>
            </div>
          )}
          {playing && hud.inTrail && (
            <div className="pointer-events-none absolute inset-x-0 bottom-28 z-30 flex justify-center">
              <span className="px-3 py-1 rounded-full bg-violet-500/80 text-white text-sm font-black">✨ Đang bay theo {lv.friend?.name}!</span>
            </div>
          )}

          {/* Boost button with its meter */}
          {(phase === 'play' || phase === 'countdown') && hud && (
            <div className="absolute right-3 bottom-4 z-30 flex flex-col items-center gap-1" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <div className="w-20 h-2.5 rounded-full bg-black/40 overflow-hidden" aria-hidden="true">
                <div className={`h-full rounded-full ${hud.boostLocked ? 'bg-slate-300' : 'bg-gradient-to-r from-orange-400 to-yellow-300'}`} style={{ width: `${Math.round(hud.boost * 100)}%` }} />
              </div>
              <button
                onPointerDown={boostOn}
                onPointerUp={boostOff}
                onPointerLeave={boostOff}
                onPointerCancel={boostOff}
                onContextMenu={(e) => e.preventDefault()}
                className={`touch-none w-20 h-20 rounded-full flex flex-col items-center justify-center text-white font-black shadow-xl border-4 border-white/80 active:scale-95 ${hud.boostLocked ? 'bg-slate-400' : hud.boosting ? 'bg-orange-500 scale-105' : 'bg-gradient-to-b from-orange-400 to-red-500'}`}
                aria-label="Tăng tốc"
                data-testid="sky3d-boost"
              >
                <Zap className="w-7 h-7" />
                <span className="text-xs leading-none">Tăng tốc</span>
              </button>
            </div>
          )}

          {phase === 'ready' && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 px-4">
              <div className="result-rise w-full max-w-sm rounded-3xl bg-white/95 p-4 text-center shadow-2xl" data-testid="sky3d-ready">
                <p className="text-3xl">{lv.icon}</p>
                <p className="text-xl font-black text-slate-800">
                  Màn {level + 1}: {lv.name}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-600">{lv.tip}</p>
                <p className="mt-2 text-xs font-bold text-slate-500">
                  {lv.rings} vòng · ⏱ {info?.timeLimit}s · 3⭐: qua hết vòng, còn ≥ {info?.star3}s
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">Bàn phím: mũi tên / WASD, Space = tăng tốc</p>
                <button onClick={() => setPhase('countdown')} className="mt-3 w-full py-3 rounded-2xl bg-gradient-to-b from-orange-400 to-red-500 text-white text-xl font-black shadow-lg active:scale-95" data-testid="sky3d-start">
                  Cất cánh! 🔥
                </button>
              </div>
            </div>
          )}
          {phase === 'countdown' && <Countdown text="BAY NÀO!" onDone={() => setPhase('play')} />}

          {phase === 'result' && result && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4" data-testid="sky3d-result" data-stars={result.stars}>
              <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-sky-100 to-white p-4 text-center shadow-2xl flex flex-col items-center gap-2">
                <p className="result-rise text-3xl font-black text-slate-800">{RESULT_TITLE[result.stars]}</p>
                <div className="result-rise" style={{ animationDelay: '100ms' }}>
                  <StarRow stars={result.stars} size="w-12 h-12" animate />
                </div>
                <div className="result-rise grid grid-cols-2 gap-1.5 w-full text-sm font-black text-slate-700" style={{ animationDelay: '180ms' }}>
                  <span className="rounded-xl bg-sky-100 px-2 py-1">◎ Vòng: {result.hits}/{result.total}</span>
                  <span className="rounded-xl bg-amber-100 px-2 py-1">⏱ Còn: {fmt(result.timeLeft)}s</span>
                  <span className="rounded-xl bg-yellow-100 px-2 py-1">⭐ Nhặt: {result.items}</span>
                  <span className="rounded-xl bg-pink-100 px-2 py-1">🔗 Liên hoàn: x{result.combo}</span>
                </div>
                {result.stars === 0 && <p className="text-sm font-bold text-slate-600">Bay qua ít nhất nửa số vòng nhé. Thử lại nào!</p>}
                {result.stars > 0 && result.stars < 3 && <p className="text-xs font-bold text-slate-500">3⭐: qua hết vòng và còn ≥ {info?.star3}s</p>}
                {result.gold > 0 && (
                  <div className="result-rise" style={{ animationDelay: '260ms' }}>
                    <GoldReward amount={result.gold} />
                  </div>
                )}
                <div className="result-rise flex flex-wrap justify-center gap-2 mt-1" style={{ animationDelay: '340ms' }}>
                  <button onClick={() => begin(level)} className="px-4 py-2.5 rounded-2xl bg-red-500 text-white text-base font-black flex items-center gap-1.5 shadow active:scale-95" data-testid="sky3d-replay">
                    <RotateCcw className="w-5 h-5" /> Chơi lại
                  </button>
                  {hasNext && (
                    <button onClick={() => begin(level + 1)} className="px-4 py-2.5 rounded-2xl bg-emerald-500 text-white text-base font-black shadow active:scale-95" data-testid="sky3d-next">
                      Màn tiếp ➜
                    </button>
                  )}
                  <button onClick={toMap} className="px-4 py-2.5 rounded-2xl bg-sky-600 text-white text-base font-black shadow active:scale-95">
                    Bản đồ
                  </button>
                </div>
              </div>
            </div>
          )}

          {phase === 'nogl' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-sky-400 to-indigo-600 px-6" data-testid="sky3d-nogl">
              <div className="max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
                <img src={CHARIZARD_ART} alt="Charizard" className="mx-auto w-24 h-24 object-contain" />
                <p className="mt-2 text-lg font-black text-slate-800">Ối! Máy này chưa vẽ được thế giới 3D.</p>
                <p className="mt-1 text-sm font-bold text-slate-600">Charizard đang nghỉ ngơi. Bé thử trò chơi khác hoặc dùng máy khác nhé!</p>
                <button onClick={onClose} className="mt-3 px-6 py-2.5 rounded-2xl bg-sky-600 text-white text-base font-black shadow active:scale-95">
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
