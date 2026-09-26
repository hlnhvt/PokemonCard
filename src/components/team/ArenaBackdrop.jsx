import React from 'react';

// Ambient particles per ground: how they move and what they look like
const AMBIENT = {
  leaves: { move: 'amb-fall', count: 12, render: (i) => <span className="text-lg">{i % 3 ? '🍃' : '🌸'}</span> },
  embers: { move: 'amb-rise', count: 18, render: (i) => <span className="block rounded-full bg-orange-400" style={{ width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2, boxShadow: '0 0 8px 3px rgba(251,146,60,0.9)' }} /> },
  bubbles: { move: 'amb-rise', count: 14, render: (i) => <span className="block rounded-full border-2 border-white/80 bg-white/15" style={{ width: 8 + (i % 4) * 5, height: 8 + (i % 4) * 5 }} /> },
  snow: { move: 'amb-fall', count: 22, render: (i) => <span className="block rounded-full bg-white" style={{ width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2, boxShadow: '0 0 4px white' }} /> },
  neon: { move: 'amb-rise', count: 14, render: (i) => <span className="block rounded-full" style={{ width: 3, height: 14 + (i % 3) * 8, background: ['#f0abfc', '#67e8f9', '#fde047'][i % 3], boxShadow: `0 0 10px 2px ${['#e879f9', '#22d3ee', '#facc15'][i % 3]}` }} /> },
  stars: { move: 'amb-twinkle', count: 26, render: (i) => <span className="block rounded-full bg-white" style={{ width: 2 + (i % 3), height: 2 + (i % 3), boxShadow: '0 0 6px white' }} /> },
};

function Ambient({ kind }) {
  const cfg = AMBIENT[kind];
  if (!cfg) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" data-testid={`ambient-${kind}`}>
      {Array.from({ length: cfg.count }).map((_, i) => {
        const left = (i * 37 + 11) % 100;
        const falling = cfg.move === 'amb-fall';
        const rising = cfg.move === 'amb-rise';
        return (
          <span
            key={i}
            className={`absolute ${cfg.move}`}
            style={{
              left: `${left}%`,
              top: falling ? '-5%' : rising ? `${85 + (i % 3) * 5}%` : `${(i * 53) % 70}%`,
              animationDelay: `${-((i * 0.83) % 7)}s`,
              '--dur': `${falling ? 6 + (i % 5) : rising ? 4 + (i % 4) : 1.6 + (i % 4) * 0.6}s`,
              '--sway': `${((i % 5) - 2) * 18}px`,
              '--dist': '480px',
            }}
          >
            {cfg.render(i)}
          </span>
        );
      })}
      {kind === 'stars' && <span className="shooting-star absolute right-4 top-6 block w-24 h-0.5 rounded-full bg-gradient-to-l from-white to-transparent" />}
    </div>
  );
}

/** Scenery drawn behind the fighters for each ground. */
function Scenery({ arena }) {
  switch (arena.id) {
    case 'meadow':
      return (
        <>
          <span className="absolute right-[12%] top-[8%] w-14 h-14 rounded-full bg-yellow-200 shadow-[0_0_40px_12px_rgba(254,240,138,0.8)]" />
          <div className="arena-drift absolute top-[10%] left-0 w-[200%] flex gap-24 text-5xl opacity-90">
            {Array.from({ length: 6 }).map((_, i) => <span key={i}>☁️</span>)}
          </div>
          <span className="absolute -left-[10%] bottom-[34%] w-[70%] h-[30%] rounded-[50%] bg-green-500/70" />
          <span className="absolute -right-[15%] bottom-[34%] w-[80%] h-[34%] rounded-[50%] bg-green-600/60" />
        </>
      );
    case 'volcano':
      return (
        <>
          <span className="absolute left-[8%] bottom-[34%] w-[60%] h-[50%] bg-stone-800" style={{ clipPath: 'polygon(0 100%, 42% 8%, 58% 8%, 100% 100%)' }} />
          <span className="lava-glow absolute left-[30%] bottom-[76%] w-[16%] h-[10%] rounded-full bg-orange-500 blur-md" />
          <span className="absolute left-[34%] bottom-[48%] w-[8%] h-[34%] bg-gradient-to-b from-orange-400 to-red-600/0" style={{ clipPath: 'polygon(40% 0, 60% 0, 100% 100%, 0 100%)' }} />
          <span className="absolute right-[-5%] bottom-[34%] w-[45%] h-[32%] bg-stone-900" style={{ clipPath: 'polygon(0 100%, 55% 0, 100% 100%)' }} />
        </>
      );
    case 'ocean':
      return (
        <>
          <span className="absolute left-[14%] top-[10%] w-16 h-16 rounded-full bg-yellow-200 shadow-[0_0_50px_16px_rgba(254,240,138,0.7)]" />
          <span className="absolute inset-x-0 bottom-[30%] h-[18%] bg-gradient-to-b from-cyan-400 to-blue-600" />
          <span className="arena-drift absolute bottom-[44%] left-0 w-[200%] h-3 opacity-70" style={{ background: 'repeating-radial-gradient(circle at 20px -8px, transparent 0 14px, rgba(255,255,255,0.9) 15px 17px, transparent 18px 40px)', backgroundSize: '40px 12px' }} />
          <span className="absolute right-[4%] bottom-[30%] text-6xl">🌴</span>
        </>
      );
    case 'snow':
      return (
        <>
          <span className="absolute left-[-5%] bottom-[34%] w-[65%] h-[48%] bg-slate-400" style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }} />
          <span className="absolute left-[16%] bottom-[66%] w-[18%] h-[16%] bg-white" style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }} />
          <span className="absolute right-[-8%] bottom-[34%] w-[60%] h-[40%] bg-slate-300" style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }} />
          <span className="absolute left-[4%] bottom-[30%] text-5xl">🌲</span>
          <span className="absolute right-[6%] bottom-[31%] text-4xl">🌲</span>
        </>
      );
    case 'city':
      return (
        <>
          <span className="absolute right-[12%] top-[8%] w-12 h-12 rounded-full bg-yellow-100 shadow-[0_0_30px_8px_rgba(254,249,195,0.6)]" />
          <div className="absolute inset-x-0 bottom-[34%] h-[36%] flex items-end gap-1 px-1">
            {[62, 88, 48, 100, 70, 56, 92, 66].map((h, i) => (
              <span
                key={i}
                className="flex-1 bg-slate-900/95 border-t-2 border-fuchsia-400/60"
                style={{ height: `${h}%`, backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 7px, rgba(253,224,71,0.55) 7px 10px), repeating-linear-gradient(90deg, transparent 0 5px, rgba(15,23,42,1) 5px 9px)' }}
              />
            ))}
          </div>
        </>
      );
    case 'space':
      return (
        <>
          <span className="absolute right-[8%] top-[6%] text-6xl opacity-90">🪐</span>
          <span className="absolute left-[10%] top-[20%] w-10 h-10 rounded-full bg-gradient-to-br from-rose-300 to-purple-700 shadow-[0_0_24px_4px_rgba(167,139,250,0.6)]" />
          <span className="absolute inset-x-0 bottom-[30%] h-[20%] bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.35),transparent_70%)]" />
        </>
      );
    default:
      return null;
  }
}

/** Themed battle ground: sky, scenery, ground and moving ambient particles. */
export function ArenaBackdrop({ arena, ambient = true, className = '', children }) {
  return (
    // `relative` would override an `absolute` passed in className (Tailwind order), so only add it when needed
    <div className={`${/absolute/.test(className) ? '' : 'relative'} overflow-hidden bg-gradient-to-b ${arena.sky} ${className}`} data-arena={arena.id}>
      <Scenery arena={arena} />
      <div className={`absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-b ${arena.ground}`} />
      {ambient && <Ambient kind={arena.ambient} />}
      {children}
    </div>
  );
}
