import React from 'react';
import { Ball } from './PokeIcons';

// Pictures for the games and the big banners, drawn in SVG with Pokemon touches
// (Pokeballs, Poké Mart, gym badges, Jigglypuff singing, Pikachu's bolt...). 48 x 48 box.

const INK = '#1f2937';

function Pic({ className = 'w-10 h-10', children, label }) {
  return (
    <svg viewBox="0 0 48 48" className={`${className} shrink-0 drop-shadow`} aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      {children}
    </svg>
  );
}

const GAME_PICS = {
  // Play
  runner: (
    <>
      <path d="M4 20h12M2 27h14M6 34h10" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
      <Ball x={30} y={27} r={13} />
    </>
  ),
  battle: (
    <>
      <Ball x={15} y={28} r={12} />
      <Ball x={33} y={28} r={12} top="#3b82f6" />
      <path d="M24 4l-4 8h7l-4 9" fill="none" stroke="#f59e0b" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
    </>
  ),
  cooking: (
    <>
      <path d="M17 12c-2-3 2-5 0-8M24 12c-2-3 2-5 0-8M31 12c-2-3 2-5 0-8" stroke="#cbd5e1" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M6 22h36v4a14 14 0 0 1-14 14h-8A14 14 0 0 1 6 26z" fill="#64748b" stroke={INK} strokeWidth="2" />
      <circle cx="17" cy="20" r="4" fill="#3b82f6" />
      <circle cx="26" cy="19" r="4" fill="#ec4899" />
      <circle cx="33" cy="21" r="3.5" fill="#f97316" />
      <rect x="2" y="22" width="44" height="4" rx="2" fill="#94a3b8" stroke={INK} strokeWidth="1.5" />
    </>
  ),
  shop: (
    <>
      <rect x="7" y="18" width="34" height="24" fill="#e0f2fe" stroke={INK} strokeWidth="2" />
      <path d="M4 18l4-10h32l4 10z" fill="#3b82f6" stroke={INK} strokeWidth="2" />
      <path d="M12 8l-2 10M20 8l-1 10M28 8l1 10M36 8l2 10" stroke="#ffffff" strokeWidth="2" />
      <rect x="19" y="28" width="10" height="14" fill="#1d4ed8" stroke={INK} strokeWidth="1.5" />
      <Ball x={12.5} y={29} r={4} />
      <Ball x={35.5} y={29} r={4} />
    </>
  ),
  catch: (
    <>
      <path d="M6 40Q14 8 38 14" fill="none" stroke="#fde047" strokeWidth="2.5" strokeDasharray="3 4" strokeLinecap="round" />
      <Ball x={36} y={14} r={9} />
      <path d="M26 5l2 3M44 6l-3 3M44 22l-3-2" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  // Sports
  bowling: (
    <>
      {[30, 37, 44].map((x) => (
        <path key={x} d={`M${x} 10c-2.4 0-3 3-2 6-2 3-2.4 10 0 14h4c2.4-4 2-11 0-14 1-3 .4-6-2-6z`} fill="#ffffff" stroke={INK} strokeWidth="1.5" transform={`translate(${-4} 0)`} />
      ))}
      <path d="M26 16h8M33 16h8M40 16h8" stroke="#ef4444" strokeWidth="2" transform="translate(-4 0)" />
      <Ball x={14} y={32} r={12} top="#6366f1" />
    </>
  ),
  penalty: (
    <>
      <path d="M4 8h40v20" fill="none" stroke="#ffffff" strokeWidth="3" />
      <path d="M4 8v20" stroke="#ffffff" strokeWidth="3" />
      <path d="M8 12h32M8 18h32M8 24h32M14 8v20M24 8v20M34 8v20" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1" />
      <Ball x={24} y={34} r={11} />
      <path d="M24 29.5l3.6 2.6-1.4 4.2h-4.4l-1.4-4.2z" fill={INK} />
    </>
  ),
  basketball: (
    <>
      <path d="M26 6h18v4H26z" fill="#ef4444" stroke={INK} strokeWidth="1.5" />
      <path d="M28 10l3 10M35 10v10M42 10l-3 10" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="18" cy="30" r="14" fill="#f97316" stroke={INK} strokeWidth="2" />
      <path d="M4 30h28M18 16v28M8 20c6 6 6 14 0 20M28 20c-6 6-6 14 0 20" fill="none" stroke={INK} strokeWidth="1.6" />
      <Ball x={18} y={30} r={3.4} />
    </>
  ),
  racing: (
    <>
      <path d="M26 4v18" stroke={INK} strokeWidth="2" />
      <path d="M26 4h16v10H26z" fill="#ffffff" stroke={INK} strokeWidth="1.5" />
      <path d="M26 4h4v5h-4zM34 4h4v5h-4zM30 9h4v5h-4zM38 9h4v5h-4z" fill={INK} />
      <path d="M13 34l6-10h10l6 10" fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinejoin="round" />
      <path d="M22 24l-3-4h-5" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" />
      <Ball x={11} y={36} r={7.5} />
      <Ball x={37} y={36} r={7.5} />
    </>
  ),
  goldminer: (
    <>
      <path d="M24 2v18" stroke={INK} strokeWidth="2" />
      <path d="M24 20c-5 0-7 4-6 8M24 20c5 0 7 4 6 8" fill="none" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
      <path d="M12 34l6-6h12l7 6-3 10H15z" fill="#facc15" stroke="#a16207" strokeWidth="2" />
      <path d="M18 34l3-3" stroke="#fef9c3" strokeWidth="2.5" strokeLinecap="round" />
      <Ball x={24} y={6} r={5} />
    </>
  ),
  archery: (
    <>
      <circle cx="28" cy="22" r="17" fill="#ffffff" stroke={INK} strokeWidth="1.5" />
      <circle cx="28" cy="22" r="12.5" fill="#3b82f6" />
      <circle cx="28" cy="22" r="8" fill="#ef4444" />
      <circle cx="28" cy="22" r="4" fill="#facc15" />
      <path d="M4 44l14-14" stroke="#fb923c" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 5" />
      <circle cx="21" cy="28" r="5" fill="#fb923c" stroke="#fde047" strokeWidth="2" />
    </>
  ),
  redlight: (
    <>
      <path d="M13 6l4 9M35 6l-4 9" stroke="#f472b6" strokeWidth="5" strokeLinecap="round" />
      <circle cx="24" cy="27" r="17" fill="#f9a8d4" stroke="#be185d" strokeWidth="2" />
      <path d="M22 13c0-4 6-4 5 0-1 3-4 2-3 0" fill="none" stroke="#be185d" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="17.5" cy="26" r="4.5" fill="#ffffff" />
      <circle cx="30.5" cy="26" r="4.5" fill="#ffffff" />
      <circle cx="18" cy="26.5" r="2.4" fill="#ef4444" />
      <circle cx="31" cy="26.5" r="2.4" fill="#22c55e" />
      <path d="M20 35q4 3 8 0" fill="none" stroke="#9d174d" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  // Thinking games
  maze: (
    <>
      <rect x="4" y="4" width="40" height="40" rx="5" fill="#bbf7d0" stroke="#15803d" strokeWidth="2.5" />
      <path d="M12 4v14h10M22 12h14M30 12v18M12 26h10v10M22 36h14M36 22v14" fill="none" stroke="#15803d" strokeWidth="3" strokeLinecap="round" />
      <Ball x={40} y={40} r={5} />
    </>
  ),
  math: (
    <>
      <rect x="3" y="12" width="13" height="16" rx="3" fill="#38bdf8" stroke={INK} strokeWidth="1.5" />
      <text x="9.5" y="25" fontSize="12" fontWeight="900" textAnchor="middle" fill="#ffffff">1</text>
      <text x="20" y="25" fontSize="12" fontWeight="900" textAnchor="middle" fill="#1e3a8a">+</text>
      <rect x="24" y="12" width="13" height="16" rx="3" fill="#a78bfa" stroke={INK} strokeWidth="1.5" />
      <text x="30.5" y="25" fontSize="12" fontWeight="900" textAnchor="middle" fill="#ffffff">2</text>
      <Ball x={24} y={38} r={7} />
      <text x="42" y="25" fontSize="12" fontWeight="900" textAnchor="middle" fill="#1e3a8a">=</text>
    </>
  ),
  english: (
    <>
      <path d="M6 6h36a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H22l-9 9v-9H6a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" fill="#fef3c7" stroke="#b45309" strokeWidth="2" />
      <text x="24" y="25" fontSize="14" fontWeight="900" textAnchor="middle" fill="#e11d48">ABC</text>
      <Ball x={40} y={38} r={6} />
    </>
  ),
  memory: (
    <>
      <rect x="4" y="12" width="16" height="22" rx="3" fill="#c4b5fd" stroke={INK} strokeWidth="1.5" transform="rotate(-12 12 23)" />
      <rect x="28" y="12" width="16" height="22" rx="3" fill="#f9a8d4" stroke={INK} strokeWidth="1.5" transform="rotate(12 36 23)" />
      <rect x="16" y="8" width="16" height="24" rx="3" fill="#ffffff" stroke={INK} strokeWidth="1.5" />
      <Ball x={24} y={20} r={6} />
      <text x="24" y="44" fontSize="9" fontWeight="900" textAnchor="middle" fill="#7c3aed">1 2 3</text>
    </>
  ),
  music: (
    <>
      <path d="M17 36V10l24-5v26" fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinejoin="round" />
      <path d="M17 16l24-5" stroke="#7c3aed" strokeWidth="3" />
      <Ball x={11} y={36} r={7} />
      <Ball x={35} y={31} r={7} top="#a855f7" />
    </>
  ),
  pairs: (
    <>
      <rect x="4" y="8" width="18" height="26" rx="3" fill="#ffffff" stroke={INK} strokeWidth="1.5" transform="rotate(-8 13 21)" />
      <rect x="26" y="8" width="18" height="26" rx="3" fill="#ffffff" stroke={INK} strokeWidth="1.5" transform="rotate(8 35 21)" />
      <Ball x={13} y={21} r={6} />
      <Ball x={35} y={21} r={6} />
      <path d="M18 42h12" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  rhythm: (
    <>
      {[['#f43f5e', 6, 180], ['#38bdf8', 18, 90], ['#34d399', 30, -90], ['#facc15', 42, 0]].map(([c, x, rot], i) => (
        <g key={i} transform={`translate(${x} ${i % 2 ? 30 : 18})`}>
          <circle r="6" fill={c} stroke="#ffffff" strokeWidth="1.5" />
          <path d="M-3 0h4M0-3l3 3-3 3" transform={`rotate(${rot})`} fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      <Ball x={24} y={42} r={5} />
    </>
  ),
  oddone: (
    <>
      <Ball x={10} y={14} r={7} />
      <Ball x={26} y={14} r={7} />
      <Ball x={10} y={32} r={7} />
      <Ball x={26} y={32} r={7} top="#3b82f6" />
      <circle cx="33" cy="33" r="9" fill="none" stroke="#f59e0b" strokeWidth="3" />
      <path d="M39.5 39.5L46 46" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  spot: (
    <>
      <rect x="2" y="10" width="20" height="26" rx="3" fill="#bae6fd" stroke={INK} strokeWidth="1.5" />
      <rect x="26" y="10" width="20" height="26" rx="3" fill="#bae6fd" stroke={INK} strokeWidth="1.5" />
      <path d="M2 28h20M26 28h20" stroke="#22c55e" strokeWidth="6" />
      <Ball x={12} y={19} r={4} />
      <Ball x={36} y={19} r={4} top="#facc15" />
      <circle cx="36" cy="19" r="7.5" fill="none" stroke="#f59e0b" strokeWidth="2.5" />
    </>
  ),
  // Big banners
  team: (
    <>
      <path d="M14 6h20v12a10 10 0 0 1-20 0z" fill="#facc15" stroke="#a16207" strokeWidth="2" />
      <path d="M14 9H8a6 6 0 0 0 6 8M34 9h6a6 6 0 0 1-6 8M24 28v6M16 42h16l-2-8H18z" fill="none" stroke="#a16207" strokeWidth="2" />
      <path d="M16 42h16l-2-8H18z" fill="#fbbf24" stroke="#a16207" strokeWidth="2" />
      <Ball x={24} y={15} r={5.5} />
    </>
  ),
  league: (
    <>
      <path d="M12 4l6 12M36 4l-6 12" stroke="#e11d48" strokeWidth="5" strokeLinecap="round" />
      <path d="M24 14l10 5.5v11L24 44l-10-13.5v-11z" fill="#94a3b8" stroke="#334155" strokeWidth="2" />
      <path d="M24 14v30M14 19.5L24 25l10-5.5M14 30.5L24 25l10 5.5" stroke="#e2e8f0" strokeWidth="1.5" />
    </>
  ),
  moba: (
    <>
      <path d="M3 10l14-5 14 5 14-5v33l-14 5-14-5-14 5z" fill="#86efac" stroke="#15803d" strokeWidth="2" />
      <path d="M8 24h32" stroke="#e7c98a" strokeWidth="4" strokeLinecap="round" />
      <circle cx="8" cy="24" r="4.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="40" cy="24" r="4.5" fill="#f43f5e" stroke="#ffffff" strokeWidth="1.5" />
      <Ball x={24} y={24} r={5.5} />
    </>
  ),
  boss: (
    <>
      <path d="M10 18l4-12 6 7 4-9 4 9 6-7 4 12z" fill="#facc15" stroke="#a16207" strokeWidth="2" strokeLinejoin="round" />
      <Ball x={24} y={32} r={13} top="#7e22ce" />
      <path d="M17 24.5l2.5-3 2.5 3 2.5-3 2.5 3" fill="none" stroke="#f9a8d4" strokeWidth="1.8" transform="translate(-1 0)" />
    </>
  ),
  gift: (
    <>
      <rect x="6" y="18" width="36" height="26" rx="3" fill="#ef4444" stroke={INK} strokeWidth="2" />
      <rect x="4" y="12" width="40" height="8" rx="2" fill="#f87171" stroke={INK} strokeWidth="2" />
      <path d="M24 12v32" stroke="#facc15" strokeWidth="5" />
      <path d="M24 12c-4-8-12-6-9-1 1.5 2 6 1 9 1zM24 12c4-8 12-6 9-1-1.5 2-6 1-9 1z" fill="#facc15" stroke="#a16207" strokeWidth="1.5" />
      <Ball x={24} y={31} r={6} />
    </>
  ),
};


/** The picture of a game (or banner); falls back to its emoji. */
export function GameIcon({ id, fallback, className = 'w-10 h-10', label }) {
  const pic = GAME_PICS[id];
  if (!pic) return <span className="text-4xl leading-none" aria-hidden="true">{fallback}</span>;
  return (
    <Pic className={className} label={label}>
      {pic}
    </Pic>
  );
}
