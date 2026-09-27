import React, { useEffect, useRef, useState } from 'react';
import { TYPE_COLORS, TYPE_VI } from '../../utils/battle/typeChart';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { ITEMS } from '../../utils/quest/items';
import { expertReward } from '../../utils/quest/experts';
import { MobaMatch } from '../moba/MobaMatch';
import { TeamVsIntro } from '../team/TeamIntro';
import { TeamArena } from '../team/TeamArena';
import { loadTeamBattle } from '../team/loadTeam';
import { arenaById } from '../../utils/team/arenas';
import { PokeballIcon } from '../PokeballIcon';
import { drawExpert } from './questTrainer';
import { itemIcon } from './questUi';
import { arenaTeam, expertArenaTeam, arenaDifficulty, teamMembers, teamArenaFor, teamLevelFactor } from './questBattle';

/** The expert drawn big in the dialog (a tiny canvas). */
function ExpertPortrait({ look }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext?.('2d');
    if (!g) return undefined;
    let raf = 0;
    const t0 = performance.now();
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = 96 * dpr;
      c.height = 120 * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, 96, 120);
      drawExpert(g, 48, 92, look, (performance.now() - t0) / 1000, { scale: 1.6 });
      raf = window.requestAnimationFrame?.(draw) || 0;
    };
    draw();
    return () => window.cancelAnimationFrame?.(raf);
  }, [look]);
  return <canvas ref={ref} className="w-24 h-[120px] shrink-0" aria-hidden="true" />;
}

/**
 * Talking to an expert trainer: who they are, their team, and the choice of battle.
 * result: { won, reward } after a battle.
 */
export function ExpertDialog({ expert, act, result, onArena, onTeam, onLater, onDone }) {
  const reward = expertReward(expert, act);
  const line = result ? (result.won ? expert.winLine : expert.loseLine) : expert.beaten ? expert.afterLine : expert.hello;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2" role="dialog" aria-label={expert.title} data-testid="quest-expert" onPointerDown={(e) => e.stopPropagation()}>
      <div className="pop-in w-full max-w-[560px] max-h-full overflow-y-auto rounded-3xl border-4 border-amber-300/80 bg-gradient-to-b from-indigo-900 via-slate-900 to-slate-950 shadow-2xl">
        <div className="flex items-start gap-2 p-3">
          <ExpertPortrait look={expert.look} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-300">Chuyên gia · Lv {expert.level}</p>
            <p className="text-xl font-black text-white leading-tight">{expert.title}</p>
            <p className="bubble-pop mt-1.5 relative px-3 py-2 rounded-2xl bg-white text-slate-800 text-sm font-bold" data-testid="expert-line">
              {line}
            </p>
          </div>
        </div>
        <div className="px-3">
          <p className="text-xs font-black text-white/80">Đội của {expert.name}:</p>
          <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1" data-testid="expert-team">
            {expert.team.map((p, i) => (
              <span key={`${p.dex}-${i}`} className="shrink-0 w-[68px] flex flex-col items-center rounded-2xl bg-white/10 p-1">
                <img src={artworkUrl(p.dex)} alt={p.name} className="w-12 h-12 object-contain" />
                <span className="w-full text-center text-[10px] font-black text-white truncate">{p.name}</span>
                <span className="text-[9px] font-black" style={{ color: TYPE_COLORS[p.types[0]] }}>
                  {TYPE_VI[p.types[0]]} · {p.level}
                </span>
              </span>
            ))}
          </div>
        </div>
        {result?.won && result.reward && (
          <div className="mx-3 mt-2 p-2 rounded-2xl bg-amber-400/15 border border-amber-300/50 text-center text-sm font-black text-amber-100" data-testid="expert-reward">
            🏅 Thắng rồi! +{result.reward.xp} KN cho cả đội · 🪙 +{result.reward.gold} · {itemIcon(result.reward.item)} {ITEMS[result.reward.item].name}
          </div>
        )}
        {!result && !expert.beaten && (
          <p className="mx-3 mt-2 text-[11px] font-bold text-white/70">
            Thắng được: cả đội nhận kinh nghiệm, 🪙 {reward.gold} vàng hành trình và {itemIcon(reward.item)} {ITEMS[reward.item].name}. Thua cũng không sao!
          </p>
        )}
        <div className="flex flex-wrap gap-2 p-3">
          {result || expert.beaten ? (
            <button type="button" onClick={onDone} className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 text-lg font-black shadow-lg active:scale-95">
              Tiếp tục
            </button>
          ) : (
            <>
              <button type="button" onClick={onArena} className="flex-1 min-w-[140px] py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black shadow-lg active:scale-95" data-testid="expert-arena">
                ⚔️ Đấu trường
                <span className="block text-[10px] font-bold text-white/80">Tự điều khiển · 2 phút</span>
              </button>
              <button type="button" onClick={onTeam} className="flex-1 min-w-[140px] py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-600 text-white font-black shadow-lg active:scale-95" data-testid="expert-team-battle">
                🎴 Đấu đội 5 vs 5
                <span className="block text-[10px] font-bold text-white/80">Theo lượt · chọn chiêu</span>
              </button>
              <button type="button" onClick={onLater} className="px-4 py-3 rounded-2xl bg-white/15 text-white font-black active:scale-95" data-testid="expert-later">
                Để sau
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Real-time arena against the expert (the MOBA match, 2 minutes). */
export function ExpertArena({ party, lead, expert, act, random, onEnd }) {
  const [blue] = useState(() => arenaTeam(party, lead));
  const [red] = useState(() => expertArenaTeam(expert));
  return (
    <div className="fixed inset-0 z-[95]" data-testid="expert-arena-match">
      <MobaMatch blue={blue} red={red} minutes={2} control={0} mapId="league" difficulty={arenaDifficulty(act)} random={random} onEnd={(sum) => onEnd(sum.winner === 'blue')} onQuit={() => onEnd(false)} />
    </div>
  );
}

/** Turn-based 5 vs 5 against the expert (the team battle: intro, then the arena). */
export function ExpertTeamBattle({ party, lead, expert, act, theme, random, onEnd, onCancel }) {
  const [phase, setPhase] = useState('loading'); // loading | intro | battle | error
  const [battle, setBattle] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const arena = arenaById(teamArenaFor(theme));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    loadTeamBattle({ team: teamMembers(party, lead), opponentNames: expert.team.map((p) => p.name.toLowerCase()), arena, levelFactor: teamLevelFactor(act), difficulty: 'normal', random, onProgress: () => alive && setProgress((p) => p + 1) })
      .then((state) => {
        if (!alive) return;
        setBattle(state);
        setPhase('intro');
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || 'Không bắt đầu được trận đấu.');
        setPhase('error');
      });
    return () => {
      alive = false;
    };
    // Loads once per attempt (the team and the expert do not change during the battle)
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const retry = () => {
    setProgress(0);
    setError(null);
    setPhase('loading');
    setAttempt((a) => a + 1);
  };
  const total = party.length + expert.team.length;
  return (
    <div data-theme="dark" className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 select-none" role="dialog" aria-label="Đấu đội với chuyên gia" data-testid="expert-team-match" data-phase={phase} style={{ '--battle-tempo': 1 }}>
      <div className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-full max-w-md overflow-y-auto overflow-x-hidden sm:rounded-3xl sm:border-4 border-white/70 shadow-2xl bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-950">
        <div className="sticky top-0 z-50 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-600 via-rose-600 to-purple-600 shadow-lg">
          <span className="shrink-0 text-white font-black">🎴 5 vs 5</span>
          <span className="min-w-0 px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-black truncate">{expert.title}</span>
          <button type="button" onClick={onCancel} className="ml-auto px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-black" aria-label="Bỏ trận đấu">
            ✕
          </button>
        </div>
        {phase === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 min-h-[360px]" role="status">
            <PokeballIcon className="w-20 h-20 animate-spin" />
            <p className="text-lg font-black text-white">Đang chuẩn bị trận đấu...</p>
            <div className="w-full max-w-xs h-3 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-300 to-rose-500 transition-[width] duration-300" style={{ width: `${(Math.min(progress, total) / total) * 100}%` }} />
            </div>
          </div>
        )}
        {phase === 'intro' && battle && <TeamVsIntro arena={arena} players={battle.players} opponents={battle.opponents} title={expert.title} onDone={() => setPhase('battle')} />}
        {phase === 'battle' && battle && <TeamArena arena={arena} state={battle} tempo={1} onFinish={(outcome) => onEnd(!!outcome.won)} />}
        {phase === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 min-h-[320px] text-center">
            <p className="text-lg font-black text-white">{error}</p>
            <div className="flex gap-2">
              <button type="button" onClick={retry} className="px-5 py-2.5 rounded-2xl bg-red-500 text-white font-black">
                Thử lại
              </button>
              <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-2xl bg-slate-600 text-white font-black">
                Quay lại
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
