// Painted sprites of the quest scenery: trees (trunk and canopy apart, so leaves can sway),
// pines, rocks, crystals, tower pillars, props (signposts, lamps, tombstones...) and the town
// buildings. Each is drawn once into a small offscreen canvas (cache) with its anchor at the
// base, then stamped with drawImage and depth-sorted with the Pokemon.

const TAU = Math.PI * 2;
export const SPRITE_SCALE = 1.25;

// Colours per theme: leaves / rock / crystal
export const PALETTES = {
  forest: { leafLight: '#a3e635', leaf: '#4ade80', leafMid: '#22a045', leafDark: '#14532d', trunk: '#7c4a21', trunkDark: '#4a2a10', rockLight: '#e7e5e4', rock: '#a8a29e', rockDark: '#57534e', moss: '#65a30d' },
  cave: { leafLight: '#86efac', leaf: '#4ade80', leafMid: '#16a34a', leafDark: '#14532d', trunk: '#6b4423', trunkDark: '#3f2a14', rockLight: '#e3d3b8', rock: '#a38b6d', rockDark: '#4d3d2c', moss: '#7c9a3c' },
  tower: { leafLight: '#c4b5fd', leaf: '#8b5cf6', leafMid: '#6d28d9', leafDark: '#2e1065', trunk: '#44403c', trunkDark: '#1c1917', rockLight: '#a99fd0', rock: '#5f5390', rockDark: '#2a2346', moss: '#6b7280' },
  volcano: { leafLight: '#fde68a', leaf: '#a16207', leafMid: '#713f12', leafDark: '#3b1d0b', trunk: '#3a2a25', trunkDark: '#1a1110', rockLight: '#7c6a64', rock: '#43322d', rockDark: '#1a100e', moss: '#f97316' },
  ice: { leafLight: '#86efac', leaf: '#22c55e', leafMid: '#15803d', leafDark: '#14532d', trunk: '#6b4423', trunkDark: '#3f2a14', rockLight: '#ffffff', rock: '#b9d7ee', rockDark: '#5b8db5', moss: '#ffffff' },
  psychic: { leafLight: '#f5d0fe', leaf: '#c084fc', leafMid: '#7e22ce', leafDark: '#3b0764', trunk: '#312e81', trunkDark: '#1e1b4b', rockLight: '#a5b4fc', rock: '#4f46e5', rockDark: '#1e1b4b', moss: '#e879f9' },
};

function blob(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}
function rr(g, x, y, w, h, r, color) {
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}
// Small deterministic numbers inside a sprite
const rnd = (v, k) => {
  const s = Math.sin(v * 9301 + k * 49297) * 233280;
  return s - Math.floor(s);
};

// ---------- trees ----------

function trunk(g, v, P) {
  const h = 30 + v * 8;
  const grd = g.createLinearGradient(-6, 0, 6, 0);
  grd.addColorStop(0, P.trunkDark);
  grd.addColorStop(0.45, P.trunk);
  grd.addColorStop(1, P.trunkDark);
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(-9, 0);
  g.quadraticCurveTo(-5, -h * 0.4, -5, -h);
  g.lineTo(5, -h);
  g.quadraticCurveTo(5, -h * 0.4, 9, 0);
  g.closePath();
  g.fill();
  // Roots
  g.fillStyle = P.trunkDark;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * 9, -1, 5, 2.5, s * 0.4, 0, TAU);
    g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(1, -4);
  g.lineTo(-1, -h * 0.7);
  g.stroke();
}

function canopy(g, v, P) {
  const R = 30 + v * 7;
  const cy = -38 - R * 0.6;
  const parts = [
    [0, 0.12, 1],
    [-0.55, 0.28, 0.72],
    [0.55, 0.3, 0.74],
    [-0.3, -0.38, 0.72],
    [0.32, -0.36, 0.7],
    [0, -0.62, 0.55],
  ];
  // Shade behind, then the leaf clumps lit from the top left
  for (const [dx, dy, s] of parts) blob(g, dx * R + 3, cy + dy * R + 4, R * s, P.leafDark);
  for (const [dx, dy, s] of parts) {
    const x = dx * R;
    const y = cy + dy * R;
    const grd = g.createRadialGradient(x - R * s * 0.35, y - R * s * 0.4, 1, x, y, R * s);
    grd.addColorStop(0, P.leafLight);
    grd.addColorStop(0.45, P.leaf);
    grd.addColorStop(1, P.leafMid);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, R * s, 0, TAU);
    g.fill();
  }
  // Leaf texture: small bright arcs
  g.strokeStyle = 'rgba(255,255,255,0.28)';
  g.lineWidth = 1.4;
  for (let k = 0; k < 9; k++) {
    const a = rnd(v, k) * TAU;
    const d = rnd(v, k + 20) * R * 0.8;
    const x = Math.cos(a) * d;
    const y = cy + Math.sin(a) * d * 0.8;
    g.beginPath();
    g.arc(x, y, 4, 3.6, 5.2);
    g.stroke();
  }
  // Fruit or blossoms on some trees
  if (v > 0.55) {
    const c = v > 0.8 ? '#f472b6' : '#ef4444';
    for (let k = 0; k < 5; k++) {
      const a = rnd(v, k + 40) * TAU;
      const d = rnd(v, k + 50) * R * 0.75;
      blob(g, Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 2.8, c);
      blob(g, Math.cos(a) * d - 0.8, cy + Math.sin(a) * d * 0.8 - 0.8, 0.9, '#ffffff');
    }
  }
}

function pine(g, v, P, snow) {
  g.fillStyle = P.trunkDark;
  g.fillRect(-4, -14, 8, 14);
  const tiers = 4;
  const H = 78 + v * 16;
  for (let i = 0; i < tiers; i++) {
    const w = 30 - i * 6 + v * 4;
    const base = -12 - i * (H / tiers) * 0.72;
    const top = base - (H / tiers) * 1.25;
    g.fillStyle = [P.leafDark, P.leafMid, P.leafMid, P.leaf][i];
    g.beginPath();
    g.moveTo(0, top);
    g.lineTo(w, base);
    g.quadraticCurveTo(0, base + 6, -w, base);
    g.closePath();
    g.fill();
    // Lit left half
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.beginPath();
    g.moveTo(0, top);
    g.lineTo(-w, base);
    g.quadraticCurveTo(-w * 0.5, base + 4, 0, base + 5);
    g.closePath();
    g.fill();
    if (snow) {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(0, top);
      g.lineTo(w * 0.55, top + (base - top) * 0.55);
      g.quadraticCurveTo(0, top + (base - top) * 0.7, -w * 0.55, top + (base - top) * 0.55);
      g.closePath();
      g.fill();
    }
  }
}

// ---------- rocks and crystals ----------

function rock(g, v, P, { moss = false, crack = false, snow = false, big = 1 } = {}) {
  const R = (20 + v * 8) * big;
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI;
    const r = R * (0.82 + rnd(v, i) * 0.3);
    pts.push([Math.cos(a) * r, -R * 0.35 + Math.sin(a) * r * 0.95]);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(4, 0, R * 1.05, R * 0.3, 0, 0, TAU);
  g.fill();
  const grd = g.createLinearGradient(-R, -R * 1.3, R, 0);
  grd.addColorStop(0, P.rockLight);
  grd.addColorStop(0.45, P.rock);
  grd.addColorStop(1, P.rockDark);
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(-R, 0);
  for (const [x, y] of pts) g.lineTo(x, y);
  g.lineTo(R, 0);
  g.closePath();
  g.fill();
  // A lit facet and a dark facet
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.beginPath();
  g.moveTo(pts[1][0], pts[1][1]);
  g.lineTo(pts[3][0], pts[3][1]);
  g.lineTo(pts[4][0] * 0.3, -R * 0.45);
  g.lineTo(-R * 0.55, -R * 0.2);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.moveTo(pts[5][0], pts[5][1]);
  g.lineTo(pts[7][0], pts[7][1]);
  g.lineTo(R, 0);
  g.lineTo(R * 0.2, -2);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-R, 0);
  for (const [x, y] of pts) g.lineTo(x, y);
  g.lineTo(R, 0);
  g.stroke();
  if (moss) {
    g.fillStyle = P.moss;
    for (let k = 0; k < 3; k++) {
      const x = (rnd(v, k + 9) - 0.5) * R;
      g.beginPath();
      g.ellipse(x, -R * (0.9 + rnd(v, k) * 0.2), 6, 3, 0, 0, TAU);
      g.fill();
    }
  }
  if (snow) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(pts[1][0], pts[1][1]);
    for (let i = 1; i < 8; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.quadraticCurveTo(0, -R * 0.75, pts[1][0], pts[1][1]);
    g.fill();
  }
  if (crack) {
    g.save();
    g.strokeStyle = 'rgba(251,146,60,0.85)';
    g.shadowColor = '#f97316';
    g.shadowBlur = 6;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-R * 0.35, -R * 0.75);
    g.quadraticCurveTo(-R * 0.1, -R * 0.5, R * 0.05, -R * 0.45);
    g.quadraticCurveTo(R * 0.2, -R * 0.3, R * 0.3, -R * 0.12);
    g.stroke();
    g.restore();
  }
}

function crystals(g, v, colors, n = 3, scale = 1) {
  const [light, main, dark] = colors;
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath();
  g.ellipse(2, 0, 20 * scale, 6 * scale, 0, 0, TAU);
  g.fill();
  const glow = g.createRadialGradient(0, -24 * scale, 2, 0, -24 * scale, 40 * scale);
  glow.addColorStop(0, `${main}66`);
  glow.addColorStop(1, `${main}00`);
  g.fillStyle = glow;
  g.fillRect(-40 * scale, -64 * scale, 80 * scale, 70 * scale);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const h = (34 + (1 - Math.abs(t) * 1.6) * 26 + rnd(v, i) * 10) * scale;
    const w = (8 + rnd(v, i + 3) * 4) * scale;
    const x = t * 26 * scale;
    const lean = t * 10 * scale;
    // Two faces: lit and shaded
    g.fillStyle = light;
    g.beginPath();
    g.moveTo(x - w, 0);
    g.lineTo(x - w * 0.9 + lean * 0.8, -h * 0.8);
    g.lineTo(x + lean, -h);
    g.lineTo(x + lean * 0.5, 0);
    g.closePath();
    g.fill();
    g.fillStyle = main;
    g.beginPath();
    g.moveTo(x + lean * 0.5, 0);
    g.lineTo(x + lean, -h);
    g.lineTo(x + w * 0.9 + lean * 0.8, -h * 0.8);
    g.lineTo(x + w, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = dark;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x - w, 0);
    g.lineTo(x - w * 0.9 + lean * 0.8, -h * 0.8);
    g.lineTo(x + lean, -h);
    g.lineTo(x + w * 0.9 + lean * 0.8, -h * 0.8);
    g.lineTo(x + w, 0);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.moveTo(x - w * 0.55 + lean * 0.5, -h * 0.55);
    g.lineTo(x - w * 0.35 + lean * 0.8, -h * 0.85);
    g.lineTo(x - w * 0.25 + lean * 0.6, -h * 0.5);
    g.closePath();
    g.fill();
  }
}

function pillar(g, v) {
  const w = 17;
  const h = 62 + v * 14;
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(4, 0, 26, 7, 0, 0, TAU);
  g.fill();
  rr(g, -w - 5, -10, (w + 5) * 2, 10, 2, '#3a3057');
  const sg = g.createLinearGradient(-w, 0, w, 0);
  sg.addColorStop(0, '#3d3360');
  sg.addColorStop(0.4, '#7a6ca8');
  sg.addColorStop(1, '#2b2346');
  g.fillStyle = sg;
  const broken = v > 0.8;
  const top = broken ? -h * 0.62 : -h;
  g.beginPath();
  g.moveTo(-w, -8);
  g.lineTo(-w, top + 6);
  g.lineTo(broken ? -w * 0.2 : -w, top);
  g.lineTo(broken ? w * 0.4 : w, broken ? top + 10 : top);
  g.lineTo(w, -8);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(18,12,32,0.45)';
  g.lineWidth = 1.2;
  for (let y = -18; y > top + 8; y -= 14) {
    g.beginPath();
    g.moveTo(-w, y);
    g.lineTo(w, y);
    g.stroke();
  }
  for (const x of [-w * 0.45, w * 0.15]) {
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.moveTo(x, -10);
    g.lineTo(x, top + 6);
    g.stroke();
  }
  if (!broken) rr(g, -w - 6, top - 8, (w + 6) * 2, 9, 2, '#8b7fbd');
  // Ivy
  if (v > 0.4 && v < 0.7) {
    g.strokeStyle = '#4d7c0f';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-w + 2, -10);
    g.bezierCurveTo(-w + 12, -h * 0.35, -w - 2, -h * 0.55, -w + 8, top + 10);
    g.stroke();
    for (let k = 0; k < 5; k++) blob(g, -w + 4 + rnd(v, k) * 8, -12 - k * (h / 7), 3, '#65a30d');
  }
}

// ---------- props ----------

function paintSign(g, v) {
  g.fillStyle = '#6b3f1d';
  g.fillRect(-3, -40, 6, 40);
  rr(g, -22, -46, 44, 18, 3, '#b45309');
  rr(g, -20, -44, 40, 14, 2, '#d97706');
  g.fillStyle = '#fef3c7';
  g.beginPath();
  g.moveTo(-10, -37);
  g.lineTo(8, -37);
  g.lineTo(8, -41);
  g.lineTo(14, -37);
  g.lineTo(8, -33);
  g.lineTo(8, -37);
  g.fill();
  g.fillRect(-12, -38, 20, 2);
  if (v > 0.5) blob(g, -18, -30, 3, '#f472b6');
}
function paintFence(g) {
  for (const x of [-18, 18]) {
    rr(g, x - 3, -30, 6, 30, 2, '#92400e');
    g.fillStyle = '#b45309';
    g.beginPath();
    g.moveTo(x - 3, -30);
    g.lineTo(x, -35);
    g.lineTo(x + 3, -30);
    g.fill();
  }
  rr(g, -22, -24, 44, 5, 2, '#d97706');
  rr(g, -22, -13, 44, 5, 2, '#b45309');
}
function paintLamp(g) {
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(2, 0, 10, 3, 0, 0, TAU);
  g.fill();
  rr(g, -6, -6, 12, 6, 2, '#334155');
  g.fillStyle = '#475569';
  g.fillRect(-2.5, -58, 5, 54);
  rr(g, -9, -76, 18, 20, 4, '#1e293b');
  rr(g, -6.5, -73, 13, 14, 3, '#fde68a');
  g.fillStyle = '#334155';
  g.beginPath();
  g.moveTo(-11, -76);
  g.lineTo(0, -84);
  g.lineTo(11, -76);
  g.fill();
}
function paintStump(g, v) {
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(2, 0, 16, 5, 0, 0, TAU);
  g.fill();
  rr(g, -13, -16, 26, 16, 5, '#7c4a21');
  g.fillStyle = '#d6a26b';
  g.beginPath();
  g.ellipse(0, -16, 13, 5, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#a16207';
  g.lineWidth = 1;
  for (const r of [4, 8]) {
    g.beginPath();
    g.ellipse(0, -16, r, r * 0.4, 0, 0, TAU);
    g.stroke();
  }
  if (v > 0.5) {
    g.fillStyle = '#ef4444';
    g.beginPath();
    g.arc(10, -4, 4, Math.PI, TAU);
    g.fill();
    g.fillStyle = '#fef3c7';
    g.fillRect(9, -4, 2, 4);
  }
}
function paintStalagmite(g, v, P) {
  const h = 44 + v * 20;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(2, 0, 16, 5, 0, 0, TAU);
  g.fill();
  const grd = g.createLinearGradient(-12, 0, 12, 0);
  grd.addColorStop(0, P.rockLight);
  grd.addColorStop(0.5, P.rock);
  grd.addColorStop(1, P.rockDark);
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(-13, 0);
  g.quadraticCurveTo(-8, -h * 0.5, -1, -h);
  g.quadraticCurveTo(6, -h * 0.5, 13, 0);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.15)';
  for (let k = 1; k < 4; k++) g.fillRect(-10 + k, -h * (k / 4.5), 20 - k * 2, 2);
}
function paintTomb(g, v) {
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(3, 0, 18, 5, 0, 0, TAU);
  g.fill();
  const grd = g.createLinearGradient(-14, 0, 14, 0);
  grd.addColorStop(0, '#9ca3af');
  grd.addColorStop(0.5, '#d1d5db');
  grd.addColorStop(1, '#6b7280');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(-14, 0);
  g.lineTo(-14, -26);
  g.arc(0, -26, 14, Math.PI, TAU);
  g.lineTo(14, 0);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(55,65,81,0.6)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -34);
  g.lineTo(0, -16);
  g.moveTo(-6, -28);
  g.lineTo(6, -28);
  g.stroke();
  // Flowers left by visitors
  blob(g, -9, -2, 3, v > 0.5 ? '#f9a8d4' : '#fde047');
  blob(g, -4, -1, 2.5, '#c4b5fd');
  g.fillStyle = '#4d7c0f';
  g.fillRect(8, -6, 2, 6);
}
function paintCandelabra(g) {
  rr(g, -10, -6, 20, 6, 2, '#44403c');
  g.fillStyle = '#78716c';
  g.fillRect(-2, -40, 4, 36);
  g.strokeStyle = '#78716c';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-14, -36);
  g.quadraticCurveTo(0, -24, 14, -36);
  g.stroke();
  for (const x of [-14, 0, 14]) {
    rr(g, x - 3, x === 0 ? -52 : -46, 6, 10, 1, '#f5f3ff');
    blob(g, x, x === 0 ? -56 : -50, 3, '#c084fc');
  }
}
function paintUrn(g) {
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.ellipse(2, 0, 13, 4, 0, 0, TAU);
  g.fill();
  const grd = g.createLinearGradient(-12, 0, 12, 0);
  grd.addColorStop(0, '#6d28d9');
  grd.addColorStop(0.5, '#a78bfa');
  grd.addColorStop(1, '#4c1d95');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(-7, 0);
  g.quadraticCurveTo(-16, -14, -6, -26);
  g.lineTo(6, -26);
  g.quadraticCurveTo(16, -14, 7, 0);
  g.closePath();
  g.fill();
  rr(g, -8, -30, 16, 5, 2, '#fbbf24');
}
function paintVent(g, v, P) {
  rock(g, v, P, { big: 0.8 });
  const glow = g.createRadialGradient(0, -18, 1, 0, -18, 14);
  glow.addColorStop(0, '#fde047');
  glow.addColorStop(0.5, '#f97316');
  glow.addColorStop(1, 'rgba(249,115,22,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.ellipse(0, -18, 12, 6, 0, 0, TAU);
  g.fill();
}
function paintObsidian(g, v) {
  crystals(g, v, ['#57534e', '#1c1917', '#000000'], 2, 0.9);
}
function paintSnowman(g, v) {
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.ellipse(2, 0, 16, 5, 0, 0, TAU);
  g.fill();
  for (const [y, r] of [[-13, 14], [-35, 10]]) {
    const grd = g.createRadialGradient(-4, y - 4, 1, 0, y, r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(1, '#cfe3f2');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(0, y, r, 0, TAU);
    g.fill();
  }
  blob(g, -3.5, -38, 1.5, '#1f2937');
  blob(g, 3.5, -38, 1.5, '#1f2937');
  g.fillStyle = '#f97316';
  g.beginPath();
  g.moveTo(0, -35);
  g.lineTo(9, -33);
  g.lineTo(0, -32);
  g.fill();
  rr(g, -10, -29, 20, 4, 2, v > 0.5 ? '#ef4444' : '#2563eb');
  rr(g, -8, -52, 16, 8, 2, '#1f2937');
  rr(g, -11, -46, 22, 3, 1, '#1f2937');
}
function paintIceSpike(g, v) {
  crystals(g, v, ['#ffffff', '#7dd3fc', '#0369a1'], 3, 0.9);
}
function paintObelisk(g) {
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(3, 0, 16, 5, 0, 0, TAU);
  g.fill();
  const grd = g.createLinearGradient(-10, 0, 10, 0);
  grd.addColorStop(0, '#312e81');
  grd.addColorStop(0.5, '#6366f1');
  grd.addColorStop(1, '#1e1b4b');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(-11, 0);
  g.lineTo(-7, -60);
  g.lineTo(0, -70);
  g.lineTo(7, -60);
  g.lineTo(11, 0);
  g.closePath();
  g.fill();
  g.save();
  g.strokeStyle = '#f0abfc';
  g.shadowColor = '#e879f9';
  g.shadowBlur = 8;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, -36, 5, 0, TAU);
  g.moveTo(0, -48);
  g.lineTo(0, -24);
  g.stroke();
  g.restore();
}
function paintOrb(g) {
  rr(g, -9, -18, 18, 18, 3, '#4338ca');
  rr(g, -12, -22, 24, 5, 2, '#6366f1');
  const grd = g.createRadialGradient(-3, -36, 1, 0, -32, 11);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.4, '#f0abfc');
  grd.addColorStop(1, '#a21caf');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, -32, 10, 0, TAU);
  g.fill();
}

// ---------- town buildings (anchor: middle of the bottom edge of the footprint) ----------

function house(g, w, h, roof, roofDark, wall, opts = {}) {
  const x = -w / 2;
  const y = -h;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x + 10, -6, w, 14);
  // Walls with a plinth
  const wg = g.createLinearGradient(0, y + h * 0.3, 0, 0);
  wg.addColorStop(0, wall);
  wg.addColorStop(1, '#e7e5e4');
  g.fillStyle = wg;
  g.fillRect(x, y + h * 0.3, w, h * 0.7);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(x, -8, w, 8);
  // Roof with tiles
  const top = y - h * 0.28;
  g.fillStyle = roofDark;
  g.beginPath();
  g.moveTo(x - 12, y + h * 0.4);
  g.lineTo(x + w * 0.1, top);
  g.lineTo(x + w * 0.9, top);
  g.lineTo(x + w + 12, y + h * 0.4);
  g.closePath();
  g.fill();
  g.fillStyle = roof;
  g.beginPath();
  g.moveTo(x - 8, y + h * 0.36);
  g.lineTo(x + w * 0.11, top + 3);
  g.lineTo(x + w * 0.89, top + 3);
  g.lineTo(x + w + 8, y + h * 0.36);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.16)';
  g.lineWidth = 1.5;
  for (let k = 1; k < 5; k++) {
    const yy = top + 3 + ((y + h * 0.36 - top - 3) * k) / 5;
    g.beginPath();
    g.moveTo(x - 8 + (k / 5) * -2, yy);
    g.lineTo(x + w + 8, yy);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(x + w * 0.11, top + 3, w * 0.78, 4);
  if (opts.chimney) {
    rr(g, x + w * 0.72, top - 16, 16, 24, 2, '#78716c');
    rr(g, x + w * 0.72 - 2, top - 18, 20, 5, 2, '#57534e');
  }
  // Door with steps
  rr(g, -16, -40, 32, 40, 4, opts.door || '#92400e');
  g.fillStyle = opts.doorGlass || 'rgba(255,255,255,0.25)';
  g.fillRect(-11, -34, 22, 12);
  blob(g, 9, -18, 2, '#fde047');
  rr(g, -22, -4, 44, 5, 2, '#a8a29e');
  // Windows with frames, shine and flower boxes
  for (const wx of [x + 16, x + w - 50]) {
    rr(g, wx - 3, y + h * 0.46 - 3, 40, 30, 3, '#ffffff');
    const gg = g.createLinearGradient(wx, y + h * 0.46, wx + 34, y + h * 0.46 + 24);
    gg.addColorStop(0, '#e0f2fe');
    gg.addColorStop(1, '#7dd3fc');
    g.fillStyle = gg;
    g.fillRect(wx, y + h * 0.46, 34, 24);
    g.fillStyle = '#ffffff';
    g.fillRect(wx + 16, y + h * 0.46, 2, 24);
    g.fillRect(wx, y + h * 0.46 + 11, 34, 2);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath();
    g.moveTo(wx + 3, y + h * 0.46 + 20);
    g.lineTo(wx + 12, y + h * 0.46 + 3);
    g.lineTo(wx + 15, y + h * 0.46 + 3);
    g.lineTo(wx + 6, y + h * 0.46 + 20);
    g.fill();
    rr(g, wx - 4, y + h * 0.46 + 26, 42, 7, 2, '#92400e');
    for (let k = 0; k < 5; k++) blob(g, wx + 2 + k * 8, y + h * 0.46 + 25, 3.2, ['#f472b6', '#facc15', '#fb7185', '#c084fc', '#f472b6'][k]);
  }
  if (opts.sign) opts.sign(g, 0, top + (y + h * 0.36 - top) * 0.45);
}

function pokeSign(g, cx, cy) {
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx, cy, 19, 0, TAU);
  g.fill();
  g.fillStyle = '#ef4444';
  g.beginPath();
  g.arc(cx, cy, 19, Math.PI, TAU);
  g.fill();
  g.fillStyle = '#1f2937';
  g.fillRect(cx - 19, cy - 2.5, 38, 5);
  g.beginPath();
  g.arc(cx, cy, 7, 0, TAU);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(cx, cy, 4, 0, TAU);
  g.fill();
  g.strokeStyle = '#1f2937';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, 19, 0, TAU);
  g.stroke();
}
function shopSign(g, cx, cy) {
  rr(g, cx - 42, cy - 14, 84, 28, 8, '#1d4ed8');
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(cx - 40, cy - 12, 80, 24, 7);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = '900 15px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('SHOP', cx, cy + 1);
}

function paintBoard(g, w, h) {
  const x = -w / 2;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x + 6, -8, w, 10);
  g.fillStyle = '#78350f';
  g.fillRect(x + 12, -h + 20, 8, h - 20);
  g.fillRect(x + w - 20, -h + 20, 8, h - 20);
  rr(g, x - 4, -h - 6, w + 8, 50, 6, '#b45309');
  g.fillStyle = '#92400e';
  g.fillRect(x - 4, -h - 6, w + 8, 6);
  g.fillStyle = '#7c2d12';
  g.beginPath();
  g.moveTo(x - 10, -h - 6);
  g.lineTo(0, -h - 22);
  g.lineTo(x + w + 10, -h - 6);
  g.closePath();
  g.fill();
  g.fillStyle = '#fef3c7';
  for (let i = 0; i < 3; i++) g.fillRect(x + 8 + i * 36, -h + 4, 26, 30);
  for (let i = 0; i < 3; i++) blob(g, x + 21 + i * 36, -h + 6, 3, '#ef4444');
  g.strokeStyle = 'rgba(120,53,15,0.5)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    for (let l = 0; l < 3; l++) {
      g.beginPath();
      g.moveTo(x + 12 + i * 36, -h + 14 + l * 7);
      g.lineTo(x + 30 + i * 36, -h + 14 + l * 7);
      g.stroke();
    }
  }
}

function paintFountain(g, w) {
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath();
  g.ellipse(6, -w * 0.3, w * 0.66, w * 0.36, 0, 0, TAU);
  g.fill();
  const cy = -w * 0.45;
  g.fillStyle = '#94a3b8';
  g.beginPath();
  for (let i = 0; i < 8; i++) g.lineTo(Math.cos((i / 8) * TAU + 0.39) * w * 0.66, cy + 8 + Math.sin((i / 8) * TAU + 0.39) * w * 0.4);
  g.closePath();
  g.fill();
  g.fillStyle = '#cbd5e1';
  g.beginPath();
  for (let i = 0; i < 8; i++) g.lineTo(Math.cos((i / 8) * TAU + 0.39) * w * 0.6, cy + Math.sin((i / 8) * TAU + 0.39) * w * 0.36);
  g.closePath();
  g.fill();
  const wg = g.createRadialGradient(-8, cy - 6, 4, 0, cy, w * 0.5);
  wg.addColorStop(0, '#bae6fd');
  wg.addColorStop(1, '#2563eb');
  g.fillStyle = wg;
  g.beginPath();
  g.ellipse(0, cy, w * 0.5, w * 0.3, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#e2e8f0';
  g.fillRect(-5, cy - 34, 10, 34);
  rr(g, -14, cy - 40, 28, 7, 3, '#cbd5e1');
}

// ---------- the cache ----------

// [width, height, anchor x, anchor y] in world units
const BOX = {
  trunk: [40, 50, 20, 48],
  canopy: [110, 130, 55, 128],
  pine: [80, 130, 40, 126],
  rock: [80, 70, 40, 60],
  crystal: [90, 100, 45, 92],
  pillar: [60, 110, 30, 104],
  sign: [50, 56, 25, 52],
  fence: [50, 42, 25, 38],
  lamp: [40, 92, 20, 88],
  stump: [40, 30, 20, 26],
  stalagmite: [40, 80, 20, 76],
  crystalBig: [90, 100, 45, 92],
  tomb: [44, 50, 22, 46],
  candelabra: [40, 64, 20, 60],
  urn: [36, 40, 18, 36],
  vent: [70, 60, 35, 52],
  obsidian: [80, 90, 40, 84],
  snowman: [36, 60, 18, 56],
  iceSpike: [80, 90, 40, 84],
  obelisk: [40, 80, 20, 76],
  orb: [34, 50, 17, 46],
};

const cache = new Map();

function paint(kind, v, theme, P, extra) {
  switch (kind) {
    case 'trunk':
      return (g) => trunk(g, v, P);
    case 'canopy':
      return (g) => canopy(g, v, P);
    case 'pine':
      return (g) => pine(g, v, P, theme === 'ice');
    case 'rock':
      return (g) => rock(g, v, P, { moss: theme === 'cave' || theme === 'forest', crack: theme === 'volcano' && v > 0.7, snow: theme === 'ice' });
    case 'crystal':
      return (g) => crystals(g, v, theme === 'psychic' ? ['#f5d0fe', '#a855f7', '#4c1d95'] : theme === 'ice' ? ['#ffffff', '#7dd3fc', '#0369a1'] : ['#cffafe', '#22d3ee', '#0e7490'], 3 + Math.round(v * 2));
    case 'crystalBig':
      return (g) => crystals(g, v, theme === 'psychic' ? ['#fce7f3', '#ec4899', '#831843'] : ['#cffafe', '#22d3ee', '#0e7490'], 3, 1.2);
    case 'pillar':
      return (g) => pillar(g, v);
    case 'sign':
      return (g) => paintSign(g, v);
    case 'fence':
      return (g) => paintFence(g);
    case 'lamp':
      return (g) => paintLamp(g);
    case 'stump':
      return (g) => paintStump(g, v);
    case 'stalagmite':
      return (g) => paintStalagmite(g, v, P);
    case 'tomb':
      return (g) => paintTomb(g, v);
    case 'candelabra':
      return (g) => paintCandelabra(g);
    case 'urn':
      return (g) => paintUrn(g);
    case 'vent':
      return (g) => paintVent(g, v, P);
    case 'obsidian':
      return (g) => paintObsidian(g, v);
    case 'snowman':
      return (g) => paintSnowman(g, v);
    case 'iceSpike':
      return (g) => paintIceSpike(g, v);
    case 'obelisk':
      return (g) => paintObelisk(g);
    case 'orb':
      return (g) => paintOrb(g);
    case 'building':
      return (g) => {
        const { id, w, h } = extra;
        if (id === 'center') house(g, w, h, '#ef4444', '#b91c1c', '#fff7ed', { sign: pokeSign, door: '#7dd3fc', doorGlass: 'rgba(255,255,255,0.5)' });
        else if (id === 'shop') house(g, w, h, '#3b82f6', '#1d4ed8', '#f8fafc', { sign: shopSign, door: '#7dd3fc', doorGlass: 'rgba(255,255,255,0.5)' });
        else if (id === 'house') house(g, w, h, extra.v > 0.5 ? '#f97316' : '#16a34a', extra.v > 0.5 ? '#c2410c' : '#166534', '#fef3c7', { chimney: true });
        else if (id === 'board') paintBoard(g, w, h);
        else if (id === 'fountain') paintFountain(g, w);
      };
    default:
      return () => {};
  }
}

/**
 * The sprite for a kind / variant (0..1, rounded to a few steps) / theme:
 * { canvas, w, h, ax, ay } where (ax, ay) is the anchor inside, in world units.
 */
export function sprite(kind, v, theme, extra = null) {
  const step = kind === 'building' ? 0 : Math.round(v * 5) / 5;
  const key = `${kind}|${step}|${theme}|${extra ? `${extra.id}-${extra.w}-${extra.h}-${Math.round((extra.v || 0) * 2)}` : ''}`;
  let s = cache.get(key);
  if (s) return s;
  let box = BOX[kind];
  if (kind === 'building') {
    const { w, h } = extra;
    box = [w + 60, h * 1.8 + 50, w / 2 + 30, h * 1.8 + 20];
  }
  const [w, h, ax, ay] = box;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const g = canvas?.getContext?.('2d');
  if (!g) {
    s = { canvas: null, w, h, ax, ay };
    cache.set(key, s);
    return s;
  }
  canvas.width = Math.ceil(w * SPRITE_SCALE);
  canvas.height = Math.ceil(h * SPRITE_SCALE);
  g.scale(SPRITE_SCALE, SPRITE_SCALE);
  g.translate(ax, ay);
  paint(kind, step, theme, PALETTES[theme] || PALETTES.forest, extra)(g);
  s = { canvas, w, h, ax, ay };
  cache.set(key, s);
  return s;
}

/** Stamp a sprite with its anchor at (x, y). */
export function stamp(ctx, s, x, y, dx = 0) {
  if (s.canvas) ctx.drawImage(s.canvas, x - s.ax + dx, y - s.ay, s.w, s.h);
}
