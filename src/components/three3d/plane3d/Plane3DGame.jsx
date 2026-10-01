import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, RotateCcw, Lock, Map as MapIcon, ArrowRight, Heart, Ball, Star } from '../../icons/PokeIcons';
import { useLoop, useLater } from '../../sports/sportsKit';
import { Countdown } from '../../carnival/CarnivalCommon';
import { GoldReward } from '../../kidgames/Common';
import { sounds } from '../../../utils/soundEffects';
import { goldForLevel } from '../../../utils/progress';
import {
  createFlight, startFlight, spinUp, step, input, acceptContinue, declineContinue, snap, botAction, steerTo,
  LEVELS, DIFFS, DIFF_IDS, LIVERIES, POWER, HEARTS, CONTINUE_TIME,
} from '../../../utils/three3d/plane3d';
import { loadSettings, saveSettings, loadProgress, saveLevelStars, starsOf, levelUnlocked } from '../../../utils/three3d/plane3d/store';
import { createPlane3DScene } from './Plane3DScene';

const TITLE = 'Đua máy bay Pokémon';
const SWIPE = 24;
const POWER_UI = {
  shield: { icon: '🛡️', color: 'bg-cyan-400', toast: 'Khiên bong bóng!' },
  magnet: { icon: '🧲', color: 'bg-sky-400', toast: 'Nam châm hút xu!' },
  boost: { icon: '🔥', color: 'bg-orange-400', toast: 'Tăng tốc – vô địch!' },
};
const TONE = { white: 'text-white', gold: 'text-amber-300', pink: 'text-pink-300', sky: 'text-sky-200', green: 'text-emerald-300', red: 'text-rose-300' };

function Coin({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#facc15" stroke="#b45309" strokeWidth="2" />
      <path d="M12 6.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#fff3b0" stroke="#b45309" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function PlaneGlyph({ livery, className = 'w-10 h-10' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <ellipse cx="24" cy="26" rx="20" ry="4.5" fill={livery.wing} stroke="#2a2440" strokeWidth="1.6" />
      <rect x="6" y="22.5" width="5" height="7" rx="2" fill={livery.trim} />
      <rect x="37" y="22.5" width="5" height="7" rx="2" fill={livery.trim} />
      <ellipse cx="24" cy="24" rx="8" ry="12" fill={livery.body} stroke="#2a2440" strokeWidth="1.6" />
      <path d="M16.5 25.5h15" stroke={livery.stripe} strokeWidth="3" />
      <ellipse cx="24" cy="19" rx="4" ry="4.5" fill={livery.glass} stroke="#2a2440" strokeWidth="1.2" />
      <circle cx="24" cy="10" r="2.6" fill={livery.trim} stroke="#2a2440" strokeWidth="1.2" />
      <path d="M14 10.5h20" stroke="#5a3f2e" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Three stars, the earned ones gold, the others faded. */
function StarRow({ stars, size = 'w-8 h-8', animate = false }) {
  return (
    <span className="flex gap-1" aria-label={`${stars} sao`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} className={`${size} ${i < stars ? 'drop-shadow' : 'opacity-25 grayscale'} ${animate && i < stars ? 'star-pop' : ''}`} style={animate ? { animationDelay: `${i * 150}ms` } : undefined} />
      ))}
    </span>
  );
}

/** End of a level: stars, coins, hearts, gold (paid once). */
function Result({ result, onReplay, onNext, onMap, onClose, onGold }) {
  const paid = useRef(false);
  useEffect(() => {
    if (paid.current) return;
    paid.current = true;
    if (result.finished) {
      onGold?.(result.gold);
      sounds.playSuccessFanfare();
      try {
        confetti({ particleCount: 60 + result.stars * 40, spread: 90, origin: { y: 0.4 }, zIndex: 9999, colors: ['#ef4444', '#facc15', '#38bdf8', '#4ade80', '#f472b6', '#ffffff'] });
      } catch {
        // decoration only
      }
    } else sounds.playOops();
  }, [onGold, result]);
  const L = LEVELS[result.level];
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-4 bg-slate-950/65 backdrop-blur-sm" data-testid="plane3d-result" data-stars={result.stars}>
      <div className="result-rise w-full max-w-sm rounded-3xl bg-gradient-to-b from-sky-400 via-indigo-500 to-violet-700 border-4 border-white/85 shadow-2xl p-5 text-center text-white">
        <p className="text-sm font-black text-white/80">
          {L.icon} Màn {L.n} · {L.name} · {DIFFS[result.diff].label}
        </p>
        <p className="mt-1 text-3xl font-black drop-shadow">{result.finished ? (result.stars === 3 ? 'Tuyệt đỉnh! 🏆' : 'Về đích rồi! 🎉') : 'Thử lại nhé!'}</p>
        <div className="mt-2 flex justify-center">
          <StarRow stars={result.stars} size="w-12 h-12" animate />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/15 py-2">
            <p className="text-xs font-bold text-white/80">Xu nhặt được</p>
            <p className="text-2xl font-black tabular-nums flex items-center justify-center gap-1" data-testid="plane3d-result-coins">
              <Coin className="w-6 h-6" /> {result.coins}/{result.coinsTotal}
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 py-2">
            <p className="text-xs font-bold text-white/80">Tim còn lại</p>
            <p className="text-2xl font-black flex items-center justify-center gap-0.5">
              {Array.from({ length: HEARTS }, (_, i) => (
                <Heart key={i} className={`w-6 h-6 ${i < result.hearts ? '' : 'opacity-30 grayscale'}`} />
              ))}
            </p>
          </div>
        </div>
        {result.rings > 0 && <p className="mt-2 text-sm font-black text-amber-200">⭐ {result.rings} vòng sao vàng</p>}
        <p className="mt-2 text-xs font-bold text-white/75">1★ về đích · 2★ còn ≥ 2 tim · 3★ thêm ≥ 70% xu</p>
        {result.finished && (
          <div className="mt-3 flex justify-center">
            <GoldReward amount={result.gold} dark />
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={onReplay} className="py-3 rounded-2xl bg-red-500 text-white text-lg font-black flex items-center justify-center gap-2 shadow-lg active:scale-95" data-testid="plane3d-replay">
            <RotateCcw className="w-5 h-5" /> Bay lại
          </button>
          {onNext ? (
            <button onClick={onNext} className="py-3 rounded-2xl bg-emerald-500 text-white text-lg font-black flex items-center justify-center gap-2 shadow-lg active:scale-95" data-testid="plane3d-next">
              Màn tiếp <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={onMap} className="py-3 rounded-2xl bg-white text-indigo-700 text-lg font-black flex items-center justify-center gap-2 shadow-lg active:scale-95">
              <MapIcon className="w-5 h-5" /> Bản đồ
            </button>
          )}
          {onNext && (
            <button onClick={onMap} className="py-2.5 rounded-2xl bg-white/90 text-indigo-700 font-black flex items-center justify-center gap-2 shadow active:scale-95" data-testid="plane3d-map">
              <MapIcon className="w-5 h-5" /> Bản đồ
            </button>
          )}
          <button onClick={onClose} className={`py-2.5 rounded-2xl bg-white/25 text-white font-black shadow active:scale-95 ${onNext ? '' : 'col-span-2'}`}>
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}

function DiffPicker({ diff, onPick }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Độ khó">
      {DIFF_IDS.map((id) => {
        const D = DIFFS[id];
        const on = id === diff;
        return (
          <button
            key={id}
            role="radio"
            aria-checked={on}
            onClick={() => onPick(id)}
            className={`rounded-2xl py-2 font-black shadow active:scale-95 transition ${on ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 ring-4 ring-white' : 'bg-white/80 text-slate-600'}`}
            data-testid={`plane3d-diff-${id}`}
          >
            <span className="block text-2xl" aria-hidden="true">
              {D.emoji}
            </span>
            <span className="text-lg">{D.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Đua máy bay Pokémon": a 3-lane plane racer, 10 levels × 3 difficulties.
 * `autopilot` lets a bot fly (tests, demos); `onFlight(flight)` sees each new flight (demos, screenshots).
 */
export function Plane3DGame({ player, onClose, onGold, random = Math.random, autopilot = false, onFlight }) {
  const [settings, setSettings] = useState(loadSettings);
  const [progress, setProgress] = useState(loadProgress);
  const [phase, setPhase] = useState('menu'); // menu | map | count | play | result
  const [level, setLevel] = useState(0);
  const [game, setGame] = useState(null);
  const [hud, setHud] = useState(null);
  const [fail, setFail] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [result, setResult] = useState(null);
  const [hint, setHint] = useState(false);
  const sceneRef = useRef(null);
  const hudTimer = useRef(0);
  const botTimer = useRef(0);
  const swipe = useRef(null);
  const lastCoinSound = useRef(0);
  const toastId = useRef(0);
  const later = useLater();
  const livery = LIVERIES.find((l) => l.id === settings.livery) || LIVERIES[0];
  const diff = settings.diff;

  const playerImage = player?.image;
  const mountStage = useCallback(
    (node) => {
      if (!node) return undefined;
      let scene = null;
      try {
        const s0 = loadSettings();
        scene = createPlane3DScene(node, { playerImage, livery: LIVERIES.find((l) => l.id === s0.livery) || LIVERIES[0], level: 0 });
      } catch (err) {
        console.warn('[plane3d] WebGL unavailable:', err);
        setFail(true);
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

  useEffect(() => {
    sceneRef.current?.setLivery(livery);
  }, [livery]);

  useEffect(() => {
    const onVis = () => setHidden(!!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const toast = useCallback(
    (text, tone = 'white') => {
      const id = ++toastId.current;
      setToasts((list) => [...list.slice(-2), { id, text, tone }]);
      later(() => setToasts((list) => list.filter((t) => t.id !== id)), 1300);
    },
    [later]
  );

  const pick = (next) => {
    sounds.playPop();
    setSettings(saveSettings(next));
  };

  const finish = useCallback(
    (s) => {
      const lv = LEVELS[s.level];
      let gold = 0;
      let improved = false;
      if (s.finished) {
        const rec = saveLevelStars(lv.id, s.diff, s.stars);
        improved = rec.improved;
        gold = goldForLevel(s.stars, rec.improved);
        setProgress(loadProgress());
      }
      const r = { level: s.level, diff: s.diff, finished: s.finished, stars: s.stars, coins: s.coins, coinsTotal: s.coinsTotal, hearts: s.hearts, rings: s.rings, gold, improved };
      later(
        () => {
          setResult(r);
          setPhase('result');
        },
        s.finished ? 200 : 600
      );
    },
    [later]
  );

  const handleEvents = useCallback(
    (s, events) => {
      for (const e of events) {
        switch (e.type) {
          case 'coin': {
            if (s.t - lastCoinSound.current > 0.06) {
              lastCoinSound.current = s.t;
              sounds.playNote(880 * Math.pow(2, Math.min(14, e.combo - 1) / 12), { duration: 0.09, volume: 0.09 });
            }
            if (e.combo >= 5 && e.combo % 5 === 0) toast(`Combo x${e.combo}!`, 'gold');
            break;
          }
          case 'ring':
            sounds.playNote(1046, { duration: 0.1, volume: 0.1 });
            later(() => sounds.playNote(1318, { duration: 0.1, volume: 0.1 }), 90);
            later(() => sounds.playNote(1568, { duration: 0.16, volume: 0.11 }), 180);
            toast('Vòng sao vàng! +5', 'gold');
            break;
          case 'lane':
            sounds.playNote(520, { duration: 0.05, volume: 0.05 });
            break;
          case 'bump':
            sounds.playPop();
            toast('Ối! Bên cạnh có vật cản', 'white');
            break;
          case 'nearMiss':
            sounds.playWhoosh();
            toast('Suýt nữa!', 'pink');
            break;
          case 'power':
            sounds.playEnergySurge();
            toast(POWER_UI[e.kind].toast, 'sky');
            break;
          case 'shieldBreak':
            sounds.playPop();
            toast('Khiên đã đỡ cho bé!', 'sky');
            break;
          case 'smash':
            sounds.playPop();
            break;
          case 'hit':
            sounds.playOops();
            toast(e.hearts > 0 ? 'Ối! Mất 1 tim' : 'Ôi không!', 'red');
            break;
          case 'continue':
            sounds.playEnergySurge();
            toast('Hồi sinh! Bay tiếp nào!', 'green');
            break;
          case 'finish':
            sounds.playSuccessFanfare();
            toast('VỀ ĐÍCH!', 'gold');
            break;
          case 'done':
          case 'over':
            finish(s);
            break;
          default:
        }
      }
    },
    [finish, later, toast]
  );

  useLoop(
    (dt) => {
      const s = game;
      const sc = sceneRef.current;
      if (phase === 'menu' || phase === 'map' || !s) {
        sc?.update(null, dt, [], { mode: phase === 'map' ? 'map' : 'menu', level });
        return;
      }
      if (phase === 'count') spinUp(s, dt);
      if (phase === 'play' || phase === 'result') {
        if (phase === 'play' && autopilot) {
          botTimer.current += dt;
          if (botTimer.current > 0.15) {
            botTimer.current = 0;
            steerTo(s, botAction(s));
          }
          if (s.phase === 'down' && s.pending === 'offer') acceptContinue(s);
        }
        step(s, dt);
      }
      const events = s.events.length ? s.events.splice(0) : [];
      sc?.update(s, dt, events, { mode: 'fly' });
      if (events.length) handleEvents(s, events);
      hudTimer.current += dt;
      if (events.length || hudTimer.current > 0.1) {
        hudTimer.current = 0;
        setHud(snap(s));
      }
    },
    !fail && !hidden
  );

  const act = useCallback(
    (action) => {
      if (phase !== 'play' || !game) return;
      input(game, action);
    },
    [game, phase]
  );

  useEffect(() => {
    const keys = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const a = keys[e.key];
      if (!a || phase !== 'play') return;
      e.preventDefault();
      if (!e.repeat) act(a);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, onClose, phase]);

  const onPointerDown = (e) => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, fired: false };
  };
  const onPointerMove = (e) => {
    const sw = swipe.current;
    if (!sw || sw.fired || sw.id !== e.pointerId) return;
    const dx = e.clientX - sw.x;
    if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(e.clientY - sw.y)) return;
    sw.fired = true;
    act(dx < 0 ? 'left' : 'right');
  };
  const onPointerUp = (e) => {
    const sw = swipe.current;
    swipe.current = null;
    if (!sw || sw.fired || sw.id !== e.pointerId) return;
    // A tap on the left / right half also changes lane
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
    act((e.clientX - r.left) / r.width < 0.5 ? 'left' : 'right');
  };

  const startLevel = (lv) => {
    const g = createFlight({ level: lv, diff, random });
    setLevel(lv);
    setGame(g);
    setHud(snap(g));
    setResult(null);
    setToasts([]);
    sceneRef.current?.setLevel(lv, g);
    onFlight?.(g);
    setPhase('count');
  };
  const begin = () => {
    if (!game) return;
    startFlight(game);
    setPhase('play');
    if (!autopilot) {
      setHint(true);
      later(() => setHint(false), 4000);
    }
    setHud(snap(game));
  };
  const onContinue = () => {
    if (game && acceptContinue(game)) setHud(snap(game));
  };
  const onGiveUp = () => {
    if (game && declineContinue(game)) setHud(snap(game));
  };
  const toMap = () => {
    setGame(null);
    setHud(null);
    setResult(null);
    setPhase('map');
  };

  const shownPhase = phase === 'play' && hud && (hud.phase === 'down' || hud.phase === 'over') ? 'down' : phase;
  const activePowers = hud ? Object.entries(hud.power).filter(([, t]) => t > 0) : [];
  const L = LEVELS[level];
  const nextOpen = result && result.finished && level + 1 < LEVELS.length && levelUnlocked(progress, level + 1);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center bg-slate-950 select-none"
      role="dialog"
      aria-label={TITLE}
      data-phase={shownPhase}
      data-level={level + 1}
      data-diff={diff}
      data-lane={hud ? hud.lane : 0}
      data-hearts={hud ? hud.hearts : HEARTS}
      data-coins={hud ? hud.coins : 0}
      data-progress={hud ? Math.round(hud.progress * 100) : 0}
      data-pending={hud?.pending || ''}
    >
      <div className="relative w-full h-full max-w-[520px] overflow-hidden bg-sky-300">
        <div
          ref={mountStage}
          className="absolute inset-0 touch-none"
          data-testid="plane3d-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipe.current = null)}
        />

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-2">
          <div className="flex items-start gap-2">
            {hud && phase !== 'menu' && phase !== 'map' ? (
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5 px-2 py-1 rounded-2xl bg-black/40" data-testid="plane3d-hearts" aria-label={`${hud.hearts} tim`}>
                    {Array.from({ length: HEARTS }, (_, i) => (
                      <Heart key={`${i}-${i < hud.hearts}`} className={`w-6 h-6 drop-shadow ${i < hud.hearts ? '' : 'opacity-30 grayscale plane3d-pop'}`} />
                    ))}
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-2xl bg-black/40 text-amber-200 text-xl font-black tabular-nums" data-testid="plane3d-coins">
                    <Coin />
                    <span key={hud.coins} className="score-bump">
                      {hud.coins}
                    </span>
                  </span>
                  {hud.combo >= 3 && (
                    <span key={hud.combo} className="plane3d-pop px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-sm font-black">
                      x{hud.combo}
                    </span>
                  )}
                </div>
                {/* progress to the finish gate */}
                <div className="relative h-5 rounded-full bg-black/35 border-2 border-white/60 overflow-visible" data-testid="plane3d-progress">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-300 via-emerald-300 to-amber-300" style={{ width: `${hud.progress * 100}%` }} />
                  <span className="absolute -top-1.5 text-lg leading-none" style={{ left: `calc(${hud.progress * 100}% - 12px)` }} aria-hidden="true">
                    ✈️
                  </span>
                  <span className="absolute -right-1 -top-2 text-lg leading-none" aria-hidden="true">
                    🏁
                  </span>
                </div>
              </div>
            ) : (
              <span className="flex-1" />
            )}
            <button onClick={onClose} aria-label="Đóng trò chơi" className="pointer-events-auto p-2 rounded-full bg-white/90 text-slate-700 shadow" data-testid="plane3d-close">
              <X className="w-5 h-5" />
            </button>
          </div>
          {hud && phase === 'play' && (
            <p className="mt-1 text-xs font-black text-white/90 drop-shadow">
              {L.icon} Màn {L.n} · {L.name} · {DIFFS[diff].label}
            </p>
          )}
        </div>

        {phase === 'play' && activePowers.length > 0 && (
          <div className="pointer-events-none absolute left-3 top-[6.6rem] z-20 flex flex-col gap-1" data-testid="plane3d-powers">
            {activePowers.map(([k, t]) => (
              <div key={k} className="plane3d-pop flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/45 text-white text-sm font-black">
                <span aria-hidden="true">{POWER_UI[k].icon}</span>
                <span className="w-14 h-2 rounded-full bg-white/25 overflow-hidden" aria-label={POWER[k].label}>
                  <span className={`block h-full ${POWER_UI[k].color}`} style={{ width: `${Math.min(100, (t / POWER[k].time) * 100)}%` }} />
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-[32%] z-20 flex flex-col items-center gap-1">
          {toasts.map((t) => (
            <span key={t.id} className={`plane3d-toast text-2xl font-black sport-banner text-center px-4 ${TONE[t.tone] || 'text-white'}`}>
              {t.text}
            </span>
          ))}
        </div>
        {hint && phase === 'play' && (
          <div className="plane3d-hint pointer-events-none absolute inset-x-4 bottom-8 z-20 flex items-center justify-between rounded-3xl bg-black/40 px-4 py-3 text-white font-black">
            <span className="text-3xl" aria-hidden="true">
              👈
            </span>
            <span className="text-center text-sm">Vuốt hoặc chạm trái / phải để đổi làn</span>
            <span className="text-3xl" aria-hidden="true">
              👉
            </span>
          </div>
        )}

        {/* Menu: livery + difficulty */}
        {phase === 'menu' && !fail && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-between px-3 pb-4 pt-12 pointer-events-none">
            <div className="result-rise text-center">
              <p className="text-4xl font-black text-white sport-banner leading-none">Đua máy bay</p>
              <p className="mt-1 text-3xl font-black text-amber-300 sport-banner leading-none">Pokémon ✈️</p>
              <p className="mt-2 inline-block rounded-full bg-black/30 px-3 py-1 text-sm font-black text-white">Lái máy bay cùng {player?.name || 'Pokémon'} qua 10 vùng đất!</p>
            </div>
            <div className="result-rise pointer-events-auto w-full max-w-sm rounded-3xl bg-white/90 backdrop-blur shadow-2xl border-4 border-amber-300 p-3 text-center">
              <p className="text-xs font-black text-indigo-500 uppercase">Chọn màu máy bay</p>
              <div className="mt-1 grid grid-cols-6 gap-1" role="radiogroup" aria-label="Màu máy bay">
                {LIVERIES.map((l) => (
                  <button
                    key={l.id}
                    role="radio"
                    aria-checked={l.id === livery.id}
                    aria-label={l.name}
                    onClick={() => pick({ livery: l.id })}
                    className={`rounded-2xl p-0.5 flex items-center justify-center active:scale-95 transition ${l.id === livery.id ? 'bg-amber-200 ring-4 ring-amber-400 scale-105' : 'bg-slate-100'}`}
                    data-testid={`plane3d-livery-${l.id}`}
                  >
                    <PlaneGlyph livery={l} />
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs font-black text-indigo-500 uppercase">Độ khó</p>
              <div className="mt-1">
                <DiffPicker diff={diff} onPick={(id) => pick({ diff: id })} />
              </div>
              <button onClick={() => setPhase('map')} className="mt-4 w-full py-3.5 rounded-2xl bg-gradient-to-b from-red-500 to-red-600 text-white text-2xl font-black shadow-lg active:scale-95 flex items-center justify-center gap-2" data-testid="plane3d-start">
                <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden="true">
                  <Ball x={12} y={12} r={9} />
                </svg>
                Bay thôi!
              </button>
            </div>
          </div>
        )}

        {/* Level map */}
        {phase === 'map' && !fail && (
          <div className="absolute inset-0 z-30 flex flex-col bg-gradient-to-b from-sky-400/90 via-indigo-500/80 to-violet-900/90" data-testid="plane3d-mapview">
            <div className="px-4 pt-14 pb-2">
              <p className="text-2xl font-black text-white drop-shadow text-center">🗺️ Bản đồ chuyến bay</p>
              <div className="mt-2">
                <DiffPicker diff={diff} onPick={(id) => pick({ diff: id })} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <ol className="relative mx-auto max-w-sm flex flex-col gap-3 pt-2">
                {LEVELS.map((lv, i) => {
                  const open = levelUnlocked(progress, i);
                  const stars = starsOf(progress, lv.id, diff);
                  const left = i % 2 === 0;
                  return (
                    <li key={lv.id} className={`flex ${left ? 'justify-start' : 'justify-end'}`}>
                      <button
                        disabled={!open}
                        onClick={() => {
                          sounds.playPop();
                          startLevel(i);
                        }}
                        className={`relative w-[78%] flex items-center gap-3 rounded-3xl px-3 py-2.5 text-left shadow-xl border-4 active:scale-95 transition ${open ? 'bg-white border-white plane3d-float' : 'bg-white/45 border-white/40 grayscale'}`}
                        style={{ animationDelay: `${i * 180}ms` }}
                        data-testid={`plane3d-level-${i + 1}`}
                        aria-label={`Màn ${lv.n}: ${lv.name}${open ? `, ${stars} sao` : ', chưa mở'}`}
                      >
                        <span className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-3xl shadow-inner" style={{ background: `linear-gradient(160deg, ${lv.color}, #ffffff)` }} aria-hidden="true">
                          {open ? lv.icon : <Lock className="w-7 h-7 text-slate-500" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-black text-slate-400">Màn {lv.n}</span>
                          <span className="block text-base font-black text-slate-800 leading-tight">{lv.name}</span>
                          <span className="mt-0.5 flex items-center gap-2">
                            <StarRow stars={stars} size="w-5 h-5" />
                            <span className="flex gap-0.5" aria-hidden="true">
                              {DIFF_IDS.map((d) => (
                                <span key={d} className={`w-2.5 h-2.5 rounded-full ${starsOf(progress, lv.id, d) > 0 ? 'bg-emerald-400' : 'bg-slate-200'}`} title={DIFFS[d].label} />
                              ))}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="px-4 pb-4">
              <button onClick={() => setPhase('menu')} className="w-full py-2.5 rounded-2xl bg-white/90 text-indigo-700 font-black shadow active:scale-95">
                ✈️ Đổi máy bay
              </button>
            </div>
          </div>
        )}

        {phase === 'count' && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-[22%] z-40 text-center">
              <span className="inline-block px-5 py-2 rounded-2xl bg-white/90 text-indigo-700 text-xl font-black shadow-xl">
                {L.icon} {L.name}
              </span>
            </div>
            <Countdown text="CẤT CÁNH!" onDone={begin} />
          </>
        )}

        {/* Out of hearts: one free "Hồi sinh" */}
        {phase === 'play' && hud?.phase === 'down' && hud.pending === 'offer' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950/55 px-6 text-center" data-testid="plane3d-offer">
            <p className="text-3xl font-black text-white sport-banner">Hết tim rồi!</p>
            <button onClick={onContinue} className="plane3d-pulse relative w-60 py-5 rounded-3xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white text-3xl font-black shadow-2xl border-4 border-white active:scale-95" data-testid="plane3d-continue">
              💛 Hồi sinh
              <span className="absolute -top-3 -right-3 w-11 h-11 rounded-full bg-amber-400 text-amber-950 text-xl font-black flex items-center justify-center border-4 border-white tabular-nums">{Math.ceil(hud.offerT)}</span>
            </button>
            <p className="text-sm font-bold text-white/80">Miễn phí 1 lần mỗi màn</p>
            <button onClick={onGiveUp} className="px-5 py-2 rounded-2xl bg-white/85 text-slate-700 font-black" data-testid="plane3d-giveup">
              Thôi, xem kết quả
            </button>
            <span className="sr-only">
              Còn {Math.ceil(hud.offerT)} trên {CONTINUE_TIME} giây
            </span>
          </div>
        )}

        {phase === 'result' && result && (
          <Result
            result={result}
            onGold={onGold}
            onReplay={() => startLevel(result.level)}
            onNext={nextOpen ? () => startLevel(result.level + 1) : null}
            onMap={toMap}
            onClose={onClose}
          />
        )}

        {fail && (
          <div className="absolute inset-0 z-40 flex items-center justify-center px-6 bg-gradient-to-b from-sky-600 to-indigo-800" data-testid="plane3d-nowebgl">
            <div className="rounded-3xl bg-white p-5 text-center shadow-2xl max-w-xs">
              <p className="text-4xl" aria-hidden="true">
                😿
              </p>
              <p className="mt-2 text-lg font-black text-slate-800">Máy này chưa chạy được thế giới 3D</p>
              <p className="mt-1 text-sm font-bold text-slate-600">Bé thử trò khác hoặc mở bằng trình duyệt khác nhé!</p>
              <button onClick={onClose} className="mt-4 px-6 py-3 rounded-2xl bg-sky-600 text-white text-lg font-black shadow active:scale-95">
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
