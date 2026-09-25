import React from 'react';

/**
 * Pokeball drawn in SVG. `spin` rotates it (loading), `glow` adds a soft halo.
 * Colours can be overridden (e.g. white outline on red buttons).
 */
export function PokeballIcon({ className = 'w-5 h-5', spin = false, top = '#ef4444', bottom = '#ffffff', line = '#111827', title }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${className} ${spin ? 'animate-spin' : ''} shrink-0`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <circle cx="32" cy="32" r="29" fill={bottom} stroke={line} strokeWidth="5" />
      <path d="M3 32a29 29 0 0 1 58 0z" fill={top} stroke={line} strokeWidth="5" strokeLinejoin="round" />
      <path d="M8 22c4-9 12-15 22-16" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
      <line x1="3" y1="32" x2="61" y2="32" stroke={line} strokeWidth="5" />
      <circle cx="32" cy="32" r="10" fill={bottom} stroke={line} strokeWidth="5" />
      <circle cx="32" cy="32" r="4" fill={line} opacity="0.15" />
    </svg>
  );
}
