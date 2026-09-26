import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, Swords, RotateCcw, Users } from 'lucide-react';
import { LEAGUE, GYMS, createLeague, recordGym, goldForGym, arenaForGym, aceOf } from '../../utils/league';
import { TYPE_VI } from '../../utils/battle/typeChart';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { sounds } from '../../utils/soundEffects';
import { GoldReward } from '../kidgames/Common';
import { PokeballIcon } from '../PokeballIcon';
import { TeamBuilder } from '../team/TeamBuilder';
import { TeamArena } from '../team/TeamArena';
import { TeamVsIntro } from '../team/TeamIntro';
import { loadTeamBattle } from '../team/loadTeam';

const TEMPO = { slow: 1.5, normal: 1 };
const SPEED_KEY = 'pokescan_battle_speed';
const readSpeed = () => {
  try {
    return localStorage.getItem(SPEED_KEY) === 'normal' ? 'normal' : 'slow';
  } catch {
    return 'slow';
  }
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Pokedex numbers of the gym Pokemon, for their pictures on the road (no download needed)
const DEX = {
  geodude: 74, graveler: 75, omanyte: 138, kabuto: 140, onix: 95, staryu: 120, psyduck: 54, goldeen: 118, seaking: 119, starmie: 121,
  voltorb: 100, magnemite: 81, electabuzz: 125, jolteon: 135, raichu: 26, oddish: 43, bellsprout: 69, tangela: 114, weepinbell: 70, vileplume: 45,
  koffing: 109, grimer: 88, ekans: 23, muk: 89, weezing: 110, abra: 63, drowzee: 96, kadabra: 64, hypno: 97, alakazam: 65,
  ponyta: 77, vulpix: 37, growlithe: 58, rapidash: 78, arcanine: 59, diglett: 50, sandshrew: 27, cubone: 104, sandslash: 28, rhydon: 112,
  dratini: 147, dragonair: 148, gyarados: 130, aerodactyl: 142, dragonite: 149,
};
const picture = (name) => (DEX[name] ? artworkUrl(DEX[name]) : '');

function BadgeCase({ badges, highlight }) {
  return (
    <div className="grid grid-cols-9 gap-1 p-2 rounded-2xl bg-slate-950/70 border-2 border-amber-400/50" aria-label={`Huy hiệu ${badges.length}/${LEAGUE.length}`} data-testid="badge-case">
      {LEAGUE.map((g) => {
        const got = badges.includes(g.id);
        return (
          <span
            key={g.id}
            className={`aspect-square rounded-full flex items-center justify-center text-base ${got ? `bg-gradient-to-br ${g.color} shadow-[0_0_10px_rgba(253,224,71,0.6)]` : 'bg-slate-800'} ${highlight === g.id ? 'spotlight-pop' : ''}`}
            title={g.name}
          >
            <span className={got ? '' : 'opacity-25 grayscale'}>{g.badge}</span>
          </span>
        );
      })}
    </div>
  );
}

/** The road: 8 gyms and the Champion; the next stop shows its team of 5. */
function Road({ state, team, onChallenge, onChangeTeam }) {
  return (
    <div className="px-4 pt-3 pb-6 space-y-3" data-testid="league-road">
      <div className="flex items-center gap-2">
        <div className="flex -space-x-3">
          {team.map((m) => (
            <img key={m.key} src={m.image} alt={m.name} className="w-11 h-11 rounded-full bg-white/15 border-2 border-sky-300 object-contain" />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-black text-white leading-tight">Đội của bé đi chinh phục Liên minh!</p>
          <p className="text-[11px] font-bold text-white/75">8 nhà thi đấu, mỗi nhà 5 vs 5, rồi Nhà Vô địch</p>
        </div>
        <button onClick={onChangeTeam} className="shrink-0 px-2.5 py-1.5 rounded-xl bg-white/15 text-white text-xs font-black flex items-center gap-1">
          <Users className="w-4 h-4" /> Đổi đội
        </button>
      </div>
      <BadgeCase badges={state.badges} />
      <ol className="relative space-y-2 pl-2">
        <span className="absolute left-7 top-4 bottom-4 w-1.5 rounded-full bg-gradient-to-b from-amber-300 via-rose-400 to-violet-500 opacity-60" aria-hidden="true" />
        {LEAGUE.map((g, i) => {
          const done = state.badges.includes(g.id);
          const current = i === state.index && !state.done;
          const champion = i === GYMS.length;
          return (
            <li key={g.id} className="relative flex items-center gap-3">
              <span className={`relative z-10 w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-xl border-4 ${done ? `bg-gradient-to-br ${g.color} border-amber-300` : current ? 'bg-white border-amber-300 hint-pulse' : 'bg-slate-800 border-slate-600'}`}>
                {done ? '✓' : g.badge}
              </span>
              <div className={`flex-1 min-w-0 p-2.5 rounded-2xl ${current ? 'bg-white/95 shadow-xl ring-4 ring-amber-300' : done ? 'bg-white/20' : 'bg-white/10'}`}>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black truncate ${current ? 'text-slate-800' : 'text-white'}`}>
                      {champion ? '🏆 ' : `${i + 1}. `}
                      {g.name}
                    </p>
                    <p className={`text-[11px] font-bold ${current ? 'text-slate-500' : 'text-white/70'}`}>
                      Hệ {TYPE_VI[g.type]} · Át chủ bài {cap(aceOf(g))}
                    </p>
                  </div>
                  {current && (
                    <button onClick={onChallenge} className="shrink-0 px-3 py-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-black shadow-lg flex items-center gap-1 active:scale-95">
                      <Swords className="w-4 h-4" /> Thách đấu
                    </button>
                  )}
                </div>
                {current && (
                  <div className="mt-1.5 flex gap-1" aria-label="Đội của nhà thi đấu">
                    {g.team.map((n) => (
                      <img key={n} src={picture(n)} alt={cap(n)} title={cap(n)} className="w-9 h-9 rounded-full bg-slate-100 object-contain" />
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * "Giải đấu Liên minh" in 5 vs 5: the child builds a team (scan cards, borrow, or pick scanned
 * Pokemon when the parent setting allows), then beats 8 gyms and the Champion in one go, each a
 * team battle against the gym's 5 Pokemon on a ground that suits its type.
 */
export function LeagueGame({ collection = [], allowScanned = false, onScanned, onGold, onClose, random = Math.random }) {
  const [state, setState] = useState(createLeague);
  const [screen, setScreen] = useState('build'); // build | road | loading | intro | battle | badge | lost | champion | error
  const [team, setTeam] = useState([]);
  const [battle, setBattle] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [award, setAward] = useState(null);
  const [round, setRound] = useState(0);
  const [speed] = useState(readSpeed);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const gym = LEAGUE[Math.min(state.index, LEAGUE.length - 1)];
  const arena = arenaForGym(gym);

  const challenge = async () => {
    setScreen('loading');
    setProgress(0);
    setError(null);
    try {
      const s = await loadTeamBattle({ team, opponentNames: gym.team, arena, levelFactor: gym.level, random, onProgress: () => alive.current && setProgress((p) => p + 1) });
      if (!alive.current) return;
      setBattle(s);
      setRound((r) => r + 1);
      setScreen('intro');
    } catch (err) {
      if (!alive.current) return;
      setError(err.message || 'Không bắt đầu được trận đấu.');
      setScreen('error');
    }
  };

  const onFinish = ({ won }) => {
    const index = state.index;
    const next = recordGym(state, won);
    setState(next);
    if (!won) {
      setScreen('lost');
      return;
    }
    const gold = goldForGym(index);
    onGold?.(gold);
    setAward({ gym: LEAGUE[index], gold });
    sounds.playSuccessFanfare();
    try {
      confetti({ particleCount: next.done ? 200 : 90, spread: 90, origin: { y: 0.45 }, zIndex: 9999 });
    } catch {
      // decoration
    }
    setScreen(next.done ? 'champion' : 'badge');
  };

  const restart = () => {
    setState(createLeague());
    setAward(null);
    setScreen('road');
  };

  const nextName = LEAGUE[Math.min(state.index, LEAGUE.length - 1)];

  return createPortal(
    <div data-theme="dark" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 select-none" role="dialog" aria-label="Giải đấu Liên minh" data-screen={screen} data-index={state.index} style={{ '--battle-tempo': TEMPO[speed] }}>
      <div className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-full max-w-md overflow-y-auto overflow-x-hidden sm:rounded-3xl sm:border-4 border-white/70 shadow-2xl bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-950">
        <div className="sticky top-0 z-50 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 shadow-lg">
          <span className="shrink-0 whitespace-nowrap text-white font-black">🏆 Liên minh 5 vs 5</span>
          {(screen === 'battle' || screen === 'intro') && <span className="min-w-0 px-2 py-0.5 rounded-full bg-white/25 text-white text-xs font-black truncate">{gym.name}</span>}
          <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full bg-white/25 text-white text-xs font-black">
            {state.badges.length}/{LEAGUE.length} 🏅
          </span>
          <button onClick={onClose} aria-label="Đóng giải đấu" className="p-1.5 rounded-full bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {screen === 'build' && (
          <TeamBuilder collection={collection} allowScanned={allowScanned} team={team} setTeam={setTeam} onScanned={onScanned} onNext={() => setScreen('road')} random={random} />
        )}

        {screen === 'road' && <Road state={state} team={team} onChallenge={challenge} onChangeTeam={() => setScreen('build')} />}

        {screen === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 min-h-[400px]" role="status">
            <PokeballIcon className="w-20 h-20 animate-spin" />
            <p className="text-lg font-black text-white">Đang vào {gym.name}...</p>
            <div className="w-full max-w-xs h-3 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-300 to-rose-500 transition-[width] duration-300" style={{ width: `${(Math.min(progress, 10) / 10) * 100}%` }} />
            </div>
          </div>
        )}

        {screen === 'intro' && battle && (
          <TeamVsIntro arena={arena} title={`${gym.badge} ${gym.name}`} players={battle.players} opponents={battle.opponents} onDone={() => setScreen('battle')} />
        )}
        {screen === 'battle' && battle && <TeamArena key={round} arena={arena} state={battle} tempo={TEMPO[speed]} onFinish={onFinish} />}

        {screen === 'badge' && award && (
          <div className="relative flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center min-h-[520px]" data-testid="league-badge">
            <div className="vs-rays absolute inset-0 opacity-20 pointer-events-none" />
            <p className="result-rise text-2xl font-black text-white">Thắng {award.gym.name}!</p>
            <span className={`spotlight-pop w-32 h-32 rounded-full bg-gradient-to-br ${award.gym.color} border-8 border-amber-200 flex items-center justify-center text-6xl shadow-[0_0_50px_rgba(253,224,71,0.8)]`}>{award.gym.badge}</span>
            <p className="result-rise text-lg font-black text-amber-200" style={{ animationDelay: '300ms' }}>
              Nhận huy hiệu hệ {TYPE_VI[award.gym.type]}!
            </p>
            <div className="w-full">
              <BadgeCase badges={state.badges} highlight={award.gym.id} />
            </div>
            <GoldReward amount={award.gold} dark />
            <button onClick={challenge} className="pop-in px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-lg font-black shadow-lg flex items-center gap-2 active:scale-95" style={{ animationDelay: '600ms' }}>
              <Swords className="w-5 h-5" /> {nextName.id === 'champion' ? 'Thách đấu Nhà Vô địch!' : `Tiếp: ${nextName.name}`}
            </button>
            <button onClick={() => setScreen('road')} className="text-sm font-bold text-white/70 underline">
              Xem bản đồ
            </button>
          </div>
        )}

        {screen === 'lost' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center min-h-[480px]" data-testid="league-lost">
            <div className="flex -space-x-3">
              {team.map((m) => (
                <img key={m.key} src={m.image} alt={m.name} className="w-14 h-14 object-contain sad-tilt" />
              ))}
            </div>
            <p className="text-2xl font-black text-white">Suýt nữa thôi!</p>
            <p className="text-sm font-bold text-white/80">
              Đội của {gym.name} mạnh quá. Thử chiêu "Siêu hiệu quả" với hệ {TYPE_VI[gym.type]}, hoặc đổi đội với Pokémon khắc hệ nhé! 💪
            </p>
            <button onClick={challenge} className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-lg font-black shadow-lg flex items-center gap-2 active:scale-95">
              <RotateCcw className="w-5 h-5" /> Thử lại
            </button>
            <button onClick={() => setScreen('road')} className="text-sm font-bold text-white/70 underline">
              Xem bản đồ / Đổi đội
            </button>
          </div>
        )}

        {screen === 'champion' && (
          <div className="relative flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center min-h-[600px] overflow-hidden" data-testid="league-champion">
            <div className="vs-rays absolute inset-0 opacity-25 pointer-events-none" />
            <span className="spotlight-swing absolute left-[15%] -top-6 w-24 h-[80%] bg-gradient-to-b from-yellow-100/50 to-transparent pointer-events-none" style={{ clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)' }} />
            <span className="spotlight-swing absolute right-[15%] -top-6 w-24 h-[80%] bg-gradient-to-b from-sky-100/40 to-transparent pointer-events-none" style={{ clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)', animationDelay: '-2s' }} />
            <p className="result-rise sport-banner text-4xl font-black italic bg-gradient-to-b from-amber-200 via-yellow-300 to-orange-500 bg-clip-text text-transparent">NHÀ VÔ ĐỊCH!</p>
            <span className="trophy-glow text-7xl spotlight-pop" aria-label="Cúp vô địch">
              🏆
            </span>
            <div className="flex justify-center -space-x-2">
              {team.map((m, i) => (
                <img key={m.key} src={m.image} alt={m.name} className="w-20 h-20 object-contain battle-victory scale-x-[-1] drop-shadow-2xl" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
            <p className="text-base font-bold text-white/90">Đội của bé đã thắng cả 8 nhà thi đấu và Nhà Vô địch Liên minh!</p>
            <div className="w-full">
              <BadgeCase badges={state.badges} highlight="champion" />
            </div>
            {award && <GoldReward amount={award.gold} dark />}
            <div className="flex gap-3">
              <button onClick={restart} className="px-5 py-3 rounded-2xl bg-red-500 text-white font-black flex items-center gap-2 active:scale-95">
                <RotateCcw className="w-5 h-5" /> Chơi lại
              </button>
              <button onClick={onClose} className="px-6 py-3 rounded-2xl bg-sky-600 text-white font-black active:scale-95">
                Xong
              </button>
            </div>
          </div>
        )}

        {screen === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 min-h-[360px] text-center">
            <p className="text-lg font-black text-white">{error}</p>
            <div className="flex gap-2">
              <button onClick={challenge} className="px-5 py-2.5 rounded-2xl bg-red-500 text-white font-black">
                Thử lại
              </button>
              <button onClick={() => setScreen('road')} className="px-5 py-2.5 rounded-2xl bg-slate-600 text-white font-black">
                Quay lại
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
