import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { fetchBattlePokemon } from '../../services/battleData';
import { createFighter, opponentLevel } from '../../utils/battle/engine';
import { OPPONENT_POOL } from '../../utils/battle/opponentPool';
import { TYPE_COLORS, TYPE_VI } from '../../utils/battle/typeChart';
import { createTeamBattle, pickOpponentTeam, teamOpponentLevel } from '../../utils/team/teamBattle';
import { ARENAS, arenaById, applyArena } from '../../utils/team/arenas';
import { goldForTeam } from '../../utils/gold';
import { PokeballIcon } from '../PokeballIcon';
import { TeamBuilder } from './TeamBuilder';
import { ArenaPicker } from './ArenaPicker';
import { ArenaBackdrop } from './ArenaBackdrop';
import { TeamArena } from './TeamArena';
import { TrophyCeremony } from './TrophyCeremony';

const TEMPO = { slow: 1.5, normal: 1 };
const SPEED_KEY = 'pokescan_battle_speed';
const readSpeed = () => {
  try {
    return localStorage.getItem(SPEED_KEY) === 'normal' ? 'normal' : 'slow';
  } catch {
    return 'slow';
  }
};

function TeamColumn({ list, side }) {
  return (
    <div className="flex flex-col gap-1.5">
      {list.map((f, i) => (
        <div key={i} className={`${side === 'player' ? 'vs-left' : 'vs-right'} flex items-center gap-1.5 ${side === 'player' ? '' : 'flex-row-reverse'}`} style={{ animationDelay: `${i * 0.12}s` }}>
          <img src={f.image} alt={f.name} className={`w-14 h-14 object-contain drop-shadow-lg ${side === 'player' ? 'scale-x-[-1]' : ''}`} />
          <span className="text-xs font-black text-white drop-shadow truncate max-w-[80px]">{f.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Both teams run in from their side, then a big VS. Tap to skip. */
function TeamVsIntro({ arena, players, opponents, onDone }) {
  const done = useRef(onDone);
  useLayoutEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const t = setTimeout(() => done.current(), 3200);
    return () => clearTimeout(t);
  }, []);
  return (
    <button type="button" onClick={() => done.current()} className="relative flex-1 min-h-[560px] w-full overflow-hidden flex flex-col justify-center" aria-label="Bắt đầu" data-testid="team-intro">
      <ArenaBackdrop arena={arena} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-r from-sky-900/70 via-transparent to-rose-900/70" />
      <div className="vs-rays absolute inset-0 opacity-20" />
      <div className="relative z-10 flex items-center justify-between px-3 pt-6">
        <TeamColumn list={players} side="player" />
        <span className="vs-pop text-7xl font-black italic text-amber-300 drop-shadow-[0_4px_0_rgba(0,0,0,0.6)]" style={{ animationDelay: '0.6s' }}>
          VS
        </span>
        <TeamColumn list={opponents} side="opponent" />
      </div>
      <div className="vs-sub relative z-10 mt-5 mx-4 p-3 rounded-2xl bg-black/50 text-center">
        <p className="text-lg font-black text-white">
          {arena.emoji} {arena.name}
        </p>
        <div className="mt-1 flex justify-center gap-1 flex-wrap">
          {arena.boost.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-black text-white" style={{ backgroundColor: TYPE_COLORS[t] }}>
              Hệ {TYPE_VI[t]} mạnh hơn
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

/**
 * "Đấu đội 5 vs 5": build a team by scanning cards (missing places are lent at random),
 * choose a battle ground, then fight 5 opponents one after another. A win ends with the
 * trophy ceremony; gold is paid for every battle, more for a win.
 */
export function TeamBattle({ collection = [], allowScanned = false, onScanned, onGold, onClose, random = Math.random }) {
  const [phase, setPhase] = useState('build'); // build | arena | loading | intro | battle | result | error
  const [team, setTeam] = useState([]);
  const [arenaId, setArenaId] = useState(ARENAS[0].id);
  const [battle, setBattle] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [speed, setSpeed] = useState(readSpeed);
  const [round, setRound] = useState(0);
  const alive = useRef(true);
  const arena = arenaById(arenaId);

  useEffect(() => {
    alive.current = true;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      alive.current = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const toggleSpeed = () => {
    const next = speed === 'slow' ? 'normal' : 'slow';
    setSpeed(next);
    try {
      localStorage.setItem(SPEED_KEY, next);
    } catch {
      // ignore
    }
  };

  const load = async () => {
    setPhase('loading');
    setProgress(0);
    setError(null);
    const tick = () => alive.current && setProgress((p) => p + 1);
    try {
      const playerData = await Promise.all(team.map((m) => fetchBattlePokemon(m.query).then((d) => (tick(), d))));
      const picks = pickOpponentTeam(playerData, OPPONENT_POOL, random);
      // An opponent that cannot be downloaded is replaced by another one
      const used = new Set([...playerData.map((d) => d.name.toLowerCase()), ...picks.map((p) => p.name.toLowerCase())]);
      const opponentData = await Promise.all(
        picks.map(async (p) => {
          try {
            return await fetchBattlePokemon(p.name.toLowerCase());
          } catch {
            const spare = OPPONENT_POOL.find((o) => !used.has(o.name.toLowerCase()));
            if (!spare) throw new Error('Không tải được đội đối thủ.');
            used.add(spare.name.toLowerCase());
            return fetchBattlePokemon(spare.name.toLowerCase());
          } finally {
            tick();
          }
        })
      );
      if (!alive.current) return;
      const players = playerData.map((d, i) => createFighter(applyArena({ ...d, name: team[i].name, image: team[i].image || d.image }, arena), { isPlayer: true, friendship: team[i].friendship || 0 }));
      const opponents = opponentData.map((d, i) => createFighter(applyArena(d, arena), { level: teamOpponentLevel(opponentLevel(playerData[i].stats, d.stats)) }));
      setBattle(createTeamBattle({ players, opponents, random }));
      setRound((r) => r + 1);
      setPhase('intro');
    } catch (err) {
      if (!alive.current) return;
      setError(err.message || 'Không bắt đầu được trận đấu.');
      setPhase('error');
    }
  };

  const finish = (outcome) => {
    const gold = goldForTeam(outcome.won, outcome.survivors);
    onGold?.(gold);
    setResult({ ...outcome, gold });
    setPhase('result');
  };

  const title = { build: 'Lập đội', arena: 'Chọn sàn đấu', loading: 'Chuẩn bị', intro: 'Đối đầu', battle: arena.name, result: 'Kết quả', error: 'Lỗi' }[phase];

  return createPortal(
    <div data-theme="dark" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 select-none" role="dialog" aria-label="Đấu đội 5 vs 5" data-phase={phase} style={{ '--battle-tempo': TEMPO[speed] }}>
      <div className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-full max-w-md overflow-y-auto overflow-x-hidden sm:rounded-3xl sm:border-4 border-white/70 shadow-2xl bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-950">
        <div className="sticky top-0 z-50 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-600 via-rose-600 to-purple-600 shadow-lg">
          <span className="text-white font-black">⚔️ Đấu đội 5 vs 5</span>
          <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-black truncate">{title}</span>
          {(phase === 'battle' || phase === 'intro') && (
            <button onClick={toggleSpeed} className="ml-auto px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-black" aria-label="Đổi tốc độ trận đấu">
              {speed === 'slow' ? '🐢 Chậm' : '🐇 Nhanh'}
            </button>
          )}
          <button onClick={onClose} aria-label="Đóng đấu đội" className={`${phase === 'battle' || phase === 'intro' ? '' : 'ml-auto'} p-1.5 rounded-full bg-white/20 text-white`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {phase === 'build' && <TeamBuilder collection={collection} allowScanned={allowScanned} team={team} setTeam={setTeam} onScanned={onScanned} onNext={() => setPhase('arena')} random={random} />}
        {phase === 'arena' && (
          <ArenaPicker selected={arenaId} onSelect={setArenaId} onStart={load} onBack={() => setPhase('build')} teamTypes={team.map((m) => m.types || [])} />
        )}
        {phase === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 min-h-[400px]" role="status">
            <PokeballIcon className="w-20 h-20 animate-spin" />
            <p className="text-lg font-black text-white">Đang chuẩn bị 10 Pokémon...</p>
            <div className="w-full max-w-xs h-3 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-300 to-rose-500 transition-[width] duration-300" style={{ width: `${(Math.min(progress, 10) / 10) * 100}%` }} />
            </div>
            <p className="text-sm font-bold text-white/70">{Math.min(progress, 10)}/10</p>
          </div>
        )}
        {phase === 'intro' && battle && <TeamVsIntro arena={arena} players={battle.players} opponents={battle.opponents} onDone={() => setPhase('battle')} />}
        {phase === 'battle' && battle && <TeamArena key={round} arena={arena} state={battle} tempo={TEMPO[speed]} onFinish={finish} />}
        {phase === 'result' && result && (
          <TrophyCeremony
            won={result.won}
            team={battle.players.map((p, i) => ({ key: team[i]?.key || i, name: p.name, image: p.image }))}
            kos={result.kos}
            mvp={result.mvp}
            gold={result.gold}
            arena={arena}
            onReplay={() => {
              setResult(null);
              setBattle(null);
              setPhase('build');
            }}
            onClose={onClose}
          />
        )}
        {phase === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 min-h-[360px] text-center">
            <p className="text-lg font-black text-white">{error}</p>
            <div className="flex gap-2">
              <button onClick={load} className="px-5 py-2.5 rounded-2xl bg-red-500 text-white font-black">Thử lại</button>
              <button onClick={() => setPhase('arena')} className="px-5 py-2.5 rounded-2xl bg-slate-600 text-white font-black">Quay lại</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
