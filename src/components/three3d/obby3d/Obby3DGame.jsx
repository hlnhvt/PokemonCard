import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, Lock, RotateCcw } from '../../icons/PokeIcons';
import { COURSES, DT, OBBY3D_GAME, RACERS, SPECIES, createObby3D, step, snap, resultOf } from '../../../utils/three3d/obby3d';
import { getProgress, recordStars, goldForLevel, totalStars, isUnlocked } from '../../../utils/progress';
import { artworkUrl } from '../../../services/pokemonOnlineService';
import { sounds } from '../../../utils/soundEffects';
import { StarRow, GoldReward } from '../../kidgames/Common';
import { Countdown } from '../../carnival/CarnivalCommon';
import { useLoop, useLater } from '../../sports/sportsKit';
import { createObby3DScene } from './Obby3DScene';

const JOY_R = 54; // joystick radius in px
const COURSE_STYLE = ['from-pink-300 to-amber-200', 'from-violet-300 to-rose-200', 'from-sky-300 to-fuchsia-200', 'from-slate-300 to-amber-200', 'from-orange-300 to-sky-300'];
const MEDAL = { gold: '🥇', silver: '🥈', bronze: '🥉', ribbon: '🎗️' };
const MEDAL_TEXT = { gold: 'Huy chương Vàng!', silver: 'Huy chương Bạc!', bronze: 'Huy chương Đồng!', ribbon: 'Về đích rồi!' };
const DEX = Object.fromEntries(SPECIES.map((s) => [s.id, s.dex]));
const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** Avatar picture for a racer (artwork of its species, or the child's card). */
const racerImage = (r, playerImage) => (r.isPlayer && playerImage ? playerImage : DEX[r.species] ? artworkUrl(DEX[r.species]) : playerImage);

function CourseMap({ progress, player, onPlay }) {
  const next = COURSES.findIndex((c, i) => isUnlocked(COURSES, progress, i) && !progress[c.id]);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 pt-2 pb-6" data-testid="obby3d-map">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2 rounded-3xl bg-white/85 p-3 shadow">
          {player?.image && <img src={player.image} alt={player.name} draggable={false} className="obby3d-bob w-16 h-16 shrink-0 object-contain drop-shadow" />}
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black text-slate-800 leading-tight">Vượt chướng ngại Pokémon!</p>
            <p className="text-xs font-bold text-slate-600">Chạy, nhảy, lao qua chướng ngại cùng 9 bạn Pokémon. Về đích top 3 để nhận 3⭐!</p>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-100 text-sm font-black text-amber-600">⭐ {totalStars(progress)}/{COURSES.length * 3}</span>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {COURSES.map((c, i) => {
            const open = isUnlocked(COURSES, progress, i);
            const stars = Number(progress[c.id]) || 0;
            return (
              <button
                key={c.id}
                onClick={() => open && onPlay(i)}
                disabled={!open}
                aria-label={open ? `Đường đua ${i + 1}: ${c.name}` : `Đường đua ${i + 1} (chưa mở)`}
                data-testid={`obby3d-course-${i + 1}`}
                className={`relative flex items-center gap-3 p-3 rounded-2xl text-left bg-gradient-to-br ${COURSE_STYLE[i]} ${open ? 'shadow active:scale-95' : 'opacity-50 grayscale'} ${i === next ? 'ring-4 ring-amber-300 hint-pulse' : ''}`}
              >
                <span className="w-12 h-12 shrink-0 rounded-full bg-white/90 flex items-center justify-center text-2xl shadow-inner">{open ? c.icon : <Lock className="w-5 h-5 text-slate-500" />}</span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-black text-slate-700/80">Đường đua {i + 1}</span>
                  <span className="block text-base font-black leading-tight text-slate-900">{c.name}</span>
                  <StarRow stars={stars} size="w-4 h-4" />
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
 * "Vượt chướng ngại Pokémon": a Fall Guys style obstacle race with real 3D chibi Pokémon.
 * Left thumb: joystick; right: NHẢY (jump) and LAO (dive). Falling just respawns at the last flag.
 * `autopilot` lets the child's racer drive itself (tests and demos).
 */
export function Obby3DGame({ player, onClose, onGold, random = Math.random, autopilot = false }) {
  const [progress, setProgress] = useState(() => getProgress(OBBY3D_GAME));
  const [course, setCourse] = useState(null);
  const [phase, setPhaseState] = useState('map'); // map | ready | countdown | play | finishing | result | nogl
  const [runId, setRunId] = useState(0);
  const [hud, setHud] = useState(null);
  const [roster, setRoster] = useState([]);
  const [result, setResult] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [banner, setBanner] = useState(null);
  const phaseRef = useRef('map');
  const game = useRef(null);
  const sceneRef = useRef(null);
  const joyRef = useRef(null);
  const knobRef = useRef(null);
  const input = useRef({ joy: null, keys: {}, jump: false, jumpTap: false, dive: false, diveTap: false });
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
    game.current = createObby3D(i, { random, player, bot: autopilot });
    acc.current = 0;
    paid.current = false;
    Object.assign(input.current, { joy: null, jump: false, jumpTap: false, dive: false, diveTap: false });
    setCourse(i);
    setResult(null);
    setBanner(null);
    setToasts([]);
    setHud(snap(game.current));
    setRoster(game.current.racers.map((r) => ({ id: r.id, name: r.name, species: r.species, shiny: r.shiny, isPlayer: r.isPlayer })));
    setRunId((r) => r + 1);
    setPhase('ready');
  };

  const toMap = () => {
    game.current = null;
    setCourse(null);
    setResult(null);
    setHud(null);
    setPhase('map');
  };

  // The 3D world for the chosen course: built when the stage mounts (keyed by the run)
  const playerImage = player?.image;
  const mountStage = useCallback(
    (node) => {
      if (!node || !game.current) return undefined;
      let scene = null;
      try {
        scene = createObby3DScene(node, { state: game.current, playerImage });
      } catch (err) {
        console.warn('[obby3d] WebGL unavailable:', err);
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
    [playerImage]
  );

  // Keyboard: WASD / arrows to run, Space to jump, Shift to dive
  useEffect(() => {
    const map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'jump', Shift: 'dive' };
    const inp = input.current;
    const down = (e) => {
      if (e.key === 'Escape') return onClose();
      const k = map[e.key];
      if (!k) return undefined;
      if (phaseRef.current === 'play') e.preventDefault();
      if (k === 'jump' && !inp.keys.jump) inp.jumpTap = true;
      if (k === 'dive' && !inp.keys.dive) inp.diveTap = true;
      inp.keys[k] = true;
      return undefined;
    };
    const up = (e) => {
      const k = map[e.key];
      if (k) inp.keys[k] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onClose]);

  const readInput = () => {
    const i = input.current;
    let sx = 0;
    let sy = 0;
    if (i.joy) {
      sx = i.joy.vx;
      sy = -i.joy.vy;
    }
    if (i.keys.left) sx -= 1;
    if (i.keys.right) sx += 1;
    if (i.keys.up) sy += 1;
    if (i.keys.down) sy -= 1;
    const out = { sx: Math.max(-1, Math.min(1, sx)), sy: Math.max(-1, Math.min(1, sy)), jump: i.jump || i.jumpTap || !!i.keys.jump, dive: i.dive || i.diveTap || !!i.keys.dive };
    return out;
  };

  const finish = (s) => {
    const def = COURSES[s.level];
    const res = resultOf(s);
    const stars = res.stars;
    let gold = 0;
    let improved = false;
    if (stars > 0) {
      const saved = recordStars(OBBY3D_GAME, def.id, stars);
      setProgress(saved.progress);
      improved = saved.improved;
      gold = goldForLevel(stars, saved.improved) + (res.place === 1 ? 5 : 0);
      if (!paid.current) {
        paid.current = true;
        onGold?.(gold);
      }
    }
    setPhase('result');
    setResult({ ...res, gold, improved });
    if (stars > 0) {
      sounds.playSuccessFanfare();
      try {
        confetti({ particleCount: 50 + stars * 40, spread: 100, origin: { y: 0.35 }, zIndex: 9999, colors: ['#ff5fa2', '#ffd166', '#4dd6ff', '#7ee081', '#b388ff'] });
      } catch {
        // decoration
      }
    }
  };

  const handleEvents = (s) => {
    const scene = sceneRef.current;
    for (const e of s.events.splice(0)) {
      scene?.fx(e, s);
      const me = e.id === 0;
      if (e.type === 'raceEnd') finish(s);
      if (!me) continue;
      if (e.type === 'jump') sounds.playNote(660, { duration: 0.1, volume: 0.1 });
      else if (e.type === 'dive') sounds.playWhoosh();
      else if (e.type === 'knock') {
        sounds.playOops();
        toast('Ối! 💫', '#fde047');
      } else if (e.type === 'checkpoint') {
        sounds.playNote(784, { duration: 0.25, volume: 0.18 });
        sounds.playNote(1047, { duration: 0.35, delay: 0.12, volume: 0.16 });
        toast('Điểm lưu! 🚩', '#86efac');
      } else if (e.type === 'bounce') {
        sounds.playNote(392, { duration: 0.18, volume: 0.15 });
        sounds.playNote(784, { duration: 0.25, delay: 0.08, volume: 0.12 });
        toast('Boing!', '#f9a8d4');
      } else if (e.type === 'doorBreak') {
        sounds.playPop();
        toast('Bùm! Cửa vỡ!', '#fdba74');
      } else if (e.type === 'doorSolid') {
        sounds.playNote(180, { duration: 0.15, volume: 0.12 });
        toast('Cửa cứng! Thử cửa khác', '#cbd5e1');
      } else if (e.type === 'fall') {
        sounds.playNote(330, { duration: 0.35, volume: 0.12 });
        toast('Rơi rồi! Quay lại cờ 🚩', '#bae6fd');
      } else if (e.type === 'respawn') sounds.playNote(988, { duration: 0.3, volume: 0.12 });
      else if (e.type === 'assist') toast('Cố lên! Bé được đưa tới cờ tiếp theo ✨', '#c4b5fd');
      else if (e.type === 'ledge') sounds.playNote(523, { duration: 0.12, volume: 0.1 });
      else if (e.type === 'finish') {
        sounds.playCoin();
        setBanner({ place: e.place });
        setPhase('finishing');
      }
    }
  };

  useLoop((dt) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    const s = game.current;
    if (!s) return;
    const ph = phaseRef.current;
    if (ph === 'play' || ph === 'finishing') {
      acc.current += dt;
      while (acc.current >= DT && s.status !== 'done') {
        step(s, DT, readInput());
        input.current.jumpTap = false;
        input.current.diveTap = false;
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
  }, course != null && phase !== 'nogl');

  // Virtual joystick on the left half: wherever the thumb goes down
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
    const dead = (v) => (Math.abs(v) < 0.12 ? 0 : v);
    j.vx = dead(dx / JOY_R);
    j.vy = dead(dy / JOY_R);
    if (knobRef.current) knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };
  const onUp = (e) => {
    const j = input.current.joy;
    if (!j || j.id !== e.pointerId) return;
    input.current.joy = null;
    if (joyRef.current) joyRef.current.style.opacity = '0.35';
    if (knobRef.current) knobRef.current.style.transform = 'translate(-50%, -50%)';
  };
  const press = (key) => (e) => {
    e.stopPropagation();
    e.preventDefault?.();
    input.current[key] = true;
    input.current[`${key}Tap`] = true;
  };
  const release = (key) => () => {
    input.current[key] = false;
  };

  const def = course != null ? COURSES[course] : null;
  const hasNext = course != null && course + 1 < COURSES.length && isUnlocked(COURSES, progress, course + 1);
  const opponents = roster.filter((r) => !r.isPlayer);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-pink-200 select-none overflow-hidden"
      role="dialog"
      aria-label="Vượt chướng ngại Pokémon"
      data-phase={phase}
      data-course={course != null ? course + 1 : 0}
      data-place={hud ? hud.place : 0}
      data-score={result ? result.stars : 0}
    >
      {course == null ? (
        <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-pink-200 via-sky-100 to-amber-100">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-lg font-black text-slate-800 drop-shadow-sm">🏁 Vượt chướng ngại Pokémon</span>
            <button onClick={onClose} aria-label="Đóng trò chơi" className="ml-auto p-2 rounded-full bg-white text-slate-700 shadow">
              <X className="w-5 h-5" />
            </button>
          </div>
          <CourseMap progress={progress} player={player} onPlay={begin} />
        </div>
      ) : (
        <div className="relative flex-1 min-h-0">
          {/* 3D world */}
          <div key={`run${runId}`} ref={mountStage} className="absolute inset-0" data-testid="obby3d-stage" />
          {/* Left half: floating joystick */}
          <div className="absolute left-0 top-0 bottom-0 w-1/2 z-10 touch-none" data-testid="obby3d-touch" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
          {(phase === 'play' || phase === 'countdown') && (
            <div ref={joyRef} className="pointer-events-none absolute z-20 w-28 h-28 -ml-14 -mt-14 rounded-full border-4 border-white/80 bg-white/15 transition-opacity" style={{ left: '22%', top: '78%', opacity: 0.35 }} aria-hidden="true" data-testid="obby3d-joystick">
              <span ref={knobRef} className="absolute left-1/2 top-1/2 w-12 h-12 rounded-full bg-white/90 shadow-lg" style={{ transform: 'translate(-50%, -50%)' }} />
            </div>
          )}

          {/* HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-2 pt-2 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <button onClick={toMap} className="pointer-events-auto px-2.5 py-1.5 rounded-full bg-white/90 text-xs font-black text-slate-700 shadow active:scale-95" aria-label="Về bản đồ đường đua">
                ← Đường đua
              </button>
              <span className="min-w-0 truncate px-2.5 py-1 rounded-full bg-black/40 text-sm font-black text-white" data-testid="obby3d-course">
                {def.icon} {def.name}
              </span>
              <button onClick={onClose} aria-label="Đóng trò chơi" className="pointer-events-auto ml-auto shrink-0 p-2 rounded-full bg-white/90 text-slate-700 shadow">
                <X className="w-5 h-5" />
              </button>
            </div>
            {hud && (
              <div className="flex items-center gap-1.5">
                <span className={`obby3d-pop px-3 py-1 rounded-full text-lg font-black tabular-nums shadow ${hud.place <= 3 ? 'bg-amber-400 text-amber-950' : 'bg-white/90 text-slate-800'}`} key={hud.place} data-testid="obby3d-place">
                  {hud.place <= 3 ? '👑 ' : ''}Hạng {hud.finished ? hud.finalPlace : hud.place}/{RACERS}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/90 text-base font-black text-slate-700 tabular-nums shadow" data-testid="obby3d-time">
                  ⏱ {fmtTime(hud.t)}
                </span>
                <span className="ml-auto px-2.5 py-1 rounded-full bg-white/85 text-sm font-black text-emerald-700 shadow" data-testid="obby3d-flags">
                  🚩 {hud.cp}/{hud.cps}
                </span>
              </div>
            )}
            {hud && (
              <div className="mx-1 h-2.5 rounded-full bg-black/25 overflow-hidden" aria-hidden="true">
                <div className="h-full rounded-full bg-gradient-to-r from-pink-400 via-amber-300 to-emerald-400" style={{ width: `${Math.round(hud.progress * 100)}%` }} />
              </div>
            )}
          </div>

          {/* Floating texts */}
          <div className="pointer-events-none absolute left-1/2 top-[28%] z-30 -translate-x-1/2 flex flex-col items-center gap-1" aria-live="polite">
            {toasts.map((t) => (
              <span key={t.id} className="obby3d-toast whitespace-nowrap text-2xl font-black sport-banner" style={{ color: t.color }}>
                {t.text}
              </span>
            ))}
          </div>
          {phase === 'finishing' && banner && (
            <div className="pointer-events-none absolute inset-x-0 top-[38%] z-30 flex flex-col items-center px-4" data-testid="obby3d-finish-banner">
              <span className="obby3d-banner text-5xl font-black text-white sport-banner">VỀ ĐÍCH!</span>
              <span className="obby3d-banner mt-1 px-4 py-1 rounded-full bg-white/90 text-xl font-black text-pink-600" style={{ animationDelay: '150ms' }}>
                {MEDAL[banner.place === 1 ? 'gold' : banner.place === 2 ? 'silver' : banner.place === 3 ? 'bronze' : 'ribbon']} Hạng {banner.place}
              </span>
            </div>
          )}

          {/* Jump and dive buttons */}
          {(phase === 'play' || phase === 'countdown') && hud && (
            <div className="absolute right-3 bottom-4 z-30 flex items-end gap-3" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <button
                onPointerDown={press('dive')}
                onPointerUp={release('dive')}
                onPointerLeave={release('dive')}
                onPointerCancel={release('dive')}
                onContextMenu={(e) => e.preventDefault()}
                className={`touch-none mb-8 w-[68px] h-[68px] rounded-full flex flex-col items-center justify-center text-white font-black shadow-xl border-4 border-white/80 active:scale-95 ${hud.diving ? 'bg-sky-600 scale-105' : 'bg-gradient-to-b from-sky-400 to-indigo-500'}`}
                aria-label="Lao tới"
                data-testid="obby3d-dive"
              >
                <span className="text-2xl leading-none">💨</span>
                <span className="text-[11px] leading-none mt-0.5">LAO</span>
              </button>
              <button
                onPointerDown={press('jump')}
                onPointerUp={release('jump')}
                onPointerLeave={release('jump')}
                onPointerCancel={release('jump')}
                onContextMenu={(e) => e.preventDefault()}
                className="touch-none w-[88px] h-[88px] rounded-full flex flex-col items-center justify-center text-white font-black shadow-xl border-4 border-white/80 active:scale-95 bg-gradient-to-b from-pink-400 to-rose-500"
                aria-label="Nhảy"
                data-testid="obby3d-jump"
              >
                <span className="text-3xl leading-none">⤒</span>
                <span className="text-sm leading-none">NHẢY</span>
              </button>
            </div>
          )}

          {phase === 'ready' && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
              <div className="result-rise w-full max-w-sm max-h-full overflow-y-auto rounded-3xl bg-white/95 p-4 text-center shadow-2xl" data-testid="obby3d-ready">
                <p className="text-3xl">{def.icon}</p>
                <p className="text-xl font-black text-slate-800">
                  Đường đua {course + 1}: {def.name}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-600">{def.tip}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-1" aria-label="Các bạn đua">
                  {opponents.map((r) => (
                    <img key={r.id} src={racerImage(r, playerImage)} alt={r.name} title={r.name} draggable={false} className={`w-9 h-9 rounded-full bg-sky-50 object-contain ${r.shiny ? 'ring-2 ring-amber-300' : ''}`} />
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] font-black text-slate-600">
                  <span className="rounded-xl bg-sky-50 px-1 py-1.5">👈 Kéo bên trái để chạy</span>
                  <span className="rounded-xl bg-pink-50 px-1 py-1.5">⤒ NHẢY qua khe</span>
                  <span className="rounded-xl bg-indigo-50 px-1 py-1.5">💨 LAO xa hơn</span>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-500">Bàn phím: WASD / mũi tên, Space = nhảy, Shift = lao</p>
                <button onClick={() => setPhase('countdown')} className="mt-3 w-full py-3 rounded-2xl bg-gradient-to-b from-pink-400 to-rose-500 text-white text-xl font-black shadow-lg active:scale-95" data-testid="obby3d-start">
                  Sẵn sàng! 🏁
                </button>
              </div>
            </div>
          )}
          {phase === 'countdown' && <Countdown text="CHẠY NÀO!" onDone={() => setPhase('play')} />}

          {phase === 'result' && result && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 px-4" data-testid="obby3d-result" data-stars={result.stars} data-place={result.place}>
              <div className="w-full max-w-sm max-h-full overflow-y-auto rounded-3xl bg-gradient-to-b from-pink-100 to-white p-4 text-center shadow-2xl flex flex-col items-center gap-2">
                <p className="result-rise text-6xl obby3d-medal" aria-hidden="true">
                  {MEDAL[result.medal] || '🎗️'}
                </p>
                <p className="result-rise text-2xl font-black text-slate-800">{MEDAL_TEXT[result.medal] || 'Về đích rồi!'}</p>
                <p className="result-rise text-lg font-black text-pink-600" data-testid="obby3d-result-place">
                  Hạng {result.place}/{RACERS}
                </p>
                <div className="result-rise" style={{ animationDelay: '100ms' }}>
                  <StarRow stars={result.stars} size="w-11 h-11" animate />
                </div>
                {/* Podium */}
                <div className="result-rise flex items-end justify-center gap-2 w-full" style={{ animationDelay: '160ms' }} data-testid="obby3d-podium">
                  {[1, 0, 2].map((k) => {
                    const r = result.podium[k];
                    if (!r) return null;
                    const h = ['h-16', 'h-11', 'h-8'][k];
                    return (
                      <div key={k} className="flex flex-col items-center w-20">
                        {k === 0 && <span className="text-xl leading-none">👑</span>}
                        <img src={racerImage(r, playerImage)} alt={r.name} draggable={false} className={`w-12 h-12 object-contain ${r.isPlayer ? 'drop-shadow-[0_0_6px_rgba(250,204,21,0.9)]' : ''}`} />
                        <span className={`text-[11px] font-black truncate max-w-full ${r.isPlayer ? 'text-amber-600' : 'text-slate-600'}`}>{r.isPlayer ? 'Bé' : `${r.name}${r.shiny ? ' ✨' : ''}`}</span>
                        <div className={`w-full ${h} rounded-t-xl flex items-center justify-center text-white font-black ${['bg-amber-400', 'bg-slate-400', 'bg-orange-400'][k]}`}>{k + 1}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="result-rise grid grid-cols-2 gap-1.5 w-full text-sm font-black text-slate-700" style={{ animationDelay: '220ms' }}>
                  <span className="rounded-xl bg-sky-100 px-2 py-1">⏱ {fmtTime(result.time)}</span>
                  <span className="rounded-xl bg-pink-100 px-2 py-1">🙃 Rơi: {result.falls}</span>
                </div>
                {result.stars < 3 && <p className="text-xs font-bold text-slate-500">Về đích top 3 để được 3⭐ nhé!</p>}
                {result.gold > 0 && (
                  <div className="result-rise" style={{ animationDelay: '280ms' }}>
                    <GoldReward amount={result.gold} />
                  </div>
                )}
                <div className="result-rise flex flex-wrap justify-center gap-2 mt-1" style={{ animationDelay: '340ms' }}>
                  <button onClick={() => begin(course)} className="px-4 py-2.5 rounded-2xl bg-rose-500 text-white text-base font-black flex items-center gap-1.5 shadow active:scale-95" data-testid="obby3d-replay">
                    <RotateCcw className="w-5 h-5" /> Chơi lại
                  </button>
                  {hasNext && (
                    <button onClick={() => begin(course + 1)} className="px-4 py-2.5 rounded-2xl bg-emerald-500 text-white text-base font-black shadow active:scale-95" data-testid="obby3d-next">
                      Đường tiếp ➜
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
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-pink-300 to-sky-500 px-6" data-testid="obby3d-nogl">
              <div className="max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
                {player?.image && <img src={player.image} alt={player.name} className="mx-auto w-24 h-24 object-contain" />}
                <p className="mt-2 text-lg font-black text-slate-800">Ối! Máy này chưa vẽ được thế giới 3D.</p>
                <p className="mt-1 text-sm font-bold text-slate-600">Đường đua đang nghỉ. Bé thử trò chơi khác hoặc dùng máy khác nhé!</p>
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
