import React, { useId } from 'react';
import { themeFor } from '../utils/typeTheme';

// A scene behind a Pokemon's artwork, themed by its type: sky colours, a soft glow, a
// repeating motif (flames, waves, leaves...) and a little ground the Pokemon stands on.


// Motifs drawn inside a 40x40 tile
const MOTIFS = {
  flame: <path d="M20 6c4 6 9 9 9 16a9 9 0 0 1-18 0c0-5 3-7 4-11 1 3 2 4 4 5 0-4-1-7 1-10z" />,
  wave: <path d="M0 22q5-6 10 0t10 0 10 0 10 0" fill="none" strokeWidth="2.5" strokeLinecap="round" />,
  leaf: <path d="M8 30C8 16 18 8 32 8c0 14-8 24-24 22zM10 28 26 12" strokeWidth="1.5" />,
  bolt: <path d="M22 4 10 22h8l-4 14 14-20h-8z" />,
  swirl: <path d="M20 20m-2 0a2 2 0 1 1 4 0a5 5 0 1 1-10 0a8 8 0 1 1 16 0a11 11 0 1 1-22 0" fill="none" strokeWidth="2" strokeLinecap="round" />,
  snow: <path d="M20 6v28M8 13l24 14M8 27l24-14M16 8l4 4 4-4M16 32l4-4 4 4" fill="none" strokeWidth="2" strokeLinecap="round" />,
  scale: <path d="M0 20a10 10 0 0 1 20 0a10 10 0 0 1 20 0M10 40a10 10 0 0 1 20 0" fill="none" strokeWidth="2" />,
  moon: <path d="M24 8a12 12 0 1 0 8 20A10 10 0 1 1 24 8z" />,
  sparkle: <path d="M20 6l3 11 11 3-11 3-3 11-3-11-11-3 11-3z" />,
  burst: <path d="M20 4l4 10 10-4-6 9 9 5-11 1 2 11-8-8-8 8 2-11-11-1 9-5-6-9 10 4z" />,
  bubble: (
    <>
      <circle cx="14" cy="24" r="7" fill="none" strokeWidth="2" />
      <circle cx="28" cy="12" r="4" fill="none" strokeWidth="2" />
      <circle cx="30" cy="30" r="2.5" />
    </>
  ),
  dune: <path d="M0 28q10-12 20 0t20 0M0 14q10-10 20 0" fill="none" strokeWidth="2.5" strokeLinecap="round" />,
  cloud: <path d="M10 28a6 6 0 0 1 1-12 8 8 0 0 1 15-2 6 6 0 0 1 4 14z" />,
  comb: <path d="M20 6l10 6v12l-10 6-10-6V12z" fill="none" strokeWidth="2" />,
  rock: <path d="M8 30l5-12 9-4 10 7 2 9z" />,
  wisp: <path d="M14 30c-6-6 0-16 8-16 6 0 10 6 6 11 4 0 6 4 2 7-4 2-6-2-8 0-3 2-5 1-8-2z" />,
  rivet: (
    <>
      <rect x="4" y="4" width="32" height="32" rx="3" fill="none" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="1.8" />
      <circle cx="31" cy="9" r="1.8" />
      <circle cx="9" cy="31" r="1.8" />
      <circle cx="31" cy="31" r="1.8" />
    </>
  ),
  dot: <circle cx="20" cy="20" r="3" />,
};

export function TypeBackdrop({ types, className = '' }) {
  const id = useId().replace(/:/g, '');
  const list = Array.isArray(types) ? types : [types];
  const main = themeFor(list);
  // A second type tints the lower half of the sky
  const second = list.length > 1 ? themeFor(list.slice(1)) : null;
  const typeName = String(list[0] || 'normal').toLowerCase();
  return (
    <svg className={`absolute inset-0 w-full h-full ${className}`} viewBox="0 0 63 88" preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-type={typeName}>
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={main.sky[0]} />
          <stop offset="0.5" stopColor={main.sky[1]} />
          <stop offset="1" stopColor={second ? second.sky[2] : main.sky[2]} />
        </linearGradient>
        <radialGradient id={`glow${id}`} cx="0.5" cy="0.45" r="0.5">
          <stop offset="0" stopColor={main.glow} stopOpacity="0.85" />
          <stop offset="1" stopColor={main.glow} stopOpacity="0" />
        </radialGradient>
        <pattern id={`motif${id}`} width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
          <g transform="scale(0.5)" fill={main.ink} stroke={main.ink}>
            {MOTIFS[main.motif]}
          </g>
        </pattern>
        <radialGradient id={`ground${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={main.ground} stopOpacity="0.55" />
          <stop offset="1" stopColor={main.ground} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="63" height="88" fill={`url(#sky${id})`} />
      <rect width="63" height="88" fill={`url(#motif${id})`} opacity="0.22" />
      <ellipse cx="31.5" cy="40" rx="34" ry="30" fill={`url(#glow${id})`} />
      {/* Ground the Pokemon stands on */}
      <ellipse cx="31.5" cy="74" rx="26" ry="6" fill={`url(#ground${id})`} />
      {/* Soft frame light at the top */}
      <rect width="63" height="88" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.2" />
    </svg>
  );
}
