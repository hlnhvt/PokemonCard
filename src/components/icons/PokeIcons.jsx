import React, { useId } from 'react';

// Pokemon-style icon set, drawn in SVG. Same names and props as the lucide icons they
// replace (className, style...), so a file only changes its import. Lines use currentColor;
// the Pokemon parts keep their own colours: Pokeball red and white, Pikachu's yellow bolt,
// Charmander's flame, the evolution stones, the Pokedex, Rotom phone, gym badges.

const RED = '#ef4444';
const WHITE = '#ffffff';
const INK = '#1f2937';

function Svg({ className = 'w-5 h-5', children, ...props }) {
  // lucide-only props (strokeWidth, size, color) are not used by these drawings
  const { strokeWidth: _sw, size: _size, color: _color, ...rest } = props;
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

/** A small Pokeball at (x, y) with radius r. */
export function Ball({ x = 12, y = 12, r = 4, top = RED, bottom = WHITE, line = INK }) {
  const w = Math.max(0.8, r * 0.22);
  return (
    <g stroke={line} strokeWidth={w}>
      <circle cx={x} cy={y} r={r} fill={bottom} />
      <path d={`M${x - r} ${y}a${r} ${r} 0 0 1 ${r * 2} 0z`} fill={top} />
      <line x1={x - r} y1={y} x2={x + r} y2={y} />
      <circle cx={x} cy={y} r={r * 0.34} fill={bottom} />
    </g>
  );
}

// ---------- actions ----------
export const X = (p) => (
  <Svg {...p}>
    <path d="M5 5l14 14M19 5L5 19" />
    <Ball r={3.6} />
  </Svg>
);
export const Check = (p) => (
  <Svg {...p}>
    <path d="M4 13l5 5L20 6" />
    <Ball x={9} y={18} r={2.4} />
  </Svg>
);
export const CheckCircle = (p) => (
  <Svg {...p}>
    <Ball r={10} />
    <path d="M7 12.5l3.2 3.2L17.5 8.5" stroke="#16a34a" strokeWidth={2.6} />
  </Svg>
);
export const Plus = (p) => (
  <Svg {...p}>
    <path d="M12 3v18M3 12h18" />
    <Ball r={3.4} />
  </Svg>
);
export const Play = (p) => (
  <Svg {...p}>
    <Ball r={10} />
    <circle cx="12" cy="12" r="5" fill={WHITE} stroke={INK} strokeWidth="1.6" />
    <path d="M10.6 9.8v4.4l3.6-2.2z" fill={INK} stroke="none" />
  </Svg>
);
const Circular = ({ flip, hands, ...p }) => (
  <Svg {...p}>
    <g transform={flip ? 'translate(24 0) scale(-1 1)' : undefined}>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M3.5 3.5v4.2h4.2" />
    </g>
    <Ball r={3.2} />
    {hands && <path d="M12 12V8.6M12 12l2.4 1.4" stroke={INK} strokeWidth="1.2" />}
  </Svg>
);
export const RotateCcw = (p) => <Circular {...p} />;
export const RotateCw = (p) => <Circular flip {...p} />;
export const RefreshCw = (p) => <Circular flip {...p} />;
export const History = (p) => <Circular hands {...p} />;
const Arrow = ({ rot = 0, ...p }) => (
  <Svg {...p}>
    <g transform={`rotate(${rot} 12 12)`}>
      <path d="M8 12h12M15 6.5l5.5 5.5-5.5 5.5" />
      <Ball x={5} y={12} r={2.8} />
    </g>
  </Svg>
);
export const ArrowRight = (p) => <Arrow {...p} />;
export const ArrowLeft = (p) => <Arrow rot={180} {...p} />;
export const ArrowUp = (p) => <Arrow rot={-90} {...p} />;
export const ArrowDown = (p) => <Arrow rot={90} {...p} />;
export const ChevronRight = (p) => (
  <Svg {...p}>
    <path d="M10 5l7 7-7 7" />
    <Ball x={6} y={12} r={2.2} />
  </Svg>
);
export const SkipForward = (p) => (
  <Svg {...p}>
    <path d="M4 6l7 6-7 6zM12 6l7 6-7 6z" fill="currentColor" />
    <Ball x={20.5} y={12} r={2.4} />
  </Svg>
);
export const ExternalLink = (p) => (
  <Svg {...p}>
    <path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5M14 3h7v7M10 14L21 3" />
    <Ball x={8} y={16} r={2.6} />
  </Svg>
);
export const Search = (p) => (
  <Svg {...p}>
    <path d="M15.5 15.5L21 21" strokeWidth={3} />
    <Ball x={10} y={10} r={6.8} />
  </Svg>
);
export const Share2 = (p) => (
  <Svg {...p}>
    <path d="M8 11l8-4M8 13l8 4" />
    <Ball x={5.5} y={12} r={3} />
    <Ball x={18.5} y={5.5} r={3} />
    <Ball x={18.5} y={18.5} r={3} />
  </Svg>
);
export const Edit3 = (p) => (
  <Svg {...p}>
    <path d="M4 20l1-4L16 5l3 3L8 19z" />
    <path d="M4 22h16" />
    <Ball x={18.3} y={5.7} r={2.6} />
  </Svg>
);
export const Trash2 = (p) => (
  <Svg {...p}>
    <path d="M3 6h18M8 6V4h8v2M5 6l1 15h12l1-15" />
    <Ball x={12} y={13.5} r={3.4} />
  </Svg>
);
export const FlipHorizontal = (p) => (
  <Svg {...p}>
    <path d="M12 3v18" strokeDasharray="2 2.5" />
    <path d="M9 7L3 12l6 5zM15 7l6 5-6 5z" />
    <Ball x={6} y={12} r={2} />
  </Svg>
);
export const Image = (p) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 17l5-5 4 4 3-3 6 6" />
    <Ball x={16} y={8.5} r={2.5} />
  </Svg>
);

// ---------- things ----------
export const Swords = (p) => (
  <Svg {...p}>
    <Ball x={7.5} y={14} r={5.5} />
    <Ball x={16.5} y={14} r={5.5} top="#3b82f6" />
    <path d="M12 2l-1.6 3.6h3.2L12 9.5" stroke="#f59e0b" strokeWidth="1.8" />
  </Svg>
);
/** Pikachu's tail: a yellow lightning bolt with a brown base. */
export const Zap = (p) => (
  <Svg {...p}>
    <path d="M3 21l5-5-2-2 6-5-2-2 10-5-6 7 2 2-6 5 2 2z" fill="#facc15" stroke="#a16207" strokeWidth="1.3" />
    <path d="M3 21l5-5-2-2 2.5-2" fill="none" stroke="#92400e" strokeWidth="2" />
  </Svg>
);
/** Charmander's tail flame. */
export const Flame = (p) => (
  <Svg {...p}>
    <path d="M12 2c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-3 1-6 1-9z" fill="#f97316" stroke="#c2410c" strokeWidth="1.3" />
    <path d="M12 12c1.5 1.5 3 2.5 3 4.5a3 3 0 0 1-6 0c0-1.5 1-2 1.5-3 .5.8.8 1.3 1 2 .3-1.3.5-2.3.5-3.5z" fill="#fde047" stroke="none" />
  </Svg>
);
/** A Pokeball-coloured heart. */
export const Heart = (p) => {
  const id = useId();
  return (
    <Svg {...p}>
      <defs>
        <clipPath id={id}>
          <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`} stroke="none">
        <rect x="0" y="0" width="24" height="12" fill={RED} />
        <rect x="0" y="12" width="24" height="12" fill={WHITE} />
      </g>
      <path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z" stroke={INK} strokeWidth="1.5" />
      <path d="M4.3 12h15.4" stroke={INK} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2" fill={WHITE} stroke={INK} strokeWidth="1.3" />
    </Svg>
  );
};
export const Star = (p) => (
  <Svg {...p}>
    <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill="#facc15" stroke="#b45309" strokeWidth="1.3" />
    <Ball x={12} y={11.6} r={2.6} />
  </Svg>
);
/** The shiny sparkle. */
export const Sparkles = (p) => (
  <Svg {...p}>
    <path d="M10 2l1.6 5.4L17 9l-5.4 1.6L10 16l-1.6-5.4L3 9l5.4-1.6z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.1" />
    <path d="M18 13l.9 2.6 2.6.9-2.6.9L18 20l-.9-2.6-2.6-.9 2.6-.9z" fill="#f9a8d4" stroke="#db2777" strokeWidth="0.9" />
    <path d="M19 2.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z" fill="#a5f3fc" stroke="#0891b2" strokeWidth="0.7" />
  </Svg>
);
export const Lock = (p) => (
  <Svg {...p}>
    <path d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11" />
    <rect x="4.5" y="11" width="15" height="10.5" rx="2.5" fill={WHITE} stroke={INK} strokeWidth="1.6" />
    <path d="M4.5 13.5a2.5 2.5 0 0 1 2.5-2.5h10a2.5 2.5 0 0 1 2.5 2.5V16h-15z" fill={RED} stroke={INK} strokeWidth="1.6" />
    <circle cx="12" cy="16" r="2" fill={WHITE} stroke={INK} strokeWidth="1.4" />
  </Svg>
);
export const Lightbulb = (p) => (
  <Svg {...p}>
    <path d="M9.5 18h5M10 21h4" />
    <Ball x={12} y={9.5} r={6.5} />
    <path d="M12 1.2v-.7M4.2 4.2l-.6-.6M19.8 4.2l.6-.6" stroke="#facc15" />
  </Svg>
);
export const Trophy = (p) => (
  <Svg {...p}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" fill="#facc15" stroke="#b45309" strokeWidth="1.4" />
    <path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8l-1-3H9z" stroke="#b45309" strokeWidth="1.4" />
    <Ball x={12} y={8} r={2.5} />
  </Svg>
);
/** A gym badge. */
export const Award = (p) => (
  <Svg {...p}>
    <path d="M12 2l6.5 3.5v7L12 22l-6.5-9.5v-7z" fill="#94a3b8" stroke="#334155" strokeWidth="1.4" />
    <path d="M12 2v20M5.5 5.5L12 9l6.5-3.5M5.5 12.5L12 9l6.5 3.5" stroke="#e2e8f0" strokeWidth="1" />
  </Svg>
);
export const Bookmark = (p) => (
  <Svg {...p}>
    <path d="M6 3h12v18l-6-4-6 4z" fill={RED} stroke={INK} strokeWidth="1.4" />
    <Ball x={12} y={9.5} r={3.2} top={WHITE} />
  </Svg>
);
export const Settings = (p) => (
  <Svg {...p}>
    <path d="M12 1.8l1.6 2.3 2.7-.7.7 2.7 2.7.7-.7 2.7 2.3 1.6-2.3 1.6.7 2.7-2.7.7-.7 2.7-2.7-.7L12 22.2l-1.6-2.3-2.7.7-.7-2.7-2.7-.7.7-2.7L1.8 12l2.3-1.6-.7-2.7 2.7-.7.7-2.7 2.7.7z" />
    <Ball r={5} />
  </Svg>
);
export const Music = (p) => (
  <Svg {...p}>
    <path d="M9 18V5l11-2v13" />
    <Ball x={6} y={18} r={3.2} />
    <Ball x={17} y={16} r={3.2} />
  </Svg>
);
export const Volume2 = (p) => (
  <Svg {...p}>
    <Ball x={7} y={12} r={5} />
    <path d="M15 8.5a5 5 0 0 1 0 7M18 5.5a9 9 0 0 1 0 13" />
  </Svg>
);
export const VolumeX = (p) => (
  <Svg {...p}>
    <Ball x={7} y={12} r={5} />
    <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
  </Svg>
);
export const Gamepad2 = (p) => (
  <Svg {...p}>
    <path d="M6 7h12a4 4 0 0 1 4 4v3.5a3.5 3.5 0 0 1-6.2 2.2L14.5 15h-5l-1.3 1.7A3.5 3.5 0 0 1 2 14.5V11a4 4 0 0 1 4-4z" />
    <path d="M6.5 10v3.5M4.8 11.8h3.5" />
    <circle cx="17.5" cy="10.5" r="1" fill="currentColor" />
    <circle cx="19.2" cy="12.6" r="1" fill="currentColor" />
    <Ball x={12} y={11.5} r={2.4} />
  </Svg>
);
export const Clock = (p) => (
  <Svg {...p}>
    <Ball r={10} />
    <path d="M12 12V6.5M12 12l3.5 2" stroke={INK} strokeWidth="1.8" />
  </Svg>
);
export const Camera = (p) => (
  <Svg {...p}>
    <path d="M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Ball x={12} y={13} r={4.5} />
  </Svg>
);
/** The Pokédex. */
export const BookOpen = (p) => (
  <Svg {...p}>
    <rect x="3" y="2.5" width="18" height="19" rx="2.5" fill={RED} stroke={INK} strokeWidth="1.4" />
    <path d="M3 8.5h18" stroke={INK} strokeWidth="1.2" />
    <circle cx="7" cy="5.5" r="2" fill="#38bdf8" stroke={WHITE} strokeWidth="1" />
    <circle cx="11" cy="5" r="0.9" fill="#fde047" stroke="none" />
    <circle cx="13.5" cy="5" r="0.9" fill="#22c55e" stroke="none" />
    <rect x="6" y="11" width="12" height="7" rx="1" fill="#bbf7d0" stroke={INK} strokeWidth="1.1" />
  </Svg>
);
/** Moon Stone. */
export const Moon = (p) => (
  <Svg {...p}>
    <path d="M12 2.5c4.5 0 8 3.5 8.5 7.8.6 5-3.5 11.2-8.8 11.2S3 17.2 3.5 11.8C4 6.8 7.5 2.5 12 2.5z" fill="#475569" stroke="#1e293b" strokeWidth="1.3" />
    <path d="M14.5 7a4.5 4.5 0 1 0 2.5 7.5 5 5 0 1 1-2.5-7.5z" fill="#e2e8f0" stroke="none" />
    <path d="M7.5 8l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z" fill="#fde047" stroke="none" />
  </Svg>
);
/** Sun Stone. */
export const Sun = (p) => (
  <Svg {...p}>
    <path d="M12 1.5l2 4 4.3-1.2-1.2 4.3 4 2-4 2 1.2 4.3-4.3-1.2-2 4-2-4-4.3 1.2 1.2-4.3-4-2 4-2-1.2-4.3 4.3 1.2z" fill="#fb923c" stroke="#c2410c" strokeWidth="1.2" />
    <circle cx="12" cy="11.6" r="3.6" fill="#dc2626" stroke="#fde047" strokeWidth="1.2" />
  </Svg>
);
/** Water Stone. */
export const Waves = (p) => (
  <Svg {...p}>
    <path d="M12 2l7 6.5-2.5 11.5h-9L5 8.5z" fill="#38bdf8" stroke="#1d4ed8" strokeWidth="1.3" />
    <path d="M7.5 12c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0" stroke="#ffffff" strokeWidth="1.6" />
    <path d="M9 5.5l3 2 3-2" stroke="#e0f2fe" strokeWidth="1" />
  </Svg>
);
/** Mystery ball (random). */
export const Dice5 = (p) => (
  <Svg {...p}>
    <Ball r={10} top="#a855f7" />
    <text x="12" y="20.3" fontSize="7" fontWeight="900" textAnchor="middle" fill="#7c3aed" stroke="none">?</text>
  </Svg>
);
export const HelpCircle = (p) => (
  <Svg {...p}>
    <Ball r={10} top="#3b82f6" />
    <text x="12" y="20.3" fontSize="7" fontWeight="900" textAnchor="middle" fill="#1d4ed8" stroke="none">?</text>
  </Svg>
);
export const Target = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6.5" strokeDasharray="3 2" />
    <Ball r={3.5} />
  </Svg>
);
/** A team: three Pokeballs. */
export const Users = (p) => (
  <Svg {...p}>
    <Ball x={12} y={8} r={4.5} />
    <Ball x={6} y={16} r={4.5} top="#3b82f6" />
    <Ball x={18} y={16} r={4.5} top="#facc15" />
  </Svg>
);
/** Poké Mart bag. */
export const ShoppingBag = (p) => (
  <Svg {...p}>
    <path d="M8.5 7V5.5a3.5 3.5 0 0 1 7 0V7" />
    <path d="M4 7h16l-1.2 14H5.2z" fill="#3b82f6" stroke="#1e3a8a" strokeWidth="1.4" />
    <Ball x={12} y={14} r={3.6} />
  </Svg>
);
/** Town map with a Pokeball pin. */
export const Map = (p) => (
  <Svg {...p}>
    <path d="M3 6l6-2.5 6 2.5 6-2.5v14.5L15 20.5l-6-2.5-6 2.5z" fill="#bbf7d0" stroke="#15803d" strokeWidth="1.4" />
    <path d="M9 3.5V18M15 6v14.5" stroke="#15803d" strokeWidth="1" />
    <Ball x={15} y={10} r={3} />
  </Svg>
);
export const Hand = (p) => (
  <Svg {...p}>
    <path d="M4 14c2 0 3 1 4 2h4a2 2 0 0 0 0-4H9M3 21l3-3h7l7-5a1.6 1.6 0 0 0-2.2-2.3L14 13" />
    <Ball x={15} y={6} r={4} />
  </Svg>
);
/** Evolution: growing forms joined by arrows. */
export const GitBranch = (p) => (
  <Svg {...p}>
    <circle cx="4" cy="16" r="2" fill="#86efac" stroke="#15803d" strokeWidth="1.2" />
    <path d="M6.5 14.5l2.5-2" />
    <circle cx="11.5" cy="11" r="3" fill="#4ade80" stroke="#15803d" strokeWidth="1.2" />
    <path d="M15 9l1.8-1.5" />
    <circle cx="19.5" cy="6" r="3.5" fill="#16a34a" stroke="#14532d" strokeWidth="1.2" />
  </Svg>
);
/** Rotom phone. */
export const Smartphone = (p) => (
  <Svg {...p}>
    <rect x="5" y="2" width="14" height="20" rx="3.5" fill={RED} stroke={INK} strokeWidth="1.4" />
    <ellipse cx="9.5" cy="9" rx="1.8" ry="2.4" fill="#7dd3fc" stroke={WHITE} strokeWidth="0.9" />
    <ellipse cx="14.5" cy="9" rx="1.8" ry="2.4" fill="#7dd3fc" stroke={WHITE} strokeWidth="0.9" />
    <path d="M9.5 15.5q2.5 1.5 5 0" stroke={WHITE} strokeWidth="1.3" />
  </Svg>
);
export const AlertTriangle = (p) => (
  <Svg {...p}>
    <path d="M12 2.5L22 20.5H2z" fill="#fde047" stroke={INK} strokeWidth="1.5" />
    <path d="M12 9v5" stroke={INK} strokeWidth="2.4" />
    <Ball x={12} y={17.3} r={1.7} />
  </Svg>
);
export const AlertCircle = (p) => (
  <Svg {...p}>
    <Ball r={10} />
    <path d="M12 16.5v.1M12 13.5v-.1" stroke={INK} strokeWidth="2.2" />
  </Svg>
);
export const ShieldAlert = (p) => (
  <Svg {...p}>
    <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="#fee2e2" stroke={INK} strokeWidth="1.4" />
    <Ball x={12} y={11.5} r={4.2} />
  </Svg>
);
