import React, { useEffect, useRef, useState } from 'react';
import { Zap, Heart } from 'lucide-react';
import { teamTurn, teamCombo, canUseTeamCombo, sendIn, alivePlayers, beatsCurrent, mvpIndex, continueWith, switchPlayer, difficultyOf } from '../../utils/team/teamBattle';
import { COMBO_MAX } from '../../utils/battle/engine';
import { effectiveness, effectivenessLabel, TYPE_COLORS, TYPE_VI } from '../../utils/battle/typeChart';
import { BattleFx } from '../../utils/battle/fx';
import { sounds } from '../../utils/soundEffects';
import { playCry } from '../../utils/cries';
import { PokeballIcon } from '../PokeballIcon';
import { ArenaBackdrop } from './ArenaBackdrop';

const POS = { opponent: { x: 0.7, y: 0.36 }, player: { x: 0.3, y: 0.72 } };
const hpColor = (ratio) => (ratio > 0.5 ? 'bg-emerald-400' : ratio > 0.2 ? 'bg-amber-400' : 'bg-rose-500');

function HpBox({ fighter, shown, ghost, align }) {
  const ratio = fighter.maxHp ? shown / fighter.maxHp : 0;
  const ghostRatio = fighter.maxHp ? ghost / fighter.maxHp : 0;
  return (
    <div className={`absolute z-20 w-[48%] max-w-[230px] rounded-2xl bg-slate-950/80 border border-white/20 px-3 py-1.5 shadow-xl backdrop-blur ${align}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-black text-white truncate">{fighter.name}</span>
        <span className="text-[11px] font-bold text-slate-300 shrink-0">Lv{fighter.level}</span>
      </div>
      <div className="flex gap-1 mt-0.5">
        {fighter.types.map((t) => (
          <span key={t} className="px-1.5 rounded text-[9px] font-black text-white" style={{ backgroundColor: TYPE_COLORS[t] }}>
            {TYPE_VI[t]}
          </span>
        ))}
        {fighter.isPlayer && fighter.friendship >= 50 && (
          <span className="flex items-center gap-0.5 px-1.5 rounded text-[9px] font-black text-white bg-pink-500">
            <Heart className="w-2.5 h-2.5 fill-white" /> Tình bạn
          </span>
        )}
      </div>
      <div className="relative mt-1 h-2.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label={`Máu ${fighter.name}`} aria-valuemin={0} aria-valuemax={fighter.maxHp} aria-valuenow={shown}>
        <div className="absolute inset-y-0 left-0 bg-rose-300 transition-[width] ease-out" style={{ width: `${ghostRatio * 100}%`, transitionDuration: 'calc(700ms * var(--battle-tempo, 1))', transitionDelay: 'calc(300ms * var(--battle-tempo, 1))' }} />
        <div className={`absolute inset-y-0 left-0 ${hpColor(ratio)} transition-[width] ease-out`} style={{ width: `${ratio * 100}%`, transitionDuration: 'calc(500ms * var(--battle-tempo, 1))' }} />
      </div>
    </div>
  );
}

/** A row of the 5 team members: who is fighting, how much HP, who has fainted. */
function Roster({ fighters, hp, active, side, label }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 ${side === 'player' ? 'bg-sky-950/70' : 'bg-rose-950/70'}`} aria-label={label} data-testid={`roster-${side}`}>
      <span className={`text-[10px] font-black w-10 shrink-0 ${side === 'player' ? 'text-sky-300' : 'text-rose-300'}`}>{side === 'player' ? 'ĐỘI BÉ' : 'ĐỐI THỦ'}</span>
      {fighters.map((f, i) => {
        const shown = hp[`${side[0]}${i}`] ?? f.maxHp;
        const out = shown <= 0;
        const isActive = i === active;
        return (
          <div key={i} className={`relative flex-1 flex flex-col items-center transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} data-fainted={out}>
            <div className={`relative w-9 h-9 rounded-full border-2 ${isActive ? 'border-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.9)]' : 'border-white/30'} bg-white/15 overflow-hidden`}>
              <img src={f.image} alt={f.name} className={`w-full h-full object-contain ${side === 'player' ? 'scale-x-[-1]' : ''} ${out ? 'grayscale opacity-40' : ''}`} />
              {out && <span className="absolute inset-0 flex items-center justify-center text-rose-400 font-black text-lg">✕</span>}
            </div>
            <div className="mt-0.5 w-8 h-1 rounded-full bg-black/50 overflow-hidden">
              <div className={`h-full ${hpColor(shown / f.maxHp)} transition-[width] duration-500`} style={{ width: `${Math.max(0, shown / f.maxHp) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The 5 vs 5 battle itself. `state` comes from createTeamBattle (mutated by the engine);
 * every event is animated: Pokeball throws, Pokemon bursting out, moves with type effects,
 * damage numbers, shakes, faints turning red and returning to the ball.
 */
export function TeamArena({ arena, state, tempo = 1.5, onFinish }) {
  const tempoRef = useRef(tempo);
  useEffect(() => {
    tempoRef.current = tempo;
  }, [tempo]);
  const [phase, setPhase] = useState('intro'); // intro | choose | animating | switch | swap | between | over
  const [active, setActive] = useState({ player: 0, opponent: 0 });
  const [hp, setHp] = useState({ player: state.players[0].maxHp, opponent: state.opponents[0].maxHp });
  const [ghost, setGhost] = useState({ player: state.players[0].maxHp, opponent: state.opponents[0].maxHp });
  const [roster, setRoster] = useState({});
  const [combo, setCombo] = useState(0);
  const [message, setMessage] = useState('Trận đấu đội bắt đầu!');
  const [spriteFx, setSpriteFx] = useState({ player: 'opacity-0', opponent: 'opacity-0' });
  const [ball, setBall] = useState(null);
  const [burst, setBurst] = useState(null);
  const [floaters, setFloaters] = useState([]);
  const [banner, setBanner] = useState(null);
  const [chain, setChain] = useState(null);
  const [shake, setShake] = useState(null);
  const [flash, setFlash] = useState(null);
  const [comboMode, setComboMode] = useState(false);
  const arenaRef = useRef(null);
  const canvasRef = useRef(null);
  const [fx] = useState(() => new BattleFx());
  const alive = useRef(true);
  const idRef = useRef(0);
  const finished = useRef(false);
  // Who is on the field right now. The engine moves on to the next pair before the turn's
  // animation ends, so the animation must not read state.pi / state.oi / state.battle.
  const shownRef = useRef({ player: 0, opponent: 0 });

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const later = (fn, ms) => setTimeout(() => alive.current && fn(), ms * tempoRef.current);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms * tempoRef.current));

  // Particle canvas over the arena
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = arenaRef.current;
    if (!canvas || !box) return undefined;
    const ctx = canvas.getContext?.('2d');
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(box.clientWidth * dpr);
      canvas.height = Math.round(box.clientHeight * dpr);
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
      fx.update(dt / tempoRef.current);
      if (ctx) fx.draw(ctx, box.clientWidth, box.clientHeight);
      id = raf(loop);
    };
    id = raf(loop);
    return () => {
      caf(id);
      window.removeEventListener('resize', resize);
    };
  }, [fx]);

  const point = (side) => {
    const a = arenaRef.current;
    return { x: POS[side].x * (a?.clientWidth || 400), y: POS[side].y * (a?.clientHeight || 300) };
  };
  const fighterOf = (side, index) => (side === 'player' ? state.players[index] : state.opponents[index]);
  const floater = (side, text, style) => {
    const id = ++idRef.current;
    const p = POS[side];
    setFloaters((list) => [...list, { id, text, style, left: `${p.x * 100}%`, top: `${(p.y - 0.13) * 100}%` }]);
    later(() => setFloaters((list) => list.filter((f) => f.id !== id)), 1000);
  };
  const showBanner = (text, tone) => {
    const id = ++idRef.current;
    setBanner({ id, text, tone });
    later(() => setBanner((b) => (b?.id === id ? null : b)), 1000);
  };
  const doShake = (size) => {
    setShake(null);
    setTimeout(() => alive.current && setShake(size), 0);
    later(() => setShake(null), size === 'lg' ? 520 : 270);
  };
  const doFlash = (color) => {
    const id = ++idRef.current;
    setFlash({ id, color });
    later(() => setFlash((f) => (f?.id === id ? null : f)), 350);
  };
  const sprite = (side, cls, ms) => {
    setSpriteFx((s) => ({ ...s, [side]: cls }));
    if (ms) later(() => setSpriteFx((s) => (s[side] === cls ? { ...s, [side]: 'battle-idle' } : s)), ms);
  };

  /** Pokeball flies in, bursts open in a flash, and the Pokemon grows out of the light. */
  const sendOut = async (side, index) => {
    const f = fighterOf(side, index);
    shownRef.current = { ...shownRef.current, [side]: index };
    setActive((a) => ({ ...a, [side]: index }));
    setSpriteFx((s) => ({ ...s, [side]: 'opacity-0' }));
    setHp((h) => ({ ...h, [side]: f.hp }));
    setGhost((g) => ({ ...g, [side]: f.hp }));
    setMessage(side === 'player' ? `Tiến lên, ${f.name}!` : `Đối thủ tung ra ${f.name}!`);
    setBall({ side, key: ++idRef.current });
    sounds.playWhoosh();
    await wait(700);
    if (!alive.current) return;
    setBall(null);
    setBurst({ side, key: ++idRef.current, color: TYPE_COLORS[f.types[0]] });
    fx.impact({ type: f.types[0], at: point(side), power: 70 });
    sounds.playPop();
    sprite(side, 'poke-emerge', 800);
    showBanner(side === 'player' ? `Tiến lên, ${f.name}!` : `${f.name} xuất hiện!`, side === 'player' ? 'from-sky-400 to-blue-600' : 'from-rose-400 to-red-600');
    playCry({ pokedexNumber: f.id, types: f.types });
    await wait(950);
  };

  // Opening: opponent first, then the child's Pokemon
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await wait(300);
      if (cancelled || !alive.current) return;
      await sendOut('opponent', 0);
      if (cancelled || !alive.current) return;
      await sendOut('player', 0);
      if (cancelled || !alive.current) return;
      setMessage(`${state.players[0].name} sẽ làm gì?`);
      setPhase('choose');
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (won) => {
    if (finished.current) return;
    finished.current = true;
    setPhase('over');
    const survivors = alivePlayers(state).length;
    if (won) {
      sprite('player', 'battle-victory');
      sounds.playSuccessFanfare();
      showBanner('CHIẾN THẮNG!', 'from-yellow-300 to-amber-500');
    } else {
      showBanner('THUA MẤT RỒI!', 'from-slate-400 to-slate-600');
    }
    later(() => onFinish?.({ won, survivors, kos: [...state.kos], mvp: mvpIndex(state) }), 1600);
  };

  const animate = async (events) => {
    let lastChain = 0;
    for (const e of events) {
      if (!alive.current) return;
      switch (e.kind) {
        case 'attack': {
          const target = e.side === 'player' ? 'opponent' : 'player';
          const physical = e.move.damageClass !== 'special';
          const name = fighterOf(e.side, shownRef.current[e.side]).name;
          if (e.chain) {
            lastChain = e.chain;
            setChain(e.chain);
            setMessage(`Liên hoàn ${e.chain}: ${e.move.name}!`);
          } else {
            setMessage(`${name} dùng ${e.move.name}!${e.move.boosted ? ' (sân nhà ↑)' : ''}`);
          }
          if (physical) {
            sounds.playWhoosh();
            sprite(e.side, `battle-lunge-${e.side}`, 450);
            await wait(260);
          } else {
            sounds.playEnergySurge();
            setSpriteFx((s) => ({ ...s, [e.side]: 'battle-charge' }));
            await wait(e.chain ? 160 : 300);
            sprite(e.side, 'battle-idle');
          }
          const travel = fx.playMove({ type: e.move.type, from: point(e.side), to: point(target), physical, power: e.move.power });
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
          fx.impact({ type: e.move.type, at: point(e.side), crit: e.crit, superEffective, power: e.move.power * (e.chain ? 1.3 : 1) });
          sounds.playPop();
          sprite(e.side, 'battle-hit', 400);
          setHp((h) => ({ ...h, [e.side]: e.hp }));
          setRoster((r) => ({ ...r, [`${e.side[0]}${shownRef.current[e.side]}`]: e.hp }));
          later(() => setGhost((g) => ({ ...g, [e.side]: e.hp })), 50);
          const style = e.crit ? 'text-yellow-300 text-4xl' : superEffective ? 'text-orange-400 text-3xl' : e.effectiveness < 1 ? 'text-slate-300 text-xl' : 'text-white text-2xl';
          floater(e.side, `${e.crit ? 'CHÍ MẠNG! ' : ''}-${e.damage}`, style);
          if (e.crit) {
            doFlash('#ffffff');
            showBanner('CHÍ MẠNG!', 'from-yellow-300 to-amber-500');
          }
          doShake(e.crit || superEffective || e.chain >= 3 ? 'lg' : 'sm');
          await wait(e.hits > 1 ? 230 : e.crit ? 560 : 450);
          break;
        }
        case 'multi':
          showBanner(`TRÚNG ${e.hits} LẦN!`, 'from-cyan-300 to-blue-500');
          await wait(600);
          break;
        case 'effect':
          if (e.effectiveness >= 2) {
            showBanner(e.label, 'from-orange-400 to-rose-500');
            doFlash('#fb923c');
          }
          setMessage(e.label);
          await wait(e.effectiveness >= 2 ? 750 : 550);
          break;
        case 'combo':
          setCombo(e.value);
          break;
        case 'combo-start':
          setComboMode(true);
          showBanner('TUYỆT KỸ LIÊN HOÀN!', 'rainbow-bg');
          sounds.playEnergySurge();
          doFlash('#a855f7');
          await wait(1100);
          break;
        case 'combo-end':
          fx.finale(point('opponent'));
          doFlash('#ffffff');
          doShake('lg');
          sounds.playSuccessFanfare();
          showBanner(`COMBO x${lastChain}! -${e.total}`, 'rainbow-bg');
          await wait(1200);
          setChain(null);
          setComboMode(false);
          break;
        case 'faint': {
          fx.faint(point(e.side));
          sprite(e.side, 'poke-recall');
          const f = fighterOf(e.side, shownRef.current[e.side]);
          playCry({ pokedexNumber: f.id, types: f.types });
          setMessage(`${f.name} đã gục ngã!`);
          if (e.side === 'opponent') showBanner('HẠ GỤC!', 'from-emerald-300 to-teal-500');
          await wait(1300);
          break;
        }
        case 'switch':
          await sendOut(e.side, e.index);
          break;
        case 'duel-won':
          setMessage('Giữ nguyên hay đổi Pokémon?');
          setPhase('between');
          return 'between';
        case 'need-switch':
          setMessage('Chọn Pokémon tiếp theo!');
          setPhase('switch');
          return 'switch';
        case 'team-won':
          finish(true);
          return 'over';
        case 'team-lost':
          finish(false);
          return 'over';
        case 'turn-end':
          setMessage(`${fighterOf('player', shownRef.current.player).name} sẽ làm gì?`);
          break;
        default:
          break;
      }
    }
    return 'choose';
  };

  const run = async (events) => {
    setPhase('animating');
    const next = await animate(events);
    if (alive.current && next === 'choose') setPhase('choose');
  };

  const choose = (index) => phase === 'choose' && run(teamTurn(state, index));
  const combo2 = () => phase === 'choose' && canUseTeamCombo(state) && run(teamCombo(state));
  const pickNext = (index) => phase === 'switch' && run(sendIn(state, index));
  const keepOrSwap = (index) => phase === 'between' && run(continueWith(state, index));
  const swapTo = (index) => phase === 'swap' && run(switchPlayer(state, index));
  const benchCount = alivePlayers(state).filter((i) => i !== active.player).length;
  const beatsNext = (i) => {
    const next = state.opponents[active.opponent + 1];
    return !!next && state.players[i].moves.some((m) => effectiveness(m.type, next.types) >= 2);
  };

  const player = fighterOf('player', active.player);
  const opponent = fighterOf('opponent', active.opponent);
  const comboReady = combo >= COMBO_MAX;
  const rosterHp = (side, i) => roster[`${side[0]}${i}`] ?? fighterOf(side, i).maxHp;

  return (
    <div className="flex flex-col" data-testid="team-arena" data-phase={phase} data-pi={active.player} data-oi={active.opponent}>
      <Roster fighters={state.opponents} hp={Object.fromEntries(state.opponents.map((_, i) => [`o${i}`, rosterHp('opponent', i)]))} active={active.opponent} side="opponent" label="Đội đối thủ" />
      <div ref={arenaRef} className={`relative aspect-[4/3.4] overflow-hidden ${shake ? `battle-shake-${shake}` : ''}`}>
        <ArenaBackdrop arena={arena} className="absolute inset-0">
          {/* Platforms */}
          <div className="absolute rounded-[50%] border-b-4 border-black/25" style={{ left: '52%', top: '44%', width: '38%', height: '10%', backgroundColor: `${arena.platform}99` }} />
          <div className="absolute rounded-[50%] border-b-4 border-black/25" style={{ left: '8%', top: '82%', width: '44%', height: '12%', backgroundColor: `${arena.platform}aa` }} />
        </ArenaBackdrop>

        {['opponent', 'player'].map((side) => {
          const f = side === 'player' ? player : opponent;
          return (
            <div
              key={side}
              className={`absolute z-10 ${side === 'player' ? 'w-[34%] max-w-[200px]' : 'w-[30%] max-w-[180px]'} -translate-x-1/2 -translate-y-1/2`}
              style={{ left: `${POS[side].x * 100}%`, top: `${POS[side].y * 100}%` }}
            >
              <img
                key={`${side}-${active[side]}`}
                src={f.image}
                alt={f.name}
                draggable={false}
                data-testid={`sprite-${side}`}
                className={`w-full drop-shadow-2xl select-none ${spriteFx[side]}`}
                style={side === 'player' ? { '--flip': -1, transform: 'scale(-1, 1)', '--charge': TYPE_COLORS[f.types[0]] } : { '--charge': TYPE_COLORS[f.types[0]] }}
              />
            </div>
          );
        })}

        {ball && (
          <div key={ball.key} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${POS[ball.side].x * 100}%`, top: `${POS[ball.side].y * 100}%` }}>
            <span className={`block ball-throw-${ball.side}`} data-testid="thrown-ball">
              <PokeballIcon className="w-10 h-10 drop-shadow-lg" />
            </span>
          </div>
        )}
        {burst && (
          <span
            key={burst.key}
            className="ball-burst absolute z-20 w-24 h-24 rounded-full pointer-events-none"
            style={{ left: `${POS[burst.side].x * 100}%`, top: `${POS[burst.side].y * 100}%`, background: `radial-gradient(circle, #ffffff 0%, ${burst.color} 45%, transparent 70%)` }}
          />
        )}

        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-20" />
        {comboMode && <div className="combo-vignette absolute inset-0 z-20 pointer-events-none" />}

        <HpBox fighter={opponent} shown={hp.opponent} ghost={ghost.opponent} align="left-2 top-2" />
        <HpBox fighter={player} shown={hp.player} ghost={ghost.player} align="right-2 bottom-2" />

        {floaters.map((f) => (
          <span key={f.id} className={`damage-float absolute z-30 font-black whitespace-nowrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] ${f.style}`} style={{ left: f.left, top: f.top }}>
            {f.text}
          </span>
        ))}
        {chain && (
          <span key={`chain-${chain}`} className="chain-pop absolute z-30 right-4 top-1/2 text-5xl font-black text-yellow-300 drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)]">
            x{chain}
          </span>
        )}
        {banner && (
          <div key={banner.id} className="banner-slam absolute z-40 left-1/2 top-1/2 max-w-[92%]" role="status">
            <span className={`block px-4 py-2 rounded-2xl bg-gradient-to-r ${banner.tone} text-white text-xl sm:text-3xl font-black whitespace-nowrap shadow-2xl border-2 border-white/70`}>{banner.text}</span>
          </div>
        )}
        {flash && <div key={flash.id} className="flash-fade absolute inset-0 z-40 pointer-events-none" style={{ backgroundColor: flash.color }} />}

        {(phase === 'swap' || phase === 'between') && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-slate-950/80 px-3" data-testid={phase === 'swap' ? 'swap-picker' : 'between-picker'}>
            {phase === 'between' ? (
              <>
                <p className="pop-in text-xl font-black text-emerald-300">Hạ gục {opponent.name}! 🎉</p>
                <p className="text-xs font-bold text-slate-300">Đối thủ tiếp theo: {state.opponents[active.opponent + 1]?.name}</p>
                <button onClick={() => keepOrSwap(active.player)} aria-label={`Giữ nguyên ${player.name}`} className="pop-in w-full max-w-sm flex items-center gap-3 p-2.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-left shadow-xl active:scale-95">
                  <img src={player.image} alt="" className="w-14 h-14 object-contain scale-x-[-1] battle-idle" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-base font-black">Giữ nguyên {player.name}</span>
                    <span className="block h-2 mt-1 rounded-full bg-white/30 overflow-hidden">
                      <span className={`block h-full ${hpColor(player.hp / player.maxHp)}`} style={{ width: `${(player.hp / player.maxHp) * 100}%` }} />
                    </span>
                  </span>
                </button>
                {benchCount > 0 && <p className="text-xs font-bold text-white/80">hoặc đổi sang:</p>}
              </>
            ) : (
              <>
                <p className="text-xl font-black text-white">Đổi Pokémon</p>
                <p className="text-xs font-bold text-slate-300">Đổi sẽ mất lượt này: {opponent.name} được đánh trước!</p>
              </>
            )}
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {alivePlayers(state)
                .filter((i) => i !== active.player)
                .map((i) => {
                  const f = state.players[i];
                  const good = phase === 'between' ? state.opponents[active.opponent + 1] && beatsNext(i) : beatsCurrent(state, i);
                  return (
                    <button key={i} onClick={() => (phase === 'swap' ? swapTo(i) : keepOrSwap(i))} aria-label={`Đổi sang ${f.name}`} className="pop-in relative flex items-center gap-2 p-2 rounded-2xl bg-white/95 text-left active:scale-95 shadow-lg">
                      <img src={f.image} alt="" className="w-11 h-11 object-contain scale-x-[-1]" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-black text-slate-800 truncate">{f.name}</span>
                        <span className="block h-1.5 mt-1 rounded-full bg-slate-200 overflow-hidden">
                          <span className={`block h-full ${hpColor(f.hp / f.maxHp)}`} style={{ width: `${(f.hp / f.maxHp) * 100}%` }} />
                        </span>
                      </span>
                      {good && <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-black shadow">Khắc hệ!</span>}
                    </button>
                  );
                })}
            </div>
            {phase === 'swap' && (
              <button onClick={() => setPhase('choose')} className="mt-1 px-5 py-2 rounded-xl bg-white/15 text-white text-sm font-black">
                Thôi, đánh tiếp
              </button>
            )}
          </div>
        )}

        {phase === 'switch' && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 bg-slate-950/75 px-3" data-testid="switch-picker">
            <p className="text-xl font-black text-white">Chọn Pokémon tiếp theo!</p>
            <p className="text-xs font-bold text-slate-300">Đối thủ: {opponent.name}</p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {alivePlayers(state).map((i) => {
                const f = state.players[i];
                const good = beatsCurrent(state, i);
                return (
                  <button key={i} onClick={() => pickNext(i)} aria-label={`Chọn ${f.name}`} className="pop-in relative flex items-center gap-2 p-2 rounded-2xl bg-white/95 text-left active:scale-95 shadow-lg">
                    <img src={f.image} alt="" className="w-12 h-12 object-contain scale-x-[-1]" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-black text-slate-800 truncate">{f.name}</span>
                      <span className="block h-1.5 mt-1 rounded-full bg-slate-200 overflow-hidden">
                        <span className={`block h-full ${hpColor(f.hp / f.maxHp)}`} style={{ width: `${(f.hp / f.maxHp) * 100}%` }} />
                      </span>
                    </span>
                    {good && <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-black shadow">Khắc hệ!</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <Roster fighters={state.players} hp={Object.fromEntries(state.players.map((_, i) => [`p${i}`, rosterHp('player', i)]))} active={active.player} side="player" label="Đội của bé" />

      {/* Commands */}
      <div className="p-3 space-y-2 bg-slate-900">
        <div className="flex items-center gap-2">
          <p className="flex-1 min-h-[1.5rem] text-base font-bold text-white" role="log" aria-live="polite">
            {message}
          </p>
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-black text-amber-200" data-testid="battle-difficulty">
            {difficultyOf(state.difficulty).icon} {difficultyOf(state.difficulty).label}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {player.moves.map((move, i) => {
            const eff = effectiveness(move.type, opponent.types);
            const hint = effectivenessLabel(eff);
            return (
              <button
                key={move.name}
                onClick={() => choose(i)}
                disabled={phase !== 'choose'}
                className="relative py-2 px-3 rounded-2xl text-left text-white font-black shadow-lg border-2 border-white/25 disabled:opacity-50 active:scale-95 transition-transform"
                style={{ background: `linear-gradient(135deg, ${TYPE_COLORS[move.type]}, ${TYPE_COLORS[move.type]}bb)` }}
              >
                <span className="block text-sm leading-tight drop-shadow">{move.name}</span>
                <span className="block text-[10px] font-bold opacity-90">
                  {TYPE_VI[move.type]} • Sức mạnh {move.power}
                </span>
                {move.boosted && <span className="absolute -top-2 left-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-[9px] font-black shadow">Sân nhà ↑</span>}
                {hint && eff !== 1 && (
                  <span className={`absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-black shadow ${eff >= 2 ? 'bg-orange-500' : 'bg-slate-500'}`}>
                    {eff >= 2 ? 'Siêu hiệu quả!' : eff === 0 ? 'Vô hiệu' : 'Yếu'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label="Năng lượng liên hoàn của đội" aria-valuemin={0} aria-valuemax={COMBO_MAX} aria-valuenow={combo}>
            <div className={`h-full rounded-full transition-[width] duration-500 ${comboReady ? 'rainbow-bg' : 'bg-gradient-to-r from-yellow-400 to-orange-500'}`} style={{ width: `${(combo / COMBO_MAX) * 100}%` }} />
          </div>
          <button
            onClick={() => phase === 'choose' && benchCount > 0 && setPhase('swap')}
            disabled={phase !== 'choose' || benchCount === 0}
            aria-label="Đổi Pokémon"
            className="shrink-0 px-3 py-2 rounded-xl text-sm font-black flex items-center gap-1 bg-sky-600 text-white disabled:opacity-40 active:scale-95"
          >
            🔄 Đổi
          </button>
          <button onClick={combo2} disabled={!comboReady || phase !== 'choose'} className={`shrink-0 px-3 py-2 rounded-xl text-sm font-black flex items-center gap-1 ${comboReady && phase === 'choose' ? 'rainbow-bg text-white energy-full' : comboReady ? 'rainbow-bg text-white opacity-50' : 'bg-slate-800 text-slate-500'}`}>
            <Zap className="w-4 h-4" /> Tuyệt Kỹ Liên Hoàn
          </button>
        </div>
      </div>
    </div>
  );
}
