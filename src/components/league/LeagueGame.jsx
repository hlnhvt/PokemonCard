import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { X, Swords, RotateCcw } from 'lucide-react';
import { LEAGUE, GYMS, createLeague, recordGym, goldForGym } from '../../utils/league';
import { TYPE_VI } from '../../utils/battle/typeChart';
import { sounds } from '../../utils/soundEffects';
import { BattleArena } from '../BattleArena';
import { GoldReward } from '../kidgames/Common';

const RESULT_DELAY = 1800; // let the battle's own victory / faint animation play first

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

/** The road: 8 gyms and the Champion's temple; the next stop pulses. */
function Road({ state, player, onChallenge }) {
  return (
    <div className="px-4 pt-3 pb-6 space-y-3" data-testid="league-road">
      <div className="flex items-center gap-3">
        <img src={player.image} alt={player.name} className="w-16 h-16 object-contain drop-shadow-lg sport-bob scale-x-[-1]" />
        <div className="flex-1">
          <p className="text-lg font-black text-white">Hành trình Liên minh của {player.name}</p>
          <p className="text-xs font-bold text-white/75">Thắng 8 nhà thi đấu rồi thách đấu Nhà Vô địch!</p>
        </div>
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
              <div className={`flex-1 flex items-center gap-2 p-2.5 rounded-2xl ${current ? 'bg-white/95 shadow-xl ring-4 ring-amber-300' : done ? 'bg-white/20' : 'bg-white/10'}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black truncate ${current ? 'text-slate-800' : 'text-white'}`}>
                    {champion ? '🏆 ' : `${i + 1}. `}
                    {g.name}
                  </p>
                  <p className={`text-[11px] font-bold ${current ? 'text-slate-500' : 'text-white/70'}`}>
                    Hệ {TYPE_VI[g.type]} · {g.ace.charAt(0).toUpperCase() + g.ace.slice(1)}
                  </p>
                </div>
                {current && (
                  <button onClick={onChallenge} className="shrink-0 px-3 py-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-black shadow-lg flex items-center gap-1 active:scale-95">
                    <Swords className="w-4 h-4" /> Thách đấu
                  </button>
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
 * "Giải đấu Liên minh": the child's Pokemon fights the 8 gyms one after another and then the
 * Champion, in one go. A win gives the gym's badge (flying into the badge case) and gold; a
 * loss lets the child try the same gym again right away.
 */
export function LeagueGame({ card, player, onGold, onClose, random = Math.random }) {
  const [state, setState] = useState(createLeague);
  const [screen, setScreen] = useState('road'); // road | battle | badge | lost | champion
  const [attempt, setAttempt] = useState(0);
  const [award, setAward] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && screen !== 'battle' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, screen]);

  const gym = LEAGUE[Math.min(state.index, LEAGUE.length - 1)];

  const challenge = () => {
    setAttempt((a) => a + 1);
    setScreen('battle');
  };

  const onResult = ({ won }) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
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
    }, RESULT_DELAY);
  };

  const restart = () => {
    setState(createLeague());
    setAward(null);
    setScreen('road');
  };

  if (screen === 'battle') {
    return (
      <BattleArena
        key={`${state.index}-${attempt}`}
        card={card}
        random={random}
        challenge={{
          ace: gym.ace,
          levelFactor: gym.level,
          title: `${gym.badge} ${gym.name}`,
          intro: gym.id === 'champion' ? `Nhà Vô địch tung ra ${gym.ace.charAt(0).toUpperCase() + gym.ace.slice(1)}!` : `${gym.name} tung ra Pokémon át chủ bài!`,
        }}
        onResult={onResult}
        onClose={() => {
          clearTimeout(timer.current);
          setScreen('road');
        }}
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4" role="dialog" aria-label="Giải đấu Liên minh" data-screen={screen} data-index={state.index}>
      <div className="relative flex flex-col w-full h-full sm:h-auto sm:max-h-full max-w-md overflow-y-auto sm:rounded-3xl sm:border-4 border-white/70 shadow-2xl bg-gradient-to-b from-indigo-900 via-purple-900 to-slate-950">
        <div className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 shadow-lg">
          <span className="text-white font-black">🏆 Giải đấu Liên minh</span>
          <span className="ml-auto px-2 py-0.5 rounded-full bg-white/25 text-white text-xs font-black">
            {state.badges.length}/{LEAGUE.length} huy hiệu
          </span>
          <button onClick={onClose} aria-label="Đóng giải đấu" className="p-1.5 rounded-full bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {screen === 'road' && <Road state={state} player={player} onChallenge={challenge} />}

        {screen === 'badge' && award && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center min-h-[520px]" data-testid="league-badge">
            <div className="vs-rays absolute inset-0 opacity-20 pointer-events-none" />
            <p className="result-rise text-2xl font-black text-white">Thắng {award.gym.name}!</p>
            <span className={`spotlight-pop w-32 h-32 rounded-full bg-gradient-to-br ${award.gym.color} border-8 border-amber-200 flex items-center justify-center text-6xl shadow-[0_0_50px_rgba(253,224,71,0.8)]`}>
              {award.gym.badge}
            </span>
            <p className="result-rise text-lg font-black text-amber-200" style={{ animationDelay: '300ms' }}>
              Nhận huy hiệu hệ {TYPE_VI[award.gym.type]}!
            </p>
            <div className="w-full">
              <BadgeCase badges={state.badges} highlight={award.gym.id} />
            </div>
            <GoldReward amount={award.gold} dark />
            <button onClick={challenge} className="pop-in px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-lg font-black shadow-lg flex items-center gap-2 active:scale-95" style={{ animationDelay: '600ms' }}>
              <Swords className="w-5 h-5" /> {LEAGUE[state.index].id === 'champion' ? 'Thách đấu Nhà Vô địch!' : `Tiếp: ${LEAGUE[state.index].name}`}
            </button>
            <button onClick={() => setScreen('road')} className="text-sm font-bold text-white/70 underline">
              Xem bản đồ
            </button>
          </div>
        )}

        {screen === 'lost' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center min-h-[480px]" data-testid="league-lost">
            <img src={player.image} alt={player.name} className="w-28 h-28 object-contain sad-tilt" />
            <p className="text-2xl font-black text-white">Suýt nữa thôi!</p>
            <p className="text-sm font-bold text-white/80">
              {gym.name} mạnh quá. Thử dùng chiêu "Siêu hiệu quả" với hệ {TYPE_VI[gym.type]}, hoặc cho {player.name} ăn để thêm Sức mạnh tình bạn nhé! 💪
            </p>
            <button onClick={challenge} className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-lg font-black shadow-lg flex items-center gap-2 active:scale-95">
              <RotateCcw className="w-5 h-5" /> Thử lại
            </button>
            <button onClick={() => setScreen('road')} className="text-sm font-bold text-white/70 underline">
              Xem bản đồ
            </button>
          </div>
        )}

        {screen === 'champion' && (
          <div className="relative flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center min-h-[600px] overflow-hidden" data-testid="league-champion">
            <div className="vs-rays absolute inset-0 opacity-25 pointer-events-none" />
            <span className="spotlight-swing absolute left-[15%] -top-6 w-24 h-[80%] bg-gradient-to-b from-yellow-100/50 to-transparent pointer-events-none" style={{ clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)' }} />
            <span className="spotlight-swing absolute right-[15%] -top-6 w-24 h-[80%] bg-gradient-to-b from-sky-100/40 to-transparent pointer-events-none" style={{ clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)', animationDelay: '-2s' }} />
            <p className="result-rise sport-banner text-4xl font-black italic bg-gradient-to-b from-amber-200 via-yellow-300 to-orange-500 bg-clip-text text-transparent">NHÀ VÔ ĐỊCH!</p>
            <span className="trophy-glow text-7xl spotlight-pop" aria-label="Cúp vô địch">🏆</span>
            <img src={player.image} alt={player.name} className="w-36 h-36 object-contain battle-victory scale-x-[-1] drop-shadow-2xl" />
            <p className="text-base font-bold text-white/90">
              {player.name} đã thắng cả 8 nhà thi đấu và Nhà Vô địch Liên minh!
            </p>
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
      </div>
    </div>,
    document.body
  );
}
