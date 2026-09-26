import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw } from 'lucide-react';
import { sounds } from '../../utils/soundEffects';
import { ArenaBackdrop } from './ArenaBackdrop';

function Trophy({ className = '' }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-label="Cúp vô địch" role="img">
      <defs>
        <linearGradient id="cupGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fef08a" />
          <stop offset="0.45" stopColor="#facc15" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path d="M14 8 C4 8 4 26 18 28" fill="none" stroke="url(#cupGold)" strokeWidth="5" strokeLinecap="round" />
      <path d="M50 8 C60 8 60 26 46 28" fill="none" stroke="url(#cupGold)" strokeWidth="5" strokeLinecap="round" />
      <path d="M14 4 H50 V16 C50 32 42 40 32 40 C22 40 14 32 14 16 Z" fill="url(#cupGold)" stroke="#92400e" strokeWidth="1.5" />
      <rect x="28" y="40" width="8" height="12" fill="url(#cupGold)" />
      <rect x="18" y="52" width="28" height="8" rx="2" fill="url(#cupGold)" stroke="#92400e" strokeWidth="1.5" />
      <rect x="14" y="60" width="36" height="8" rx="2" fill="#78350f" />
      <path d="M32 11 L34.6 17 L41 17.6 L36.2 21.8 L37.6 28 L32 24.8 L26.4 28 L27.8 21.8 L23 17.6 L29.4 17 Z" fill="#fff7ed" />
      <path d="M18 8 C18 20 22 30 28 34" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Podium places from left to right: rank 4, 2, 1 (MVP), 3, 5
const PLACES = [3, 1, 0, 2, 4];
const HEIGHTS = [58, 96, 130, 80, 50];
const BLOCKS = ['from-sky-400 to-blue-700', 'from-slate-200 to-slate-500', 'from-yellow-300 to-amber-600', 'from-orange-300 to-amber-800', 'from-sky-400 to-blue-700'];

/** Counts up from 0 to `to` (the gold earned) once `start` ms have passed. */
function useCountUp(to, start) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let timer;
    const begin = setTimeout(() => {
      const steps = 24;
      let i = 0;
      timer = setInterval(() => {
        i += 1;
        setValue(Math.round((to * i) / steps));
        if (i % 3 === 0) sounds.playCoin();
        if (i >= steps) clearInterval(timer);
      }, 45);
    }, start);
    return () => {
      clearTimeout(begin);
      clearInterval(timer);
    };
  }, [to, start]);
  return value;
}

/**
 * End of a team battle. A win: the whole team on a podium ordered by knock-outs, the cup
 * dropping onto the MVP, fireworks and the gold counting up. A loss: a gentle "try again".
 */
export function TrophyCeremony({ won, team, kos = [], mvp = 0, gold, arena, onReplay, onClose }) {
  const shownGold = useCountUp(gold, won ? 2200 : 600);
  const [ready, setReady] = useState(false);
  const bursts = useRef([]);

  useEffect(() => {
    const timers = bursts.current;
    const fire = (opts) => {
      try {
        confetti({ zIndex: 9999, ...opts });
      } catch {
        // decoration
      }
    };
    if (won) {
      sounds.playSuccessFanfare();
      timers.push(setTimeout(() => fire({ particleCount: 140, spread: 100, origin: { y: 0.5 } }), 1300));
      timers.push(setTimeout(() => {
        fire({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
        fire({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
      }, 2100));
      timers.push(setTimeout(() => {
        sounds.playSuccessFanfare();
        for (const x of [0.2, 0.5, 0.8]) fire({ particleCount: 60, spread: 360, startVelocity: 30, origin: { x, y: 0.25 }, colors: ['#fde047', '#f97316', '#ffffff', '#f472b6'] });
      }, 3000));
    }
    timers.push(setTimeout(() => setReady(true), won ? 2600 : 900));
    return () => timers.forEach(clearTimeout);
  }, [won]);

  // Ranking: most knock-outs first (MVP), then team order
  const ranking = team.map((_, i) => i).sort((a, b) => (b === mvp) - (a === mvp) || kos[b] - kos[a] || a - b);

  return (
    <div className="relative flex-1 min-h-[600px] overflow-hidden" data-testid="trophy-ceremony" data-won={won}>
      <ArenaBackdrop arena={arena} ambient={false} className="absolute inset-0" />
      <div className="absolute inset-0 bg-slate-950/70" />
      {won && (
        <>
          <div className="vs-rays absolute inset-0 opacity-25" />
          <span className="spotlight-swing absolute left-[18%] -top-6 w-24 h-[80%] bg-gradient-to-b from-yellow-100/50 to-transparent" style={{ clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)' }} />
          <span className="spotlight-swing absolute right-[18%] -top-6 w-24 h-[80%] bg-gradient-to-b from-sky-100/40 to-transparent" style={{ clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)', animationDelay: '-2s' }} />
        </>
      )}

      <div className="relative z-10 flex flex-col items-center px-3 pt-5 pb-6 gap-3">
        <p className="result-rise sport-banner text-4xl sm:text-5xl font-black italic bg-gradient-to-b from-amber-200 via-yellow-300 to-orange-500 bg-clip-text text-transparent text-center">
          {won ? 'VÔ ĐỊCH!' : 'Thua mất rồi!'}
        </p>
        <p className="result-rise text-sm font-bold text-white/85 text-center" style={{ animationDelay: '150ms' }}>
          {won ? 'Cả đội của bé đã thắng cả 5 đối thủ!' : 'Đối thủ mạnh quá! Thử chọn chiêu "Siêu hiệu quả" và sàn đấu hợp với đội nhé 💪'}
        </p>

        {won ? (
          <div className="relative w-full max-w-sm h-[300px] mt-2" data-testid="podium">
            {/* The cup drops onto the MVP */}
            <div className="trophy-drop absolute left-1/2 z-20" style={{ bottom: HEIGHTS[2] + 118, animationDelay: '1.1s' }}>
              <Trophy className="trophy-glow w-16 h-[72px]" />
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-1.5">
              {PLACES.map((rank, col) => {
                const i = ranking[rank];
                const m = team[i];
                if (!m) return <div key={col} className="flex-1" />;
                return (
                  <div key={col} className="flex-1 flex flex-col items-center">
                    {rank === 0 && <span className="pop-in mb-0.5 px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black shadow" style={{ animationDelay: '2s' }}>⭐ MVP</span>}
                    <img
                      src={m.image}
                      alt={m.name}
                      className={`pop-in object-contain drop-shadow-xl scale-x-[-1] ${rank === 0 ? 'w-24 h-24' : 'w-16 h-16'}`}
                      style={{ animationDelay: `${0.5 + (4 - rank) * 0.12}s` }}
                    />
                    <div className={`podium-rise w-full rounded-t-xl bg-gradient-to-b ${BLOCKS[col]} border-t-4 border-white/70 shadow-2xl flex flex-col items-center pt-1`} style={{ height: HEIGHTS[col], animationDelay: `${col * 0.08}s` }}>
                      <span className="text-2xl font-black text-white drop-shadow">{rank + 1}</span>
                      <span className="text-[10px] font-black text-white/90 truncate max-w-full px-1">{m.name}</span>
                      {kos[i] > 0 && <span className="mt-0.5 px-1.5 rounded-full bg-black/30 text-[10px] font-black text-white">💥 {kos[i]}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex justify-center gap-2 my-4">
            {team.map((m, i) => (
              <img key={m.key} src={m.image} alt={m.name} className="sad-tilt w-14 h-14 object-contain grayscale-[30%]" style={{ animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        )}

        <div className="result-rise flex items-center gap-2 px-5 py-2 rounded-2xl bg-amber-400/20 border-2 border-amber-300/60 text-2xl font-black text-amber-200" style={{ animationDelay: won ? '2s' : '400ms' }} data-testid="team-gold">
          <span className="coin-spin">🪙</span> +{shownGold} vàng
        </div>

        {ready && (
          <div className="pop-in flex gap-3">
            <button onClick={onReplay} className="px-5 py-3 rounded-2xl bg-red-500 hover:bg-red-400 text-white text-lg font-black flex items-center gap-2 shadow-lg active:scale-95">
              <RotateCcw className="w-5 h-5" /> Đấu trận mới
            </button>
            <button onClick={onClose} className="px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-lg font-black shadow-lg active:scale-95">
              Xong
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
