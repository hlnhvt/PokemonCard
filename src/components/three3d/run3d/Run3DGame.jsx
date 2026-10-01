import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, RotateCcw, Trophy, Ball } from '../../icons/PokeIcons';
import { useLoop, useLater } from '../../sports/sportsKit';
import { Countdown } from '../../carnival/CarnivalCommon';
import { GoldReward } from '../../kidgames/Common';
import { sounds } from '../../../utils/soundEffects';
import { createRun, startRun, step, input, acceptContinue, declineContinue, snap, goldForRun, POWER, CONTINUE_TIME } from '../../../utils/three3d/run3d';
import { loadRun3d, saveRun3d } from '../../../utils/three3d/run3dStore';
import { createRun3DScene } from './Run3DScene';

const TITLE = 'Pokémon Chạy 3 làn';
const SWIPE = 26; // px before a drag counts as a swipe
const POWER_UI = {
  magnet: { icon: '🧲', color: 'bg-sky-500' },
  shield: { icon: '🛡️', color: 'bg-cyan-500' },
  boost: { icon: '🔥', color: 'bg-orange-500' },
  double: { icon: '✖️2', color: 'bg-amber-500' },
};
const MISSION_ICON = { coins: '🪙', jumps: '⬆️', slides: '⬇️', dist: '🏃', powers: '🎁', dodges: '🚧' };
const TOAST = {
  magnet: 'Nam châm Magnemite!',
  shield: 'Khiên Poké Ball!',
  boost: 'Lửa Rapidash – lao nhanh!',
  double: 'Bùa Meowth: xu x2!',
  revive: 'Có Hồi sinh rồi!',
};

function Coin({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#facc15" stroke="#b45309" strokeWidth="2" />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="#b45309" strokeWidth="1.6" />
      <path d="M6.5 12h3.6M13.9 12h3.6" stroke="#b45309" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.6" fill="#b45309" />
    </svg>
  );
}

/** End of a run: distance, coins, missions, best; gold paid once. */
function Result({ result, onReplay, onClose, onGold }) {
  const paid = useRef(false);
  useEffect(() => {
    if (paid.current) return;
    paid.current = true;
    onGold?.(result.gold);
    sounds.playSuccessFanfare();
    try {
      confetti({ particleCount: result.isNew ? 140 : 70, spread: 90, origin: { y: 0.4 }, zIndex: 9999, colors: ['#ef4444', '#facc15', '#38bdf8', '#4ade80', '#ffffff'] });
    } catch {
      // decoration only
    }
  }, [onGold, result]);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center px-4 bg-slate-950/70 backdrop-blur-sm" data-testid="run3d-result">
      <div className="result-rise w-full max-w-sm rounded-3xl bg-gradient-to-b from-sky-500 to-indigo-700 border-4 border-white/80 shadow-2xl p-5 text-center text-white">
        <p className="text-2xl font-black drop-shadow">{result.isNew ? 'Kỷ lục mới! 🎉' : 'Về đích rồi!'}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/15 py-2">
            <p className="text-xs font-bold text-white/80">Quãng đường</p>
            <p className="text-3xl font-black tabular-nums" data-testid="run3d-result-dist">{result.dist} m</p>
          </div>
          <div className="rounded-2xl bg-white/15 py-2">
            <p className="text-xs font-bold text-white/80">Xu nhặt được</p>
            <p className="text-3xl font-black tabular-nums flex items-center justify-center gap-1">
              <Coin className="w-7 h-7" /> {result.coins}
            </p>
          </div>
        </div>
        <ul className="mt-3 space-y-1 text-left">
          {result.missions.map((m) => (
            <li key={m.kind} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold ${m.done ? 'bg-emerald-500/80' : 'bg-white/10 text-white/75'}`}>
              <span aria-hidden="true">{m.done ? '✅' : MISSION_ICON[m.kind]}</span>
              <span className="flex-1">{m.label}</span>
              <span className="tabular-nums">
                {m.progress}/{m.goal}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-bold text-amber-200">
          <Trophy className="w-4 h-4" /> Kỷ lục: {result.best} m
        </p>
        <div className="mt-3 flex justify-center">
          <GoldReward amount={result.gold} dark />
        </div>
        <div className="mt-4 flex gap-3 justify-center">
          <button onClick={onReplay} className="px-5 py-3 rounded-2xl bg-red-500 text-white text-lg font-black flex items-center gap-2 shadow-lg active:scale-95" data-testid="run3d-replay">
            <RotateCcw className="w-5 h-5" /> Chạy lại
          </button>
          <button onClick={onClose} className="px-5 py-3 rounded-2xl bg-white text-indigo-700 text-lg font-black shadow-lg active:scale-95">
            Xong
          </button>
        </div>
      </div>
    </div>
  );
}

export function Run3DGame({ player, onClose, onGold, random = Math.random }) {
  const [record, setRecord] = useState(loadRun3d);
  const [game, setGame] = useState(() => createRun({ random, best: record.best }));
  const [hud, setHud] = useState(() => snap(game));
  const [phase, setPhase] = useState('menu'); // menu | count | play | result
  const [fail, setFail] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [banner, setBanner] = useState(null);
  const [result, setResult] = useState(null);
  const [hint, setHint] = useState(false);
  const sceneRef = useRef(null);
  const hudTimer = useRef(0);
  const swipe = useRef(null);
  const lastCoinSound = useRef(0);
  const toastId = useRef(0);
  const later = useLater();

  // The 3D scene, built when the stage mounts (a friendly message when WebGL is missing)
  const playerImage = player?.image;
  const mountStage = useCallback(
    (node) => {
      if (!node) return undefined;
      let scene = null;
      try {
        scene = createRun3DScene(node, { playerImage });
      } catch (err) {
        console.warn('[run3d] WebGL unavailable:', err);
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

  const finish = useCallback(
    (s) => {
      const saved = saveRun3d(s.d, s.coins);
      setRecord(saved);
      const done = s.missions.filter((m) => m.done).length;
      const r = { dist: Math.floor(s.d), coins: s.coins, missions: s.missions.map((m) => ({ ...m })), best: saved.best, isNew: saved.isNew, gold: goldForRun(s.d, s.coins, done) };
      later(() => {
        setResult(r);
        setPhase('result');
      }, 700);
    },
    [later]
  );

  const handleEvents = useCallback(
    (s, events) => {
      for (const e of events) {
        switch (e.type) {
          case 'coin': {
            const now = s.t;
            if (now - lastCoinSound.current > 0.07) {
              lastCoinSound.current = now;
              if (e.mag) sounds.playNote(1320 + Math.min(10, e.combo) * 40, { duration: 0.08, volume: 0.08 });
              else sounds.playCoin();
            }
            if (e.combo >= 5 && e.combo % 5 === 0) toast(`Combo x${e.combo}!`, 'gold');
            break;
          }
          case 'jump':
            sounds.playNote(620, { duration: 0.12, volume: 0.12 });
            break;
          case 'slide':
            sounds.playWhoosh();
            break;
          case 'lane':
            sounds.playNote(480, { duration: 0.05, volume: 0.06 });
            break;
          case 'bump':
            sounds.playPop();
            toast('Ối! Có vật cản bên cạnh', 'white');
            break;
          case 'nearMiss':
            sounds.playNote(990, { duration: 0.15, volume: 0.12 });
            toast('Suýt nữa!', 'pink');
            break;
          case 'power':
            sounds.playEnergySurge();
            toast(TOAST[e.kind] || 'Vật phẩm!', 'sky');
            break;
          case 'shieldBreak':
            sounds.playPop();
            toast('Khiên đã đỡ cho bé!', 'sky');
            break;
          case 'smash':
            sounds.playPop();
            break;
          case 'crateWarn':
            sounds.playScanBeep();
            break;
          case 'crash':
            sounds.playOops();
            break;
          case 'revive':
          case 'continue':
            sounds.playEnergySurge();
            toast(e.type === 'revive' ? 'Hồi sinh! Chạy tiếp nào!' : 'Chạy tiếp nào!', 'gold');
            break;
          case 'mission':
            sounds.playSuccessFanfare();
            toast(`Hoàn thành: ${e.label}!`, 'green');
            break;
          case 'world':
            sounds.playNote(784, { duration: 0.3, volume: 0.12 });
            {
              const id = s.t;
              setBanner({ id, text: e.name });
              later(() => setBanner((b) => (b?.id === id ? null : b)), 2700);
            }
            break;
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
      if (phase === 'play') step(s, dt);
      const events = s.events.length ? s.events.splice(0) : [];
      sceneRef.current?.update(s, dt, events);
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
      if (phase !== 'play') return;
      input(game, action);
    },
    [game, phase]
  );

  useEffect(() => {
    const keys = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump', ArrowDown: 'slide', s: 'slide', S: 'slide' };
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
    const dy = e.clientY - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
    sw.fired = true;
    if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right');
    else act(dy < 0 ? 'jump' : 'slide');
  };
  const onPointerUp = (e) => {
    const sw = swipe.current;
    swipe.current = null;
    if (!sw || sw.fired || sw.id !== e.pointerId) return;
    // A tap on the far left / right edge also changes lane (handy for small fingers)
    const r = e.currentTarget.getBoundingClientRect();
    if (!r.width) return;
    const fx = (e.clientX - r.left) / r.width;
    if (fx < 0.25) act('left');
    else if (fx > 0.75) act('right');
  };

  const begin = () => {
    startRun(game);
    setPhase('play');
    setHint(true);
    later(() => setHint(false), 4500);
    setHud(snap(game));
  };
  const replay = () => {
    const g = createRun({ random, best: record.best });
    setGame(g);
    setHud(snap(g));
    setResult(null);
    setToasts([]);
    setBanner(null);
    setPhase('menu');
  };
  const onContinue = () => {
    if (acceptContinue(game)) setHud(snap(game));
  };
  const onGiveUp = () => {
    if (declineContinue(game)) setHud(snap(game));
  };

  const shownPhase = phase === 'play' && hud.phase !== 'run' ? (hud.phase === 'crashed' ? 'crashed' : 'over') : phase;
  const activePowers = Object.entries(hud.power).filter(([, t]) => t > 0);
  const toneClass = { white: 'text-white', gold: 'text-amber-300', pink: 'text-pink-300', sky: 'text-sky-200', green: 'text-emerald-300' };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center bg-slate-950 select-none"
      role="dialog"
      aria-label={TITLE}
      data-phase={shownPhase}
      data-dist={hud.dist}
      data-coins={hud.coins}
      data-lane={hud.lane}
      data-pending={hud.pending || ''}
      data-world={hud.world}
    >
      <div className="relative w-full h-full max-w-[520px] overflow-hidden bg-sky-300">
        <div
          ref={mountStage}
          className="absolute inset-0 touch-none"
          data-testid="run3d-stage"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipe.current = null)}
        />

        {/* Top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-2 flex items-start gap-2">
          {phase !== 'menu' && (
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-2xl bg-black/45 text-white text-2xl font-black tabular-nums drop-shadow" data-testid="run3d-dist">
                  {hud.dist} m
                </span>
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-2xl bg-black/45 text-amber-200 text-xl font-black tabular-nums" data-testid="run3d-coins">
                  <Coin />
                  <span key={hud.coins} className="score-bump">
                    {hud.coins}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {hud.missions.map((m) => (
                  <span key={m.kind} className={`px-2 py-0.5 rounded-full text-[11px] font-black tabular-nums ${m.done ? 'run3d-pop bg-emerald-500 text-white' : 'bg-black/35 text-white/90'}`} title={m.label}>
                    {m.done ? '✅' : MISSION_ICON[m.kind]} {m.progress}/{m.goal}
                  </span>
                ))}
              </div>
            </div>
          )}
          <span className="ml-auto" />
          {phase !== 'menu' && record.best > 0 && (
            <span className="mt-1 flex items-center gap-1 px-2 py-1 rounded-xl bg-black/35 text-amber-200 text-xs font-black whitespace-nowrap">
              <Trophy className="w-3.5 h-3.5" /> {record.best} m
            </span>
          )}
          <button onClick={onClose} aria-label="Đóng trò chơi" className="pointer-events-auto p-2 rounded-full bg-white/90 text-slate-700 shadow" data-testid="run3d-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Power-up timers */}
        {phase === 'play' && (activePowers.length > 0 || hud.revives > 0) && (
          <div className="pointer-events-none absolute left-3 top-[5.6rem] z-20 flex flex-col gap-1" data-testid="run3d-powers">
            {activePowers.map(([k, t]) => (
              <div key={k} className="run3d-chip flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/45 text-white text-sm font-black">
                <span aria-hidden="true">{POWER_UI[k].icon}</span>
                <span className="w-14 h-2 rounded-full bg-white/25 overflow-hidden" aria-label={POWER[k].label}>
                  <span className={`block h-full ${POWER_UI[k].color}`} style={{ width: `${Math.min(100, (t / POWER[k].time) * 100)}%` }} />
                </span>
              </div>
            ))}
            {hud.revives > 0 && (
              <div className="run3d-chip flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-400/90 text-amber-950 text-xs font-black">
                <span aria-hidden="true">💛</span> Hồi sinh
              </div>
            )}
          </div>
        )}

        {/* Floating words */}
        <div className="pointer-events-none absolute inset-x-0 top-[34%] z-20 flex flex-col items-center gap-1">
          {toasts.map((t) => (
            <span key={t.id} className={`run3d-toast text-2xl font-black sport-banner text-center px-4 ${toneClass[t.tone] || 'text-white'}`}>
              {t.text}
            </span>
          ))}
        </div>
        {banner && (
          <div key={banner.id} className="run3d-banner pointer-events-none absolute left-1/2 top-[20%] z-20 px-5 py-2 rounded-2xl bg-white/90 text-indigo-700 text-xl font-black shadow-xl whitespace-nowrap" data-testid="run3d-world">
            🗺️ {banner.text}
          </div>
        )}
        {hint && phase === 'play' && (
          <div className="run3d-hint pointer-events-none absolute inset-x-4 bottom-6 z-20 rounded-2xl bg-black/45 px-3 py-2 text-center text-white text-sm font-black">
            Vuốt ⬅️ ➡️ đổi làn · ⬆️ nhảy · ⬇️ trượt
          </div>
        )}

        {/* Menu */}
        {phase === 'menu' && !fail && (
          <div className="absolute inset-0 z-30 flex items-center justify-center px-4 bg-gradient-to-b from-sky-900/40 via-transparent to-indigo-950/60">
            <div className="result-rise w-full max-w-sm rounded-3xl bg-white/92 shadow-2xl border-4 border-amber-300 p-4 text-center">
              <p className="text-2xl font-black text-indigo-700">{TITLE}</p>
              <p className="mt-1 text-sm font-bold text-slate-600">Chạy cùng {player?.name || 'Pokémon'} qua rừng, phố, hang đá và bãi biển!</p>
              <div className="mt-3 rounded-2xl bg-indigo-50 p-2 text-left">
                <p className="px-1 text-xs font-black text-indigo-500 uppercase">Nhiệm vụ lần này</p>
                <ul className="mt-1 space-y-1">
                  {hud.missions.map((m) => (
                    <li key={m.kind} className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-sm font-black text-slate-700 shadow-sm">
                      <span aria-hidden="true">{MISSION_ICON[m.kind]}</span> {m.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                <span className="rounded-xl bg-slate-100 px-2 py-1.5">⬅️ ➡️ Vuốt ngang: đổi làn</span>
                <span className="rounded-xl bg-slate-100 px-2 py-1.5">⬆️ Vuốt lên: nhảy</span>
                <span className="rounded-xl bg-slate-100 px-2 py-1.5">⬇️ Vuốt xuống: trượt</span>
                <span className="rounded-xl bg-slate-100 px-2 py-1.5">🪙 Nhặt xu & vật phẩm</span>
              </div>
              {record.best > 0 && (
                <p className="mt-2 flex items-center justify-center gap-1 text-sm font-black text-amber-600">
                  <Trophy className="w-4 h-4" /> Kỷ lục: {record.best} m
                </p>
              )}
              <button onClick={() => setPhase('count')} className="mt-3 w-full py-3.5 rounded-2xl bg-gradient-to-b from-red-500 to-red-600 text-white text-2xl font-black shadow-lg active:scale-95 flex items-center justify-center gap-2" data-testid="run3d-start">
                <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden="true">
                  <Ball x={12} y={12} r={9} />
                </svg>
                Chạy thôi!
              </button>
            </div>
          </div>
        )}

        {phase === 'count' && <Countdown text="CHẠY!" onDone={begin} />}

        {/* Crash: revive or one free continue */}
        {phase === 'play' && hud.phase === 'crashed' && hud.pending === 'offer' && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950/55 px-6 text-center" data-testid="run3d-offer">
            <p className="text-3xl font-black text-white sport-banner">Ối! Va phải rồi!</p>
            <button onClick={onContinue} className="run3d-pulse relative w-56 py-5 rounded-3xl bg-gradient-to-b from-emerald-400 to-emerald-600 text-white text-3xl font-black shadow-2xl border-4 border-white active:scale-95" data-testid="run3d-continue">
              Tiếp tục!
              <span className="absolute -top-3 -right-3 w-11 h-11 rounded-full bg-amber-400 text-amber-950 text-xl font-black flex items-center justify-center border-4 border-white tabular-nums">{Math.ceil(hud.offerT)}</span>
            </button>
            <p className="text-sm font-bold text-white/80">Miễn phí 1 lần mỗi lượt chạy</p>
            <button onClick={onGiveUp} className="px-5 py-2 rounded-2xl bg-white/85 text-slate-700 font-black" data-testid="run3d-giveup">
              Thôi, xem kết quả
            </button>
            <span className="sr-only">Còn {Math.ceil(hud.offerT)} trên {CONTINUE_TIME} giây</span>
          </div>
        )}
        {phase === 'play' && hud.phase === 'crashed' && hud.pending === 'revive' && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <span className="run3d-banner-in text-4xl font-black text-amber-300 sport-banner">💛 Hồi sinh!</span>
          </div>
        )}

        {phase === 'result' && result && <Result result={result} onReplay={replay} onClose={onClose} onGold={onGold} />}

        {fail && (
          <div className="absolute inset-0 z-40 flex items-center justify-center px-6 bg-gradient-to-b from-sky-600 to-indigo-800" data-testid="run3d-nowebgl">
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
