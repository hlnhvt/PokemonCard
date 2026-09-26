import React from 'react';

/**
 * "Pokémon ra sân đầu tiên": after the team is ready the child picks who fights first.
 * The others follow in team order.
 */
export function LeadPicker({ team, lead, onPick }) {
  return (
    <div className="rounded-2xl bg-black/30 p-3" data-testid="lead-picker">
      <p className="text-base font-black text-white">⭐ Chọn Pokémon ra sân đầu tiên</p>
      <p className="text-[11px] font-bold text-white/70">Các bạn còn lại vào sân theo thứ tự trong đội.</p>
      <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Pokémon ra sân đầu tiên">
        {team.map((m, i) => {
          const on = i === lead;
          return (
            <button
              key={m.key || i}
              role="radio"
              aria-checked={on}
              aria-label={`Ra sân đầu: ${m.name}`}
              onClick={() => onPick(i)}
              className={`relative flex flex-col items-center p-1 rounded-2xl border-2 transition-all active:scale-95 ${on ? 'border-amber-300 bg-amber-300/25 scale-105 shadow-lg shadow-amber-400/30' : 'border-white/20 bg-white/5'}`}
            >
              {on && <span className="pop-in absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 rounded-full bg-amber-400 text-slate-900 text-[9px] font-black whitespace-nowrap">RA SÂN</span>}
              <img src={m.image} alt="" className={`w-12 h-12 object-contain ${on ? 'battle-idle' : 'opacity-80'}`} />
              <span className="w-full text-center text-[10px] font-black text-white truncate">{m.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
