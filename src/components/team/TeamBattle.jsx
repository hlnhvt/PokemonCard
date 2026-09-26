import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ARENAS, arenaById } from '../../utils/team/arenas';
import { goldForTeam } from '../../utils/gold';
import { PokeballIcon } from '../PokeballIcon';
import { TeamBuilder } from './TeamBuilder';
import { ArenaPicker } from './ArenaPicker';
import { TeamVsIntro } from './TeamIntro';
import { loadTeamBattle } from './loadTeam';
import { LeadPicker } from './LeadPicker';
import { withLead } from '../../utils/team/teamBattle';
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

/**
 * "Đấu đội 5 vs 5": build a team by scanning cards (missing places are lent at random),
 * choose a battle ground, then fight 5 opponents one after another. A win ends with the
 * trophy ceremony; gold is paid for every battle, more for a win.
 */
export function TeamBattle({ collection = [], allowScanned = false, onScanned, onGold, onClose, random = Math.random }) {
  const [phase, setPhase] = useState('build'); // build | arena | loading | intro | battle | result | error
  const [team, setTeam] = useState([]);
  const [lead, setLead] = useState(0);
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
    try {
      const state = await loadTeamBattle({ team: withLead(team, lead), arena, random, onProgress: () => alive.current && setProgress((p) => p + 1) });
      if (!alive.current) return;
      setBattle(state);
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
          <span className="shrink-0 whitespace-nowrap text-white font-black">⚔️ 5 vs 5</span>
          <span className="min-w-0 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-black truncate">{title}</span>
          {(phase === 'battle' || phase === 'intro') && (
            <button onClick={toggleSpeed} className="ml-auto shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-black" aria-label="Đổi tốc độ trận đấu">
              {speed === 'slow' ? '🐢 Chậm' : '🐇 Nhanh'}
            </button>
          )}
          <button onClick={onClose} aria-label="Đóng đấu đội" className={`${phase === 'battle' || phase === 'intro' ? '' : 'ml-auto'} p-1.5 rounded-full bg-white/20 text-white`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {phase === 'build' && <TeamBuilder collection={collection} allowScanned={allowScanned} team={team} setTeam={setTeam} onScanned={onScanned} onNext={() => {
              setLead((l) => Math.min(l, team.length - 1));
              setPhase('arena');
            }} random={random} />}
        {phase === 'arena' && (
          <div className="px-4 pt-3">
            <LeadPicker team={team} lead={lead} onPick={setLead} />
          </div>
        )}
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
            team={battle.players.map((p, i) => ({ key: withLead(team, lead)[i]?.key || i, name: p.name, image: p.image }))}
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
