import React from 'react';
import { BERRIES } from '../utils/friendship';

/** Round berry with a leaf, matching how berries are drawn in the runner game. */
export function BerryIcon({ type = 'oran', className = 'w-5 h-5' }) {
  const berry = BERRIES[type] || BERRIES.oran;
  return (
    <span aria-hidden="true" className={`relative inline-block shrink-0 ${className}`}>
      <span className={`absolute inset-0 rounded-full ${berry.color} shadow-inner`} />
      <span className="absolute left-[22%] top-[22%] w-[28%] h-[28%] rounded-full bg-white/60" />
      <span className="absolute -top-[18%] right-[8%] w-[45%] h-[28%] rounded-full bg-green-500 rotate-[-25deg]" />
    </span>
  );
}
