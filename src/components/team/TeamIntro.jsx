import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { TYPE_COLORS, TYPE_VI } from '../../utils/battle/typeChart';
import { ArenaBackdrop } from './ArenaBackdrop';

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

/** Both teams run in from their side, then a big VS. Tap to skip. `title` (e.g. a gym) shows above the ground. */
export function TeamVsIntro({ arena, players, opponents, onDone, title }) {
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
        {title && <p className="mb-1 text-xl font-black text-amber-300">{title}</p>}
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
