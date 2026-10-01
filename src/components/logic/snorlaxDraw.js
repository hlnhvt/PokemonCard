// Canvas painting for "Cho Snorlax ăn" (kept apart from the React component).
import { SNORLAX_W as W, SNORLAX_H as H, BERRY_R, STAR_R, starAt } from '../../utils/logic/snorlax';
import { WORLDS } from '../../utils/logic/snorlaxLevels';
import { imageReady, updateParticles } from '../sports/sportsKit';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** Where the child's Pokemon sits: the bottom corner away from Snorlax. */
export const playerSpot = (s) => ({ x: s.mouth.x > W / 2 ? 46 : W - 46, y: 508 });

// ---------- background, painted once per world into layers
const layerCache = new Map();
function makeLayer(key, paint) {
  if (layerCache.has(key)) return layerCache.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = (W + 40) * 2;
  c.height = H * 2;
  const ctx = c.getContext?.('2d');
  if (!ctx) {
    layerCache.set(key, null);
    return null;
  }
  ctx.scale(2, 2);
  ctx.translate(20, 0);
  paint(ctx);
  layerCache.set(key, c);
  return c;
}

function rand(seed) {
  let a = seed;
  return () => ((a = (a * 16807) % 2147483647) - 1) / 2147483646;
}

function cloud(ctx, x, y, s, color = 'rgba(255,255,255,0.9)') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 14 * s, 0, TAU);
  ctx.arc(x + 16 * s, y - 8 * s, 18 * s, 0, TAU);
  ctx.arc(x + 36 * s, y - 2 * s, 14 * s, 0, TAU);
  ctx.arc(x + 20 * s, y + 6 * s, 14 * s, 0, TAU);
  ctx.fill();
}

function hills(ctx, base, amp, color, phase, step = 40) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-20, H);
  for (let x = -20; x <= W + 20; x += step / 4) ctx.lineTo(x, base - Math.sin(x / step + phase) * amp - Math.sin(x / (step * 0.37) + phase * 2) * amp * 0.3);
  ctx.lineTo(W + 20, H);
  ctx.closePath();
  ctx.fill();
}

function paintFar(world) {
  return (ctx) => {
    const wd = WORLDS[world];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, wd.sky[0]);
    g.addColorStop(1, wd.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-20, 0, W + 40, H);
    const r = rand(world * 31 + 7);
    if (world === 0) {
      const sun = ctx.createRadialGradient(300, 70, 4, 300, 70, 70);
      sun.addColorStop(0, 'rgba(254,249,195,1)');
      sun.addColorStop(0.35, 'rgba(253,224,71,0.9)');
      sun.addColorStop(1, 'rgba(253,224,71,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(220, 0, 160, 150);
      hills(ctx, 400, 26, '#a7f3d0', 0.4, 70);
    } else if (world === 1) {
      hills(ctx, 330, 50, 'rgba(125,211,252,0.7)', 1.2, 55);
      hills(ctx, 360, 30, 'rgba(56,189,248,0.6)', 2.2, 45);
    } else if (world === 2) {
      // Rainbow
      const cols = ['#fca5a5', '#fdba74', '#fde68a', '#bbf7d0', '#bae6fd', '#c4b5fd'];
      ctx.lineWidth = 9;
      cols.forEach((c, i) => {
        ctx.strokeStyle = c;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(180, 380, 230 - i * 9, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      for (let i = 0; i < 6; i++) cloud(ctx, r() * W - 20, 300 + r() * 200, 1.4 + r(), 'rgba(255,255,255,0.55)');
    } else if (world === 3) {
      // Tall tree trunks far away
      for (let i = 0; i < 9; i++) {
        const x = i * 44 + r() * 20 - 20;
        ctx.fillStyle = `rgba(20,83,45,${0.35 + r() * 0.3})`;
        ctx.fillRect(x, 0, 14 + r() * 10, H);
        ctx.beginPath();
        ctx.arc(x + 10, 40 + r() * 60, 40 + r() * 20, 0, TAU);
        ctx.fill();
      }
    } else {
      // Cave: crystals and stalactites
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(253,230,138,${0.2 + r() * 0.5})`;
        ctx.beginPath();
        ctx.arc(r() * W, r() * H * 0.8, 0.8 + r() * 1.4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(30,27,75,0.75)';
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      for (let x = -20; x <= W + 20; x += 18) {
        ctx.lineTo(x + 9, 26 + r() * 46);
        ctx.lineTo(x + 18, 8);
      }
      ctx.lineTo(W + 20, 0);
      ctx.fill();
    }
  };
}

function mushroom(ctx, x, y, s, cap) {
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(x - 5 * s, y - 16 * s, 10 * s, 18 * s);
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.ellipse(x, y - 16 * s, 18 * s, 12 * s, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x - 7 * s, y - 21 * s, 2.5 * s, 0, TAU);
  ctx.arc(x + 5 * s, y - 24 * s, 2 * s, 0, TAU);
  ctx.fill();
}

function crystal(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 30 * s);
  ctx.lineTo(x + 9 * s, y - 8 * s);
  ctx.lineTo(x + 5 * s, y);
  ctx.lineTo(x - 5 * s, y);
  ctx.lineTo(x - 9 * s, y - 8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(x, y - 30 * s);
  ctx.lineTo(x + 3 * s, y - 8 * s);
  ctx.lineTo(x - 3 * s, y - 2 * s);
  ctx.closePath();
  ctx.fill();
}

function paintNear(world) {
  return (ctx) => {
    const r = rand(world * 97 + 3);
    const wd = WORLDS[world];
    if (world === 0) {
      hills(ctx, 470, 22, '#86efac', 2.1, 60);
      hills(ctx, 520, 12, wd.ground, 0.7, 40);
      for (let i = 0; i < 26; i++) {
        const x = r() * W;
        const y = 525 + r() * 30;
        ctx.fillStyle = ['#fde047', '#f9a8d4', '#ffffff', '#fca5a5'][i % 4];
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.arc(x + Math.cos((k * TAU) / 5) * 3, y + Math.sin((k * TAU) / 5) * 3, 2.2, 0, TAU);
          ctx.fill();
        }
      }
    } else if (world === 1) {
      const water = ctx.createLinearGradient(0, 440, 0, H);
      water.addColorStop(0, 'rgba(14,165,233,0.55)');
      water.addColorStop(1, 'rgba(8,47,73,0.65)');
      ctx.fillStyle = water;
      ctx.fillRect(-20, 440, W + 40, H - 440);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        for (let x = -20; x <= W + 20; x += 6) ctx.lineTo(x, 450 + k * 26 + Math.sin(x / 18 + k) * 3);
        ctx.stroke();
      }
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(180, 560, 260, 26, 0, Math.PI, 0);
      ctx.fill();
      for (let i = 0; i < 10; i++) {
        const x = r() < 0.5 ? r() * 70 : W - r() * 70;
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, 560);
        ctx.quadraticCurveTo(x + 6, 520, x + (r() - 0.5) * 20, 470 + r() * 30);
        ctx.stroke();
      }
    } else if (world === 2) {
      for (let i = 0; i < 7; i++) cloud(ctx, i * 58 - 30, 540 + r() * 10, 1.8, '#ffffff');
      for (let i = 0; i < 6; i++) cloud(ctx, i * 66 - 10, 515 + r() * 8, 1.2, '#fce7f3');
    } else if (world === 3) {
      hills(ctx, 525, 10, wd.ground, 1.3, 30);
      for (let i = 0; i < 9; i++) mushroom(ctx, 10 + i * 42 + r() * 16, 540 + r() * 16, 0.8 + r() * 0.6, ['#ef4444', '#f97316', '#a855f7'][i % 3]);
    } else {
      ctx.fillStyle = '#312e81';
      ctx.beginPath();
      ctx.moveTo(-20, H);
      for (let x = -20; x <= W + 20; x += 20) ctx.lineTo(x, 528 + r() * 14);
      ctx.lineTo(W + 20, H);
      ctx.fill();
      for (let i = 0; i < 8; i++) crystal(ctx, r() < 0.5 ? r() * 60 : W - r() * 60, 548, 0.8 + r() * 0.7, ['#67e8f9', '#c084fc', '#f0abfc'][i % 3]);
    }
  };
}

function drawBackground(ctx, s, v) {
  const world = s.def.world ?? 0;
  const px = (s.berry.x - W / 2) / (W / 2);
  const far = makeLayer(`far${world}`, paintFar(world));
  const near = makeLayer(`near${world}`, paintNear(world));
  if (far) ctx.drawImage(far, -20 - px * 6, 0, W + 40, H);
  else {
    ctx.fillStyle = WORLDS[world].sky[0];
    ctx.fillRect(0, 0, W, H);
  }
  // Moving decor between the layers
  const t = v.time;
  if (world === 0 || world === 2) {
    for (const [cx, cy, sc] of [[40, 70, 1], [210, 120, 0.8], [120, 30, 0.6]]) cloud(ctx, ((cx + t * 9 * sc - px * 10) % (W + 100)) - 50, cy, sc, 'rgba(255,255,255,0.85)');
  } else if (world === 1) {
    for (let i = 0; i < 8; i++) {
      const y = H - ((t * (18 + i * 3) + i * 90) % (H + 40));
      const x = (i * 53 + Math.sin(t + i) * 8 - px * 8 + W) % W;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 3) * 2, 0, TAU);
      ctx.stroke();
    }
  } else if (world === 3) {
    for (let i = 0; i < 10; i++) {
      const x = (i * 41 + Math.sin(t * 0.7 + i * 2) * 20 + W) % W;
      const y = 120 + ((i * 67) % 340) + Math.cos(t * 0.9 + i) * 14;
      ctx.fillStyle = `rgba(254,240,138,${0.35 + 0.35 * Math.sin(t * 3 + i)})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, TAU);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 12; i++) {
      const tw = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.7);
      ctx.fillStyle = `rgba(196,181,253,${tw * 0.8})`;
      ctx.beginPath();
      ctx.arc((i * 71) % W, 60 + ((i * 113) % 380), 1 + tw * 1.6, 0, TAU);
      ctx.fill();
    }
  }
  if (near) ctx.drawImage(near, -20 - px * 14, 0, W + 40, H);
}

// ---------- level pieces
function smoothPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

function drawRope(ctx, pts, alpha = 1, silk = false) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  smoothPath(ctx, pts);
  if (silk) {
    ctx.strokeStyle = 'rgba(148,163,184,0.9)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#5b3416';
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.strokeStyle = '#c98b4a';
    ctx.lineWidth = 4.5;
    ctx.stroke();
    // The twist: short darker dashes along the cord
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = '#8a5527';
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(-1, -1);
    smoothPath(ctx, pts);
    ctx.strokeStyle = 'rgba(255,237,213,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPeg(ctx, x, y) {
  const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 9);
  g.addColorStop(0, '#fef9c3');
  g.addColorStop(0.5, '#facc15');
  g.addColorStop(1, '#a16207');
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.arc(x + 1.5, y + 2, 8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#854d0e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#854d0e';
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, TAU);
  ctx.fill();
}

function drawWeb(ctx, w, t, used) {
  ctx.save();
  if (!used) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([5, 6]);
    ctx.lineDashOffset = -t * 12;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w.x, w.y, w.r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.strokeStyle = 'rgba(241,245,249,0.85)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 8; k++) {
    const a = (k * TAU) / 8;
    ctx.beginPath();
    ctx.moveTo(w.x, w.y);
    ctx.lineTo(w.x + Math.cos(a) * 17, w.y + Math.sin(a) * 17);
    ctx.stroke();
  }
  for (const rr of [6, 11, 16]) {
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) ctx.lineTo(w.x + Math.cos((k * TAU) / 8) * rr, w.y + Math.sin((k * TAU) / 8) * rr);
    ctx.stroke();
  }
  // Spinarak
  const bob = Math.sin(t * 3) * 1.5;
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 1.6;
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(w.x + sx * 5, w.y + bob + k * 3 - 2);
      ctx.lineTo(w.x + sx * 12, w.y + bob + k * 4 - 6);
      ctx.lineTo(w.x + sx * 14, w.y + bob + k * 4);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#84cc16';
  ctx.beginPath();
  ctx.ellipse(w.x, w.y + bob, 8, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.ellipse(w.x, w.y + bob - 1, 4, 3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.arc(w.x - 2.5, w.y + bob + 3, 1.3, 0, TAU);
  ctx.arc(w.x + 2.5, w.y + bob + 3, 1.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function star5(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + rot + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function drawStar(ctx, st, t, i) {
  if (st.move) {
    // its glide path, faintly
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([2, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 40; k++) {
      const p = starAt(st, (k / 40) * (TAU / st.move.w));
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }
  if (st.got) return;
  const bob = Math.sin(t * 2.6 + i * 1.3) * 2.5;
  const x = st.cx;
  const y = st.cy + bob;
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 2, x, y, STAR_R * 2.2);
  glow.addColorStop(0, 'rgba(254,240,138,0.85)');
  glow.addColorStop(1, 'rgba(254,240,138,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, STAR_R * 2.2, 0, TAU);
  ctx.fill();
  const g = ctx.createLinearGradient(x, y - STAR_R, x, y + STAR_R);
  g.addColorStop(0, '#fef08a');
  g.addColorStop(0.6, '#facc15');
  g.addColorStop(1, '#f59e0b');
  ctx.fillStyle = g;
  star5(ctx, x, y, STAR_R, Math.sin(t * 1.8 + i) * 0.18);
  ctx.fill();
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(x - 4, y - 4, 3, 1.8, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawBubble(ctx, q, t, held) {
  const wob = 1 + Math.sin(t * 4 + q.x) * 0.035;
  ctx.save();
  ctx.translate(q.x, q.y);
  ctx.scale(wob, 2 - wob);
  const g = ctx.createRadialGradient(-q.r * 0.3, -q.r * 0.35, 2, 0, 0, q.r);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.7, 'rgba(186,230,253,0.18)');
  g.addColorStop(1, 'rgba(125,211,252,0.45)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, q.r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = held ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Rainbow sheen and highlights
  ctx.strokeStyle = 'rgba(244,114,182,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, q.r - 3, 0.2, 1.2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.ellipse(-q.r * 0.42, -q.r * 0.45, q.r * 0.2, q.r * 0.11, -0.7, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(q.r * 0.45, q.r * 0.38, 2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPuffer(ctx, p, t, inflate) {
  const sc = 1 + inflate * 0.22;
  const look = { x: Math.cos(p.angle), y: Math.sin(p.angle) };
  ctx.save();
  ctx.translate(p.x, p.y + Math.sin(t * 2.2 + p.x) * 1.5);
  ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(2, 22, 18, 4, 0, 0, TAU);
  ctx.fill();
  // ears
  ctx.fillStyle = '#f9a8d4';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 8, -16);
    ctx.lineTo(sx * 19, -26);
    ctx.lineTo(sx * 20, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.moveTo(sx * 12, -16);
    ctx.lineTo(sx * 18, -22);
    ctx.lineTo(sx * 18, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f9a8d4';
  }
  const g = ctx.createRadialGradient(-6, -8, 3, 0, 0, 22);
  g.addColorStop(0, '#fdf2f8');
  g.addColorStop(0.4, '#fbcfe8');
  g.addColorStop(1, '#f472b6');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, TAU);
  ctx.fill();
  // tuft
  ctx.strokeStyle = '#f472b6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-2, -16, 6, Math.PI * 0.9, Math.PI * 2.3);
  ctx.stroke();
  // eyes look the way it blows
  for (const sx of [-1, 1]) {
    const ex = sx * 7.5 + look.x * 2;
    const ey = -3 + look.y * 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 5.2, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.arc(ex + look.x * 1.6, ey + look.y * 1.6, 3.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0c4a6e';
    ctx.beginPath();
    ctx.arc(ex + look.x * 2, ey + look.y * 2, 1.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex - 1.5, ey - 2, 1.4, 0, TAU);
    ctx.fill();
  }
  // mouth: an "o" when blowing
  ctx.fillStyle = '#be185d';
  ctx.beginPath();
  if (inflate > 0.1) ctx.arc(look.x * 9, 8 + look.y * 5, 3 + inflate * 2, 0, TAU);
  else ctx.ellipse(look.x * 4, 9, 3, 1.5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // The direction it blows: a small arrow of wind
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * Math.sin(t * 4)})`;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  const o = 30 + (t * 20) % 8;
  ctx.beginPath();
  ctx.moveTo(o, -5);
  ctx.quadraticCurveTo(o + 8, -8, o + 14, -4);
  ctx.moveTo(o + 3, 4);
  ctx.quadraticCurveTo(o + 10, 1, o + 18, 5);
  ctx.stroke();
  ctx.restore();
}

function drawPad(ctx, pad) {
  const dx = pad.x2 - pad.x1;
  const dy = pad.y2 - pad.y1;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const cx = (pad.x1 + pad.x2) / 2;
  const cy = (pad.y1 + pad.y2) / 2;
  const sq = pad.squish;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  // stem
  ctx.fillStyle = '#fef3c7';
  ctx.strokeStyle = '#d6b88a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  roundRect(ctx, -8, 2, 16, 30, 6);
  ctx.fill();
  ctx.stroke();
  // springy cap, squashed when hit
  const w = len / 2 + 8 + sq * 6;
  const h = 15 * (1 - sq * 0.4);
  const g = ctx.createLinearGradient(0, -h, 0, 4);
  g.addColorStop(0, '#fb7185');
  g.addColorStop(1, '#be123c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-w, 4);
  ctx.quadraticCurveTo(-w, -h, 0, -h - 2);
  ctx.quadraticCurveTo(w, -h, w, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#881337';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [sx, sy, r] of [[-0.55, -0.35, 4], [-0.1, -0.7, 3.4], [0.4, -0.4, 4.4], [0.75, -0.05, 2.6]]) {
    ctx.beginPath();
    ctx.ellipse(sx * w, sy * h, r, r * 0.8, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function thornBall(ctx, x, y, r, rot) {
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const rr = i % 2 ? r * 0.72 : r * 1.35;
    const a = rot + (i * Math.PI) / 8;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  g.addColorStop(0, '#d1d5db');
  g.addColorStop(1, '#6b7280');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#84cc16';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.28, 0, TAU);
  ctx.fill();
}

function drawSpikes(ctx, sp, t) {
  const len = Math.hypot(sp.x2 - sp.x1, sp.y2 - sp.y1);
  const n = Math.max(2, Math.round(len / 24));
  ctx.strokeStyle = '#3f6212';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sp.x1, sp.y1);
  ctx.lineTo(sp.x2, sp.y2);
  ctx.stroke();
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    thornBall(ctx, sp.x1 + (sp.x2 - sp.x1) * k, sp.y1 + (sp.y2 - sp.y1) * k, 10, i * 0.7 + Math.sin(t * 1.5 + i) * 0.08);
  }
}

/** Oran berry: blue with a shine, a leafy top, squashed a little on bounces. */
export function drawBerry(ctx, x, y, { rot = 0, squash = 0, alpha = 1 } = {}) {
  const r = BERRY_R;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(3, r * 0.9, r * 0.8, r * 0.25, 0, 0, TAU);
  ctx.fill();
  ctx.rotate(rot);
  ctx.scale(1 + squash * 0.22, 1 - squash * 0.22);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 2, 0, 0, r * 1.05);
  g.addColorStop(0, '#bfdbfe');
  g.addColorStop(0.35, '#3b82f6');
  g.addColorStop(0.85, '#1d4ed8');
  g.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.82);
  ctx.bezierCurveTo(r * 0.6, -r * 1.12, r * 1.08, -r * 0.5, r, r * 0.1);
  ctx.bezierCurveTo(r * 0.95, r * 0.8, r * 0.45, r, 0, r);
  ctx.bezierCurveTo(-r * 0.45, r, -r * 0.95, r * 0.8, -r, r * 0.1);
  ctx.bezierCurveTo(-r * 1.08, -r * 0.5, -r * 0.6, -r * 1.12, 0, -r * 0.82);
  ctx.fill();
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Oran's pale band
  ctx.strokeStyle = 'rgba(191,219,254,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.78, r * 0.32, 0, 0.15, Math.PI - 0.15);
  ctx.stroke();
  // leaves
  ctx.fillStyle = '#16a34a';
  for (const a of [-0.9, 0, 0.9]) {
    ctx.save();
    ctx.translate(0, -r * 0.82);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, -5, 3, 6.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(0, -r * 0.85, 2.4, 0, TAU);
  ctx.fill();
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.42, -r * 0.35, r * 0.24, r * 0.14, -0.7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.55, 1.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawLedge(ctx, x, y, world) {
  const top = y;
  ctx.save();
  const rock = ['#a16207', '#0f766e', '#c4b5fd', '#713f12', '#3730a3'][world];
  const lip = ['#4ade80', '#5eead4', '#ffffff', '#65a30d', '#818cf8'][world];
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(x - 76, top);
  ctx.lineTo(x + 76, top);
  ctx.quadraticCurveTo(x + 66, top + 30, x + 30, top + 44);
  ctx.quadraticCurveTo(x, top + 70, x - 30, top + 44);
  ctx.quadraticCurveTo(x - 66, top + 30, x - 76, top);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(x - 50, top + 18);
  ctx.quadraticCurveTo(x, top + 34, x + 50, top + 18);
  ctx.quadraticCurveTo(x, top + 50, x - 50, top + 18);
  ctx.fill();
  ctx.fillStyle = lip;
  ctx.beginPath();
  roundRect(ctx, x - 80, top - 6, 160, 12, 6);
  ctx.fill();
  ctx.restore();
}

/** Snorlax drawn by hand, so it can breathe, peek, open its mouth, munch and bounce. */
export function drawSnorlax(ctx, mx, my, { t = 0, open = 0, mood = 'sleep', bounce = 0 } = {}) {
  const breathe = mood === 'sleep' || mood === 'peek' ? Math.sin(t * 1.7) : 0;
  const by = my - bounce;
  ctx.save();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(mx, my + 80, 62 - bounce * 0.3, 8, 0, 0, TAU);
  ctx.fill();
  ctx.translate(mx, by + 80);
  ctx.scale(1 + breathe * 0.015, 1 - breathe * 0.02 + (mood === 'won' ? 0 : 0));
  ctx.translate(-mx, -(by + 80));
  const teal = ctx.createLinearGradient(mx, by - 40, mx, by + 80);
  teal.addColorStop(0, '#3f7f8f');
  teal.addColorStop(1, '#245866');
  // feet
  ctx.fillStyle = '#f2dfb8';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(mx + sx * 38, by + 74, 17, 10, sx * 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8cf9f';
    ctx.beginPath();
    ctx.ellipse(mx + sx * 38, by + 75, 8, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (const k of [-1, 0, 1]) {
      ctx.beginPath();
      ctx.moveTo(mx + sx * 38 + k * 6 - 2, by + 66);
      ctx.lineTo(mx + sx * 38 + k * 6, by + 61);
      ctx.lineTo(mx + sx * 38 + k * 6 + 2, by + 66);
      ctx.fill();
    }
    ctx.fillStyle = '#f2dfb8';
  }
  // body
  ctx.fillStyle = teal;
  ctx.beginPath();
  ctx.ellipse(mx, by + 40, 62, 42, 0, 0, TAU);
  ctx.fill();
  // arms
  const armUp = mood === 'won' ? 1 : 0;
  for (const sx of [-1, 1]) {
    ctx.save();
    ctx.translate(mx + sx * 56, by + 30 - armUp * 22);
    ctx.rotate(sx * (0.5 + armUp * 1.6 + (mood === 'won' ? Math.sin(t * 12) * 0.2 : 0)));
    ctx.fillStyle = '#2f6a7a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 21, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-5, 18);
    ctx.lineTo(-3, 24);
    ctx.lineTo(-1, 18);
    ctx.moveTo(1, 19);
    ctx.lineTo(3, 25);
    ctx.lineTo(5, 19);
    ctx.fill();
    ctx.restore();
  }
  // belly
  const belly = ctx.createRadialGradient(mx - 10, by + 40, 4, mx, by + 50, 48);
  belly.addColorStop(0, '#fbf1da');
  belly.addColorStop(1, '#e9d3a5');
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(mx, by + 50, 45, 30, 0, 0, TAU);
  ctx.fill();
  // head
  ctx.fillStyle = teal;
  ctx.beginPath();
  ctx.ellipse(mx, by - 6, 45, 32, 0, 0, TAU);
  ctx.fill();
  // ears
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(mx + sx * 18, by - 34);
    ctx.lineTo(mx + sx * 34, by - 50);
    ctx.lineTo(mx + sx * 40, by - 24);
    ctx.closePath();
    ctx.fill();
  }
  // face
  ctx.fillStyle = '#f2dfb8';
  ctx.beginPath();
  ctx.moveTo(mx - 36, by + 4);
  ctx.quadraticCurveTo(mx - 34, by - 24, mx - 14, by - 22);
  ctx.quadraticCurveTo(mx, by - 12, mx + 14, by - 22);
  ctx.quadraticCurveTo(mx + 34, by - 24, mx + 36, by + 4);
  ctx.quadraticCurveTo(mx + 30, by + 24, mx, by + 24);
  ctx.quadraticCurveTo(mx - 30, by + 24, mx - 36, by + 4);
  ctx.fill();
  // eyes
  ctx.strokeStyle = '#1f2937';
  ctx.fillStyle = '#1f2937';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (const sx of [-1, 1]) {
    const ex = mx + sx * 14;
    const ey = by - 7;
    ctx.beginPath();
    if (mood === 'won') {
      ctx.arc(ex, ey + 2, 5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (mood === 'peek' && open > 0.4) {
      ctx.ellipse(ex, ey, 3.2, 3.2 * Math.min(1, open), 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex - 1, ey - 1, 1, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1f2937';
    } else if (mood === 'sad') {
      ctx.moveTo(ex - 6, ey - 1);
      ctx.lineTo(ex + 6, ey - 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ex - sx * 7, ey - 8);
      ctx.lineTo(ex + sx * 4, ey - 5);
      ctx.stroke();
    } else {
      ctx.moveTo(ex - 7, ey);
      ctx.lineTo(ex + 7, ey);
      ctx.stroke();
    }
  }
  // mouth
  const mouthY = by + 9;
  if (open > 0.05) {
    const rx = 9 + open * 9;
    const ry = 2 + open * 11;
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(mx, mouthY, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.ellipse(mx, mouthY + ry * 0.45, rx * 0.6, ry * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(mx + sx * rx * 0.75 - 3, mouthY + ry * 0.5);
      ctx.lineTo(mx + sx * rx * 0.62, mouthY - ry * 0.3);
      ctx.lineTo(mx + sx * rx * 0.55 + 3 * sx, mouthY + ry * 0.62);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (mood === 'sad') ctx.arc(mx, mouthY + 6, 8, Math.PI * 1.2, Math.PI * 1.8);
    else {
      ctx.moveTo(mx - 10, mouthY);
      ctx.quadraticCurveTo(mx - 5, mouthY + 3, mx, mouthY);
      ctx.quadraticCurveTo(mx + 5, mouthY + 3, mx + 10, mouthY);
    }
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(mx + sx * 8 - 2, mouthY + 1);
      ctx.lineTo(mx + sx * 7, mouthY - 4);
      ctx.lineTo(mx + sx * 8 + 2, mouthY + 1);
      ctx.fill();
    }
  }
  // blush
  ctx.fillStyle = 'rgba(251,113,133,0.35)';
  ctx.beginPath();
  ctx.ellipse(mx - 25, by + 6, 6, 3.5, 0, 0, TAU);
  ctx.ellipse(mx + 25, by + 6, 6, 3.5, 0, 0, TAU);
  ctx.fill();
  if (mood === 'sad') {
    ctx.fillStyle = '#7dd3fc';
    const ty = by - 2 + ((t * 30) % 14);
    ctx.beginPath();
    ctx.moveTo(mx + 18, ty - 4);
    ctx.quadraticCurveTo(mx + 22, ty + 2, mx + 18, ty + 4);
    ctx.quadraticCurveTo(mx + 14, ty + 2, mx + 18, ty - 4);
    ctx.fill();
  }
  ctx.restore();
  // Zzz while asleep
  if (mood === 'sleep') {
    for (let k = 0; k < 3; k++) {
      const p = (t * 0.45 + k / 3) % 1;
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
      ctx.font = `900 ${Math.round(13 + p * 10)}px system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(30,58,138,0.6)';
      ctx.lineWidth = 3;
      const zx = mx + 32 + p * 26 + Math.sin(p * 6 + k) * 4;
      const zy = my - 40 - p * 46;
      ctx.strokeText('Z', zx, zy);
      ctx.fillText('Z', zx, zy);
      ctx.restore();
    }
  }
}

function drawPlayer(ctx, img, x, y, v) {
  const t = v.time;
  const mood = v.player.mood;
  let hop = 0;
  if (mood === 'win') hop = Math.abs(Math.sin(t * 7)) * 18;
  else if (v.player.hop > 0) hop = Math.sin((1 - v.player.hop) * Math.PI) * 22;
  const size = 66;
  const tilt = mood === 'fail' ? -0.12 : Math.sin(t * 2) * 0.04;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.42, 22 - hop * 0.3, 5, 0, 0, TAU);
  ctx.fill();
  ctx.translate(x, y - hop);
  ctx.rotate(tilt);
  if (imageReady(img)) ctx.drawImage(img, -size / 2, -size / 2, size, size);
  else {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.32, 0, TAU);
    ctx.fill();
  }
  if (mood === 'fail') {
    // Paws over the eyes
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#fff7ed';
      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(sx * 9, -10, 10, 8, sx * 0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.arc(20, -22, 4, 0, TAU);
    ctx.fill();
  } else if (mood === 'win' || v.player.hop > 0) {
    ctx.font = '900 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mood === 'win' ? '🎉' : '⭐', 22, -26);
  }
  ctx.restore();
}

function drawTrail(ctx, trail, now) {
  if (trail.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const age = now - b.t;
    const k = Math.max(0, 1 - age / 0.28);
    if (k <= 0) continue;
    const w = 2 + 9 * k * (i / trail.length);
    ctx.strokeStyle = `rgba(103,232,249,${0.45 * k})`;
    ctx.lineWidth = w + 6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.95 * k})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Paint one frame. `v` holds the view-only bits: time, particles, trail, moods. */
export function drawSnorlaxScene(ctx, s, v, img) {
  const t = v.time;
  drawBackground(ctx, s, v);
  const world = s.def.world ?? 0;
  if (s.mouth.y < 440) drawLedge(ctx, s.mouth.x, s.mouth.y + 84, world);
  for (const sp of s.spikes) drawSpikes(ctx, sp, t);
  for (const pad of s.pads) drawPad(ctx, pad);
  s.webs.forEach((w) => drawWeb(ctx, w, t, w.used));
  s.stars.forEach((st, i) => drawStar(ctx, st, t, i));
  s.puffers.forEach((p) => drawPuffer(ctx, p, t, p.cool > 0 ? p.cool / 0.35 : 0));
  // Snorlax
  const mood = s.status === 'won' ? 'won' : s.status === 'lost' ? 'sad' : s.near > 0.35 ? 'peek' : 'sleep';
  let open = s.status === 'play' ? Math.max(0, (s.near - 0.3) / 0.7) : 0;
  let bounce = 0;
  if (s.status === 'won') {
    const since = t - (v.wonAt ?? t);
    open = since < 1.1 ? Math.abs(Math.sin(since * 11)) * 0.7 : 0;
    bounce = since > 0.6 ? Math.abs(Math.sin((since - 0.6) * 6)) * 14 : 0;
  }
  v.open = (v.open ?? 0) + (open - (v.open ?? 0)) * 0.3;
  drawSnorlax(ctx, s.mouth.x, s.mouth.y, { t, open: v.open, mood, bounce });
  const ps = playerSpot(s);
  drawPlayer(ctx, img, ps.x, ps.y, v);
  // Ropes
  for (const r of s.ropes) {
    if (r.points.length > 1) drawRope(ctx, r.points, 1, r.web >= 0);
    if (r.tail && r.tail.points.length > 1 && s.status !== 'won') drawRope(ctx, r.tail.points, Math.min(1, r.tail.life * 1.5), r.web >= 0);
  }
  for (const r of s.ropes) if (r.active && r.web < 0) drawPeg(ctx, r.ax, r.ay);
  // Bubbles that are free, then the berry (with its bubble)
  s.bubbles.forEach((q) => q.state === 'free' && drawBubble(ctx, q, t, false));
  if (s.berry.alive && s.status !== 'won') {
    v.spin = (v.spin ?? 0) + (s.berry.x - s.berry.px) * 0.04;
    drawBerry(ctx, s.berry.x, s.berry.y, { rot: v.spin, squash: v.squash || 0 });
    if (s.berry.bubble >= 0) drawBubble(ctx, s.bubbles[s.berry.bubble], t, true);
  }
  updateParticles(ctx, v.particles, v.dt);
  // Floating texts
  for (let i = v.floats.length - 1; i >= 0; i--) {
    const f = v.floats[i];
    f.life -= v.dt;
    if (f.life <= 0) {
      v.floats.splice(i, 1);
      continue;
    }
    const k = 1 - f.life / f.max;
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life * 3);
    ctx.font = `900 ${Math.round(20 + (k < 0.2 ? k * 30 : 6))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.strokeText(f.text, f.x, f.y - k * 40);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - k * 40);
    ctx.restore();
  }
  drawTrail(ctx, v.trail, t);
}
