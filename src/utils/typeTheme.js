// Colours of the scene behind a Pokemon's artwork, by type (used by TypeBackdrop).
export const TYPE_THEMES = {
  fire: { sky: ['#fde68a', '#fb923c', '#dc2626'], glow: '#fff7ed', ground: '#9a3412', motif: 'flame', ink: '#fff7ed' },
  water: { sky: ['#a5f3fc', '#38bdf8', '#1d4ed8'], glow: '#ecfeff', ground: '#1e40af', motif: 'wave', ink: '#e0f2fe' },
  grass: { sky: ['#d9f99d', '#4ade80', '#15803d'], glow: '#f7fee7', ground: '#166534', motif: 'leaf', ink: '#ecfccb' },
  electric: { sky: ['#fef9c3', '#facc15', '#ea580c'], glow: '#fffbeb', ground: '#a16207', motif: 'bolt', ink: '#fffbeb' },
  psychic: { sky: ['#fbcfe8', '#f472b6', '#9333ea'], glow: '#fdf4ff', ground: '#86198f', motif: 'swirl', ink: '#fdf4ff' },
  ice: { sky: ['#f0f9ff', '#a5f3fc', '#60a5fa'], glow: '#ffffff', ground: '#bae6fd', motif: 'snow', ink: '#ffffff' },
  dragon: { sky: ['#c7d2fe', '#6366f1', '#312e81'], glow: '#eef2ff', ground: '#3730a3', motif: 'scale', ink: '#e0e7ff' },
  dark: { sky: ['#6b7280', '#374151', '#111827'], glow: '#fde68a', ground: '#030712', motif: 'moon', ink: '#fde68a' },
  fairy: { sky: ['#fff1f2', '#fbcfe8', '#f472b6'], glow: '#ffffff', ground: '#db2777', motif: 'sparkle', ink: '#ffffff' },
  fighting: { sky: ['#fed7aa', '#f97316', '#9f1239'], glow: '#fff7ed', ground: '#7c2d12', motif: 'burst', ink: '#ffedd5' },
  poison: { sky: ['#e9d5ff', '#a855f7', '#581c87'], glow: '#faf5ff', ground: '#4c1d95', motif: 'bubble', ink: '#f3e8ff' },
  ground: { sky: ['#fef3c7', '#f59e0b', '#92400e'], glow: '#fffbeb', ground: '#78350f', motif: 'dune', ink: '#fef3c7' },
  flying: { sky: ['#e0f2fe', '#7dd3fc', '#818cf8'], glow: '#ffffff', ground: '#c7d2fe', motif: 'cloud', ink: '#ffffff' },
  bug: { sky: ['#ecfccb', '#a3e635', '#4d7c0f'], glow: '#f7fee7', ground: '#3f6212', motif: 'comb', ink: '#f7fee7' },
  rock: { sky: ['#e7e5e4', '#a8a29e', '#57534e'], glow: '#fafaf9', ground: '#44403c', motif: 'rock', ink: '#f5f5f4' },
  ghost: { sky: ['#c4b5fd', '#6d28d9', '#1e1b4b'], glow: '#ede9fe', ground: '#1e1b4b', motif: 'wisp', ink: '#ede9fe' },
  steel: { sky: ['#f1f5f9', '#94a3b8', '#475569'], glow: '#ffffff', ground: '#334155', motif: 'rivet', ink: '#f8fafc' },
  normal: { sky: ['#fefce8', '#d6d3d1', '#a3a3a3'], glow: '#ffffff', ground: '#78716c', motif: 'dot', ink: '#ffffff' },
};

export const themeFor = (types) => {
  const list = (Array.isArray(types) ? types : [types]).map((t) => String(t || '').toLowerCase());
  return TYPE_THEMES[list.find((t) => TYPE_THEMES[t])] || TYPE_THEMES.normal;
};

/** True for a photo/scan of a real card (it fills the frame); false for transparent artwork. */
export const isCardScan = (src) => /pokemontcg\.io|\/cards?\//i.test(String(src || ''));
