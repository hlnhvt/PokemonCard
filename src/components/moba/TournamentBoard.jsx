import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Swords, RotateCcw } from 'lucide-react';
import { ARENA_DIFFICULTY } from '../../utils/moba/engine';
import { ARENA_MODES, MEDALS, currentMatch, medalOf, tournamentTitle } from '../../utils/moba/tournament';
import { GoldReward } from '../kidgames/Common';

const RESULT_BADGE = {
  win: { text: 'Thắng', cls: 'bg-emerald-500' },
  draw: { text: 'Hòa', cls: 'bg-sky-500' },
  lose: { text: 'Thua', cls: 'bg-rose-500' },
};

function DiffChip({ id }) {
  const d = ARENA_DIFFICULTY[id];
  return (
    <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-black/35 text-[10px] font-black text-amber-200">
      {d.icon} {d.label}
    </span>
  );
}

/**
 * The league table or the cup road between matches: every match with its opponent club,
 * difficulty and result; the next match with the opponents; the ceremony at the end.
 */
export function TournamentBoard({ tour, foes, bonus, onPlay, onRestart, onClose }) {
  const mode = ARENA_MODES[tour.mode];
  const over = tour.status !== 'playing';
  const next = currentMatch(tour);
  const champion = tour.status === 'finished' && (tour.mode === 'cup' || medalOf(tour.points).id === 'gold');

  useEffect(() => {
    if (!over || tour.status === 'out') return;
    try {
      confetti({ particleCount: champion ? 200 : 90, spread: 100, origin: { y: 0.35 }, zIndex: 9999 });
    } catch {
      // decoration
    }
  }, [over, tour.status, champion]);

  const list = tour.mode === 'cup' ? [...tour.matches].reverse() : tour.matches;

  return (
    <div className="px-4 pt-3 pb-5 space-y-3" data-testid="tournament-board" data-mode={tour.mode} data-status={tour.status} data-index={tour.index} data-points={tour.points}>
      <div className="flex items-center gap-2">
        <span className="text-3xl">{mode.icon}</span>
        <div className="flex-1">
          <p className="text-xl font-black text-white">{mode.label}</p>
          <p className="text-xs font-bold text-white/70">{mode.hint}</p>
        </div>
        {tour.mode === 'league' && (
          <span key={tour.points} className="score-bump px-3 py-1 rounded-2xl bg-amber-400 text-slate-900 text-lg font-black shadow" data-testid="league-points">
            {tour.points} điểm
          </span>
        )}
      </div>

      {tour.mode === 'league' && (
        <div className="flex justify-between gap-1 rounded-2xl bg-black/25 px-2 py-1.5 text-[10px] font-black text-white/80">
          {MEDALS.slice(0, 3).map((m) => (
            <span key={m.id} className={tour.points >= m.min ? 'text-amber-200' : ''}>
              {m.icon} {m.label}: ≥{m.min}
            </span>
          ))}
        </div>
      )}

      {/* The matches (the cup is drawn from the final down, like a road to the trophy) */}
      <div className="relative space-y-2">
        {tour.mode === 'cup' && <div className="text-center text-4xl drop-shadow" aria-hidden="true">🏆</div>}
        {list.map((m) => {
          const i = tour.matches.indexOf(m);
          const isNext = !over && i === tour.index;
          return (
            <div key={i} className={`flex items-center gap-2 p-2 rounded-2xl border-2 ${isNext ? 'border-amber-300 bg-amber-300/15 shadow-lg shadow-amber-500/20' : m.result ? 'border-white/10 bg-white/10' : 'border-white/5 bg-black/20 opacity-80'}`} data-testid="tour-match">
              <span className="w-16 shrink-0 text-[11px] font-black text-white/80">{m.round}</span>
              <span className="text-2xl">{m.club.emblem}</span>
              <span className="flex-1 min-w-0 text-sm font-black text-white truncate">{m.club.name}</span>
              <DiffChip id={m.difficulty} />
              {m.result ? (
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-black text-white ${RESULT_BADGE[m.result].cls}`}>
                  {RESULT_BADGE[m.result].text} {m.score ? `${m.score.blue}-${m.score.red}` : ''}
                  {m.decided === 'damage' ? ' ⚖️' : ''}
                </span>
              ) : isNext ? (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[11px] font-black hint-pulse">Tiếp</span>
              ) : (
                <span className="shrink-0 w-10" />
              )}
            </div>
          );
        })}
      </div>
      {tour.mode === 'cup' && tour.matches.some((m) => m.decided === 'damage') && <p className="text-[10px] font-bold text-white/60">⚖️ Hòa số hạ gục thì đội gây nhiều sát thương hơn đi tiếp.</p>}

      {over ? (
        <div className="pop-in rounded-3xl bg-gradient-to-b from-amber-300/25 to-purple-600/25 border-2 border-amber-300/60 p-4 text-center space-y-2" data-testid="tour-ceremony">
          <p className={`text-6xl ${tour.status === 'out' ? '' : 'battle-victory'}`}>{tour.mode === 'cup' ? (tour.status === 'finished' ? '🏆' : '💪') : medalOf(tour.points).icon}</p>
          <p className="text-2xl font-black text-white">{tournamentTitle(tour)}</p>
          <div className="flex justify-center">
            <GoldReward amount={bonus} dark />
          </div>
          <div className="flex gap-2 justify-center">
            <button onClick={onRestart} className="px-5 py-2.5 rounded-2xl bg-red-500 text-white font-black flex items-center gap-2 active:scale-95">
              <RotateCcw className="w-5 h-5" /> Chơi lại
            </button>
            <button onClick={onClose} className="px-6 py-2.5 rounded-2xl bg-sky-600 text-white font-black active:scale-95">
              Xong
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-black/30 p-3 space-y-2" data-testid="tour-next">
          <p className="text-sm font-black text-rose-300">
            {next.round}: {next.club.emblem} {next.club.name} · <DiffChip id={next.difficulty} />
          </p>
          <div className={`flex ${foes.length > 1 ? 'justify-between' : 'justify-center'}`}>
            {foes.map((f) => (
              <span key={f.key} className="flex flex-col items-center w-14">
                <img src={f.image} alt={f.name} className="w-12 h-12 object-contain" />
                <span className="text-[10px] font-black text-white truncate w-full text-center">{f.name}</span>
              </span>
            ))}
          </div>
          <button onClick={onPlay} className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 text-white text-lg font-black shadow-lg flex items-center justify-center gap-2 active:scale-95">
            <Swords className="w-6 h-6" /> Bắt đầu {next.round}!
          </button>
        </div>
      )}
    </div>
  );
}
