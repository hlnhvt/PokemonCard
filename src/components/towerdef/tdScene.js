// Thủ thành Pokémon: the static 2.5D map (ground, raised road, build pads, portal, scenery), painted once per
// level into an offscreen canvas at the screen's pixel ratio, plus the cheap animated touches drawn every frame.
import { TD_W as W, TD_H as H, distToPath, pointAt } from '../../utils/towerdef/levels';
import { drawPokeball } from '../sports/sportsKit';
import {
  TAU, seededRnd, mix, lighten, darken, rgba, roundRect, softShadow, castShadow, ball, box, cylinder, makeCanvas, drawGlow,
} from './tdKit';

const ROAD_OUT = 46; // curb / bank width
const ROAD_IN = 34; // walking surface width
const SIDE = 5; // thickness of the raised road edge

// ---------- Theme palettes ----------

const PAL = {
  forest: {
    g: ['#93dc6c', '#5cb548'], hi: '#b8ef8c', lo: '#3f8f37', vign: '#123d1a',
    road: '#d6a56a', roadHi: '#e8c08a', roadLo: '#a8743f', curb: '#9b6a39', side: '#5f3b1b', style: 'dirt', sunken: true,
    pad: ['#e7ecf2', '#8e9bb0'], portal: ['#8b8f98', '#4b5160'],
    decor: { tree: 6, pine: 2, bush: 3, rock: 2, flowers: 3, stump: 1, mushroom: 1.5, fence: 1 },
  },
  beach: {
    g: ['#fbe3a1', '#f2cd7c'], hi: '#fff3cf', lo: '#d9ad62', vign: '#7a4a12',
    road: '#c98d55', roadHi: '#dfa871', roadLo: '#94612f', curb: '#8a5a2c', side: '#5a3818', style: 'planks', sunken: false,
    pad: ['#fff4dc', '#c9a46a'], portal: ['#a77a4b', '#6b4724'],
    decor: { palm: 5, umbrella: 2, rock: 2, bush: 1.2, sandcastle: 1, star: 2, shell: 1.5 },
  },
  cave: {
    g: ['#6e655d', '#3e3732'], hi: '#8b8178', lo: '#2c2622', vign: '#0b0806',
    road: '#9a8d7e', roadHi: '#b2a594', roadLo: '#6c6052', curb: '#5d544c', side: '#2f2925', style: 'slabs', sunken: true,
    pad: ['#cbc3b9', '#6f665d'], portal: ['#6b625a', '#36302b'],
    decor: { crystal: 4, stalag: 3, rock: 3, gshroom: 2 },
  },
  city: {
    g: ['#90d861', '#62b23e'], hi: '#b6ec8a', lo: '#47922f', vign: '#183018',
    road: '#9aa6b8', roadHi: '#b9c3d1', roadLo: '#6d798c', curb: '#d9dde3', side: '#8a929e', style: 'cobble', sunken: true,
    pad: ['#eef2f7', '#8d99ab'], portal: ['#94a3b8', '#475569'],
    decor: { house: 3.2, tree: 3, lamp: 2, planter: 2, bush: 2, flowers: 1 },
  },
  volcano: {
    g: ['#4a2b23', '#26140f'], hi: '#6a4034', lo: '#170b08', vign: '#120302',
    road: '#a68e78', roadHi: '#c4ac94', roadLo: '#73604f', curb: '#4b3b33', side: '#21150f', style: 'bridge', sunken: false,
    pad: ['#b7aaa0', '#5a4b42'], portal: ['#5b4038', '#2a1a14'],
    decor: { lava: 3, basalt: 4, dead: 2, vent: 1.5 },
  },
  snow: {
    g: ['#fbfdff', '#dbe7f4'], hi: '#ffffff', lo: '#b7cbe3', vign: '#3d5a80',
    road: '#a8cdf0', roadHi: '#d6e9fb', roadLo: '#7aa6d6', curb: '#f4f8fc', side: '#8fb0d6', style: 'ice', sunken: true,
    pad: ['#f0f7ff', '#93b4dc'], portal: ['#b9d6f2', '#6d93bf'],
    decor: { snowpine: 5, snowman: 1.5, snowrock: 3, ice: 1.5 },
  },
  rocket: {
    g: ['#4b5768', '#2a3342'], hi: '#5f6c7e', lo: '#1d2430', vign: '#05070b',
    road: '#7b8799', roadHi: '#98a3b3', roadLo: '#556173', curb: '#facc15', side: '#3b3f47', style: 'steel', sunken: false,
    pad: ['#d5dce6', '#6b7789'], portal: ['#4b5563', '#1f2937'],
    decor: { crate: 3, crates: 2, barrel: 3, warn: 1.5, flag: 1, console: 1.5 },
  },
  indigo: {
    g: ['#f3eefc', '#ddd2f3'], hi: '#ffffff', lo: '#b8a6dd', vign: '#2e1065',
    road: '#d42a3a', roadHi: '#ef4b58', roadLo: '#9b1626', curb: '#efe6d2', side: '#a8946b', style: 'carpet', sunken: false,
    pad: ['#fbf8ff', '#a996cf'], portal: ['#c4b5fd', '#6d4fb3'],
    decor: { column: 2.5, topiary: 3, planter: 2, banner: 1, statue: 1.2, flowers: 1.5 },
  },
};

/** Footprint radius and height of each scenery piece (for spacing and shadows). */
const DECOR = {
  tree: [12, 38], pine: [10, 42], bush: [9, 13], rock: [10, 12], flowers: [7, 3], stump: [7, 8], mushroom: [6, 10], fence: [14, 12],
  palm: [9, 46], umbrella: [13, 30], sandcastle: [11, 18], star: [5, 1], shell: [5, 1],
  crystal: [10, 26], stalag: [9, 26], gshroom: [7, 10],
  house: [18, 34], lamp: [5, 32], planter: [13, 12],
  lava: [16, 0], basalt: [11, 15], dead: [9, 30], vent: [8, 8],
  snowpine: [10, 42], snowman: [9, 28], snowrock: [10, 13], ice: [9, 22],
  crate: [11, 18], crates: [14, 30], barrel: [7, 16], warn: [5, 30], flag: [6, 38], console: [11, 16],
  column: [9, 44], topiary: [9, 28], banner: [6, 40], statue: [10, 30],
};

// ---------- Small painters ----------

function blob(ctx, x, y, r, color, a, squash = 0.7) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, squash);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function polyline(ctx, pts, dx = 0, dy = 0) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy)));
}

function strokeRoad(ctx, pts, width, color, dx = 0, dy = 0) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  polyline(ctx, pts, dx, dy);
  ctx.stroke();
}

/** Polyline offset sideways by d (miter joins). */
function offsetLine(pts, d) {
  const nrm = (ax, ay, bx, by) => {
    const l = Math.hypot(bx - ax, by - ay) || 1;
    return { x: -(by - ay) / l, y: (bx - ax) / l };
  };
  return pts.map((p, i) => {
    const n1 = i > 0 ? nrm(pts[i - 1].x, pts[i - 1].y, p.x, p.y) : null;
    const n2 = i < pts.length - 1 ? nrm(p.x, p.y, pts[i + 1].x, pts[i + 1].y) : null;
    if (!n1 || !n2) {
      const n = n1 || n2;
      return { x: p.x + n.x * d, y: p.y + n.y * d };
    }
    let nx = n1.x + n2.x;
    let ny = n1.y + n2.y;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    const k = d / Math.max(0.3, nx * n1.x + ny * n1.y);
    return { x: p.x + nx * k, y: p.y + ny * k };
  });
}

/** Points every `step` px along a polyline (only the ones on screen). */
function samples(pts, step) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / (len || 1);
    const uy = (b.y - a.y) / (len || 1);
    for (let d = 0; d < len; d += step) {
      const x = a.x + ux * d;
      const y = a.y + uy * d;
      if (x > -10 && x < W + 10 && y > -10 && y < H + 10) out.push({ x, y, ux, uy });
    }
  }
  return out;
}

/** Each road segment with its direction and normal. */
function segments(pts) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    out.push({ a, b, len, ux, uy, nx: -uy, ny: ux });
  }
  return out;
}

/** Inner bevel on a layer: light on one inner edge, shade on the other (sunken = shade on the lit side). */
function bevel(lctx, tmp, mask, sunken, strength = 1) {
  const [tc, t] = tmp;
  const run = (color, a, dx, dy, blur) => {
    t.save();
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.clearRect(0, 0, tc.width, tc.height);
    t.restore();
    t.globalCompositeOperation = 'source-over';
    t.fillStyle = rgba(color, a * strength);
    t.fillRect(-20, -20, W + 40, H + 40);
    t.globalCompositeOperation = 'destination-out';
    if ('filter' in t) t.filter = `blur(${blur}px)`;
    mask(t, dx, dy);
    if ('filter' in t) t.filter = 'none';
    t.globalCompositeOperation = 'source-over';
    lctx.save();
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-atop';
    lctx.drawImage(tc, 0, 0);
    lctx.restore();
  };
  if (sunken) {
    run('#000000', 0.42, 2.2, 4, 1.5);
    run('#ffffff', 0.3, -1.2, -2.4, 1);
  } else {
    run('#ffffff', 0.38, 1.4, 2.6, 0.8);
    run('#000000', 0.4, -1.6, -3.2, 1.4);
  }
}

// ---------- Ground ----------

function groundBase(ctx, P, rnd, n = 34) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, P.g[0]);
  g.addColorStop(1, P.g[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < n; i++) blob(ctx, rnd() * W, rnd() * H, 30 + rnd() * 70, rnd() < 0.5 ? P.hi : P.lo, 0.28 + rnd() * 0.25, 0.55 + rnd() * 0.3);
}

function tuft(ctx, x, y, s, dark, light) {
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.strokeStyle = i === 0 ? light : dark;
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath();
    ctx.moveTo(x + i * 1.6 * s, y);
    ctx.quadraticCurveTo(x + i * 2 * s, y - 3 * s, x + i * 3.2 * s, y - (5.5 - Math.abs(i)) * s);
    ctx.stroke();
  }
}

function tinyFlower(ctx, x, y, c) {
  ctx.fillStyle = c;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.1, 1.1, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(x, y, 0.8, 0, TAU);
  ctx.fill();
}

function pebble(ctx, x, y, r, c) {
  softShadow(ctx, x + r * 0.5, y + r * 0.5, r * 1.3, r * 0.7, 0.3);
  ball(ctx, x, y, r, c, 0.5, 0.3);
}

function jaggedLine(ctx, rnd, x, y, len, ang, wob) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  let a = ang;
  const n = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    a += (rnd() - 0.5) * wob;
    x += Math.cos(a) * (len / n);
    y += Math.sin(a) * (len / n);
    ctx.lineTo(x, y);
  }
}

function shoreX(y) {
  return W - 36 + Math.sin(y / 37) * 5 + Math.sin(y / 13 + 1) * 2;
}

function paintGround(ctx, lv, P, rnd) {
  const th = lv.theme;
  if (th === 'rocket') {
    ctx.fillStyle = P.g[1];
    ctx.fillRect(0, 0, W, H);
    const S = 40;
    for (let y = -10; y < H; y += S) {
      for (let x = (Math.floor(y / S) % 2) * -20; x < W; x += S) {
        const c = mix(P.g[0], P.g[1], 0.2 + rnd() * 0.5);
        ctx.fillStyle = c;
        ctx.fillRect(x + 1, y + 1, S - 2, S - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + 1, y + 1, S - 2, 1.5);
        ctx.fillRect(x + 1, y + 1, 1.5, S - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + 1, y + S - 2.5, S - 2, 1.5);
        ctx.fillRect(x + S - 2.5, y + 1, 1.5, S - 2);
        if (rnd() < 0.35) {
          ctx.strokeStyle = 'rgba(255,255,255,0.07)';
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
              const px = x + 5 + i * 7;
              const py = y + 5 + j * 7;
              ctx.beginPath();
              const k = (i + j) % 2;
              ctx.moveTo(px + (k ? 0 : 3), py);
              ctx.lineTo(px + (k ? 3 : 0), py + 3);
              ctx.stroke();
            }
          }
        }
        for (const [rx, ry] of [[4, 4], [S - 5, 4], [4, S - 5], [S - 5, S - 5]]) {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.beginPath();
          ctx.arc(x + rx + 0.4, y + ry + 0.4, 1.4, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#9aa5b4';
          ctx.beginPath();
          ctx.arc(x + rx, y + ry, 1.1, 0, TAU);
          ctx.fill();
        }
      }
    }
    for (let i = 0; i < 9; i++) blob(ctx, rnd() * W, rnd() * H, 12 + rnd() * 22, '#0b0f16', 0.35, 0.6);
    for (let i = 0; i < 12; i++) blob(ctx, rnd() * W, rnd() * H, 40 + rnd() * 50, rnd() < 0.5 ? '#7d8a9c' : '#111827', 0.18);
    return;
  }
  if (th === 'indigo') {
    const S = 30;
    for (let y = 0; y < H; y += S) {
      for (let x = 0; x < W; x += S) {
        const odd = ((x + y) / S) % 2;
        const base = odd ? '#ddd0f5' : '#f8f4ff';
        const g = ctx.createLinearGradient(x, y, x + S, y + S);
        g.addColorStop(0, lighten(base, 0.3));
        g.addColorStop(1, mix(base, '#c7b8e6', 0.25));
        ctx.fillStyle = g;
        ctx.fillRect(x, y, S, S);
        ctx.strokeStyle = 'rgba(140,115,190,0.22)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x + rnd() * S, y);
        ctx.bezierCurveTo(x + rnd() * S, y + S * 0.3, x + rnd() * S, y + S * 0.7, x + rnd() * S, y + S);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(x + 1, y + 1, S - 2, 1);
        ctx.fillStyle = 'rgba(90,60,150,0.2)';
        ctx.fillRect(x + 1, y + S - 1.5, S - 1.5, 1.5);
        ctx.fillRect(x + S - 1.5, y + 1, 1.5, S - 1.5);
      }
    }
    for (let i = 0; i < 14; i++) blob(ctx, rnd() * W, rnd() * H, 40 + rnd() * 60, rnd() < 0.5 ? '#ffffff' : '#a78bfa', 0.16);
    return;
  }
  groundBase(ctx, P, rnd);
  if (th === 'forest' || th === 'city') {
    if (th === 'city') {
      ctx.save();
      ctx.rotate(-0.5);
      for (let k = -30; k < 30; k += 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(k * 22, -100, 22, H * 2);
      }
      ctx.restore();
    }
    const n = th === 'forest' ? 360 : 160;
    for (let i = 0; i < n; i++) tuft(ctx, rnd() * W, rnd() * H, 0.7 + rnd() * 0.6, rgba(P.lo, 0.8), rgba(P.hi, 0.9));
    const fl = ['#ffffff', '#fde047', '#f9a8d4', '#93c5fd', '#fca5a5'];
    for (let i = 0; i < (th === 'forest' ? 60 : 24); i++) tinyFlower(ctx, rnd() * W, rnd() * H, fl[Math.floor(rnd() * fl.length)]);
    for (let i = 0; i < 18; i++) pebble(ctx, rnd() * W, rnd() * H, 1.2 + rnd() * 1.4, '#c7c2b8');
  } else if (th === 'beach') {
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(160,110,40,0.22)';
      ctx.fillRect(rnd() * W, rnd() * H, 1, 1);
    }
    for (let i = 0; i < 80; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const l = 14 + rnd() * 26;
      for (const [c, o] of [['rgba(176,124,52,0.28)', 0], ['rgba(255,255,255,0.4)', -1.2]]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let k = 0; k <= 8; k++) ctx.lineTo(x + (k / 8) * l, y + o + Math.sin(k * 1.2 + x) * 1.6);
        ctx.stroke();
      }
    }
    // Wet sand, then the sea along the right
    ctx.fillStyle = 'rgba(170,120,50,0.25)';
    ctx.beginPath();
    ctx.moveTo(W, 0);
    for (let y = 0; y <= H; y += 6) ctx.lineTo(shoreX(y) - 9, y);
    ctx.lineTo(W, H);
    ctx.fill();
    const sg = ctx.createLinearGradient(W - 40, 0, W, 0);
    sg.addColorStop(0, '#5eead4');
    sg.addColorStop(0.35, '#22b8e0');
    sg.addColorStop(1, '#0369a1');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(W + 2, 0);
    for (let y = 0; y <= H; y += 6) ctx.lineTo(shoreX(y), y);
    ctx.lineTo(W + 2, H);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 40; i++) {
      const y = rnd() * H;
      const x = shoreX(y) + 8 + rnd() * 24;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 3, y - 1.5, x + 6, y);
      ctx.stroke();
    }
  } else if (th === 'cave') {
    for (let i = 0; i < 70; i++) {
      jaggedLine(ctx, rnd, rnd() * W, rnd() * H, 14 + rnd() * 30, rnd() * TAU, 1.4);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.save();
      ctx.translate(0.6, 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 120; i++) pebble(ctx, rnd() * W, rnd() * H, 1 + rnd() * 2.2, mix('#8b8178', '#5b524b', rnd()));
    for (let i = 0; i < 10; i++) blob(ctx, rnd() * W, rnd() * H, 16 + rnd() * 20, '#4d7c4a', 0.25);
    for (let i = 0; i < 14; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const c = rnd() < 0.5 ? '#67e8f9' : '#c4b5fd';
      drawGlow(ctx, c, x, y, 8, 0.5);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x + 1.6, y);
      ctx.lineTo(x, y + 1.5);
      ctx.lineTo(x - 1.6, y);
      ctx.fill();
    }
  } else if (th === 'volcano') {
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.25)';
      ctx.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
    }
    for (let i = 0; i < 16; i++) drawGlow(ctx, '#ea580c', rnd() * W, rnd() * H, 30 + rnd() * 30, 0.18);
    for (let i = 0; i < 60; i++) {
      jaggedLine(ctx, rnd, rnd() * W, rnd() * H, 18 + rnd() * 40, rnd() * TAU, 1.2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(249,115,22,0.22)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  } else if (th === 'snow') {
    for (let i = 0; i < 30; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 14 + rnd() * 30;
      blob(ctx, x + r * 0.2, y + r * 0.15, r, '#9fb9da', 0.4, 0.45);
      blob(ctx, x - r * 0.15, y - r * 0.12, r * 0.8, '#ffffff', 0.9, 0.4);
    }
    for (let i = 0; i < 160; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      ctx.fillStyle = rnd() < 0.6 ? 'rgba(255,255,255,0.95)' : 'rgba(147,197,253,0.7)';
      ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
    }
    ctx.strokeStyle = 'rgba(90,70,50,0.5)';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 16; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y - 4);
      ctx.moveTo(x, y);
      ctx.lineTo(x + 2.5, y - 3.5);
      ctx.stroke();
    }
  }
}

// ---------- Road ----------

function paintRoad(ctx, lv, P, rnd, dpr) {
  const pts = lv.path.pts;
  const segs = segments(pts);
  const th = lv.theme;
  const mk = () => {
    const m = makeCanvas(W * dpr, H * dpr);
    if (m) m[1].scale(dpr, dpr);
    return m;
  };
  const curbL = mk();
  const roadL = mk();
  const tmp = mk();
  if (!curbL || !roadL || !tmp) return;

  // Glow of lava under the volcano bridge
  if (th === 'volcano') {
    strokeRoad(ctx, pts, ROAD_OUT + 26, 'rgba(234,88,12,0.18)');
    strokeRoad(ctx, pts, ROAD_OUT + 12, 'rgba(249,115,22,0.35)', 0, 3);
    strokeRoad(ctx, pts, ROAD_OUT + 5, '#fb923c', 0, SIDE + 1);
  }
  // Soft drop shadow + side band (thickness)
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(4px)';
  strokeRoad(ctx, pts, ROAD_OUT + 2, 'rgba(0,0,0,0.38)', 4, SIDE + 4);
  ctx.restore();
  ctx.filter = 'none';
  strokeRoad(ctx, pts, ROAD_OUT, P.side, 0, SIDE);
  strokeRoad(ctx, pts, ROAD_OUT, darken(P.side, 0.25), 0, SIDE + 1.5);
  strokeRoad(ctx, pts, ROAD_OUT, P.side, 0, SIDE);

  // ----- curb layer -----
  const [, c] = curbL;
  strokeRoad(c, pts, ROAD_OUT, P.curb);
  c.globalCompositeOperation = 'source-atop';
  if (th === 'rocket') {
    // Hazard stripes
    const m = makeCanvas(16, 16);
    if (m) {
      const [pc, p] = m;
      p.fillStyle = '#facc15';
      p.fillRect(0, 0, 16, 16);
      p.fillStyle = '#1f2937';
      p.beginPath();
      p.moveTo(0, 0);
      p.lineTo(8, 0);
      p.lineTo(0, 8);
      p.closePath();
      p.moveTo(16, 0);
      p.lineTo(16, 8);
      p.lineTo(8, 16);
      p.lineTo(0, 16);
      p.closePath();
      p.fill();
      c.fillStyle = c.createPattern(pc, 'repeat');
      c.fillRect(0, 0, W, H);
    }
  } else if (th === 'beach') {
    c.lineWidth = 0.8;
    for (const s of segs) {
      for (let i = 0; i < s.len / 3; i++) {
        const d = rnd() * s.len;
        const o = (rnd() - 0.5) * ROAD_OUT;
        const l = 8 + rnd() * 22;
        const x = s.a.x + s.ux * d + s.nx * o;
        const y = s.a.y + s.uy * d + s.ny * o;
        c.strokeStyle = rnd() < 0.6 ? 'rgba(50,25,8,0.3)' : 'rgba(255,230,190,0.25)';
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + s.ux * l, y + s.uy * l);
        c.stroke();
      }
    }
  } else if (th === 'forest' || th === 'snow') {
    for (let i = 0; i < 260; i++) {
      const p = pointAt(lv.path, rnd() * lv.path.length);
      blob(c, p.x + (rnd() - 0.5) * 50, p.y + (rnd() - 0.5) * 50, 4 + rnd() * 8, rnd() < 0.5 ? lighten(P.curb, 0.3) : darken(P.curb, 0.2), 0.5);
    }
  } else {
    // Stone blocks
    const S = th === 'city' ? 9 : th === 'indigo' ? 11 : 10;
    for (let y = -S; y < H + S; y += S * 0.75) {
      const off = (Math.round(y / (S * 0.75)) % 2) * S * 0.5;
      for (let x = -S + off; x < W + S; x += S) {
        const col = mix(P.curb, rnd() < 0.5 ? '#ffffff' : '#000000', rnd() * (th === 'indigo' ? 0.1 : 0.18));
        c.fillStyle = col;
        roundRect(c, x + 0.6, y + 0.6, S - 1.2, S * 0.75 - 1.2, 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(x + 1.2, y + 1, S - 2.6, 1);
      }
    }
  }
  c.globalCompositeOperation = 'source-over';
  bevel(c, tmp, (t, dx, dy) => strokeRoad(t, pts, ROAD_OUT, '#000', dx, dy), false, 0.9);

  // ----- road layer -----
  const [, r] = roadL;
  strokeRoad(r, pts, ROAD_IN, P.road);
  r.globalCompositeOperation = 'source-atop';
  const style = P.style;
  const along = (fn, step) => {
    for (const s of segs) for (let d = -ROAD_IN / 2; d < s.len + ROAD_IN / 2; d += step) fn(s, s.a.x + s.ux * d, s.a.y + s.uy * d, d);
  };
  if (style === 'dirt') {
    for (let i = 0; i < 260; i++) {
      const p = pointAt(lv.path, rnd() * lv.path.length);
      blob(r, p.x + (rnd() - 0.5) * 36, p.y + (rnd() - 0.5) * 36, 3 + rnd() * 9, rnd() < 0.5 ? P.roadHi : P.roadLo, 0.55);
    }
    for (const d of [-8, 8]) {
      const o = offsetLine(pts, d);
      strokeRoad(r, o, 4, rgba(P.roadLo, 0.55));
      strokeRoad(r, o, 1.2, rgba(P.roadHi, 0.8), -0.6, -1.6);
    }
    for (let i = 0; i < 220; i++) {
      const p = pointAt(lv.path, rnd() * lv.path.length);
      const x = p.x + (rnd() - 0.5) * 34;
      const y = p.y + (rnd() - 0.5) * 34;
      pebble(r, x, y, 0.8 + rnd() * 1.6, mix('#e7d3b5', '#a08060', rnd()));
    }
  } else if (style === 'planks') {
    along((s, x, y) => {
      const shade = mix(P.road, rnd() < 0.5 ? P.roadHi : P.roadLo, rnd() * 0.7);
      r.save();
      r.translate(x, y);
      r.rotate(Math.atan2(s.uy, s.ux));
      r.fillStyle = shade;
      r.fillRect(0, -ROAD_IN / 2, 6.2, ROAD_IN);
      r.fillStyle = 'rgba(60,30,10,0.55)';
      r.fillRect(6.2, -ROAD_IN / 2, 1.3, ROAD_IN);
      r.fillStyle = 'rgba(255,240,210,0.35)';
      r.fillRect(0, -ROAD_IN / 2, 1, ROAD_IN);
      r.strokeStyle = 'rgba(90,50,20,0.25)';
      r.lineWidth = 0.6;
      r.beginPath();
      r.moveTo(1.5, -ROAD_IN / 2 + rnd() * 6);
      r.lineTo(4 + rnd() * 2, ROAD_IN / 2 - rnd() * 6);
      r.stroke();
      r.fillStyle = '#3f2a1a';
      for (const k of [-12, 12]) {
        r.beginPath();
        r.arc(3.1, k, 0.8, 0, TAU);
        r.fill();
      }
      r.restore();
    }, 7.5);
  } else if (style === 'slabs' || style === 'cobble') {
    r.fillStyle = darken(P.road, 0.35);
    r.fillRect(0, 0, W, H);
    const S = style === 'cobble' ? 7 : 13;
    for (let y = -S; y < H + S; y += S * 0.85) {
      const off = (Math.round(y / (S * 0.85)) % 2) * S * 0.5;
      for (let x = -S + off; x < W + S; x += S) {
        if (distToPath(lv.path, x + S / 2, y + S / 2) > ROAD_IN / 2 + S) continue;
        const jx = style === 'slabs' ? (rnd() - 0.5) * 3 : 0;
        const col = mix(P.road, rnd() < 0.5 ? P.roadHi : P.roadLo, rnd() * 0.8);
        const g = r.createLinearGradient(x, y, x + S, y + S);
        g.addColorStop(0, lighten(col, 0.18));
        g.addColorStop(1, darken(col, 0.15));
        r.fillStyle = g;
        roundRect(r, x + 0.8 + jx, y + 0.8, S - 1.6, S * 0.85 - 1.6, style === 'cobble' ? 2.4 : 3);
        r.fill();
        r.fillStyle = 'rgba(255,255,255,0.3)';
        r.fillRect(x + 2 + jx, y + 1.3, S - 4.5, 0.9);
      }
    }
    if (style === 'slabs') for (let i = 0; i < 40; i++) {
      const p = pointAt(lv.path, rnd() * lv.path.length);
      blob(r, p.x + (rnd() - 0.5) * 30, p.y + (rnd() - 0.5) * 30, 6 + rnd() * 8, '#3b342f', 0.3);
    }
  } else if (style === 'bridge') {
    along((s, x, y, d) => {
      r.save();
      r.translate(x, y);
      r.rotate(Math.atan2(s.uy, s.ux));
      for (let row = 0; row < 3; row++) {
        const w = ROAD_IN / 3;
                const col = mix(P.road, rnd() < 0.5 ? P.roadHi : P.roadLo, rnd() * 0.8);
        r.fillStyle = col;
        roundRect(r, 0.7, -ROAD_IN / 2 + row * w + 0.7, 11.3, w - 1.4, 2.2);
        r.fill();
        r.fillStyle = 'rgba(255,255,255,0.22)';
        r.fillRect(1.6, -ROAD_IN / 2 + row * w + 1.2, 9, 0.9);
        if ((Math.floor(d / 12) + row) % 3 === 0) {
          r.strokeStyle = 'rgba(40,20,10,0.35)';
          r.lineWidth = 0.6;
          r.beginPath();
          r.moveTo(3, -ROAD_IN / 2 + row * w + 2);
          r.lineTo(6, -ROAD_IN / 2 + row * w + w - 2);
          r.stroke();
        }
      }
      r.restore();
    }, 12);
  } else if (style === 'ice') {
    for (let i = 0; i < 120; i++) {
      const p = pointAt(lv.path, rnd() * lv.path.length);
      blob(r, p.x + (rnd() - 0.5) * 30, p.y + (rnd() - 0.5) * 30, 5 + rnd() * 10, rnd() < 0.6 ? '#ffffff' : P.roadLo, 0.5);
    }
    r.strokeStyle = 'rgba(255,255,255,0.75)';
    r.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const p = pointAt(lv.path, rnd() * lv.path.length);
      const x = p.x + (rnd() - 0.5) * 26;
      const y = p.y + (rnd() - 0.5) * 26;
      r.lineWidth = 0.8 + rnd() * 1.4;
      r.beginPath();
      r.moveTo(x, y);
      r.lineTo(x + 5 + rnd() * 6, y - 5 - rnd() * 6);
      r.stroke();
    }
    // Footprints
    along((s, x, y, d) => {
      const side = Math.floor(d / 9) % 2 ? 1 : -1;
      r.fillStyle = 'rgba(100,140,190,0.3)';
      r.beginPath();
      r.ellipse(x + s.nx * side * 4, y + s.ny * side * 4, 1.8, 1.8, 0, 0, TAU);
      r.fill();
    }, 9);
  } else if (style === 'steel') {
    along((s, x, y) => {
      r.save();
      r.translate(x, y);
      r.rotate(Math.atan2(s.uy, s.ux));
      r.fillStyle = 'rgba(0,0,0,0.25)';
      r.fillRect(0, -ROAD_IN / 2, 1.2, ROAD_IN);
      r.fillStyle = 'rgba(255,255,255,0.12)';
      r.fillRect(1.2, -ROAD_IN / 2, 0.8, ROAD_IN);
      r.restore();
    }, 5);
    for (const s of segs) {
      for (let d = 18; d < s.len - 8; d += 40) {
        const x = s.a.x + s.ux * d;
        const y = s.a.y + s.uy * d;
        if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
        r.save();
        r.translate(x, y);
        r.rotate(Math.atan2(s.uy, s.ux));
        for (const [col, oy] of [['rgba(0,0,0,0.4)', 1.2], ['#facc15', 0]]) {
          r.fillStyle = col;
          for (const k of [-5, 3]) {
            r.beginPath();
            r.moveTo(k - 3, -9 + oy);
            r.lineTo(k + 3, oy);
            r.lineTo(k - 3, 9 + oy);
            r.lineTo(k - 7, 9 + oy);
            r.lineTo(k - 1, oy);
            r.lineTo(k - 7, -9 + oy);
            r.closePath();
            r.fill();
          }
        }
        r.restore();
      }
    }
  } else if (style === 'carpet') {
    for (let i = 0; i < 80; i++) {
      const p = pointAt(lv.path, rnd() * lv.path.length);
      blob(r, p.x + (rnd() - 0.5) * 30, p.y + (rnd() - 0.5) * 30, 6 + rnd() * 8, rnd() < 0.5 ? P.roadHi : P.roadLo, 0.35);
    }
    for (const d of [-12.5, 12.5]) strokeRoad(r, offsetLine(pts, d), 2.4, '#fbbf24');
    for (const d of [-10.2, 10.2]) strokeRoad(r, offsetLine(pts, d), 0.8, 'rgba(253,230,138,0.8)');
    along((s, x, y) => {
      r.save();
      r.translate(x, y);
      r.fillStyle = 'rgba(253,224,71,0.55)';
      r.beginPath();
      r.moveTo(0, -2.6);
      r.lineTo(2.6, 0);
      r.lineTo(0, 2.6);
      r.lineTo(-2.6, 0);
      r.fill();
      r.restore();
    }, 12);
  }
  r.globalCompositeOperation = 'source-over';
  bevel(r, tmp, (t, dx, dy) => strokeRoad(t, pts, ROAD_IN, '#000', dx, dy), P.sunken, 1);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(curbL[0], 0, 0);
  if (!P.sunken) {
    // Raised walkway: its own little side band over the curb
    ctx.restore();
    strokeRoad(ctx, pts, ROAD_IN, 'rgba(0,0,0,0.35)', 0.5, 2.5);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.drawImage(roadL[0], 0, 0);
  ctx.restore();

  // Edges: grass tufts over the bank, snow lumps, boardwalk posts
  if (th === 'forest' || th === 'city') {
    for (const d of [-ROAD_OUT / 2, ROAD_OUT / 2]) {
      for (const p of samples(offsetLine(pts, d), th === 'forest' ? 7 : 12)) {
        if (distToPath(lv.path, p.x, p.y) < ROAD_OUT / 2 - 1.5) continue;
        if (rnd() < 0.45) continue;
        tuft(ctx, p.x + (rnd() - 0.5) * 3, p.y + 2 + rnd() * 2, 0.8 + rnd() * 0.5, P.lo, P.hi);
      }
    }
  } else if (th === 'snow') {
    for (const d of [-ROAD_OUT / 2 + 1, ROAD_OUT / 2 - 1]) {
      for (const p of samples(offsetLine(pts, d), 5)) {
        if (distToPath(lv.path, p.x, p.y) < ROAD_OUT / 2 - 3) continue;
        if (rnd() < 0.35) continue;
        const rr = 2.5 + rnd() * 4.5;
        softShadow(ctx, p.x + 2, p.y + 3, rr * 1.3, rr * 0.6, 0.25);
        ball(ctx, p.x, p.y, rr, '#f3f8fd', 0.6, 0.22);
      }
    }
  } else if (th === 'beach') {
    for (const d of [-ROAD_OUT / 2 + 2, ROAD_OUT / 2 - 2]) {
      for (const p of samples(offsetLine(pts, d), 28)) {
        if (distToPath(lv.path, p.x, p.y) < ROAD_OUT / 2 - 4) continue;
        cylinder(ctx, p.x, p.y + 3, 2.6, 1.4, 6, '#b88454', '#6b4524');
      }
    }
  }
}

// ---------- Build pads ----------

export const PAD_TOP = 4; // pad top centre is (x, y + PAD_TOP)

function paintPad(ctx, p, P, theme) {
  const [top, side] = P.pad;
  softShadow(ctx, p.x + 4, p.y + 13, 25, 9, 0.42);
  softShadow(ctx, p.x + 1, p.y + 12, 20, 7, 0.35);
  cylinder(ctx, p.x, p.y + PAD_TOP + 7, 19, 9.5, 7, top, side, 'rgba(0,0,0,0.35)');
  // Stone ring seams on the side
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.8;
  for (const k of [-11, 0, 11]) {
    ctx.beginPath();
    ctx.moveTo(p.x + k, p.y + PAD_TOP + 7 + Math.sqrt(Math.max(0, 1 - (k / 19) ** 2)) * 9.5 - 7);
    ctx.lineTo(p.x + k, p.y + PAD_TOP + 7 + Math.sqrt(Math.max(0, 1 - (k / 19) ** 2)) * 9.5);
    ctx.stroke();
  }
  const cy = p.y + PAD_TOP;
  // Rim
  if (theme === 'rocket' || theme === 'indigo') {
    ctx.strokeStyle = theme === 'rocket' ? '#facc15' : '#fbbf24';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(p.x, cy, 17.2, 8.4, 0, 0, TAU);
    ctx.stroke();
  }
  // Recess with an engraved Poké Ball
  const g = ctx.createLinearGradient(0, cy - 7, 0, cy + 7);
  g.addColorStop(0, darken(top, 0.22));
  g.addColorStop(1, lighten(top, 0.1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(p.x, cy, 13, 6.5, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(p.x, cy);
  ctx.scale(1, 0.5);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, 0, 9, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.fillRect(-9, -1.2, 18, 2.4);
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------- Enemy portal ----------

function portalSpot(lv) {
  const path = lv.path;
  let d = 0;
  for (; d < path.length; d += 2) {
    const p = pointAt(path, d);
    if (p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H) break;
  }
  const p = pointAt(path, d + 30);
  const nx = -Math.sin(p.angle);
  const ny = Math.cos(p.angle);
  return { x: p.x, y: p.y, angle: p.angle, nx, ny };
}

function paintPortal(ctx, g, P, theme) {
  const [top, side] = P.portal;
  // Banner pole on the open side
  const sideK = g.x + g.nx * 34 > 8 && g.x + g.nx * 34 < W - 8 && g.y + g.ny * 34 > 30 ? 1 : -1;
  const px = g.x + g.nx * 34 * sideK;
  const py = Math.max(44, g.y + g.ny * 34 * sideK);
  softShadow(ctx, g.x + 4, g.y + 10, 34, 14, 0.45);
  cylinder(ctx, g.x, g.y + 6, 27, 15, 7, top, side, 'rgba(0,0,0,0.4)');
  // Studs/lights around the ring
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const x = g.x + Math.cos(a) * 23.5;
    const y = g.y - 1 + Math.sin(a) * 12.8;
    ctx.fillStyle = theme === 'rocket' || theme === 'city' ? '#ef4444' : darken(top, 0.25);
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#12051f';
  ctx.beginPath();
  ctx.ellipse(g.x, g.y - 1, 20, 10.5, 0, 0, TAU);
  ctx.fill();
  // Banner
  castShadow(ctx, px, py, 3, 30, 0.3);
  cylinder(ctx, px, py, 1.8, 1, 34, '#e5e7eb', '#6b7280');
  ball(ctx, px, py - 35, 2.4, '#fbbf24');
  ctx.save();
  ctx.translate(px + 1.5, py - 32);
  ctx.fillStyle = '#7f1d1d';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10, -3, 20, 1);
  ctx.lineTo(20, 15);
  ctx.quadraticCurveTo(10, 11, 0, 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10, -3, 20, 1);
  ctx.lineTo(20, 13);
  ctx.quadraticCurveTo(10, 9, 0, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('R', 10, 6.5);
  ctx.restore();
}

// ---------- Scenery ----------

function tree(ctx, s, rnd, autumn) {
  const th = 12 * s;
  ctx.fillStyle = '#6b3d1d';
  roundRect(ctx, -2.8 * s, -th, 5.6 * s, th + 1, 1.5);
  ctx.fill();
  ctx.fillStyle = '#4a2810';
  ctx.fillRect(0.6 * s, -th, 2.2 * s, th);
  ctx.fillStyle = '#8a5a30';
  ctx.fillRect(-2.2 * s, -th, 1.2 * s, th);
  const greens = ['#43a947', '#3c9c45', '#55b847', '#2f9a4a'];
  const base = autumn ? (rnd() < 0.5 ? '#f59e0b' : '#ea580c') : greens[Math.floor(rnd() * greens.length)];
  const cy = -th - 9 * s;
  const blobs = [
    [-8 * s, cy + 4 * s, 8.5 * s],
    [8 * s, cy + 4 * s, 8.5 * s],
    [0, cy - 6 * s, 10.5 * s],
    [-4 * s, cy + 7 * s, 8 * s],
    [5 * s, cy + 7 * s, 8 * s],
  ];
  ctx.fillStyle = darken(base, 0.55);
  for (const [x, y, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x + 0.6, y + 0.8, r + 1.3, 0, TAU);
    ctx.fill();
  }
  for (const [x, y, r] of blobs) ball(ctx, x, y, r, base, 0.5, 0.4);
  ctx.fillStyle = rgba(lighten(base, 0.6), 0.55);
  for (const [x, y, r] of blobs.slice(0, 3)) {
    ctx.beginPath();
    ctx.ellipse(x - r * 0.35, y - r * 0.45, r * 0.32, r * 0.2, -0.5, 0, TAU);
    ctx.fill();
  }
  if (rnd() < 0.35) {
    for (let i = 0; i < 4; i++) ball(ctx, (rnd() - 0.5) * 16 * s, cy + (rnd() - 0.3) * 12 * s, 1.6 * s, '#ef4444', 0.6, 0.3);
  }
}

function pine(ctx, s, snowy) {
  ctx.fillStyle = '#5b3416';
  ctx.fillRect(-2 * s, -7 * s, 4 * s, 8 * s);
  const tiers = [
    [-6, 13, 13],
    [-16, 10.5, 12],
    [-25, 8, 11],
  ];
  const L = snowy ? '#2f7d5b' : '#2f9e55';
  const D = snowy ? '#1b5540' : '#1a6b3a';
  for (const [by, hw, h] of tiers) {
    const y0 = by * s;
    const ap = y0 - h * s - 4 * s;
    ctx.fillStyle = darken(D, 0.4);
    ctx.beginPath();
    ctx.moveTo(0, ap - 1);
    ctx.lineTo(hw * s + 1.2, y0 + 0.8);
    ctx.quadraticCurveTo(0, y0 + 4.5 * s, -hw * s - 1.2, y0 + 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = L;
    ctx.beginPath();
    ctx.moveTo(0, ap);
    ctx.lineTo(-hw * s, y0);
    ctx.quadraticCurveTo(-hw * s * 0.5, y0 + 3 * s, 0, y0 + 3.2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = D;
    ctx.beginPath();
    ctx.moveTo(0, ap);
    ctx.lineTo(hw * s, y0);
    ctx.quadraticCurveTo(hw * s * 0.5, y0 + 3 * s, 0, y0 + 3.2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-0.5, ap + 1);
    ctx.lineTo(-hw * s * 0.85, y0 - 0.5);
    ctx.stroke();
    if (snowy) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, ap - 0.5);
      ctx.lineTo(-hw * s * 0.55, ap + h * s * 0.55);
      ctx.quadraticCurveTo(-hw * s * 0.25, ap + h * s * 0.42, 0, ap + h * s * 0.6);
      ctx.quadraticCurveTo(hw * s * 0.25, ap + h * s * 0.5, hw * s * 0.55, ap + h * s * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c7dcf3';
      ctx.beginPath();
      ctx.moveTo(0, ap);
      ctx.lineTo(hw * s * 0.55, ap + h * s * 0.55);
      ctx.quadraticCurveTo(hw * s * 0.25, ap + h * s * 0.5, 0, ap + h * s * 0.6);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function rock(ctx, s, base, rnd, snowy) {
  const j = () => (rnd() - 0.5) * 2 * s;
  const o = [[-11, 0], [-12, -6], [-6, -12], [3, -13], [10, -8], [12, 0]].map(([x, y]) => [x * s + j(), y * s + j()]);
  ctx.fillStyle = darken(base, 0.55);
  ctx.beginPath();
  o.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = darken(base, 0.55);
  ctx.stroke();
  ctx.fillStyle = base;
  ctx.fill();
  const c = [1 * s, -6 * s];
  // right facet (shade)
  ctx.fillStyle = darken(base, 0.3);
  ctx.beginPath();
  ctx.moveTo(c[0], c[1]);
  ctx.lineTo(o[4][0], o[4][1]);
  ctx.lineTo(o[5][0], o[5][1]);
  ctx.lineTo(c[0] + 1 * s, 0);
  ctx.closePath();
  ctx.fill();
  // top facet (lit)
  ctx.fillStyle = lighten(base, snowy ? 0.9 : 0.3);
  ctx.beginPath();
  ctx.moveTo(o[1][0] + 1, o[1][1]);
  ctx.lineTo(o[2][0], o[2][1]);
  ctx.lineTo(o[3][0], o[3][1]);
  ctx.lineTo(o[4][0], o[4][1]);
  ctx.lineTo(c[0], c[1]);
  ctx.closePath();
  ctx.fill();
  if (snowy) {
    ctx.fillStyle = '#c9dcf2';
    ctx.beginPath();
    ctx.moveTo(o[3][0], o[3][1]);
    ctx.lineTo(o[4][0], o[4][1]);
    ctx.lineTo(c[0], c[1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(o[1][0] + 1, o[1][1]);
  ctx.lineTo(o[2][0], o[2][1]);
  ctx.lineTo(o[3][0], o[3][1]);
  ctx.stroke();
}

function bush(ctx, s, rnd, base = '#3fa34a') {
  const bl = [[-6 * s, -5 * s, 6 * s], [6 * s, -5 * s, 6 * s], [0, -9 * s, 7 * s]];
  ctx.fillStyle = darken(base, 0.55);
  for (const [x, y, r] of bl) {
    ctx.beginPath();
    ctx.arc(x + 0.5, y + 0.6, r + 1.2, 0, TAU);
    ctx.fill();
  }
  for (const [x, y, r] of bl) ball(ctx, x, y, r, base, 0.5, 0.4);
  const berry = rnd() < 0.5 ? '#ef4444' : '#a855f7';
  for (let i = 0; i < 5; i++) ball(ctx, (rnd() - 0.5) * 16 * s, -4 * s - rnd() * 8 * s, 1.4 * s, berry, 0.7, 0.3);
}

function flowers(ctx, s, rnd) {
  const cols = ['#f472b6', '#facc15', '#ffffff', '#f87171', '#a78bfa', '#60a5fa'];
  const c = cols[Math.floor(rnd() * cols.length)];
  for (let i = 0; i < 5; i++) {
    const x = (rnd() - 0.5) * 14 * s;
    const y = (rnd() - 0.5) * 7 * s;
    ctx.strokeStyle = '#2f7d32';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 4 * s);
    ctx.stroke();
    ctx.fillStyle = '#3f9f45';
    ctx.beginPath();
    ctx.ellipse(x + 1.6, y - 1.5 * s, 1.8, 0.9, 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = darken(c, 0.25);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 1.8 + 0.3, y - 4 * s + Math.sin(a) * 1.4 + 0.3, 1.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = c;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 1.8, y - 4 * s + Math.sin(a) * 1.4, 1.3, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(x, y - 4 * s, 1, 0, TAU);
    ctx.fill();
  }
}

function palm(ctx, s, rnd) {
  const lean = (rnd() < 0.5 ? -1 : 1) * (5 + rnd() * 4) * s;
  const h = 40 * s;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const k0 = i / n;
    const x = lean * k0 * k0;
    const y = -h * k0;
    const w = (4.6 - k0 * 1.6) * s;
    ctx.fillStyle = i % 2 ? '#a0703c' : '#8a5c2e';
    ctx.beginPath();
    ctx.ellipse(x, y - 2 * s, w, 2.8 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,30,10,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.45, y - 2 * s, w * 0.55, 2.6 * s, 0, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,180,0.35)';
    ctx.fillRect(x - w * 0.7, y - 3.5 * s, w * 0.35, 2 * s);
  }
  const tx = lean;
  const ty = -h - 2 * s;
  const leaves = 7;
  for (let i = 0; i < leaves; i++) {
    const a = -Math.PI / 2 + ((i - (leaves - 1) / 2) / leaves) * Math.PI * 2.1;
    const len = (17 + rnd() * 4) * s;
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.6 + 7 * s;
    const mx = tx + Math.cos(a) * len * 0.5;
    const my = ty + Math.sin(a) * len * 0.5 - 5 * s;
    const pxn = -Math.sin(a) * 4 * s;
    const pyn = Math.cos(a) * 4 * s;
    const front = Math.sin(a) > -0.2;
    ctx.fillStyle = front ? '#1f8a3e' : '#176b31';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(mx + pxn, my + pyn, ex, ey);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.fill();
    ctx.fillStyle = front ? '#3fbf5a' : '#2c9a49';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(mx - pxn, my - pyn, ex, ey);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.fill();
  }
  for (const [dx, dy] of [[-2.5, 1.5], [2.5, 1.8], [0, 3.5]]) ball(ctx, tx + dx * s, ty + dy * s, 2.4 * s, '#7c4a1e', 0.5, 0.4);
}

function umbrella(ctx, s, rnd) {
  const cols = [['#ef4444', '#ffffff'], ['#3b82f6', '#ffffff'], ['#f59e0b', '#fef3c7'], ['#ec4899', '#ffffff']][Math.floor(rnd() * 4)];
  // Towel
  ctx.save();
  ctx.translate(4 * s, 3 * s);
  ctx.rotate(-0.3);
  ctx.fillStyle = cols[0];
  ctx.fillRect(-6 * s, -4 * s, 13 * s, 9 * s);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let k = 0; k < 3; k++) ctx.fillRect(-6 * s + k * 4.5 * s, -4 * s, 2 * s, 9 * s);
  ctx.restore();
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(-0.8, -26 * s, 1.6, 26 * s);
  const apx = 0;
  const apy = -31 * s;
  const rx = 16 * s;
  const ry = 6.5 * s;
  const cy = -23 * s;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    const a1 = ((i + 1) / n) * TAU;
    const mid = (a0 + a1) / 2;
    const lit = Math.cos(mid - Math.PI * 1.2);
    const base = i % 2 ? cols[0] : cols[1];
    ctx.fillStyle = lit > 0 ? lighten(base, 0.1) : darken(base, 0.18);
    ctx.beginPath();
    ctx.moveTo(apx, apy);
    ctx.lineTo(Math.cos(a0) * rx, cy + Math.sin(a0) * ry);
    ctx.quadraticCurveTo(Math.cos(mid) * rx * 1.05, cy + Math.sin(mid) * ry * 1.05 + 1.5 * s, Math.cos(a1) * rx, cy + Math.sin(a1) * ry);
    ctx.closePath();
    ctx.fill();
  }
  ball(ctx, apx, apy, 1.6 * s, '#f8fafc');
}

function crystal(ctx, s, rnd, cols) {
  const prisms = [
    [-6, 14, 3.4, -2.5],
    [6, 13, 3.2, 2.5],
    [0, 22, 4.4, 0],
    [-2, 9, 2.6, -4],
    [4, 8, 2.4, 4],
  ];
  const c = cols[Math.floor(rnd() * cols.length)];
  drawGlow(ctx, c, 0, -10 * s, 22 * s, 0.55);
  for (const [ox, h, w, tilt] of prisms) {
    const X = ox * s;
    const Hh = h * s;
    const Ww = w * s;
    const T = tilt * s;
    const ap = [X + T * 1.3, -Hh - Ww * 1.5];
    const tl = [X - Ww + T, -Hh];
    const tm = [X + T, -Hh + Ww * 0.4];
    const tr = [X + Ww + T, -Hh];
    const quad = (pts, f) => {
      ctx.fillStyle = f;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fill();
    };
    quad([[X - Ww, 0], [X, 1.2], tm, tl], lighten(c, 0.25));
    quad([[X, 1.2], [X + Ww, 0], tr, tm], darken(c, 0.3));
    quad([tl, tm, ap], lighten(c, 0.65));
    quad([tm, tr, ap], c);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(X - Ww * 0.5, -1);
    ctx.lineTo(tl[0] + Ww * 0.5, tl[1] + 1);
    ctx.stroke();
  }
  return c;
}

function stalag(ctx, s, base) {
  const h = 24 * s;
  const w = 8 * s;
  ctx.fillStyle = lighten(base, 0.2);
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.quadraticCurveTo(-w * 0.5, -h * 0.5, 0, -h);
  ctx.lineTo(1 * s, 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = darken(base, 0.3);
  ctx.beginPath();
  ctx.moveTo(1 * s, 1);
  ctx.lineTo(0, -h);
  ctx.quadraticCurveTo(w * 0.5, -h * 0.5, w, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.8;
  for (const k of [0.3, 0.55, 0.78]) {
    ctx.beginPath();
    ctx.moveTo(-w * (1 - k) * 0.95, -h * k);
    ctx.lineTo(w * (1 - k) * 0.95, -h * k + 1);
    ctx.stroke();
  }
  // a tiny one beside
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(w * 0.7, 1);
  ctx.lineTo(w * 1.1, -h * 0.4);
  ctx.lineTo(w * 1.6, 1);
  ctx.fill();
}

function mushroom(ctx, s, cap, glow) {
  const caps = [[-3 * s, 0, 1], [3.5 * s, 1, 0.75]];
  for (const [x, y, k] of caps) {
    cylinder(ctx, x, y, 1.6 * s * k, 0.8 * s * k, 5 * s * k, '#fff7e6', '#e9dcc0', null);
    const cy = y - 5 * s * k;
    if (glow) drawGlow(ctx, cap, x, cy - 1, 9 * s * k, 0.8);
    ctx.fillStyle = darken(cap, 0.4);
    ctx.beginPath();
    ctx.ellipse(x, cy + 0.5, 5.2 * s * k, 1.8 * s * k, 0, 0, TAU);
    ctx.fill();
    const g = ctx.createRadialGradient(x - 2 * s * k, cy - 3 * s * k, 0.5, x, cy - 1, 6 * s * k);
    g.addColorStop(0, lighten(cap, 0.5));
    g.addColorStop(1, cap);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, cy, 5 * s * k, 4.6 * s * k, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [dx, dy] of [[-2, -2.4], [1.5, -3], [2.5, -1]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s * k, cy + dy * s * k, 0.9 * s * k, 0, TAU);
      ctx.fill();
    }
  }
}

function stump(ctx, s) {
  cylinder(ctx, 0, 0, 7 * s, 3.5 * s, 7 * s, '#d9a86c', '#7a4a22');
  ctx.strokeStyle = 'rgba(122,74,34,0.6)';
  ctx.lineWidth = 0.7;
  for (const k of [0.65, 0.35]) {
    ctx.beginPath();
    ctx.ellipse(0, -7 * s, 7 * s * k, 3.5 * s * k, 0, 0, TAU);
    ctx.stroke();
  }
}

function fence(ctx, s) {
  const w = 26 * s;
  for (const k of [-1, 0, 1]) box(ctx, k * w * 0.45, 0, 3 * s, 12 * s, 3 * s, { top: '#e8c697', front: '#c08a52', side: '#8a5a2e' });
  for (const y of [-9, -4.5]) {
    ctx.fillStyle = '#b07a44';
    ctx.fillRect(-w * 0.5, y * s, w, 2.2 * s);
    ctx.fillStyle = 'rgba(255,240,210,0.5)';
    ctx.fillRect(-w * 0.5, y * s, w, 0.7);
  }
}

function house(ctx, s, rnd) {
  const roofs = ['#ef4444', '#3b82f6', '#f97316', '#16a34a', '#8b5cf6'];
  const walls = ['#fff7e6', '#fef3c7', '#e0f2fe', '#fce7f3'];
  const roof = roofs[Math.floor(rnd() * roofs.length)];
  const wall = walls[Math.floor(rnd() * walls.length)];
  const w = 28 * s;
  const h = 16 * s;
  const d = 16 * s;
  const b = box(ctx, 0, 0, w, h, d, { top: wall, front: wall, side: darken(wall, 0.22) });
  const { l, r, t, dx, dy } = b;
  const rh = 10 * s;
  // gable on the side
  ctx.fillStyle = darken(wall, 0.18);
  ctx.beginPath();
  ctx.moveTo(r, t);
  ctx.lineTo(r + dx, t + dy);
  ctx.lineTo(r + dx / 2, t + dy / 2 - rh);
  ctx.closePath();
  ctx.fill();
  // back roof plane, then the front one
  ctx.fillStyle = darken(roof, 0.35);
  ctx.beginPath();
  ctx.moveTo(l + dx / 2 - 2, t + dy / 2 - rh);
  ctx.lineTo(r + dx / 2 + 2, t + dy / 2 - rh);
  ctx.lineTo(r + dx + 2, t + dy + 1);
  ctx.lineTo(r + dx / 2, t + dy / 2 - rh + 1);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, t + dy / 2 - rh, 0, t + 2);
  g.addColorStop(0, lighten(roof, 0.2));
  g.addColorStop(1, darken(roof, 0.1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(l - 2.5, t + 2);
  ctx.lineTo(r + 2.5, t + 2);
  ctx.lineTo(r + dx / 2 + 2.5, t + dy / 2 - rh);
  ctx.lineTo(l + dx / 2 - 2.5, t + dy / 2 - rh);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = darken(roof, 0.4);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  for (let k = 1; k < 4; k++) {
    const f = k / 4;
    ctx.beginPath();
    ctx.moveTo(l - 2.5 + (dx / 2) * f, t + 2 + (dy / 2 - rh - 2) * f);
    ctx.lineTo(r + 2.5 + (dx / 2) * f, t + 2 + (dy / 2 - rh - 2) * f);
    ctx.stroke();
  }
  ctx.fillStyle = darken(roof, 0.45);
  ctx.fillRect(l - 2.5, t + 2, w + 5, 1.6);
  // chimney
  box(ctx, r - 6 * s + dx * 0.3, t + dy * 0.3 - rh * 0.6, 3.6 * s, 6 * s, 3 * s, { top: '#57534e', front: '#a8a29e', side: '#78716c' });
  // door + windows
  ctx.fillStyle = '#7c4a22';
  roundRect(ctx, -3 * s, -9 * s, 6 * s, 9 * s, 1.5);
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(1.5 * s, -4.5 * s, 0.6 * s, 0, TAU);
  ctx.fill();
  for (const wx of [-10 * s, 6 * s]) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(wx - 0.8, -12 * s - 0.8, 5.6 * s + 1.6, 5 * s + 1.6);
    const wg = ctx.createLinearGradient(wx, -12 * s, wx + 5 * s, -7 * s);
    wg.addColorStop(0, '#bae6fd');
    wg.addColorStop(1, '#38bdf8');
    ctx.fillStyle = wg;
    ctx.fillRect(wx, -12 * s, 5.6 * s, 5 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(wx + 0.6, -11.5 * s, 1.2 * s, 4 * s);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(r + 2, -9 * s, dx * 0.5, 4 * s);
}

function lamp(ctx, s) {
  cylinder(ctx, 0, 0, 3 * s, 1.5 * s, 3 * s, '#475569', '#334155');
  ctx.fillStyle = '#334155';
  ctx.fillRect(-1 * s, -28 * s, 2 * s, 26 * s);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(-1 * s, -28 * s, 0.8 * s, 26 * s);
  drawGlow(ctx, '#fde68a', 0, -30 * s, 14 * s, 0.7);
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(-4 * s, -29 * s);
  ctx.lineTo(4 * s, -29 * s);
  ctx.lineTo(2.5 * s, -34 * s);
  ctx.lineTo(-2.5 * s, -34 * s);
  ctx.fill();
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(-2.6 * s, -33.3 * s, 5.2 * s, 3.6 * s);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-3.5 * s, -35.5 * s, 7 * s, 1.8 * s);
}

function planter(ctx, s, rnd, frame) {
  box(ctx, 0, 0, 24 * s, 6 * s, 10 * s, { top: '#5b3a1e', front: frame, side: darken(frame, 0.3) });
  flowersOn(ctx, s, rnd);
}

function flowersOn(ctx, s, rnd) {
  const cols = ['#f472b6', '#facc15', '#f87171', '#a78bfa', '#ffffff'];
  for (let i = 0; i < 9; i++) {
    const x = -10 * s + (i % 5) * 5 * s + (rnd() - 0.5) * 2 + (i > 4 ? 4 * s : 0);
    const y = -7 * s - (i > 4 ? 4 * s : 0);
    ball(ctx, x, y, 2.2 * s, '#2f8f3a', 0.4, 0.4);
    ball(ctx, x + 0.4, y - 1.6 * s, 1.5 * s, cols[Math.floor(rnd() * cols.length)], 0.6, 0.2);
  }
}

function sandcastle(ctx, s) {
  const sand = '#e9c37e';
  box(ctx, 0, 0, 18 * s, 6 * s, 10 * s, { top: lighten(sand, 0.2), front: sand, side: darken(sand, 0.2) });
  for (const x of [-7, 7]) cylinder(ctx, x * s, -2 * s, 3.4 * s, 1.7 * s, 9 * s, lighten(sand, 0.25), sand, 'rgba(120,80,30,0.3)');
  cylinder(ctx, 0, -4 * s, 4 * s, 2 * s, 12 * s, lighten(sand, 0.25), sand, 'rgba(120,80,30,0.3)');
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -16 * s);
  ctx.lineTo(0, -22 * s);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(0, -22 * s);
  ctx.lineTo(5 * s, -20.5 * s);
  ctx.lineTo(0, -19 * s);
  ctx.fill();
}

function starfish(ctx, s, rnd) {
  ctx.rotate(rnd() * TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = (i % 2 ? 2 : 5.5) * s;
    const a = (i / 10) * TAU;
    ctx.lineTo(Math.cos(a) * r + 0.8, Math.sin(a) * r + 0.8);
  }
  ctx.fill();
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = (i % 2 ? 2 : 5.5) * s;
    const a = (i / 10) * TAU;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.fill();
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
}

function shell(ctx, s) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.arc(0.8, 0.8, 4 * s, Math.PI, TAU);
  ctx.fill();
  ctx.fillStyle = '#fbcfe8';
  ctx.beginPath();
  ctx.arc(0, 0, 4 * s, Math.PI, TAU);
  ctx.fill();
  ctx.strokeStyle = '#db2777';
  ctx.lineWidth = 0.5;
  for (let k = 1; k < 5; k++) {
    const a = Math.PI + (k / 5) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 4 * s, Math.sin(a) * 4 * s);
    ctx.stroke();
  }
}

function lavaPool(ctx, s, rnd) {
  const n = 9;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = (12 + rnd() * 4) * s;
    pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.55]);
  }
  const path = (k, dy = 0) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % n];
      const mx = ((x + nx) / 2) * k;
      const my = ((y + ny) / 2) * k + dy;
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.quadraticCurveTo(x * k, y * k + dy, mx, my);
    });
    const [x0, y0] = pts[0];
    const [x1, y1] = pts[1];
    ctx.quadraticCurveTo(x0 * k, y0 * k + dy, ((x0 + x1) / 2) * k, ((y0 + y1) / 2) * k + dy);
    ctx.closePath();
  };
  drawGlow(ctx, '#f97316', 0, 0, 30 * s, 0.6);
  ctx.fillStyle = '#1c0d0a';
  path(1.25, 1);
  ctx.fill();
  ctx.fillStyle = '#3b1a12';
  path(1.12, -0.5);
  ctx.fill();
  const g = ctx.createRadialGradient(-3 * s, -2 * s, 1, 0, 0, 15 * s);
  g.addColorStop(0, '#fff7b0');
  g.addColorStop(0.35, '#fdba74');
  g.addColorStop(0.75, '#f97316');
  g.addColorStop(1, '#b91c1c');
  ctx.fillStyle = g;
  path(1, 1);
  ctx.fill();
  ctx.fillStyle = 'rgba(60,20,10,0.55)';
  for (let i = 0; i < 3; i++) {
    const x = (rnd() - 0.5) * 14 * s;
    const y = (rnd() - 0.5) * 6 * s;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.5 * s, 1.2 * s, rnd(), 0, TAU);
    ctx.fill();
  }
}

function basalt(ctx, s, rnd) {
  rock(ctx, s * 1.05, '#4b3a34', rnd, false);
  ctx.strokeStyle = '#fb923c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6 * s, -2 * s);
  ctx.lineTo(-2 * s, -6 * s);
  ctx.lineTo(1 * s, -5 * s);
  ctx.lineTo(4 * s, -9 * s);
  ctx.stroke();
  drawGlow(ctx, '#f97316', -1 * s, -5 * s, 8 * s, 0.5);
}

function deadTree(ctx, s) {
  ctx.lineCap = 'round';
  const br = (x, y, a, len, w) => {
    if (len < 3 || w < 0.6) return;
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    ctx.strokeStyle = '#1c1210';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = w * 0.35;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.25, y);
    ctx.lineTo(ex - w * 0.25, ey);
    ctx.stroke();
    br(ex, ey, a - 0.55, len * 0.65, w * 0.62);
    br(ex, ey, a + 0.5, len * 0.6, w * 0.6);
  };
  br(0, 0, -Math.PI / 2, 14 * s, 4 * s);
  drawGlow(ctx, '#f97316', 0, -2, 6 * s, 0.4);
}

function vent(ctx, s) {
  ctx.fillStyle = '#2a1a14';
  ctx.beginPath();
  ctx.moveTo(-9 * s, 0);
  ctx.quadraticCurveTo(-5 * s, -7 * s, -3 * s, -7 * s);
  ctx.lineTo(3 * s, -7 * s);
  ctx.quadraticCurveTo(5 * s, -7 * s, 9 * s, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a3229';
  ctx.beginPath();
  ctx.moveTo(-9 * s, 0);
  ctx.quadraticCurveTo(-5 * s, -7 * s, -3 * s, -7 * s);
  ctx.lineTo(0, -7 * s);
  ctx.lineTo(0, 0);
  ctx.fill();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.ellipse(0, -7 * s, 3 * s, 1.2 * s, 0, 0, TAU);
  ctx.fill();
  drawGlow(ctx, '#fb923c', 0, -8 * s, 9 * s, 0.6);
}

function snowman(ctx, s) {
  const sn = '#f8fbff';
  ball(ctx, 0, -6 * s, 7 * s, sn, 0.2, 0.25);
  ball(ctx, 0, -16 * s, 5.2 * s, sn, 0.2, 0.25);
  ball(ctx, 0, -24 * s, 4 * s, sn, 0.2, 0.25);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-4.6 * s, -20.5 * s, 9.2 * s, 2.2 * s);
  ctx.fillRect(2 * s, -20 * s, 2.2 * s, 6 * s);
  ctx.fillStyle = '#1f2937';
  for (const [x, y] of [[-1.4, -25], [1.4, -25], [0, -16], [0, -13], [0, -9]]) {
    ctx.beginPath();
    ctx.arc(x * s, y * s, 0.7 * s, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(0, -24 * s);
  ctx.lineTo(5 * s, -23.2 * s);
  ctx.lineTo(0, -22.6 * s);
  ctx.fill();
  cylinder(ctx, 0, -27 * s, 4.6 * s, 1.6 * s, 1, '#111827', '#111827', null);
  cylinder(ctx, 0, -27.5 * s, 3 * s, 1.1 * s, 5 * s, '#374151', '#1f2937', null);
  ctx.strokeStyle = '#5b3416';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5 * s, -16 * s);
  ctx.lineTo(-10 * s, -20 * s);
  ctx.moveTo(5 * s, -16 * s);
  ctx.lineTo(10 * s, -19 * s);
  ctx.stroke();
}

function crate(ctx, x, y, s, label = true) {
  const b = box(ctx, x, y, 17 * s, 14 * s, 12 * s, { top: '#d9a35c', front: '#b97a3a', side: '#8a5524' }, 'rgba(60,30,10,0.6)');
  ctx.strokeStyle = 'rgba(80,40,10,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(b.l + 1.5, b.t + 1.5, 17 * s - 3, 14 * s - 3);
  ctx.beginPath();
  ctx.moveTo(b.l + 1.5, b.t + 1.5);
  ctx.lineTo(b.r - 1.5, y - 1.5);
  ctx.stroke();
  if (label) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y - 7 * s, 4.6 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.font = `900 ${Math.round(8 * s)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', x, y - 6.6 * s);
  }
}

function barrel(ctx, s, rnd) {
  const toxic = rnd() < 0.5;
  const side = toxic ? '#7e22ce' : '#b91c1c';
  cylinder(ctx, 0, 0, 6.5 * s, 3.2 * s, 15 * s, lighten(side, 0.15), side);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.2;
  for (const y of [-3.5, -11.5]) {
    ctx.beginPath();
    ctx.ellipse(0, y * s, 6.5 * s, 3.2 * s, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.fillStyle = toxic ? '#a3e635' : '#fde047';
  ctx.font = `900 ${Math.round(6 * s)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(toxic ? '☠' : 'R', -0.5, -7.5 * s);
  if (toxic) {
    ctx.fillStyle = '#84cc16';
    ctx.beginPath();
    ctx.ellipse(0, -15 * s, 4.5 * s, 2 * s, 0, 0, TAU);
    ctx.fill();
  }
}

function warnLight(ctx, s) {
  cylinder(ctx, 0, 0, 3.5 * s, 1.8 * s, 3 * s, '#4b5563', '#374151');
  ctx.fillStyle = '#374151';
  ctx.fillRect(-1.1 * s, -26 * s, 2.2 * s, 23 * s);
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(-1.1 * s, -26 * s, 0.8 * s, 23 * s);
  ctx.fillStyle = '#facc15';
  for (let k = 0; k < 4; k++) ctx.fillRect(-1.1 * s, (-24 + k * 5) * s, 2.2 * s, 2 * s);
  cylinder(ctx, 0, -26 * s, 3.2 * s, 1.5 * s, 1.5 * s, '#1f2937', '#111827', null);
  ball(ctx, 0, -29.5 * s, 3 * s, '#dc2626', 0.6, 0.3);
}

function flagPole(ctx, s, cloth, trim, mark) {
  cylinder(ctx, 0, 0, 3.5 * s, 1.8 * s, 3 * s, '#9ca3af', '#4b5563');
  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(-0.9 * s, -38 * s, 1.8 * s, 36 * s);
  ball(ctx, 0, -39 * s, 1.8 * s, '#fbbf24');
  ctx.save();
  ctx.translate(1, -36 * s);
  ctx.fillStyle = darken(cloth, 0.35);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(7 * s, -2 * s, 14 * s, 0);
  ctx.lineTo(14 * s, 16 * s);
  ctx.lineTo(7 * s, 13 * s);
  ctx.lineTo(0, 16 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(7 * s, -2 * s, 12.5 * s, 0);
  ctx.lineTo(12.5 * s, 14.5 * s);
  ctx.lineTo(6.5 * s, 11.6 * s);
  ctx.lineTo(0, 14.5 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (mark === 'R') {
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(9 * s)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', 6.3 * s, 6 * s);
  } else {
    drawPokeball(ctx, 6.3 * s, 6 * s, 3.6 * s);
  }
  ctx.restore();
}

function consoleBox(ctx, s) {
  const b = box(ctx, 0, 0, 18 * s, 10 * s, 10 * s, { top: '#64748b', front: '#475569', side: '#334155' });
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(b.l + 2, b.t);
  ctx.lineTo(b.r - 2, b.t);
  ctx.lineTo(b.r - 2 + b.dx * 0.8, b.t + b.dy * 0.8 - 3);
  ctx.lineTo(b.l + 2 + b.dx * 0.8, b.t + b.dy * 0.8 - 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 0.8;
  for (let k = 0; k < 3; k++) {
    const f = 0.25 + k * 0.22;
    ctx.beginPath();
    ctx.moveTo(b.l + 4 + b.dx * f, b.t + (b.dy * 0.8 - 3) * f);
    ctx.lineTo(b.l + 10 + b.dx * f, b.t + (b.dy * 0.8 - 3) * f);
    ctx.stroke();
  }
  drawGlow(ctx, '#22d3ee', b.l + 9 + b.dx * 0.4, b.t - 3, 10, 0.4);
  for (const [x, c] of [[-5, '#ef4444'], [-1, '#22c55e'], [3, '#facc15']]) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x * s, -4 * s, 1.1 * s, 0, TAU);
    ctx.fill();
  }
}

function column(ctx, s) {
  box(ctx, 0, 0, 14 * s, 4 * s, 9 * s, { top: '#ffffff', front: '#e9e3f5', side: '#bfb3d9' });
  const cx = 2.2 * s;
  const cy = -4 * s - 3 * s;
  cylinder(ctx, cx, cy, 4.6 * s, 2.2 * s, 26 * s, '#ffffff', '#ece6f7');
  ctx.strokeStyle = 'rgba(120,100,170,0.3)';
  ctx.lineWidth = 0.7;
  for (const k of [-2.5, -0.5, 1.5, 3.3]) {
    ctx.beginPath();
    ctx.moveTo(cx + k * s, cy + 1.8 * s);
    ctx.lineTo(cx + k * s, cy - 26 * s + 2);
    ctx.stroke();
  }
  cylinder(ctx, cx, cy - 26 * s, 6.5 * s, 3 * s, 2.5 * s, '#fde68a', '#d4a017');
  // brazier
  cylinder(ctx, cx, cy - 29 * s, 4.8 * s, 2.2 * s, 2.5 * s, '#3f2a10', '#b8860b');
}

function topiary(ctx, s) {
  cylinder(ctx, 0, 0, 5.5 * s, 2.6 * s, 7 * s, '#7c4a22', '#c2703d');
  ctx.fillStyle = '#5b3416';
  ctx.fillRect(-0.8 * s, -12 * s, 1.6 * s, 6 * s);
  ctx.fillStyle = '#14532d';
  ctx.beginPath();
  ctx.arc(0.6, -19 * s + 0.8, 8.4 * s, 0, TAU);
  ctx.fill();
  ball(ctx, 0, -19 * s, 7.6 * s, '#2f9e55', 0.5, 0.4);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    ctx.arc(-3 * s + (k % 3) * 2.5 * s, -23 * s + Math.floor(k / 3) * 3 * s, 1 * s, 0, TAU);
    ctx.fill();
  }
}

function statue(ctx, s) {
  box(ctx, 0, 0, 14 * s, 12 * s, 10 * s, { top: '#ffffff', front: '#e9e3f5', side: '#b9add6' });
  ctx.fillStyle = '#d4a017';
  ctx.fillRect(-7 * s, -12 * s, 14 * s, 1.5 * s);
  const cx = 2.5 * s;
  const cy = -12 * s - 3 * s - 6 * s;
  ctx.save();
  drawPokeball(ctx, cx, cy, 6.5 * s);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,215,0,0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, 6.5 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(cx - 2.5 * s, cy - 3 * s, 1.6 * s, 1 * s, -0.6, 0, TAU);
  ctx.fill();
}

/** Draw one scenery piece; returns animated anchors it wants (lights, lava, flames…). */
function paintDecor(ctx, d, theme, rnd) {
  const { kind, x, y, s } = d;
  const out = [];
  ctx.save();
  ctx.translate(x, y);
  switch (kind) {
    case 'tree':
      tree(ctx, s, rnd, false);
      break;
    case 'pine':
      pine(ctx, s, false);
      break;
    case 'snowpine':
      pine(ctx, s, true);
      break;
    case 'bush':
      bush(ctx, s, rnd, theme === 'beach' ? '#4caf50' : '#3fa34a');
      break;
    case 'rock':
      rock(ctx, s, theme === 'cave' ? '#7a7068' : theme === 'beach' ? '#a8a29e' : '#9ca3af', rnd, false);
      break;
    case 'snowrock':
      rock(ctx, s, '#8a99ad', rnd, true);
      break;
    case 'flowers':
      flowers(ctx, s, rnd);
      break;
    case 'stump':
      stump(ctx, s);
      break;
    case 'mushroom':
      mushroom(ctx, s, '#ef4444', false);
      break;
    case 'gshroom':
      mushroom(ctx, s, rnd() < 0.5 ? '#38bdf8' : '#a78bfa', true);
      out.push({ type: 'glint', x, y: y - 6 * s, c: '#67e8f9' });
      break;
    case 'fence':
      fence(ctx, s);
      break;
    case 'palm':
      palm(ctx, s, rnd);
      break;
    case 'umbrella':
      umbrella(ctx, s, rnd);
      break;
    case 'sandcastle':
      sandcastle(ctx, s);
      break;
    case 'star':
      starfish(ctx, s, rnd);
      break;
    case 'shell':
      shell(ctx, s);
      break;
    case 'crystal': {
      const c = crystal(ctx, s, rnd, ['#67e8f9', '#a78bfa', '#f0abfc', '#5eead4']);
      out.push({ type: 'glint', x, y: y - 16 * s, c });
      break;
    }
    case 'ice': {
      crystal(ctx, s * 0.85, rnd, ['#bae6fd', '#93c5fd']);
      out.push({ type: 'glint', x, y: y - 14 * s, c: '#e0f2fe' });
      break;
    }
    case 'stalag':
      stalag(ctx, s, '#7d7369');
      break;
    case 'house':
      house(ctx, s, rnd);
      break;
    case 'lamp':
      lamp(ctx, s);
      out.push({ type: 'lamp', x, y: y - 31 * s, c: '#fde68a' });
      break;
    case 'planter':
      planter(ctx, s, rnd, theme === 'indigo' ? '#e9e3f5' : '#b45309');
      break;
    case 'lava':
      lavaPool(ctx, s, rnd);
      out.push({ type: 'lava', x, y, r: 12 * s });
      break;
    case 'basalt':
      basalt(ctx, s, rnd);
      break;
    case 'dead':
      deadTree(ctx, s);
      break;
    case 'vent':
      vent(ctx, s);
      out.push({ type: 'smoke', x, y: y - 8 * s });
      break;
    case 'snowman':
      snowman(ctx, s);
      break;
    case 'crate':
      crate(ctx, 0, 0, s);
      break;
    case 'crates':
      crate(ctx, -6 * s, 0, s * 0.95, false);
      crate(ctx, 8 * s, 2 * s, s * 0.95);
      crate(ctx, 1 * s, -13 * s, s * 0.9);
      break;
    case 'barrel':
      barrel(ctx, s, rnd);
      break;
    case 'warn':
      warnLight(ctx, s);
      out.push({ type: 'warn', x, y: y - 29.5 * s, ph: rnd() * TAU });
      break;
    case 'flag':
      flagPole(ctx, s, '#dc2626', '#fecaca', 'R');
      break;
    case 'banner':
      flagPole(ctx, s, '#6d28d9', '#fbbf24', 'ball');
      break;
    case 'console':
      consoleBox(ctx, s);
      break;
    case 'column':
      column(ctx, s);
      out.push({ type: 'flame', x: x + 2.2 * s, y: y - 39.5 * s });
      break;
    case 'topiary':
      topiary(ctx, s);
      break;
    case 'statue':
      statue(ctx, s);
      out.push({ type: 'glint', x: x + 2.5 * s, y: y - 21 * s, c: '#fde68a' });
      break;
    default:
  }
  ctx.restore();
  return out;
}

const FLAT = new Set(['flowers', 'star', 'shell', 'lava']);

function placeDecor(lv, P, rnd, avoid) {
  const kinds = Object.entries(P.decor);
  const total = kinds.reduce((a, [, w]) => a + w, 0);
  const pick = () => {
    let r = rnd() * total;
    for (const [k, w] of kinds) {
      r -= w;
      if (r <= 0) return k;
    }
    return kinds[0][0];
  };
  const list = [];
  for (let tries = 0; tries < 1400 && list.length < 46; tries++) {
    const kind = pick();
    const [r0, h0] = DECOR[kind];
    const s = 0.85 + rnd() * 0.35;
    const r = r0 * s;
    const h = h0 * s;
    const x = -2 + rnd() * (W + 4);
    const y = 10 + rnd() * (H - 4);
    if (lv.theme === 'beach' && x > shoreX(y) - r - 4) continue;
    if (distToPath(lv.path, x, y) < ROAD_OUT / 2 + r + 2) continue;
    if (h > 14 && distToPath(lv.path, x, y - h * 0.75) < ROAD_OUT / 2 + r * 0.8) continue;
    if (lv.pads.some((p) => Math.hypot(p.x - x, p.y + PAD_TOP - y) < 24 + r || (h > 14 && Math.hypot(p.x - x, p.y - (y - h * 0.7)) < 22 + r * 0.7))) continue;
    if (avoid.some((a) => Math.hypot(a.x - x, a.y - y) < a.r + r)) continue;
    if (list.some((d) => Math.hypot(d.x - x, d.y - y) < (d.r + r) * 0.9)) continue;
    if (h > 20 && y - h < -6) continue;
    list.push({ kind, x, y, s, r, h });
  }
  return list.sort((a, b) => a.y - b.y);
}

// ---------- The Pokémon Center (pre-rendered) ----------

const CENTER_BOX = { w: 110, h: 92, ox: 52, oy: 66 }; // canvas size and where the anchor sits

function paintCenter(ctx) {
  softShadow(ctx, 10, 6, 52, 16, 0.4);
  softShadow(ctx, 2, 2, 40, 10, 0.35);
  // Base slab
  box(ctx, 0, 6, 76, 6, 26, { top: '#e2e8f0', front: '#94a3b8', side: '#64748b' });
  const w = 60;
  const h = 26;
  const d = 22;
  const b = box(ctx, 0, 0, w, h, d, { top: '#fff7ed', front: '#fffaf3', side: '#e3d6c6' }, 'rgba(80,40,20,0.35)');
  // Red stripe on the walls
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(b.l, b.t + 8, w, 3);
  ctx.beginPath();
  ctx.moveTo(b.r, b.t + 8);
  ctx.lineTo(b.r + b.dx, b.t + 8 + b.dy);
  ctx.lineTo(b.r + b.dx, b.t + 11 + b.dy);
  ctx.lineTo(b.r, b.t + 11);
  ctx.fillStyle = '#b91c1c';
  ctx.fill();
  // Side windows
  for (const f of [0.3, 0.7]) {
    const x = b.r + b.dx * f;
    const y = b.t + 14 + b.dy * f;
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y);
    ctx.lineTo(x + 2.5, y - 3);
    ctx.lineTo(x + 2.5, y + 4);
    ctx.lineTo(x - 2.5, y + 7);
    ctx.closePath();
    ctx.fill();
  }
  // Roof slab with thickness and tiles
  const rl = b.l - 4;
  const rr = b.r + 4;
  const rt = b.t - 1;
  const rdx = b.dx + 4;
  const rdy = b.dy - 3;
  const th = 5;
  ctx.fillStyle = '#991b1b';
  ctx.beginPath();
  ctx.moveTo(rr, rt + th);
  ctx.lineTo(rr + rdx, rt + rdy + th);
  ctx.lineTo(rr + rdx, rt + rdy);
  ctx.lineTo(rr, rt);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(rl, rt, rr - rl, th);
  const rg = ctx.createLinearGradient(rl, rt + rdy, rr, rt);
  rg.addColorStop(0, '#f87171');
  rg.addColorStop(1, '#dc2626');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(rl, rt);
  ctx.lineTo(rr, rt);
  ctx.lineTo(rr + rdx, rt + rdy);
  ctx.lineTo(rl + rdx, rt + rdy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(127,29,29,0.45)';
  ctx.lineWidth = 0.8;
  for (let k = 1; k < 5; k++) {
    const f = k / 5;
    ctx.beginPath();
    ctx.moveTo(rl + rdx * f, rt + rdy * f);
    ctx.lineTo(rr + rdx * f, rt + rdy * f);
    ctx.stroke();
  }
  for (let k = 1; k < 9; k++) {
    const x = rl + ((rr - rl) * k) / 9;
    ctx.beginPath();
    ctx.moveTo(x, rt);
    ctx.lineTo(x + rdx, rt + rdy);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rl, rt + 0.5);
  ctx.lineTo(rr, rt + 0.5);
  ctx.stroke();
  // Glass doors
  const dw = 18;
  const dh = 15;
  ctx.fillStyle = '#334155';
  roundRect(ctx, -dw / 2 - 1.5, -dh - 1.5, dw + 3, dh + 1.5, 2);
  ctx.fill();
  const gg = ctx.createLinearGradient(-dw / 2, -dh, dw / 2, 0);
  gg.addColorStop(0, '#bae6fd');
  gg.addColorStop(0.6, '#38bdf8');
  gg.addColorStop(1, '#0369a1');
  ctx.fillStyle = gg;
  ctx.fillRect(-dw / 2, -dh, dw, dh);
  ctx.fillStyle = '#334155';
  ctx.fillRect(-0.6, -dh, 1.2, dh);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.moveTo(-dw / 2 + 2, -2);
  ctx.lineTo(-dw / 2 + 6, -dh);
  ctx.lineTo(-dw / 2 + 8.5, -dh);
  ctx.lineTo(-dw / 2 + 4.5, -2);
  ctx.closePath();
  ctx.moveTo(2.5, -2);
  ctx.lineTo(6.5, -dh);
  ctx.lineTo(7.8, -dh);
  ctx.lineTo(3.8, -2);
  ctx.closePath();
  ctx.fill();
  // Front windows
  for (const x of [-24, 15]) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, -14, 11, 9);
    const wg = ctx.createLinearGradient(x, -13, x + 9, -6);
    wg.addColorStop(0, '#e0f2fe');
    wg.addColorStop(1, '#38bdf8');
    ctx.fillStyle = wg;
    ctx.fillRect(x, -13, 9, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(x + 1, -12.5, 2, 6);
  }
  // Steps
  box(ctx, 0, 9, 24, 3, 5, { top: '#f1f5f9', front: '#cbd5e1', side: '#94a3b8' });
  box(ctx, 0, 12, 28, 3, 4, { top: '#f8fafc', front: '#cbd5e1', side: '#94a3b8' });
  // Sign base (the ball itself is drawn live so it can glow)
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(-1.5, rt - 10, 3, 10);
}

let centerCache = null;
function centerSprite(dpr) {
  if (centerCache && centerCache.dpr === dpr) return centerCache;
  const m = makeCanvas(CENTER_BOX.w * dpr, CENTER_BOX.h * dpr);
  if (!m) return null;
  const [c, x] = m;
  x.scale(dpr, dpr);
  x.translate(CENTER_BOX.ox, CENTER_BOX.oy);
  paintCenter(x);
  // Red-tinted copy for the "ouch" flash
  const m2 = makeCanvas(c.width, c.height);
  let red = null;
  if (m2) {
    const [c2, x2] = m2;
    x2.drawImage(c, 0, 0);
    x2.globalCompositeOperation = 'source-atop';
    x2.fillStyle = '#ef4444';
    x2.fillRect(0, 0, c2.width, c2.height);
    red = c2;
  }
  centerCache = { dpr, canvas: c, red };
  return centerCache;
}

/** Where the Center stands (kept on screen even when the road ends near the top). */
export function centerSpot(lv) {
  const end = lv.path.pts[lv.path.pts.length - 1];
  return { x: end.x, y: Math.max(end.y - 2, 62) };
}

export function drawCenter(ctx, lv, dpr, t, hurt) {
  const { x, y } = centerSpot(lv);
  const sp = centerSprite(dpr);
  if (sp) ctx.drawImage(sp.canvas, x - CENTER_BOX.ox, y - CENTER_BOX.oy, CENTER_BOX.w, CENTER_BOX.h);
  // Glowing Poké Ball sign
  const sy = y - 46;
  const pulse = (Math.sin(t * 3) + 1) / 2;
  drawGlow(ctx, hurt > 0 ? '#ef4444' : '#fde68a', x, sy, 18 + pulse * 4, 0.55 + pulse * 0.25);
  drawPokeball(ctx, x, sy, 8.5 + pulse * 0.4);
  ctx.strokeStyle = 'rgba(30,41,59,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, sy, 8.5 + pulse * 0.4, 0, TAU);
  ctx.stroke();
  if (hurt > 0) {
    const k = Math.min(1, hurt / 0.6);
    if (sp?.red) {
      ctx.globalAlpha = 0.55 * k * (0.6 + 0.4 * Math.sin(t * 40));
      ctx.drawImage(sp.red, x - CENTER_BOX.ox, y - CENTER_BOX.oy, CENTER_BOX.w, CENTER_BOX.h);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = `rgba(239,68,68,${k})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 40 + (1 - k) * 22, 15 + (1 - k) * 8, 0, 0, TAU);
    ctx.stroke();
    // Nurse Joy heals: green crosses float up
    for (let i = 0; i < 3; i++) {
      const fy = y - 30 - (1 - k) * 26 - i * 6;
      const fx = x - 18 + i * 18;
      ctx.globalAlpha = k;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fx - 3.5, fy - 1.6, 7, 3.2);
      ctx.fillRect(fx - 1.6, fy - 3.5, 3.2, 7);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(fx - 2.6, fy - 0.8, 5.2, 1.6);
      ctx.fillRect(fx - 0.8, fy - 2.6, 1.6, 5.2);
    }
    ctx.globalAlpha = 1;
  }
}

/** Round stone plaza the Pokémon Center stands on (hides the end of the road). */
function paintPlaza(ctx, lv, P) {
  const { x, y } = centerSpot(lv);
  const [top, side] = P.pad;
  softShadow(ctx, x + 5, y + 10, 52, 20, 0.4);
  cylinder(ctx, x, y + 12, 44, 19, 5, top, side, 'rgba(0,0,0,0.3)');
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.8;
  for (const k of [0.45, 0.75]) {
    ctx.beginPath();
    ctx.ellipse(x, y + 7, 44 * k, 19 * k, 0, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 44 * 0.45, y + 7 + Math.sin(a) * 19 * 0.45);
    ctx.lineTo(x + Math.cos(a) * 43, y + 7 + Math.sin(a) * 18.5);
    ctx.stroke();
  }
}

// ---------- The whole static scene ----------

const sceneCache = new Map();

function paintScene(lv, dpr) {
  const m = makeCanvas(W * dpr, H * dpr);
  if (!m) return null;
  const [c, ctx] = m;
  ctx.scale(dpr, dpr);
  const P = PAL[lv.theme] || PAL.forest;
  const rnd = seededRnd(11 + lv.index * 97);
  paintGround(ctx, lv, P, rnd);
  paintRoad(ctx, lv, P, rnd, dpr);
  paintPlaza(ctx, lv, P);
  for (const p of lv.pads) paintPad(ctx, p, P, lv.theme);
  const gate = portalSpot(lv);
  paintPortal(ctx, gate, P, lv.theme);
  const cs = centerSpot(lv);
  const avoid = [
    { x: cs.x, y: cs.y, r: 50 },
    { x: cs.x, y: cs.y - 34, r: 42 },
    { x: gate.x, y: gate.y, r: 36 },
    { x: gate.x + gate.nx * 34, y: gate.y + gate.ny * 34, r: 14 },
    { x: gate.x - gate.nx * 34, y: gate.y - gate.ny * 34, r: 14 },
  ];
  const decor = placeDecor(lv, P, rnd, avoid);
  for (const d of decor) if (!FLAT.has(d.kind)) castShadow(ctx, d.x, d.y, d.r * 0.7, d.h, 0.3);
  const anchors = [];
  for (const d of decor) anchors.push(...paintDecor(ctx, d, lv.theme, rnd));
  // Key light from the top-left and a soft vignette
  const lg = ctx.createRadialGradient(W * 0.15, H * 0.05, 10, W * 0.15, H * 0.05, H * 0.9);
  lg.addColorStop(0, 'rgba(255,248,220,0.14)');
  lg.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.72);
  vg.addColorStop(0, rgba(P.vign, 0));
  vg.addColorStop(1, rgba(P.vign, lv.theme === 'cave' || lv.theme === 'volcano' ? 0.55 : lv.theme === 'indigo' ? 0.5 : 0.32));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // Animated grass tufts (forest) beside the road
  const sway = [];
  if (lv.theme === 'forest' || lv.theme === 'city') {
    for (let i = 0; i < 400 && sway.length < 22; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const dd = distToPath(lv.path, x, y);
      if (dd < ROAD_OUT / 2 + 2 || dd > ROAD_OUT / 2 + 26) continue;
      if (lv.pads.some((p) => Math.hypot(p.x - x, p.y - y) < 26)) continue;
      if (decor.some((d) => Math.hypot(d.x - x, d.y - y) < d.r + 4)) continue;
      sway.push({ x, y, ph: rnd() * TAU });
    }
  }
  return { canvas: c, anchors, gate, theme: lv.theme, sway, dpr };
}

export function scene(lv, dpr = 2) {
  const key = `${lv.id}|${dpr}`;
  if (!sceneCache.has(key)) {
    const sc = paintScene(lv, dpr);
    if (!sc) return null;
    sceneCache.set(key, sc);
  }
  return sceneCache.get(key);
}

// ---------- Live touches (cheap, every frame) ----------

/** Under the units: sea foam, lava bubbles, the portal swirl, swaying grass. */
export function drawAmbientUnder(ctx, sc, t) {
  const th = sc.theme;
  if (th === 'beach') {
    ctx.save();
    ctx.lineCap = 'round';
    for (let band = 0; band < 2; band++) {
      const k = (t * 0.35 + band * 0.5) % 1;
      const off = -2 + Math.sin(k * Math.PI) * 6;
      ctx.strokeStyle = `rgba(255,255,255,${0.85 - band * 0.35})`;
      ctx.lineWidth = band ? 1.5 : 2.6;
      ctx.beginPath();
      for (let y = 0; y <= H; y += 8) {
        const x = shoreX(y) - off + band * 7 + Math.sin(y / 9 + t * 2 + band) * 1.4;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 10; i++) {
      const y = (i * 61 + t * 9) % H;
      const x = shoreX(y) + 10 + ((i * 37) % 22);
      const a = (Math.sin(t * 3 + i * 1.7) + 1) / 2;
      ctx.globalAlpha = a;
      ctx.fillRect(x - 2, y, 4, 1);
    }
    ctx.restore();
  }
  for (const a of sc.anchors) {
    if (a.type === 'lava') {
      drawGlow(ctx, '#fb923c', a.x, a.y, a.r * 2.2, 0.25 + 0.15 * Math.sin(t * 2 + a.x));
      for (let i = 0; i < 2; i++) {
        const k = (t * 0.7 + i * 0.5 + a.x * 0.013) % 1;
        const bx = a.x + Math.sin(a.y + i * 3) * a.r * 0.5;
        const by = a.y + Math.cos(a.x + i) * a.r * 0.2;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#fff7b0';
        ctx.fillStyle = '#fdba74';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(bx, by - k * 2, 1 + k * 2.6, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (a.type === 'smoke') {
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.35 + i / 3 + a.x * 0.01) % 1;
        ctx.globalAlpha = 0.35 * (1 - k);
        ctx.fillStyle = '#6b6461';
        ctx.beginPath();
        ctx.arc(a.x + Math.sin(k * 5 + i) * 3 + k * 6, a.y - k * 26, 2.5 + k * 6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
  if (sc.sway.length) {
    ctx.lineCap = 'round';
    for (const g of sc.sway) {
      const w = Math.sin(t * 2.2 + g.ph) * 1.6;
      for (let i = -1; i <= 1; i++) {
        ctx.strokeStyle = i ? '#3f8f37' : '#a6e07a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(g.x + i * 2, g.y);
        ctx.quadraticCurveTo(g.x + i * 2.4, g.y - 4, g.x + i * 3.5 + w, g.y - 8 + Math.abs(i) * 1.5);
        ctx.stroke();
      }
    }
  }
  // Portal swirl
  const g = sc.gate;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(g.x, g.y - 1, 19.5, 10, 0, 0, TAU);
  ctx.clip();
  ctx.translate(g.x, g.y - 1);
  ctx.scale(1, 0.52);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
  sg.addColorStop(0, '#f0abfc');
  sg.addColorStop(0.4, '#9333ea');
  sg.addColorStop(1, '#1e0636');
  ctx.fillStyle = sg;
  ctx.fillRect(-21, -21, 42, 42);
  ctx.rotate(t * 2.2);
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 3; arm++) {
    ctx.rotate(TAU / 3);
    ctx.strokeStyle = arm % 2 ? 'rgba(255,255,255,0.7)' : 'rgba(248,113,113,0.8)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) {
      const r = 2 + k * 1.5;
      const a = k * 0.32;
      if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.stroke();
  }
  ctx.restore();
  drawGlow(ctx, '#c084fc', g.x, g.y - 4, 26, 0.35 + 0.15 * Math.sin(t * 4));
}

/** Over everything: glints, lamps, flames, warning lights, and weather. */
export function drawAmbientOver(ctx, sc, t) {
  const th = sc.theme;
  for (const a of sc.anchors) {
    if (a.type === 'glint') {
      const k = (Math.sin(t * 2.4 + a.x * 0.37) + 1) / 2;
      drawGlow(ctx, a.c, a.x, a.y, 9 + k * 6, 0.25 + k * 0.45);
      if (k > 0.85) {
        ctx.fillStyle = '#ffffff';
        const r = (k - 0.85) * 30;
        ctx.fillRect(a.x - r, a.y - 0.5, r * 2, 1);
        ctx.fillRect(a.x - 0.5, a.y - r, 1, r * 2);
      }
    } else if (a.type === 'lamp') {
      drawGlow(ctx, a.c, a.x, a.y, 16, 0.45 + 0.1 * Math.sin(t * 5 + a.x));
    } else if (a.type === 'warn') {
      const on = Math.sin(t * 5 + a.ph) > 0.2;
      if (on) drawGlow(ctx, '#ef4444', a.x, a.y, 16, 0.9);
    } else if (a.type === 'flame') {
      const f = Math.sin(t * 13 + a.x) * 0.8;
      drawGlow(ctx, '#fb923c', a.x, a.y - 3, 15, 0.7);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(a.x - 4, a.y);
      ctx.quadraticCurveTo(a.x - 4, a.y - 6, a.x + f, a.y - 11);
      ctx.quadraticCurveTo(a.x + 4, a.y - 6, a.x + 4, a.y);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.moveTo(a.x - 2, a.y);
      ctx.quadraticCurveTo(a.x - 2, a.y - 4, a.x + f * 0.6, a.y - 7);
      ctx.quadraticCurveTo(a.x + 2, a.y - 4, a.x + 2, a.y);
      ctx.fill();
    }
  }
  if (th === 'snow') {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 42; i++) {
      const sp = 14 + (i % 5) * 5;
      const y = ((i * 97.3 + t * sp) % (H + 20)) - 10;
      const x = (i * 53.7) % W + Math.sin(t * 0.9 + i) * 8;
      ctx.globalAlpha = 0.6 + (i % 3) * 0.13;
      ctx.beginPath();
      ctx.arc(x, y, 0.9 + (i % 4) * 0.45, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (th === 'volcano') {
    for (let i = 0; i < 22; i++) {
      const sp = 16 + (i % 4) * 7;
      const k = ((i * 0.137 + (t * sp) / H) % 1);
      const y = H + 10 - k * (H + 20);
      const x = (i * 71.3) % W + Math.sin(t * 1.3 + i) * 10;
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
      ctx.fillStyle = i % 3 ? '#fb923c' : '#fde047';
      ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
    }
    ctx.globalAlpha = 1;
  } else if (th === 'cave') {
    for (let i = 0; i < 12; i++) {
      const x = (i * 83.1) % W + Math.sin(t * 0.6 + i * 1.3) * 18;
      const y = (i * 149.7) % H + Math.cos(t * 0.5 + i) * 14;
      const k = (Math.sin(t * 2 + i * 2.1) + 1) / 2;
      drawGlow(ctx, '#bef264', x, y, 6 + k * 4, 0.3 + k * 0.6);
    }
  } else if (th === 'forest') {
    for (let i = 0; i < 3; i++) {
      const x = ((i * 131 + t * 14) % (W + 40)) - 20;
      const y = 90 + i * 170 + Math.sin(t * 1.3 + i) * 24;
      const flap = Math.abs(Math.sin(t * 12 + i));
      ctx.fillStyle = ['#fde047', '#f9a8d4', '#ffffff'][i];
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + sx * 2.4 * flap, y, 2.6 * flap + 0.4, 2, 0, 0, TAU);
        ctx.fill();
      }
    }
    for (let i = 0; i < 10; i++) {
      const x = (i * 97.3 + Math.sin(t * 0.4 + i) * 20) % W;
      const y = (i * 61.7 + t * 4) % H;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + i);
      ctx.fillStyle = '#fefce8';
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
  } else if (th === 'indigo') {
    for (let i = 0; i < 12; i++) {
      const x = (i * 89.3) % W + Math.sin(t * 0.7 + i) * 10;
      const y = H - (((i * 53.1) + t * 10) % H);
      const k = (Math.sin(t * 3 + i * 1.9) + 1) / 2;
      ctx.globalAlpha = k * 0.85;
      ctx.fillStyle = '#fde047';
      ctx.fillRect(x - 0.6, y - 2.2, 1.2, 4.4);
      ctx.fillRect(x - 2.2, y - 0.6, 4.4, 1.2);
    }
    ctx.globalAlpha = 1;
  }
}
