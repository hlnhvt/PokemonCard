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
  // Carnival
  diglett: (
    <>
      <ellipse cx="24" cy="40" rx="20" ry="6" fill="#78350f" />
      <path d="M12 40V24a12 12 0 0 1 24 0v16z" fill="#a16207" stroke="#451a03" strokeWidth="2" />
      <ellipse cx="19.5" cy="23" rx="1.8" ry="3" fill={INK} />
      <ellipse cx="28.5" cy="23" rx="1.8" ry="3" fill={INK} />
      <ellipse cx="24" cy="30" rx="5" ry="3.4" fill="#f9a8d4" stroke="#be185d" strokeWidth="1.2" />
      <path d="M30 4l12 8-4 5-12-8z" fill="#94a3b8" stroke={INK} strokeWidth="1.5" />
      <path d="M36 12l-8 12" stroke="#92400e" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M8 8l3 3M6 16h4M14 4l1 4" stroke="#fde047" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  ringtoss: (
    <>
      <ellipse cx="24" cy="42" rx="14" ry="3.5" fill="#15803d" opacity="0.5" />
      <rect x="21.5" y="18" width="5" height="24" rx="2.5" fill="#f59e0b" stroke="#92400e" strokeWidth="1.2" />
      <circle cx="24" cy="30" r="3.2" fill="#f59e0b" stroke="#fff" strokeWidth="1.2" />
      <Ball x={24} y={12} r={7} />
      <ellipse cx="24" cy="38" rx="12" ry="4.5" fill="none" stroke="#1e293b" strokeWidth="5" />
      <path d="M12 38a12 4.5 0 0 1 24 0" fill="none" stroke="#ef4444" strokeWidth="3.2" />
      <path d="M36 38a12 4.5 0 0 1-24 0" fill="none" stroke="#fff" strokeWidth="3.2" />
    </>
  ),
  psyduck: (
    <>
      <path d="M2 38q5.5-4 11 0t11 0 11 0 11 0V46H2z" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.2" />
      <circle cx="20" cy="22" r="13" fill="#fff" stroke="#7f1d1d" strokeWidth="1.5" />
      <circle cx="20" cy="22" r="9.5" fill="#ef4444" />
      <circle cx="20" cy="22" r="7" fill="#facc15" stroke="#a16207" strokeWidth="1" />
      <path d="M17 15.5l-1-3M20 15l0-3.5M23 15.5l1-3" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="17.5" cy="21" r="1.3" fill="#1e293b" />
      <circle cx="22.5" cy="21" r="1.3" fill="#1e293b" />
      <ellipse cx="20" cy="25" rx="3.2" ry="1.8" fill="#fde68a" stroke="#a16207" strokeWidth="0.8" />
      <circle cx="38" cy="12" r="4" fill="#7dd3fc" stroke="#0284c7" strokeWidth="1" />
      <circle cx="33" cy="16" r="2.2" fill="#bae6fd" />
      <Ball x={40} y={40} r={5} />
    </>
  ),
  cans: (
    <>
      <rect x="4" y="40" width="40" height="4" rx="1.5" fill="#b45309" />
      <rect x="7" y="27" width="10" height="13" rx="2" fill="#38bdf8" stroke="#0369a1" strokeWidth="1" />
      <rect x="19" y="27" width="10" height="13" rx="2" fill="#facc15" stroke="#a16207" strokeWidth="1" />
      <rect x="13" y="14" width="10" height="13" rx="2" fill="#4ade80" stroke="#15803d" strokeWidth="1" />
      <rect x="31" y="31" width="13" height="9" rx="2" transform="rotate(-25 37 35)" fill="#fb923c" stroke="#c2410c" strokeWidth="1" />
      <circle cx="12" cy="33.5" r="2.2" fill="#fff" />
      <circle cx="24" cy="33.5" r="2.2" fill="#fff" />
      <circle cx="18" cy="20.5" r="2.2" fill="#fff" />
      <path d="M29 10l2-4M33 12l4-2M31 8l1-5" stroke="#fde047" strokeWidth="1.6" strokeLinecap="round" />
      <Ball x={33} y={16} r={5.5} />
    </>
  ),
  claw: (
    <>
      <rect x="7" y="3" width="34" height="42" rx="6" fill="#d946ef" stroke="#701a75" strokeWidth="2" />
      <rect x="11" y="9" width="26" height="25" rx="2" fill="#312e81" />
      <path d="M11 11h26" stroke="#e2e8f0" strokeWidth="2" />
      <path d="M24 11v6" stroke="#e2e8f0" strokeWidth="1.5" />
      <rect x="20.5" y="16.5" width="7" height="3" rx="1.5" fill="#cbd5e1" />
      <path d="M21 19.5l-2 4 2 2M27 19.5l2 4-2 2" fill="none" stroke="#e2e8f0" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19.5 22l1-3.5 2 2.5M28.5 22l-1-3.5-2 2.5" fill="#facc15" stroke="#a16207" strokeWidth="0.8" />
      <circle cx="24" cy="24.5" r="3.6" fill="#facc15" stroke="#a16207" strokeWidth="0.8" />
      <circle cx="22.7" cy="24" r="0.6" fill="#1e293b" />
      <circle cx="25.3" cy="24" r="0.6" fill="#1e293b" />
      <circle cx="16" cy="30.5" r="3.2" fill="#f9a8d4" />
      <Ball x={31.5} y={30.5} r={3.2} />
      <rect x="13" y="37" width="9" height="4.5" rx="1.2" fill="#1e1b4b" />
      <circle cx="32" cy="39" r="2.8" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
      <circle cx="10" cy="6" r="1" fill="#fef08a" />
      <circle cx="38" cy="6" r="1" fill="#fef08a" />
      <circle cx="24" cy="6" r="1" fill="#fef08a" />
    </>
  ),
  cups: (
    <>
      <ellipse cx="24" cy="40" rx="21" ry="5" fill="#15803d" />
      <path d="M6 16h10l3 22H3z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M4 31h16" stroke="#fde047" strokeWidth="2.5" />
      <path d="M32 12h10l3 24H29z" fill="#3b82f6" stroke="#1e3a8a" strokeWidth="1.6" strokeLinejoin="round" transform="rotate(-14 37 30)" />
      <path d="M30 27h16" stroke="#ffffff" strokeWidth="2.5" transform="rotate(-14 37 30)" />
      <Ball x={24} y={34} r={5.5} />
      <path d="M24 22v-4M18 25l-2.5-2.5M30 25l2.5-2.5" stroke="#fde047" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  fishing: (
    <>
      <rect x="2" y="24" width="44" height="22" rx="8" fill="#0891b2" />
      <path d="M5 30q4-2 8 0t8 0M27 40q4-2 8 0t8 0" stroke="#a5f3fc" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M4 4q20 2 32 20" stroke="#78350f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M36 24v6" stroke="#ffffff" strokeWidth="1" />
      <path d="M16 36c3-7 13-7 17 0-4 7-14 7-17 0z" fill="#f97316" stroke="#9a3412" strokeWidth="1.3" />
      <path d="M16 36l-5-4v8z" fill="#fde047" stroke="#9a3412" strokeWidth="1.1" />
      <path d="M24 30.5l2-3 2 3" fill="#fde047" stroke="#9a3412" strokeWidth="1" />
      <circle cx="29" cy="35" r="1.6" fill="#fff" stroke="#1e293b" strokeWidth="0.8" />
      <path d="M32 37q3 1 3 4" stroke="#fde68a" strokeWidth="1" fill="none" />
      <Ball x={36} y={30} r={3} />
      <ellipse cx="36" cy="33.5" rx="6" ry="1.6" fill="none" stroke="#e0f2fe" strokeWidth="1" />
    </>
  ),
  ponyta: (
    <>
      <circle cx="24" cy="24" r="22" fill="#fde68a" />
      <path d="M6 40h36" stroke="#b45309" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 3" />
      <path d="M14 36c0-8 4-15 10-17l4-7 3 6c4 1 7 4 7 7l-5 2-3-2-2 11z" fill="#fff7ed" stroke="#9a3412" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 19c-3-5-1-10 3-12-1 3 1 4 3 3-1 3 2 4 4 3-1 4-4 7-10 6z" fill="#f97316" stroke="#c2410c" strokeWidth="1.2" />
      <path d="M11 31c-4-1-6-4-5-7 2 2 4 2 6 1-1 3 1 5 3 5z" fill="#fb923c" />
      <circle cx="31" cy="22" r="1.6" fill="#1e293b" />
      <Ball x={38} y={38} r={6} />
    </>
  ),
  hammer: (
    <>
      <rect x="21" y="9" width="8" height="31" rx="4" fill="#f59e0b" stroke="#92400e" strokeWidth="2" />
      <path d="M17 12c0-5 3-8 8-8s8 3 8 8z" fill="#fde047" stroke="#a16207" strokeWidth="2" />
      <Ball x={25} y={24} r={4.5} />
      <rect x="14" y="40" width="22" height="5" rx="2" fill="#e11d48" stroke="#9f1239" strokeWidth="1.5" />
      <g transform="rotate(-35 12 36)">
        <rect x="10" y="18" width="4" height="22" rx="2" fill="#92400e" />
        <rect x="3" y="11" width="18" height="11" rx="3" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.5" />
      </g>
      <path d="M38 9l3-3M39 14h5M36 5V1" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  wheel: (
    <>
      <circle cx="24" cy="25" r="21" fill="#b45309" stroke="#78350f" strokeWidth="2" />
      <path d="M24 25L24 8A17 17 0 0 1 36.02 12.98z" fill="#facc15" />
      <path d="M24 25L36.02 12.98A17 17 0 0 1 41 25z" fill="#38bdf8" />
      <path d="M24 25L41 25A17 17 0 0 1 36.02 37.02z" fill="#f97316" />
      <path d="M24 25L36.02 37.02A17 17 0 0 1 24 42z" fill="#f43f5e" />
      <path d="M24 25L24 42A17 17 0 0 1 11.98 37.02z" fill="#a855f7" />
      <path d="M24 25L11.98 37.02A17 17 0 0 1 7 25z" fill="#22c55e" />
      <path d="M24 25L7 25A17 17 0 0 1 11.98 12.98z" fill="#ec4899" />
      <path d="M24 25L11.98 12.98A17 17 0 0 1 24 8z" fill="#3b82f6" />
      <Ball x={24} y={25} r={5.5} />
      <path d="M19 1h10l-5 10z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.5" strokeLinejoin="round" />
    </>
  ),
  eggs: (
    <>
      <ellipse cx="24" cy="41" rx="17" ry="5" fill="#92400e" />
      <path d="M8 39q16 8 32 0" stroke="#fbbf24" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M24 5C33 5 39 20 39 29C39 37 32.5 42 24 42C15.5 42 9 37 9 29C9 20 15 5 24 5Z" fill="#fffbeb" stroke="#b45309" strokeWidth="1.8" />
      <path d="M15 22l3-5 3 5z" fill="#ef4444" />
      <path d="M27 14l2.5 4.5 2.5-4.5z" fill="#3b82f6" />
      <path d="M28 33l3-5 3 5z" fill="#ef4444" />
      <path d="M14 33l2.5-4 2.5 4z" fill="#3b82f6" />
      <path d="M10 27l5-3 4 4 5-4 5 4 4-4 5 3" stroke="#422006" strokeWidth="1.8" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <ellipse cx="18" cy="12" rx="2.5" ry="4" fill="#fff" opacity="0.7" transform="rotate(20 18 12)" />
      <path d="M40 6l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#fde047" stroke="#ca8a04" strokeWidth="0.6" />
      <Ball x={9} y={10} r={5} />
    </>
  ),
  darts: (
    <>
      <rect x="4" y="6" width="40" height="36" rx="6" fill="#b7793f" stroke="#7c2d12" strokeWidth="2" />
      <ellipse cx="16" cy="18" rx="7" ry="8" fill="#ef4444" />
      <ellipse cx="32" cy="17" rx="7" ry="8" fill="#facc15" />
      <ellipse cx="22" cy="32" rx="7" ry="8" fill="#3b82f6" />
      <ellipse cx="14" cy="15" rx="1.6" ry="2.6" fill="#fff" opacity="0.7" />
      <ellipse cx="30" cy="14" rx="1.6" ry="2.6" fill="#fff" opacity="0.7" />
      <path d="M37 8l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#fff" />
      <Ball x={22} y={32} r={3.5} />
      <path d="M44 44L30 26" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M30 26l-4-5 6 2z" fill="#cbd5e1" />
      <path d="M44 44l-6-1 3-3zM44 44l-1-6-3 3z" fill="#ef4444" />
    </>
  ),
  watergun: (
    <>
      <circle cx="15" cy="13" r="9" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.5" />
      <ellipse cx="12" cy="10" rx="2" ry="3" fill="#fff" opacity="0.7" />
      <path d="M15 22l-2 3h4z" fill="#0369a1" />
      <Ball x={33} y={26} r={9} />
      <path d="M7 44Q17 29 27 28" stroke="#7dd3fc" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M7 44Q17 29 27 28" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="38" cy="39" r="1.8" fill="#bae6fd" />
      <circle cx="43" cy="34" r="1.4" fill="#bae6fd" />
      <circle cx="27" cy="36" r="1.5" fill="#bae6fd" />
    </>
  ),
  skeeball: (
    <>
      <path d="M5 46L16 23h16l11 23z" fill="#f59e0b" stroke="#92400e" strokeWidth="1.5" />
      <path d="M24 24v22" stroke="#fde68a" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="24" cy="12" r="10.5" fill="#1e1b4b" />
      <circle cx="24" cy="13" r="8" fill="none" stroke="#22c55e" strokeWidth="1.8" />
      <circle cx="24" cy="13" r="4.5" fill="none" stroke="#a855f7" strokeWidth="1.8" />
      <circle cx="24" cy="5.5" r="1.8" fill="#f59e0b" />
      <circle cx="16" cy="5" r="1.5" fill="#ef4444" />
      <circle cx="32" cy="5" r="1.5" fill="#ef4444" />
      <Ball x={24} y={38} r={6} />
    </>
  ),
  ghosthouse: (
    <>
      <rect x="4" y="6" width="40" height="38" rx="8" fill="#2e1065" />
      <path d="M30 8a10 10 0 0 1 10 10v26H20V18A10 10 0 0 1 30 8z" fill="#1e3a8a" stroke="#78350f" strokeWidth="2" />
      <circle cx="35" cy="15" r="3" fill="#fef9c3" />
      <path d="M6 40L26 20l8 14z" fill="#fef08a" opacity="0.35" />
      <path d="M12 30a9 9 0 0 1 18 0v8l-3-2-3 2-3-2-3 2-3-2-3 2z" fill="#7c3aed" />
      <ellipse cx="18" cy="28" rx="2" ry="2.6" fill="#fff" />
      <ellipse cx="24" cy="28" rx="2" ry="2.6" fill="#fff" />
      <path d="M17 33q4 3 8 0" stroke="#fff" strokeWidth="1.5" fill="none" />
      <Ball x={38} y={38} r={5} />
    </>
  ),
  coaster: (
    <>
      <rect x="2" y="4" width="44" height="40" rx="8" fill="#7dd3fc" />
      <circle cx="38" cy="12" r="4" fill="#fde047" />
      <path d="M2 38q10-26 20-10t12-6 12 4" fill="none" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
      <path d="M8 38v6M14 27v17M22 28v16M30 23v21M38 21v23" stroke="#e2e8f0" strokeWidth="1.5" />
      <rect x="12" y="15" width="12" height="7" rx="2" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.2" transform="rotate(-30 18 18)" />
      <path d="M15 12l2-4 2 3 2-3 1 4" fill="#facc15" stroke="#a16207" strokeWidth="1" />
      <path d="M34 30l2 4 4 .5-3 3 .8 4-3.8-2-3.8 2 .8-4-3-3 4-.5z" fill="#fde047" stroke="#ca8a04" strokeWidth="1" />
      <Ball x={40} y={40} r={4} />
    </>
  ),
  weigh: (
    <>
      <rect x="4" y="4" width="40" height="40" rx="8" fill="#a21caf" />
      <path d="M8 18L40 12" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 16v22h4V15z" fill="#facc15" />
      <path d="M16 42h16l-2-5H18z" fill="#ef4444" />
      <path d="M2 27h12a6 3 0 0 1-12 0zM34 21h12a6 3 0 0 1-12 0z" fill="#fcd34d" stroke="#78350f" strokeWidth="1" />
      <circle cx="40" cy="15" r="5" fill="#0f766e" />
      <path d="M37 14h2M41 14h2" stroke="#fef3c7" strokeWidth="1" />
      <circle cx="8" cy="23" r="2.5" fill="#facc15" />
      <Ball x={24} y={15} r={4} />
    </>
  ),
  candy: (
    <>
      <path d="M24 30v15" stroke="#e7e5e4" strokeWidth="3" strokeLinecap="round" />
      <circle cx="17" cy="19" r="10" fill="#f472b6" />
      <circle cx="30" cy="17" r="11" fill="#60a5fa" />
      <circle cx="24" cy="26" r="10" fill="#f9a8d4" />
      <circle cx="22" cy="12" r="8" fill="#a78bfa" />
      <circle cx="19" cy="14" r="4" fill="#fff" opacity="0.6" />
      <path d="M33 23l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" fill="#fff" />
      <Ball x={24} y={44} r={3.5} />
    </>
  ),
  trampoline: (
    <>
      <path d="M8 40l3 6M40 40l-3 6" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="24" cy="39" rx="19" ry="5" fill="#f9a8d4" stroke="#2563eb" strokeWidth="3" />
      <path d="M17 38q7 4 14 0" stroke="#db2777" strokeWidth="1.5" fill="none" />
      <circle cx="24" cy="16" r="10" fill="#f9a8d4" stroke="#db2777" strokeWidth="1.5" />
      <path d="M21 8q3-4 5 0q-3 1-2 4" stroke="#db2777" strokeWidth="1.5" fill="#f9a8d4" />
      <circle cx="20.5" cy="16" r="2.6" fill="#fff" />
      <circle cx="27.5" cy="16" r="2.6" fill="#fff" />
      <circle cx="20.8" cy="16.3" r="1.5" fill="#1e3a8a" />
      <circle cx="27.8" cy="16.3" r="1.5" fill="#1e3a8a" />
      <path d="M9 12a17 17 0 0 1 6-7" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M39 12a17 17 0 0 0-6-7" stroke="#fde047" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M24 29v4M20 31l4 3 4-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
    </>
  ),
  ferris: (
    <>
      <path d="M20 22L10 46M20 22l10 24" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
      <circle cx="20" cy="22" r="15" fill="none" stroke="#ec4899" strokeWidth="3" />
      <path d="M5 22h30M20 7v30M9.4 11.4l21.2 21.2M30.6 11.4L9.4 32.6" stroke="#fce7f3" strokeWidth="1.3" />
      <rect x="16" y="37" width="8" height="6" rx="2" fill="#fbbf24" />
      <rect x="31" y="21" width="7" height="5" rx="2" fill="#38bdf8" />
      <rect x="3" y="21" width="7" height="5" rx="2" fill="#4ade80" />
      <rect x="16.5" y="3" width="7" height="5" rx="2" fill="#a78bfa" />
      <Ball x={20} y={22} r={3.5} />
      <circle cx="38" cy="36" r="6" fill="#e0f2fe" fillOpacity="0.5" stroke="#1e293b" strokeWidth="2.5" />
      <path d="M42.5 40.5l4 4" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  quest: (
    <>
      <path d="M4 40c6-9 13-11 20-9s13 2 20-6v19H4z" fill="#4ade80" />
      <path d="M4 44c8-5 16-6 24-3s11 1 16-2v5H4z" fill="#22c55e" />
      <path d="M10 44c4-6 9-9 14-9" stroke="#d6b27a" strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="38" cy="10" r="5" fill="#fde047" />
      <ellipse cx="22" cy="42" rx="8" ry="2" fill="rgba(0,0,0,0.25)" />
      <rect x="17" y="34" width="4" height="8" rx="1.5" fill="#1e3a8a" />
      <rect x="23" y="34" width="4" height="8" rx="1.5" fill="#1e3a8a" />
      <rect x="13" y="23" width="18" height="12" rx="4" fill="#facc15" />
      <rect x="15" y="22" width="14" height="14" rx="5" fill="#2563eb" />
      <rect x="21.2" y="22.5" width="1.6" height="13" fill="#ffffff" />
      <circle cx="22" cy="16" r="7" fill="#fcd9b8" />
      <circle cx="19.5" cy="16.5" r="1" fill="#1f2937" />
      <circle cx="24.5" cy="16.5" r="1" fill="#1f2937" />
      <path d="M20.2 19.4q1.8 1.4 3.6 0" stroke="#9a3412" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <path d="M14.5 14a7.5 7.5 0 0 1 15 0z" fill="#ef4444" />
      <ellipse cx="22" cy="14" rx="8.5" ry="1.8" fill="#b91c1c" />
      <Ball x={22} y={11} r={2.4} />
      <Ball x={37} y={30} r={4} />
      <path d="M40 20l1 2.2 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="#fde047" />
    </>
  ),
  snorlax: (
    <>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="#bae6fd" />
      <line x1="24" y1="5" x2="24" y2="13" stroke="#8a5527" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="5" r="2" fill="#facc15" />
      <path d="M22 13.5 l2 -2.2 l2 2.2" fill="#16a34a" />
      <circle cx="24" cy="18" r="5" fill="#2563eb" />
      <circle cx="22.3" cy="16.4" r="1.4" fill="#fff" opacity="0.85" />
      <path d="M9 35 L11 24 L18 29 Z M39 35 L37 24 L30 29 Z" fill="#2f6a7a" />
      <ellipse cx="24" cy="38" rx="17" ry="9" fill="#2f6a7a" />
      <ellipse cx="24" cy="36.5" rx="12" ry="7" fill="#f2dfb8" />
      <path d="M18 33.5 h4 M26 33.5 h4" stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="24" cy="39" rx="3.5" ry="2.5" fill="#7f1d1d" />
      <Ball x={40} y={9} r={4} />
    </>
  ),
  run3d: (
    <>
      <path d="M19 8h10l15 36H4z" fill="#d8ad74" />
      <path d="M22.3 8 15 44M25.7 8 33 44" stroke="#fff" strokeWidth="1.4" strokeDasharray="3 2.5" />
      <circle cx="24" cy="13" r="2.6" fill="#facc15" stroke="#b45309" strokeWidth="1" />
      <circle cx="24" cy="20" r="3.2" fill="#facc15" stroke="#b45309" strokeWidth="1" />
      <path d="M15.5 31l-3-8 6 5zM32.5 31l3-8-6 5z" fill="#facc15" stroke="#1f2937" strokeWidth="1" strokeLinejoin="round" />
      <path d="M12.6 23l1.2 3.2M35.4 23l-1.2 3.2" stroke="#1f2937" strokeWidth="1.6" />
      <Ball x={24} y={35} r={7} />
      <path d="M6 14h7M4 19h6M35 14h7M38 19h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    </>
  ),
  sky3d: (
    <>
      <defs><linearGradient id="sky3dBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#fdba74" /></linearGradient></defs>
      <rect x="2" y="2" width="44" height="44" rx="12" fill="url(#sky3dBg)" />
      <ellipse cx="14" cy="13" rx="7" ry="3.5" fill="#fff" opacity="0.9" />
      <ellipse cx="33" cy="24" rx="9" ry="11" fill="none" stroke="#fde047" strokeWidth="3.5" />
      <path d="M8 34c6-9 12-11 17-9l6-7 1 9c3 1 5 3 6 6-6-2-11-1-15 2-4-3-9-3-15-1z" fill="#f97316" stroke="#9a3412" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M25 25l6-7 1 9z" fill="#14b8a6" stroke="#0f766e" strokeWidth="1" />
      <path d="M38 33c2-2 3-4 2-6" stroke="#facc15" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Ball x={21} y={20} r={3.6} />
    </>
  ),
  island3d: (
    <>
      <rect x="2" y="30" width="44" height="16" rx="6" fill="#38bdf8" />
      <path d="M4 36q5-3 10 0t10 0 10 0 10 0" stroke="#e0f2fe" strokeWidth="2" fill="none" />
      <path d="M8 32l16-8 16 8-16 8z" fill="#6cc24a" />
      <path d="M8 32v6l16 8v-6z" fill="#9b6b3f" />
      <path d="M40 32v6l-16 8v-6z" fill="#8a5d35" />
      <rect x="15" y="14" width="10" height="10" fill="#c8553d" />
      <path d="M13 15l7-7 7 7z" fill="#c99a5b" />
      <rect x="18.5" y="18" width="3" height="6" fill="#7c2d12" />
      <circle cx="31" cy="12" r="2.4" fill="#fde047" />
      <Ball x={33} y={24} r={5} />
    </>
  ),
  towerdef: (
    <>
      <path d="M6 40 Q14 30 24 34 T42 28" fill="none" stroke="#c2894b" strokeWidth="6" strokeLinecap="round" />
      <rect x="27" y="8" width="16" height="12" rx="2" fill="#fff7ed" stroke="#1f2937" strokeWidth="1.2" />
      <path d="M25 9 L35 2 L45 9 Z" fill="#ef4444" stroke="#1f2937" strokeWidth="1.2" />
      <rect x="33" y="13" width="4" height="7" fill="#38bdf8" />
      <path d="M10 6 L20 10 V18 C20 24 15 27 10 29 C5 27 0 24 0 18 V10 Z" transform="translate(2 4)" fill="#3b82f6" stroke="#1e3a8a" strokeWidth="1.4" />
      <path d="M12 14 L10 20 H13 L11 26 L17 18 H14 L16 14 Z" fill="#fde047" stroke="#a16207" strokeWidth="0.8" />
      <Ball x={24} y={38} r={6} />
      <path d="M40 34 l1.5 3 3 .5 -2.2 2 .6 3 -2.9-1.5 -2.9 1.5 .6-3 -2.2-2 3-.5z" fill="#fde047" />
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
