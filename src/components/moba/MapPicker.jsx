import React from 'react';
import { MAPS } from '../../utils/moba/map';
import { saveMapId } from './mapChoice';

/** Little top-down preview: ground colour, the three lanes and the obstacles as dots. */
function Preview({ map }) {
  const t = map.theme;
  return (
    <svg viewBox="0 0 160 90" className="w-full h-auto rounded-xl" aria-hidden="true">
      <rect width="160" height="90" fill={t.ground[1]} />
      {[17, 45, 73].map((y, i) => (
        <path key={y} d={i === 1 ? 'M12 45 H148' : `M16 ${45 + (y < 45 ? -4 : 4)} Q21 ${y} 33 ${y} H127 Q139 ${y} 144 ${45 + (y < 45 ? -4 : 4)}`} stroke={t.lane[1]} strokeWidth="5" fill="none" strokeLinecap="round" />
      ))}
      {map.obstacles.map((o, i) => (
        <circle key={i} cx={o.x / 10} cy={o.y / 10} r={Math.max(1.6, o.r / 12)} fill={o.kind === 'lava' ? '#f97316' : t.miniDot} />
      ))}
      <circle cx="11.5" cy="45" r="7" fill="#38bdf8" stroke="#fff" strokeWidth="1.5" />
      <circle cx="148.5" cy="45" r="7" fill="#f43f5e" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

/** Choose the battle map (arena and boss raid). */
export function MapPicker({ value, onChange }) {
  return (
    <div>
      <p className="text-lg font-black text-white">🗺️ Bản đồ</p>
      <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Bản đồ">
        {MAPS.map((m) => {
          const on = m.id === value;
          return (
            <button
              key={m.id}
              role="radio"
              aria-checked={on}
              aria-label={m.name}
              onClick={() => {
                onChange(m.id);
                saveMapId(m.id);
              }}
              className={`p-1.5 rounded-2xl border-2 text-left transition-all active:scale-95 bg-gradient-to-br ${m.card} ${on ? 'border-amber-300 scale-[1.03] shadow-lg shadow-amber-500/30' : 'border-white/20 opacity-80'}`}
            >
              <Preview map={m} />
              <span className="mt-1 flex items-center gap-1 px-1 text-sm font-black text-white drop-shadow">
                {m.icon} {m.name}
                {on && <span className="ml-auto text-amber-200">✓</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
