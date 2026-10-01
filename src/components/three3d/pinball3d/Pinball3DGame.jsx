import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, RotateCcw } from '../../icons/PokeIcons';
import { DT, BALLS, STAR2, STAR3, WILD, createPinball, startGame, step, launch, setPull, canLaunch, snap, starsForScore, goldForGame, botInput } from '../../../utils/three3d/pinball3d';
import { loadPinball3d, savePinball3d } from '../../../utils/three3d/pinball3dStore';
import { artworkUrl } from '../../../services/pokemonOnlineService';
import { sounds } from '../../../utils/soundEffects';
import { StarRow, GoldReward } from '../../kidgames/Common';
import { useLoop, useLater } from '../../sports/sportsKit';
import { createPinball3DScene } from './Pinball3DScene';

const fmt = (n) => Math.floor(n).toLocaleString('vi-VN');
const WILD_BY_ID = Object.fromEntries(WILD.map((w) => [w.id, w]));
const BUMPER_NOTES = [659.25, 783.99, 987.77];
const RESULT_TITLE = ['', 'Hoàn thành!', 'Giỏi lắm!', 'Siêu đỉnh!'];
const PULL_PX = 90; // plunger drag distance for full power

function BallIcon({ used }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-5 h-5 ${used ? 'opacity-25 grayscale' : ''}`} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
      <path d="M2 12a10 10 0 0 1 20 0z" fill="#ef4444" stroke="#1e293b" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.2" fill="#f8fafc" stroke="#1e293b" strokeWidth="2" />
    </svg>
  );
}

function MonThumb({ id, size = 'w-9 h-9' }) {
  const w = WILD_BY_ID[id];
  if (!w) return null;
  return <img src={artworkUrl(w.dex)} alt={w.name} draggable={false} className={`${size} object-contain drop-shadow`} style={{ background: `radial-gradient(circle, ${w.color}66 0%, transparent 70%)` }} />;
}

/**
 * "Pinball Pokémon": a 3D pinball table with Voltorb bumpers, Diglett targets, Psyduck's spinner,
 * Cloyster's ramp and a catch mode. Tap the left / right half for the flippers, pull the plunger.
 * `autoplay` lets a bot play (tests and demos).
 */
export function Pinball3DGame({ player, onClose, onGold, random = Math.random, autoplay = false }) {
  const [phase, setPhaseState] = useState('menu'); // menu | play | over | nogl
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);
  const [record, setRecord] = useState(loadPinball3d);
  const [banner, setBanner] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [press, setPress] = useState({ left: false, right: false });
  const [pullUi, setPullUi] = useState(0);
  const [sessionCaught, setSessionCaught] = useState([]);
  const phaseRef = useRef('menu');
  const game = useRef(null);
  const idle = useRef(null);
  const sceneRef = useRef(null);
  const input = useRef({ left: new Set(), right: new Set(), keys: { left: false, right: false }, space: false, pull: 0, drag: null });
  const acc = useRef(0);
  const hudT = useRef(0);
  const paid = useRef(false);
  const toastId = useRef(0);
  const bot = useRef({ mem: {}, wait: 0.6 });
  const later = useLater();

  const setPhase = (p) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const toast = (text, color = '#fde047') => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text, color }]);
    later(() => setToasts((t) => t.filter((x) => x.id !== id)), 1200);
  };
  const showBanner = (text, kind) => {
    toastId.current += 1;
    const id = toastId.current;
    setBanner({ id, text, kind });
    later(() => setBanner((b) => (b && b.id === id ? null : b)), 2300);
  };

  const begin = () => {
    const s = createPinball({ random });
    startGame(s);
    game.current = s;
    acc.current = 0;
    paid.current = false;
    bot.current = { mem: {}, wait: 0.6 };
    const i = input.current;
    i.left.clear();
    i.right.clear();
    i.pull = 0;
    i.drag = null;
    setPress({ left: false, right: false });
    setPullUi(0);
    setResult(null);
    setBanner(null);
    setToasts([]);
    setHud(snap(s));
    setPhase('play');
    sounds.playWhoosh();
    later(() => showBanner('BÓNG 1 – KÉO CẦN BẮN!', 'info'), 50);
  };

  // The 3D table: built once when the stage mounts
  const mountStage = useCallback((node) => {
    if (!node) return undefined;
    let scene = null;
    try {
      scene = createPinball3DScene(node);
    } catch (err) {
      console.warn('[pinball3d] WebGL unavailable:', err);
      phaseRef.current = 'nogl';
      setPhaseState('nogl');
      return undefined;
    }
    sceneRef.current = scene;
    if (import.meta.env?.DEV && typeof window !== 'undefined') window.__pinball3d = scene;
    return () => {
      if (sceneRef.current === scene) sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  const finish = (s) => {
    const stars = starsForScore(s.score);
    const gold = goldForGame(stars, s.caught.length);
    const saved = savePinball3d(s.score, s.caught);
    setRecord(saved);
    if (!paid.current) {
      paid.current = true;
      onGold?.(gold);
    }
    setPhase('over');
    const r = { stars, gold, score: s.score, isNew: saved.isNew, best: saved.best, caught: [...s.caught], combo: s.bestCombo, ramps: s.stats.ramps, bumpers: s.stats.bumpers };
    later(() => {
      setResult(r);
      sounds.playSuccessFanfare();
      try {
        confetti({ particleCount: 50 + stars * 40, spread: 90, origin: { y: 0.4 }, zIndex: 9999 });
      } catch {
        // decoration
      }
    }, 900);
  };

  const handleEvents = (s) => {
    const scene = sceneRef.current;
    let spins = 0;
    for (const e of s.events.splice(0)) {
      scene?.fx(e, s);
      switch (e.type) {
        case 'flip':
          sounds.playNote(e.side === 'L' ? 196 : 220, { duration: 0.07, volume: 0.12 });
          break;
        case 'bumper':
          sounds.playNote(BUMPER_NOTES[e.i] * (s.mult > 1 ? 1.12 : 1), { duration: 0.22, volume: 0.17 });
          break;
        case 'sling':
          sounds.playNote(523.25, { duration: 0.08, volume: 0.1 });
          break;
        case 'drop':
          sounds.playPop();
          toast(`Diglett! +${fmt(e.points)}`, '#fdba74');
          break;
        case 'dugtrio':
          sounds.playCoin();
          toast(`+${fmt(e.points)}`, '#fdba74');
          break;
        case 'spin':
          spins += 1;
          break;
        case 'lane':
          sounds.playNote(880 + e.i * 110, { duration: 0.15, volume: 0.14 });
          break;
        case 'mult':
          sounds.playEnergySurge();
          break;
        case 'rampEnter':
          sounds.playWhoosh();
          break;
        case 'ramp':
          if (e.jackpot) sounds.playCoin();
          toast(`${e.jackpot ? 'Jackpot' : 'Cầu trượt'} +${fmt(e.points)}`, '#7dd3fc');
          break;
        case 'cloysterEat':
          sounds.playMunch?.();
          break;
        case 'orbit':
          sounds.playNote(1046.5, { duration: 0.25, volume: 0.14 });
          toast(`Vòng quanh +${fmt(e.points)}`, '#c4b5fd');
          break;
        case 'combo':
          sounds.playNote(1318.5, { duration: 0.2, volume: 0.14 });
          toast(`Liên hoàn x${e.n}!`, '#f9a8d4');
          break;
        case 'center':
          sounds.playNote(739.99, { duration: 0.18, volume: 0.14 });
          toast(`Poké Ball ${e.hits}/3`, '#f9a8d4');
          break;
        case 'holeOpen':
          sounds.playScanBeep?.();
          break;
        case 'catchStart':
          sounds.playEnergySurge();
          break;
        case 'catchHit':
          sounds.playPop();
          toast(`Trúng ${e.hits}/3!`, '#fde047');
          break;
        case 'caught':
          sounds.playSuccessFanfare();
          setSessionCaught((l) => [...l, e.mon.id]);
          try {
            confetti({ particleCount: 90, spread: 80, origin: { y: 0.45 }, zIndex: 9999 });
          } catch {
            // decoration
          }
          break;
        case 'catchFail':
          sounds.playOops();
          toast(`${e.mon.name} chạy mất rồi!`, '#cbd5e1');
          break;
        case 'kickback':
          sounds.playEnergySurge();
          break;
        case 'save':
          sounds.playCoin();
          break;
        case 'launch':
          sounds.playWhoosh();
          break;
        case 'multiball':
          sounds.playEnergySurge();
          break;
        case 'drain':
          sounds.playOops();
          if (s.ballNo < BALLS) later(() => showBanner(`BÓNG ${s.ballNo + 1}`, 'info'), 1700);
          else showBanner('HẾT BÓNG!', 'info');
          break;
        case 'banner':
          showBanner(e.text, e.kind);
          break;
        case 'over':
          finish(s);
          break;
        default:
      }
    }
    if (spins) sounds.playNote(1567.98, { duration: 0.04, volume: 0.06 });
  };

  const readInput = (s) => {
    if (autoplay) return botInput(s, bot.current.mem, 1);
    const i = input.current;
    return { left: i.left.size > 0 || i.keys.left, right: i.right.size > 0 || i.keys.right };
  };

  useLoop((dt) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    const scene = sceneRef.current;
    if (phaseRef.current === 'play' && game.current) {
      const s = game.current;
      const i = input.current;
      // Space held: the plunger is pulled further
      if (i.space && canLaunch(s)) {
        i.pull = Math.min(1, i.pull + dt * 1.2);
        setPull(s, i.pull);
      }
      if (autoplay && canLaunch(s)) {
        bot.current.wait -= dt;
        if (bot.current.wait <= 0) {
          launch(s, 0.85);
          bot.current.wait = 0.6;
        }
      }
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
    if (!scene) return;
    if (!game.current && !idle.current) idle.current = createPinball({ random });
    scene.update(game.current || idle.current, dt);
  }, phase !== 'nogl');

  // Keyboard: Z / ← left flipper, M / → right flipper, Space plunger (hold to pull)
  useEffect(() => {
    const side = (k) => (k === 'z' || k === 'Z' || k === 'ArrowLeft' ? 'left' : k === 'm' || k === 'M' || k === 'ArrowRight' ? 'right' : null);
    const down = (e) => {
      if (e.key === 'Escape') return onClose();
      const sd = side(e.key);
      const playing = phaseRef.current === 'play';
      if (sd) {
        if (playing) e.preventDefault();
        input.current.keys[sd] = true;
        setPress((p) => ({ ...p, [sd]: true }));
      } else if (e.key === ' ' && playing) {
        e.preventDefault();
        if (!input.current.space) input.current.pull = 0;
        input.current.space = true;
      }
      return undefined;
    };
    const up = (e) => {
      const sd = side(e.key);
      if (sd) {
        input.current.keys[sd] = false;
        setPress((p) => ({ ...p, [sd]: false }));
      } else if (e.key === ' ') {
        const i = input.current;
        if (i.space && game.current && phaseRef.current === 'play') launch(game.current, Math.max(0.35, i.pull));
        i.space = false;
        i.pull = 0;
        if (game.current) setPull(game.current, 0);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onClose]);

  // Touch zones: left half / right half of the screen (several fingers at once)
  const zoneDown = (sd) => (e) => {
    if (phaseRef.current !== 'play') return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // not supported
    }
    input.current[sd].add(e.pointerId);
    setPress((p) => ({ ...p, [sd]: true }));
  };
  const zoneUp = (sd) => (e) => {
    input.current[sd].delete(e.pointerId);
    if (!input.current[sd].size) setPress((p) => ({ ...p, [sd]: false }));
  };

  // Plunger: drag the knob down and let go, or tap "Bắn!"
  const plungerDown = (e) => {
    e.stopPropagation();
    if (!game.current || !canLaunch(game.current)) return;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // not supported
    }
    input.current.drag = { id: e.pointerId, y: e.clientY };
  };
  const plungerMove = (e) => {
    const d = input.current.drag;
    if (!d || d.id !== e.pointerId || !game.current) return;
    const p = Math.max(0, Math.min(1, (e.clientY - d.y) / PULL_PX));
    setPull(game.current, p);
    setPullUi(p);
  };
  const plungerUp = (e) => {
    const d = input.current.drag;
    if (!d || d.id !== e.pointerId) return;
    input.current.drag = null;
    const s = game.current;
    const p = s ? s.pull : 0;
    setPullUi(0);
    if (!s) return;
    if (p > 0.08) launch(s, p);
    else setPull(s, 0);
  };
  const shoot = (e) => {
    e.stopPropagation();
    if (game.current) launch(game.current, 0.8);
  };

  const playing = phase === 'play' && hud;
  const c = hud?.catch;
  const caughtShow = [...new Set(sessionCaught)];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-indigo-950 select-none overflow-hidden"
      role="dialog"
      aria-label="Pinball Pokémon"
      data-phase={phase}
      data-score={hud ? hud.score : 0}
      data-ball={hud ? hud.ballNo : 0}
      data-caught={hud ? hud.caught.length : 0}
    >
      <div className="relative flex-1 min-h-0">
        <div ref={mountStage} className="absolute inset-0" data-testid="pinball3d-stage" />

        {/* Touch zones: left half = left flipper, right half = right flipper */}
        {phase === 'play' && (
          <div className="absolute inset-0 z-10 flex touch-none">
            {['left', 'right'].map((sd) => (
              <div
                key={sd}
                className="relative flex-1 h-full"
                data-testid={`pinball3d-zone-${sd}`}
                onPointerDown={zoneDown(sd)}
                onPointerUp={zoneUp(sd)}
                onPointerCancel={zoneUp(sd)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <div
                  className={`pointer-events-none absolute bottom-3 ${sd === 'left' ? 'left-3' : 'right-3'} w-[calc(100%-1.5rem)] h-14 rounded-3xl border-[3px] flex items-center justify-center gap-2 text-base font-black transition-colors ${press[sd] ? 'bg-yellow-300/45 border-yellow-200 text-white' : 'bg-white/5 border-white/30 text-white/75'}`}
                  style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
                  aria-hidden="true"
                >
                  <span className="text-2xl">{sd === 'left' ? '◀' : '▶'}</span>
                  <span>{sd === 'left' ? 'Lật trái' : 'Lật phải'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Plunger */}
        {playing && hud.ready && (
          <div className="absolute right-2 bottom-28 z-20 flex flex-col items-center gap-1.5" data-testid="pinball3d-plunger" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
            <div
              className="relative w-16 h-40 rounded-2xl bg-slate-900/75 border-2 border-white/40 touch-none overflow-hidden"
              onPointerDown={plungerDown}
              onPointerMove={plungerMove}
              onPointerUp={plungerUp}
              onPointerCancel={plungerUp}
              aria-label="Kéo cần bắn xuống rồi thả"
              data-testid="pinball3d-pull"
            >
              <div className="absolute inset-x-2 bottom-2 rounded-lg bg-gradient-to-t from-red-500 via-amber-400 to-lime-300 opacity-90" style={{ height: `${Math.round(pullUi * 100)}%` }} />
              <div className="absolute left-1/2 w-12 h-12 -ml-6 rounded-full bg-gradient-to-b from-red-400 to-red-600 border-4 border-white shadow-lg pinball3d-knob" style={{ top: `${6 + pullUi * 80}px` }} />
              <span className="absolute inset-x-0 bottom-1 text-center text-[10px] font-black text-white/90">KÉO ↓</span>
            </div>
            <button onPointerDown={(e) => e.stopPropagation()} onClick={shoot} className="w-16 py-2 rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 text-white text-lg font-black shadow-lg border-2 border-white/80 active:scale-95 pinball3d-pulse" data-testid="pinball3d-shoot">
              Bắn!
            </button>
          </div>
        )}

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-2 pt-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <div className="min-w-0 px-3 py-1 rounded-xl bg-black/70 border border-amber-400/50 pinball3d-led-digits" data-testid="pinball3d-score">
              <span className="block text-[10px] font-black text-amber-200/80 leading-none">ĐIỂM</span>
              <span key={hud ? Math.floor(hud.score / 1000) : 0} className="block text-2xl font-black tabular-nums text-amber-300 leading-tight pinball3d-bump">
                {fmt(hud ? hud.score : 0)}
              </span>
            </div>
            {hud && (
              <div className="flex flex-col items-start gap-0.5">
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/50" data-testid="pinball3d-balls" aria-label={`Bóng ${hud.ballNo}/${BALLS}`}>
                  {Array.from({ length: BALLS }, (_, i) => (
                    <BallIcon key={i} used={i < hud.ballNo - 1} />
                  ))}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${hud.mult > 1 ? 'bg-yellow-400 text-slate-900' : 'bg-black/50 text-white/80'}`} data-testid="pinball3d-mult">
                  x{hud.mult}
                </span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="px-2 py-1 rounded-full bg-black/55 text-[11px] font-black text-white/85 tabular-nums">🏆 {fmt(Math.max(record.best, hud ? hud.score : 0))}</span>
              <button onClick={onClose} aria-label="Đóng trò chơi" className="pointer-events-auto shrink-0 p-2 rounded-full bg-white/90 text-slate-700 shadow">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {playing && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {hud.save > 0 && <span className="px-2 py-0.5 rounded-full bg-cyan-400/90 text-xs font-black text-slate-900 hint-pulse">🛟 Cứu bóng {hud.save}s</span>}
              {hud.kickback && <span className="px-2 py-0.5 rounded-full bg-rose-500/85 text-xs font-black text-white">⬆ Kickback</span>}
              {hud.multiball && <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/90 text-xs font-black text-white">⚡ Multiball</span>}
              {!c && (
                <span className="px-2 py-0.5 rounded-full bg-black/50 text-xs font-black text-pink-200" data-testid="pinball3d-center">
                  {hud.holeOpen ? '🕳️ Bắn vào lỗ Poké Ball!' : `🎯 Poké Ball ${hud.centerHits}/3`}
                </span>
              )}
              {caughtShow.length > 0 && (
                <span className="ml-auto flex items-center -space-x-2 px-1 rounded-full bg-black/40" data-testid="pinball3d-caught">
                  {caughtShow.map((id) => (
                    <MonThumb key={id} id={id} size="w-7 h-7" />
                  ))}
                </span>
              )}
            </div>
          )}
          {playing && c && c.state === 'wild' && (
            <div className="self-center flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-fuchsia-900/80 border-2 border-fuchsia-300/70 shadow-lg" data-testid="pinball3d-catch">
              <MonThumb id={c.id} />
              <div className="leading-tight">
                <p className="text-sm font-black text-white">Bắt {c.name}!</p>
                <p className="text-xs font-black text-fuchsia-100 tabular-nums">
                  Trúng {c.hits}/3 · ⏱ {c.timeLeft}s
                </p>
              </div>
            </div>
          )}
        </div>

        {/* LED banner */}
        {banner && (
          <div className="pointer-events-none absolute inset-x-0 top-[22%] z-30 flex justify-center px-3">
            <div key={banner.id} className={`pinball3d-led pinball3d-banner max-w-full px-4 py-2 rounded-xl border-2 ${banner.kind === 'caught' || banner.kind === 'jackpot' ? 'border-yellow-300' : banner.kind === 'catch' ? 'border-fuchsia-300' : 'border-orange-400'}`} data-testid="pinball3d-banner">
              <span className="block text-center text-xl sm:text-2xl font-black tracking-widest uppercase whitespace-nowrap overflow-hidden text-ellipsis">{banner.text}</span>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute left-1/2 top-[34%] z-30 -translate-x-1/2 flex flex-col items-center gap-1" aria-live="polite">
          {toasts.map((t) => (
            <span key={t.id} className="pinball3d-toast whitespace-nowrap text-xl font-black sport-banner" style={{ color: t.color }}>
              {t.text}
            </span>
          ))}
        </div>

        {phase === 'menu' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 px-4">
            <div className="result-rise w-full max-w-sm rounded-3xl bg-gradient-to-b from-indigo-100 to-white p-4 text-center shadow-2xl" data-testid="pinball3d-menu">
              <div className="flex items-center justify-center gap-2">
                {player?.image && <img src={player.image} alt={player.name} draggable={false} className="w-14 h-14 object-contain drop-shadow pinball3d-float" />}
                <p className="text-2xl font-black text-slate-800 leading-tight">Pinball Pokémon</p>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-600">
                Giữ bóng trên bàn thật lâu! Đụng Voltorb, hạ Diglett, bắn cầu trượt cho Cloyster và bắt Pokémon hoang dã{player?.name ? ` cùng ${player.name}` : ''}.
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-1.5 text-xs font-black text-slate-700">
                <li className="rounded-xl bg-sky-100 px-2 py-1.5">👈 Chạm nửa trái: lật trái</li>
                <li className="rounded-xl bg-sky-100 px-2 py-1.5">👉 Chạm nửa phải: lật phải</li>
                <li className="rounded-xl bg-amber-100 px-2 py-1.5">⬇ Kéo cần rồi thả (hoặc Bắn!)</li>
                <li className="rounded-xl bg-pink-100 px-2 py-1.5">🎯 Poké Ball 3 lần → bắt Pokémon</li>
              </ul>
              <p className="mt-2 text-xs font-bold text-slate-500">
                {BALLS} bóng · 10 giây đầu được cứu bóng · ⭐⭐ {fmt(STAR2)} · ⭐⭐⭐ {fmt(STAR3)}
              </p>
              <p className="mt-0.5 text-xs font-bold text-slate-500">Bàn phím: Z / ← trái, M / → phải, Space giữ để bắn</p>
              {record.best > 0 && <p className="mt-1 text-sm font-black text-amber-600">🏆 Kỷ lục: {fmt(record.best)}</p>}
              <button onClick={begin} className="mt-3 w-full py-3 rounded-2xl bg-gradient-to-b from-red-400 to-red-600 text-white text-xl font-black shadow-lg active:scale-95" data-testid="pinball3d-start">
                Chơi thôi! 🎯
              </button>
            </div>
          </div>
        )}

        {phase === 'over' && result && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4" data-testid="pinball3d-result" data-stars={result.stars}>
            <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-indigo-100 to-white p-4 text-center shadow-2xl flex flex-col items-center gap-2">
              <p className="result-rise text-3xl font-black text-slate-800">{RESULT_TITLE[result.stars]}</p>
              <div className="result-rise" style={{ animationDelay: '100ms' }}>
                <StarRow stars={result.stars} size="w-12 h-12" animate />
              </div>
              <p className="result-rise text-3xl font-black text-indigo-700 tabular-nums" style={{ animationDelay: '160ms' }} data-testid="pinball3d-final">
                {fmt(result.score)}
              </p>
              {result.isNew ? (
                <span className="px-3 py-1 rounded-full bg-amber-400 text-sm font-black text-white hint-pulse">🏆 Kỷ lục mới!</span>
              ) : (
                <span className="text-xs font-bold text-slate-500">Kỷ lục: {fmt(result.best)}</span>
              )}
              <div className="result-rise w-full rounded-2xl bg-fuchsia-50 p-2" style={{ animationDelay: '220ms' }}>
                <p className="text-sm font-black text-fuchsia-700">Pokémon bắt được: {result.caught.length}</p>
                {result.caught.length > 0 ? (
                  <div className="mt-1 flex flex-wrap justify-center gap-1">
                    {result.caught.map((id, i) => (
                      <MonThumb key={`${id}${i}`} id={id} size="w-11 h-11" />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-bold text-slate-500">Bắn Poké Ball giữa bàn 3 lần rồi vào lỗ để gặp Pokémon nhé!</p>
                )}
              </div>
              {result.stars < 3 && <p className="text-xs font-bold text-slate-500">{result.stars < 2 ? `⭐⭐ từ ${fmt(STAR2)} điểm` : `⭐⭐⭐ từ ${fmt(STAR3)} điểm`}</p>}
              <div className="result-rise" style={{ animationDelay: '280ms' }}>
                <GoldReward amount={result.gold} />
              </div>
              <div className="result-rise flex flex-wrap justify-center gap-2 mt-1" style={{ animationDelay: '340ms' }}>
                <button onClick={begin} className="px-5 py-2.5 rounded-2xl bg-red-500 text-white text-base font-black flex items-center gap-1.5 shadow active:scale-95" data-testid="pinball3d-replay">
                  <RotateCcw className="w-5 h-5" /> Chơi lại
                </button>
                <button onClick={onClose} className="px-5 py-2.5 rounded-2xl bg-sky-600 text-white text-base font-black shadow active:scale-95">
                  Xong
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'nogl' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-indigo-500 to-purple-800 px-6" data-testid="pinball3d-nogl">
            <div className="max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
              <p className="text-5xl">🎯</p>
              <p className="mt-2 text-lg font-black text-slate-800">Ối! Máy này chưa vẽ được bàn pinball 3D.</p>
              <p className="mt-1 text-sm font-bold text-slate-600">Voltorb đang ngủ trưa. Bé thử trò chơi khác hoặc dùng máy khác nhé!</p>
              <button onClick={onClose} className="mt-3 px-6 py-2.5 rounded-2xl bg-indigo-600 text-white text-base font-black shadow active:scale-95">
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
