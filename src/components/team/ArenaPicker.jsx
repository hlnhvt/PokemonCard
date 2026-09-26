import React from 'react';
import { Swords, ArrowLeft } from 'lucide-react';
import { ARENAS } from '../../utils/team/arenas';
import { TYPE_COLORS, TYPE_VI } from '../../utils/battle/typeChart';
import { ArenaBackdrop } from './ArenaBackdrop';

/**
 * Choosing the battle ground. Each shows a small live preview and the types it powers up;
 * `teamTypes` (the team's types, when known) tells how many of the child's Pokemon it suits.
 */
export function ArenaPicker({ selected, onSelect, onStart, onBack, teamTypes = [] }) {
  return (
    <div className="px-4 pt-3 pb-5 space-y-3" data-testid="arena-picker">
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="Quay lại đội hình" className="p-2 rounded-full bg-white/20 text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-2xl font-black text-white drop-shadow">Chọn sàn đấu</p>
          <p className="text-xs font-bold text-white/80">Mỗi sàn giúp một số hệ ra đòn mạnh hơn (cho cả hai đội)!</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Sàn đấu">
        {ARENAS.map((arena, i) => {
          const active = arena.id === selected;
          const suits = teamTypes.filter((types) => types.some((t) => arena.boost.includes(t))).length;
          return (
            <button
              key={arena.id}
              role="radio"
              aria-checked={active}
              aria-label={arena.name}
              onClick={() => onSelect(arena.id)}
              className={`pop-in relative rounded-3xl overflow-hidden text-left transition-all duration-300 ${active ? 'ring-4 ring-amber-300 scale-[1.03] shadow-[0_0_24px_rgba(252,211,77,0.8)]' : 'ring-2 ring-white/30 opacity-90'}`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <ArenaBackdrop arena={arena} ambient={active} className="h-28">
                <span className="absolute left-2 top-2 text-3xl drop-shadow">{arena.emoji}</span>
                {active && <span className="absolute right-2 top-2 px-2 py-0.5 rounded-full bg-amber-300 text-slate-900 text-[10px] font-black">ĐÃ CHỌN</span>}
              </ArenaBackdrop>
              <div className="p-2 bg-slate-950/85">
                <p className="text-sm font-black text-white leading-tight">{arena.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {arena.boost.map((t) => (
                    <span key={t} className="px-1.5 rounded text-[9px] font-black text-white" style={{ backgroundColor: TYPE_COLORS[t] }}>
                      {TYPE_VI[t]} ↑
                    </span>
                  ))}
                </div>
                {teamTypes.length > 0 && (
                  <p className={`mt-1 text-[10px] font-bold ${suits ? 'text-emerald-300' : 'text-slate-400'}`}>
                    {suits ? `💪 Hợp với ${suits} Pokémon của bé` : 'Chưa hợp Pokémon nào'}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button onClick={onStart} className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 text-white text-xl font-black shadow-lg flex items-center justify-center gap-2 active:scale-95">
        <Swords className="w-6 h-6" /> Bắt đầu trận đấu!
      </button>
    </div>
  );
}
