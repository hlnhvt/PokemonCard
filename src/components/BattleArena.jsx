import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, Swords, Zap, RotateCcw, Trophy, Heart } from 'lucide-react';
import { fetchBattlePokemon } from '../services/battleData';
import {
  createFighter,
  createBattle,
  playTurn,
  playCombo,
  canUseCombo,
  opponentLevel,
  COMBO_MAX,
} from '../utils/battle/engine';
import { effectiveness, effectivenessLabel, TYPE_COLORS, TYPE_VI } from '../utils/battle/typeChart';
import { BattleFx } from '../utils/battle/fx';
import { OPPONENT_POOL } from '../utils/battle/opponentPool';
import { pickOpponent } from '../utils/battle/matchmaking';
import { sounds } from '../utils/soundEffects';
import { playCry } from '../utils/cries';

// Slow is the default: children asked to see the moves and effects properly
const TEMPO = { slow: 1.5, normal: 1 };
const SPEED_KEY = 'pokescan_battle_speed';
function readSpeed() {
  try {
    return localStorage.getItem(SPEED_KEY) === 'normal' ? 'normal' : 'slow';
  } catch {
    return 'slow';
  }
}
function saveSpeed(value) {
  try {
    localStorage.setItem(SPEED_KEY, value);
  } catch {
    // ignore
  }
}

// Sprite centres as fractions of the arena (classic layout: opponent up-right, player low-left)
const POS = { opponent: { x: 0.72, y: 0.34 }, player: { x: 0.28, y: 0.7 } };

const hpColor = (ratio) => (ratio > 0.5 ? 'bg-emerald-400' : ratio > 0.2 ? 'bg-amber-400' : 'bg-rose-500');

function HpBox({ fighter, shown, ghost, align }) {
  const ratio = fighter.maxHp ? shown / fighter.maxHp : 0;
  const ghostRatio = fighter.maxHp ? ghost / fighter.maxHp : 0;
  return (
    <div className={`absolute z-20 w-[46%] max-w-[240px] rounded-2xl bg-slate-950/80 border border-white/20 px-3 py-2 shadow-xl backdrop-blur ${align}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm sm:text-base font-black text-white truncate">{fighter.name}</span>
        <span className="text-[11px] font-bold text-slate-300 shrink-0">Lv{fighter.level}</span>
      </div>
      <div className="flex gap-1 mt-0.5">
        {fighter.types.map((t) => (
          <span key={t} className="px-1.5 rounded text-[9px] font-black text-white" style={{ backgroundColor: TYPE_COLORS[t] }}>
            {TYPE_VI[t]}
          </span>
        ))}
        {fighter.isPlayer && fighter.friendship >= 50 && (
          <span className="flex items-center gap-0.5 px-1.5 rounded text-[9px] font-black text-white bg-pink-500" title="Sức mạnh tình bạn">
            <Heart className="w-2.5 h-2.5 fill-white" /> Tình bạn
          </span>
        )}
      </div>
      <div className="relative mt-1.5 h-2.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label={`Máu ${fighter.name}`} aria-valuemin={0} aria-valuemax={fighter.maxHp} aria-valuenow={shown}>
        {/* Red chip bar trails behind the real HP like in fighting games */}
        <div className="absolute inset-y-0 left-0 bg-rose-300 transition-[width] ease-out" style={{ width: `${ghostRatio * 100}%`, transitionDuration: 'calc(700ms * var(--battle-tempo, 1))', transitionDelay: 'calc(300ms * var(--battle-tempo, 1))' }} />
        <div className={`absolute inset-y-0 left-0 ${hpColor(ratio)} transition-[width] ease-out`} style={{ width: `${ratio * 100}%`, transitionDuration: 'calc(500ms * var(--battle-tempo, 1))' }} />
      </div>
      {fighter.isPlayer && (
        <div className="text-right text-[11px] font-bold text-slate-200 tabular-nums mt-0.5">
          {shown}/{fighter.maxHp}
        </div>
      )}
    </div>
  );
}

/**
 * Turn-based battle between the child's Pokemon and a wild one.
 * Every event from the engine is animated in order: moves travel with type-specific
 * particle effects, hits shake the screen, damage numbers pop, HP bars drain smoothly,
 * and the combo finisher chains all four moves.
 */
/**
 * challenge (optional, used by the Pokemon League): { ace, levelFactor, intro, title } fights that
 * Pokemon at a stronger or weaker level instead of a random wild one.
 */
export function BattleArena({ card, onClose, onResult, random = Math.random, tempo: tempoOverride, challenge }) {
  // Pace of the battle: 'slow' (default, easier to follow for children) or 'normal'
  const [speed, setSpeed] = useState(readSpeed);
  const tempo = tempoOverride ?? TEMPO[speed];
  const tempoRef = useRef(tempo);
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);
  const toggleSpeed = () => {
    const next = speed === 'slow' ? 'normal' : 'slow';
    setSpeed(next);
    saveSpeed(next);
  };
  const [phase, setPhase] = useState('loading'); // loading | intro | choose | animating | won | lost | error
  const [error, setError] = useState(null);
  const [battle, setBattle] = useState(null);
  const [hp, setHp] = useState({ player: 0, opponent: 0 });
  const [ghostHp, setGhostHp] = useState({ player: 0, opponent: 0 });
  const [combo, setCombo] = useState(0);
  const [message, setMessage] = useState('Đang tìm đối thủ...');
  const [spriteFx, setSpriteFx] = useState({ player: 'battle-enter', opponent: 'battle-enter' });
  const [floaters, setFloaters] = useState([]);
  const [banner, setBanner] = useState(null);
  const [chain, setChain] = useState(null);
  const [shake, setShake] = useState(null);
  const [flash, setFlash] = useState(null);
  const [comboMode, setComboMode] = useState(false);
  const [round, setRound] = useState(0);

  const arenaRef = useRef(null);
  const canvasRef = useRef(null);
  const fxRef = useRef(new BattleFx());
  const alive = useRef(true);
  const idRef = useRef(0);
  const reported = useRef(false);
  // Parents re-render with a new card object (e.g. after berries are awarded); reading it
  // through a ref keeps that from restarting the battle. Only the "round" counter starts a new one.
  const cardRef = useRef(card);
  const randomRef = useRef(random);
  const challengeRef = useRef(challenge);
  useEffect(() => {
    cardRef.current = card;
    randomRef.current = random;
    challengeRef.current = challenge;
  });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Every delay scales with the tempo (slow motion), so animations stay in sync
  const later = (fn, ms) => setTimeout(fn, ms * tempoRef.current);
  const wait = (ms) => new Promise((resolve) => later(resolve, ms));

  // ---- Canvas: size to the arena and run the particle loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const arena = arenaRef.current;
    if (!canvas || !arena) return undefined;
    const ctx = canvas.getContext?.('2d');
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(arena.clientWidth * dpr);
      canvas.height = Math.round(arena.clientHeight * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const raf = window.requestAnimationFrame || ((cb) => setTimeout(() => cb(performance.now()), 16));
    const caf = window.cancelAnimationFrame || clearTimeout;
    let id;
    let last = null;
    const loop = (now) => {
      const dt = last == null ? 16 : Math.min(50, now - last);
      last = now;
      const fx = fxRef.current;
      fx.update(dt / tempoRef.current);
      if (ctx) fx.draw(ctx, arena.clientWidth, arena.clientHeight);
      id = raf(loop);
    };
    id = raf(loop);
    return () => {
      caf(id);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const point = (side) => {
    const a = arenaRef.current;
    const w = a?.clientWidth || 400;
    const h = a?.clientHeight || 300;
    return { x: POS[side].x * w, y: POS[side].y * h };
  };

  const floater = (side, text, style) => {
    const id = ++idRef.current;
    const p = POS[side];
    setFloaters((list) => [...list, { id, text, style, left: `${p.x * 100}%`, top: `${(p.y - 0.12) * 100}%` }]);
    later(() => alive.current && setFloaters((list) => list.filter((f) => f.id !== id)), 1000);
  };

  const showBanner = (text, tone) => {
    const id = ++idRef.current;
    setBanner({ id, text, tone });
    later(() => alive.current && setBanner((b) => (b?.id === id ? null : b)), 1000);
  };

  const doShake = (size) => {
    // Remove then re-add the class on the next tick so the shake restarts on every hit
    setShake(null);
    setTimeout(() => alive.current && setShake(size), 0);
    later(() => alive.current && setShake(null), size === 'lg' ? 520 : 270);
  };

  const doFlash = (color) => {
    const id = ++idRef.current;
    setFlash({ id, color });
    later(() => alive.current && setFlash((f) => (f?.id === id ? null : f)), 350);
  };

  const spriteClass = (side, cls, ms) => {
    setSpriteFx((s) => ({ ...s, [side]: cls }));
    if (ms) later(() => alive.current && setSpriteFx((s) => (s[side] === cls ? { ...s, [side]: 'battle-idle' } : s)), ms);
  };

  // ---- Setup: load both Pokemon and play the intro
  const setup = useCallback(async () => {
    reported.current = false;
    const card = cardRef.current;
    const random = randomRef.current;
    try {
      const playerData = await fetchBattlePokemon(card);
      // A fair match: similar strength and no type advantage over the child's Pokemon
      const ch = challengeRef.current;
      const foe = ch ? { name: ch.ace } : pickOpponent(playerData, OPPONENT_POOL, random);
      const opponentData = await fetchBattlePokemon(foe.name);
      if (!alive.current) return;

      const player = createFighter(
        { ...playerData, name: card.name || playerData.name, image: card.fallbackImage || playerData.image },
        { isPlayer: true, friendship: card.friendship || 0 }
      );
      const baseLevel = opponentLevel(playerData.stats, opponentData.stats);
      const opponent = createFighter(opponentData, { level: ch ? Math.max(5, Math.round(baseLevel * (ch.levelFactor || 1))) : baseLevel });
      const b = createBattle({ player, opponent, random });
      fxRef.current.clear();
      setBattle(b);
      setHp({ player: player.hp, opponent: opponent.hp });
      setGhostHp({ player: player.hp, opponent: opponent.hp });
      setCombo(0);
      setComboMode(false);
      setPhase('intro');

      setSpriteFx({ player: 'opacity-0', opponent: 'battle-enter' });
      setMessage(ch?.intro || `Một ${opponent.name} hoang dã xuất hiện!`);
      playCry({ pokedexNumber: opponent.id, types: opponent.types });
      await wait(1300);
      if (!alive.current) return;
      setSpriteFx({ player: 'battle-enter', opponent: 'battle-idle' });
      setMessage(`Tiến lên, ${player.name}!`);
      playCry({ ...card, types: player.types });
      await wait(1000);
      if (!alive.current) return;
      setSpriteFx({ player: 'battle-idle', opponent: 'battle-idle' });
      setMessage(`${player.name} sẽ làm gì?`);
      setPhase('choose');
    } catch (err) {
      if (!alive.current) return;
      setError(err.message || 'Không bắt đầu được trận đấu.');
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    setup();
  }, [setup, round]);

  // ---- Animate the engine's events one by one
  const animate = async (b, events) => {
    const nameOf = (side) => b[side].name;
    let lastChain = 0;
    for (const e of events) {
      if (!alive.current) return;
      switch (e.kind) {
        case 'attack': {
          const target = e.side === 'player' ? 'opponent' : 'player';
          const physical = e.move.damageClass !== 'special';
          if (e.chain) {
            lastChain = e.chain;
            setChain(e.chain);
            setMessage(`Liên hoàn ${e.chain}: ${e.move.name}!`);
          } else {
            setMessage(`${nameOf(e.side)} dùng ${e.move.name}!`);
          }
          if (physical) {
            sounds.playWhoosh();
            spriteClass(e.side, `battle-lunge-${e.side}`, 450);
            await wait(260);
          } else {
            sounds.playEnergySurge();
            setSpriteFx((s) => ({ ...s, [e.side]: 'battle-charge' }));
            await wait(e.chain ? 160 : 300);
            spriteClass(e.side, 'battle-idle');
          }
          const travel = fxRef.current.playMove({ type: e.move.type, from: point(e.side), to: point(target), physical, power: e.move.power });
          await wait(physical ? 60 : travel * (e.chain ? 0.7 : 1));
          break;
        }
        case 'miss':
          floater(e.side === 'player' ? 'opponent' : 'player', 'TRƯỢT!', 'text-slate-200 text-2xl');
          setMessage('Trượt rồi!');
          await wait(650);
          break;
        case 'hit': {
          const superEffective = e.effectiveness >= 2;
          fxRef.current.impact({ type: e.move.type, at: point(e.side), crit: e.crit, superEffective, power: e.move.power * (e.chain ? 1.3 : 1) });
          sounds.playPop();
          spriteClass(e.side, 'battle-hit', 400);
          setHp((h) => ({ ...h, [e.side]: e.hp }));
          later(() => alive.current && setGhostHp((g) => ({ ...g, [e.side]: e.hp })), 50);
          const style = e.crit
            ? 'text-yellow-300 text-4xl'
            : superEffective
              ? 'text-orange-400 text-3xl'
              : e.effectiveness < 1
                ? 'text-slate-300 text-xl'
                : 'text-white text-2xl';
          floater(e.side, `${e.crit ? 'CHÍ MẠNG! ' : ''}-${e.damage}`, style);
          if (e.crit) {
            doFlash('#ffffff');
            showBanner('CHÍ MẠNG!', 'from-yellow-300 to-amber-500');
          }
          if (e.crit || superEffective || e.chain >= 3) doShake('lg');
          else doShake('sm');
          // Hit-stop: a tiny freeze makes strong hits feel heavy
          await wait(e.hits > 1 ? 230 : e.crit ? 560 : 450);
          break;
        }
        case 'multi':
          showBanner(`TRÚNG ${e.hits} LẦN!`, 'from-cyan-300 to-blue-500');
          setMessage(`Trúng ${e.hits} lần!`);
          await wait(650);
          break;
        case 'effect':
          if (e.effectiveness >= 2) {
            showBanner(e.label, 'from-orange-400 to-rose-500');
            doFlash('#fb923c');
          }
          setMessage(e.label);
          await wait(e.effectiveness >= 2 ? 750 : 600);
          break;
        case 'combo':
          setCombo(e.value);
          break;
        case 'combo-start':
          setComboMode(true);
          showBanner('TUYỆT KỸ LIÊN HOÀN!', 'rainbow-bg');
          sounds.playEnergySurge();
          doFlash('#a855f7');
          setMessage(`${b.player.name} tung Tuyệt Kỹ Liên Hoàn!`);
          await wait(1100);
          break;
        case 'combo-end':
          fxRef.current.finale(point('opponent'));
          doFlash('#ffffff');
          doShake('lg');
          sounds.playSuccessFanfare();
          showBanner(`COMBO x${lastChain}! -${e.total}`, 'rainbow-bg');
          await wait(1200);
          setChain(null);
          setComboMode(false);
          break;
        case 'faint':
          fxRef.current.faint(point(e.side));
          spriteClass(e.side, 'battle-faint');
          playCry({ pokedexNumber: b[e.side].id, types: b[e.side].types });
          setMessage(`${nameOf(e.side)} đã gục ngã!`);
          await wait(1300);
          break;
        case 'turn-end':
          setMessage(`${b.player.name} sẽ làm gì?`);
          break;
        default:
          break;
      }
    }
  };

  const finishIfOver = (b) => {
    if (b.status === 'choosing') {
      setPhase('choose');
      return;
    }
    const won = b.status === 'won';
    setPhase(won ? 'won' : 'lost');
    if (won) {
      spriteClass('player', 'battle-victory');
      sounds.playSuccessFanfare();
      try {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.45 } });
      } catch {
        // ignore
      }
    }
    if (!reported.current) {
      reported.current = true;
      onResult?.({ won, opponent: b.opponent.name });
    }
  };

  const choose = async (index) => {
    if (phase !== 'choose' || !battle) return;
    setPhase('animating');
    const events = playTurn(battle, index);
    await animate(battle, events);
    if (alive.current) finishIfOver(battle);
  };

  const triggerCombo = async () => {
    if (phase !== 'choose' || !battle || !canUseCombo(battle)) return;
    setPhase('animating');
    const events = playCombo(battle);
    await animate(battle, events);
    if (alive.current) finishIfOver(battle);
  };

  // New opponent: reset to the loading screen, then the effect loads the next battle
  const rematch = () => {
    setPhase('loading');
    setMessage('Đang tìm đối thủ...');
    setError(null);
    setBattle(null);
    setRound((r) => r + 1);
  };

  const player = battle?.player;
  const opponent = battle?.opponent;
  const comboReady = combo >= COMBO_MAX;

  return createPortal(
    <div data-theme="dark" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4" role="dialog" aria-label="Đấu Pokémon" data-phase={phase} data-speed={speed} style={{ '--battle-tempo': tempo }}>
      <div className="w-full max-w-2xl max-h-full overflow-y-auto rounded-3xl border-4 border-white/70 shadow-2xl bg-slate-950">
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-red-600 via-rose-600 to-orange-500">
          <span className="flex items-center gap-2 text-white font-black">
            <Swords className="w-5 h-5" /> {challenge?.title || 'Đấu Pokémon!'}
          </span>
          <button
            onClick={toggleSpeed}
            aria-label={speed === 'slow' ? 'Tốc độ: chậm (bấm để nhanh hơn)' : 'Tốc độ: nhanh (bấm để chậm lại)'}
            className="ml-auto mr-2 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-sm font-black"
          >
            {speed === 'slow' ? '🐢 Chậm' : '🐇 Nhanh'}
          </button>
          <button onClick={onClose} aria-label="Đóng trận đấu" className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Arena */}
        <div
          ref={arenaRef}
          className={`relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden bg-gradient-to-b from-sky-400 via-sky-200 to-emerald-300 ${shake ? `battle-shake-${shake}` : ''}`}
          data-testid="battle-arena"
        >
          {/* Platforms */}
          <div className="absolute rounded-[50%] bg-emerald-600/50 border-b-4 border-emerald-800/40" style={{ left: '56%', top: '42%', width: '34%', height: '10%' }} />
          <div className="absolute rounded-[50%] bg-emerald-700/50 border-b-4 border-emerald-900/40" style={{ left: '8%', top: '80%', width: '40%', height: '12%' }} />

          {phase === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-900">
              <div className="w-14 h-14 rounded-full border-[6px] border-white border-t-red-500 animate-spin" />
              <p className="font-black" role="status">Đang chuẩn bị trận đấu...</p>
            </div>
          )}

          {/* Outer box positions the sprite; the inner image carries the animation and, for the
              player, the mirror (--flip) so both Pokemon face each other */}
          {opponent && (
            <div
              className="absolute z-10 w-[30%] max-w-[190px] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${POS.opponent.x * 100}%`, top: `${POS.opponent.y * 100}%` }}
            >
              <img
                src={opponent.image}
                alt={opponent.name}
                draggable={false}
                className={`w-full drop-shadow-2xl select-none ${spriteFx.opponent}`}
                style={{ '--charge': TYPE_COLORS[opponent.types[0]] }}
              />
            </div>
          )}
          {player && (
            <div
              className="absolute z-10 w-[34%] max-w-[220px] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${POS.player.x * 100}%`, top: `${POS.player.y * 100}%` }}
            >
              <img
                src={player.image}
                alt={player.name}
                draggable={false}
                className={`w-full drop-shadow-2xl select-none ${spriteFx.player}`}
                style={{ '--flip': -1, transform: 'scale(-1, 1)', '--charge': TYPE_COLORS[player.types[0]] }}
              />
            </div>
          )}

          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-20" data-testid="battle-fx" />

          {comboMode && <div className="combo-vignette absolute inset-0 z-20 pointer-events-none" data-testid="combo-vignette" />}

          {opponent && <HpBox fighter={opponent} shown={hp.opponent} ghost={ghostHp.opponent} align="left-2 top-2" />}
          {player && <HpBox fighter={player} shown={hp.player} ghost={ghostHp.player} align="right-2 bottom-2" />}

          {floaters.map((f) => (
            <span key={f.id} className={`damage-float absolute z-30 font-black whitespace-nowrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] ${f.style}`} style={{ left: f.left, top: f.top }}>
              {f.text}
            </span>
          ))}

          {chain && (
            <span key={chain} className="chain-pop absolute z-30 right-4 top-1/2 text-4xl sm:text-5xl font-black text-yellow-300 drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)]" data-testid="chain-counter">
              x{chain}
            </span>
          )}

          {/* Outer element runs the slam (and centring); the inner one paints the background,
              because .rainbow-bg has its own animation that would replace the slam */}
          {banner && (
            <div key={banner.id} className="banner-slam absolute z-40 left-1/2 top-1/2 max-w-[92%]" role="status">
              <span className={`block px-4 sm:px-5 py-2 rounded-2xl bg-gradient-to-r ${banner.tone} text-white text-lg sm:text-3xl font-black whitespace-nowrap shadow-2xl border-2 border-white/70`}>
                {banner.text}
              </span>
            </div>
          )}

          {flash && <div key={flash.id} className="flash-fade absolute inset-0 z-40 pointer-events-none" style={{ backgroundColor: flash.color }} />}

          {(phase === 'won' || phase === 'lost') && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-black/55 text-center px-4">
              {phase === 'won' ? (
                <>
                  <Trophy className="w-14 h-14 text-yellow-300" />
                  <p className="text-3xl font-black text-white">Chiến thắng! 🎉</p>
                  <p className="text-sm font-bold text-emerald-200">{player.name} đã thắng {opponent.name}! Phần thưởng: 2 quả mọng</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-black text-white">Thua mất rồi!</p>
                  <p className="text-sm font-bold text-slate-200">Cố lên! Thử chọn chiêu "Siêu hiệu quả" nhé. Quà an ủi: 1 quả mọng</p>
                </>
              )}
              <div className="flex gap-2 mt-2">
                <button onClick={rematch} className="px-5 py-2.5 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-black flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" /> Đấu tiếp
                </button>
                <button onClick={onClose} className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black">
                  Xong
                </button>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/60 text-center px-6">
              <p className="text-lg font-black text-white">{error}</p>
              <button onClick={rematch} className="px-5 py-2.5 rounded-2xl bg-red-500 text-white font-black">
                Thử lại
              </button>
            </div>
          )}
        </div>

        {/* Command panel */}
        <div className="p-3 space-y-2.5 bg-slate-900">
          <p className="min-h-[1.5rem] text-base font-bold text-white" role="log" aria-live="polite">
            {message}
          </p>

          {player && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {player.moves.map((move, i) => {
                  const eff = opponent ? effectiveness(move.type, opponent.types) : 1;
                  const hint = effectivenessLabel(eff);
                  return (
                    <button
                      key={move.name}
                      onClick={() => choose(i)}
                      disabled={phase !== 'choose'}
                      className="relative py-2.5 px-3 rounded-2xl text-left text-white font-black shadow-lg border-2 border-white/25 disabled:opacity-50 active:scale-95 transition-transform"
                      style={{ background: `linear-gradient(135deg, ${TYPE_COLORS[move.type]}, ${TYPE_COLORS[move.type]}bb)` }}
                    >
                      <span className="block text-sm sm:text-base leading-tight drop-shadow">{move.name}</span>
                      <span className="block text-[11px] font-bold opacity-90">
                        {TYPE_VI[move.type]} • Sức mạnh {move.power}
                        {move.maxHits > 1 ? ` • ${move.minHits}-${move.maxHits} đòn` : ''}
                        {move.priority > 0 ? ' • Ra đòn trước' : ''}
                      </span>
                      {hint && eff !== 1 && (
                        <span className={`absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-black shadow ${eff >= 2 ? 'bg-orange-500' : eff === 0 ? 'bg-slate-600' : 'bg-slate-500'}`}>
                          {eff >= 2 ? 'Siêu hiệu quả!' : eff === 0 ? 'Vô hiệu' : 'Yếu'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label="Năng lượng liên hoàn" aria-valuemin={0} aria-valuemax={COMBO_MAX} aria-valuenow={combo}>
                  <div className={`h-full rounded-full transition-[width] duration-500 ${comboReady ? 'rainbow-bg' : 'bg-gradient-to-r from-yellow-400 to-orange-500'}`} style={{ width: `${(combo / COMBO_MAX) * 100}%` }} />
                </div>
                <button
                  onClick={triggerCombo}
                  disabled={!comboReady || phase !== 'choose'}
                  className={`shrink-0 px-3 py-2 rounded-xl text-sm font-black flex items-center gap-1 ${comboReady ? 'rainbow-bg text-white energy-full' : 'bg-slate-800 text-slate-500'}`}
                >
                  <Zap className="w-4 h-4" /> Tuyệt Kỹ Liên Hoàn
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
