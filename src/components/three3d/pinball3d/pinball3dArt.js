// Canvas-generated textures for "Pinball Pokémon": printed playfield, apron, backbox, wood, glow, env.
import * as THREE from 'three';
import { TABLE, CX } from '../../../utils/three3d/pinball3d';

export const FIELD = { x0: 0, x1: 10, y0: -1.5, y1: 20 };

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bolt(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(4, -20);
  ctx.lineTo(-10, 3);
  ctx.lineTo(-1, 3);
  ctx.lineTo(-5, 20);
  ctx.lineTo(10, -4);
  ctx.lineTo(1, -4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function pokeLogo(ctx, x, y, r, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ff6b6b');
  g.addColorStop(1, '#b4141e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.fill();
  const g2 = ctx.createRadialGradient(-r * 0.3, r * 0.2, r * 0.1, 0, 0, r);
  g2.addColorStop(0, '#ffffff');
  g2.addColorStop(1, '#c9cfe0');
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#16161e';
  ctx.fillRect(-r, -r * 0.09, r * 2, r * 0.18);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = r * 0.06;
  ctx.strokeStyle = '#16161e';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function chevron(ctx, x, y, s, angle, fill, stroke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.8, s * 0.2);
  ctx.lineTo(s * 0.4, s * 0.2);
  ctx.lineTo(s * 0.4, s);
  ctx.lineTo(-s * 0.4, s);
  ctx.lineTo(-s * 0.4, s * 0.2);
  ctx.lineTo(-s * 0.8, s * 0.2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

/** Printed playfield: type-coloured zones, the big Poké Ball logo, lane arrows, labels. */
export function playfieldTexture(lowRes = false) {
  const Wd = lowRes ? 512 : 1024;
  const Ht = lowRes ? 1024 : 2048;
  return canvasTexture(Wd, Ht, (ctx, w, h) => {
    const X = (x) => ((x - FIELD.x0) / (FIELD.x1 - FIELD.x0)) * w;
    const Y = (y) => ((FIELD.y1 - y) / (FIELD.y1 - FIELD.y0)) * h;
    const U = w / 10; // pixels per table unit
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1d1a5e');
    bg.addColorStop(0.5, '#15296b');
    bg.addColorStop(1, '#0c1840');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const rnd = rand(9);
    // Faint star dust
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.08 + rnd() * 0.25})`;
      const r = 0.6 + rnd() * 1.8;
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, r * (w / 1024), 0, Math.PI * 2);
      ctx.fill();
    }
    const zone = (x, y, r, inner, outer = 'rgba(0,0,0,0)') => {
      const g = ctx.createRadialGradient(X(x), Y(y), 0, X(x), Y(y), r * U);
      g.addColorStop(0, inner);
      g.addColorStop(1, outer);
      ctx.fillStyle = g;
      ctx.fillRect(X(x) - r * U, Y(y) - r * U, r * U * 2, r * U * 2);
    };
    // Electric zone around the bumpers
    zone(4.6, 14.3, 3.4, 'rgba(250,204,21,0.55)');
    for (let i = 0; i < 9; i++) bolt(ctx, X(2 + rnd() * 5.2), Y(12 + rnd() * 5), (0.9 + rnd() * 0.9) * (w / 1024), 'rgba(253,224,71,0.35)');
    // Ground zone (Digletts)
    zone(1.0, 8.2, 2.6, 'rgba(180,110,50,0.7)');
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(${90 + rnd() * 60},${50 + rnd() * 30},20,0.35)`;
      ctx.beginPath();
      ctx.arc(X(rnd() * 2.4), Y(6.3 + rnd() * 3.8), (2 + rnd() * 5) * (w / 1024), 0, Math.PI * 2);
      ctx.fill();
    }
    // Water zone (Cloyster's ramp side)
    zone(8.2, 11.5, 3.0, 'rgba(56,189,248,0.55)');
    ctx.strokeStyle = 'rgba(186,230,253,0.35)';
    ctx.lineWidth = 4 * (w / 1024);
    for (let k = 0; k < 7; k++) {
      ctx.beginPath();
      const yy = 8.4 + k * 0.85;
      for (let x = 6.4; x <= 9.2; x += 0.1) {
        const py = Y(yy + Math.sin(x * 4 + k) * 0.12);
        if (x === 6.4) ctx.moveTo(X(x), py);
        else ctx.lineTo(X(x), py);
      }
      ctx.stroke();
    }
    // Grass zone at the bottom
    zone(CX, 2.6, 4.8, 'rgba(74,222,128,0.4)');
    // Psychic glow at the centre target
    zone(CX, 10.4, 1.6, 'rgba(244,114,182,0.5)');
    // Big Poké Ball logo; its button is the catch hole
    zone(TABLE.hole.x, TABLE.hole.y, 2.4, 'rgba(255,255,255,0.18)');
    pokeLogo(ctx, X(TABLE.hole.x), Y(TABLE.hole.y), 1.45 * U, 0.92);
    // Dashed rings
    ctx.setLineDash([10 * (w / 1024), 10 * (w / 1024)]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3 * (w / 1024);
    ctx.beginPath();
    ctx.arc(X(TABLE.hole.x), Y(TABLE.hole.y), 1.75 * U, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Plunger lane
    ctx.fillStyle = 'rgba(8,12,30,0.75)';
    ctx.fillRect(X(9.2), 0, X(10) - X(9.2), h);
    for (let y = 1.5; y < 13; y += 1.4) chevron(ctx, X(9.6), Y(y), 0.22 * U, 0, 'rgba(250,204,21,0.25)', 'rgba(250,204,21,0.5)');
    // Orbit lanes
    ctx.fillStyle = 'rgba(15,23,60,0.6)';
    ctx.fillRect(X(0), Y(14.4), X(1.05), Y(11) - Y(14.4));
    ctx.fillRect(X(8.5), Y(14.4), X(9.2) - X(8.5), Y(9.4) - Y(14.4));
    // Inlane / outlane strips
    ctx.fillStyle = 'rgba(10,16,40,0.55)';
    ctx.fillRect(X(0), Y(5), X(0.75), Y(-1.5) - Y(5));
    ctx.fillRect(X(8.45), Y(5), X(9.2) - X(8.45), Y(-1.5) - Y(5));
    // Labels
    const label = (text, x, y, size, color = '#fde68a', rot = 0) => {
      ctx.save();
      ctx.translate(X(x), Y(y));
      ctx.rotate(rot);
      ctx.font = `900 ${size * U}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = size * U * 0.18;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    };
    label('CỨU BÓNG', CX, 2.5, 0.2, '#a5f3fc');
    label('KICK', 0.37, 2.35, 0.17, '#fca5a5', -Math.PI / 2);
    label('BẮT POKÉMON', CX, 5.9, 0.3, '#fef08a');
    label('DIGLETT', 1.25, 10.35, 0.2, '#fdba74');
    label('RAMP', 7.9, 8.0, 0.22, '#7dd3fc');
    label('ORBIT', 0.52, 10.3, 0.15, '#c4b5fd', -Math.PI / 2);
    label('ORBIT', 8.85, 8.9, 0.15, '#c4b5fd', -Math.PI / 2);
    for (let k = 2; k <= 5; k++) label(`x${k}`, CX - 1.5 + (k - 2) * 1.0, 4.85, 0.2, '#fde047');
    label('PINBALL', CX, 3.7, 0.42, 'rgba(255,255,255,0.85)');
    // Inlane arrows printed under the lights
    for (const l of TABLE.inlanes) chevron(ctx, X(l.x), Y(l.y + 0.6), 0.16 * U, Math.PI, 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.4)');
    // Glow under the flippers
    zone(2.85, 2.2, 1.3, 'rgba(255,255,255,0.12)');
    zone(6.35, 2.2, 1.3, 'rgba(255,255,255,0.12)');
  });
}

/** Apron with the game's title. */
export function apronTexture() {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ef4444');
    g.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 24; i++) ctx.fillRect(i * 48, 0, 20, h);
    pokeLogo(ctx, 110, h / 2, 70);
    pokeLogo(ctx, w - 110, h / 2, 70);
    ctx.font = '900 92px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#1e3a8a';
    ctx.strokeText('POKÉMON', w / 2, h / 2 + 4);
    ctx.fillStyle = '#fde047';
    ctx.fillText('POKÉMON', w / 2, h / 2 + 4);
  });
}

/** The lit backbox above the top of the table. */
export function backboxTexture() {
  return canvasTexture(1024, 384, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#312e81');
    g.addColorStop(1, '#0f172a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rnd = rand(4);
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `hsla(${rnd() * 360},90%,65%,0.35)`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(w / 2, h * 1.2, 200 + i * 22, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) bolt(ctx, 80 + i * 175, 70 + (i % 2) * 230, 2.2, 'rgba(253,224,71,0.55)');
    ctx.font = '900 120px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#1e40af';
    ctx.strokeText('PINBALL', w / 2, h * 0.42);
    ctx.fillStyle = '#fde047';
    ctx.fillText('PINBALL', w / 2, h * 0.42);
    ctx.font = '900 64px system-ui, sans-serif';
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#7f1d1d';
    ctx.strokeText('POKÉMON', w / 2, h * 0.76);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('POKÉMON', w / 2, h * 0.76);
    pokeLogo(ctx, 110, h * 0.6, 62);
    pokeLogo(ctx, w - 110, h * 0.6, 62);
  });
}

/** Warm wood grain for the cabinet walls. */
export function woodTexture() {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5b3417';
    ctx.fillRect(0, 0, w, h);
    const rnd = rand(12);
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = `rgba(${120 + rnd() * 60},${70 + rnd() * 30},${30 + rnd() * 20},${0.25 + rnd() * 0.3})`;
      ctx.lineWidth = 1 + rnd() * 3;
      ctx.beginPath();
      const y = rnd() * h;
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 4);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Soft round glow sprite. */
export function glowTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** Dark arcade room with bright light strips: gives chrome and plastic something to reflect. */
export function envTexture() {
  const tex = canvasTexture(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#a5b4fc');
    g.addColorStop(0.35, '#4c1d95');
    g.addColorStop(0.55, '#1e1b4b');
    g.addColorStop(1, '#0b0b1a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Ceiling light strips, a bright horizon band and neon signs
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 6; i++) ctx.fillRect(i * 88 + 10, 18, 50, 14);
    const hb = ctx.createLinearGradient(0, 108, 0, 150);
    hb.addColorStop(0, 'rgba(255,255,255,0)');
    hb.addColorStop(0.5, 'rgba(240,244,255,0.9)');
    hb.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hb;
    ctx.fillRect(0, 108, w, 42);
    const neon = ['#f472b6', '#22d3ee', '#facc15', '#a3e635'];
    neon.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(i * 128 + 20, 92, 70, 10);
    });
  });
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}
