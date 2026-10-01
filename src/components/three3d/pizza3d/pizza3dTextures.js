// Canvas-generated textures for "Tiệm Pizza Pokémon" (no image files).
import * as THREE from 'three';

export function canvasTexture(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.anisotropy = 4;
  return tex;
}

export const mulberry = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Warm wooden planks. */
export function woodTexture(repeat) {
  const rnd = mulberry(3);
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      const rows = 4;
      const ph = h / rows;
      const tones = ['#d89a5b', '#cf9152', '#dda366', '#c98a4c', '#e0a86c'];
      for (let r = 0; r < rows; r++) {
        let x = -rnd() * 120;
        while (x < w) {
          const len = 110 + rnd() * 90;
          ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
          ctx.fillRect(x, r * ph, len, ph);
          // grain
          ctx.strokeStyle = 'rgba(120,70,30,0.16)';
          ctx.lineWidth = 1.2;
          for (let k = 0; k < 5; k++) {
            const y = r * ph + 6 + rnd() * (ph - 12);
            ctx.beginPath();
            ctx.moveTo(x + 4, y);
            ctx.bezierCurveTo(x + len * 0.3, y + (rnd() - 0.5) * 6, x + len * 0.7, y + (rnd() - 0.5) * 6, x + len - 4, y);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(90,50,20,0.35)';
          ctx.fillRect(x, r * ph, 2, ph);
          x += len;
        }
        ctx.fillStyle = 'rgba(90,50,20,0.4)';
        ctx.fillRect(0, r * ph, w, 2);
      }
    },
    { repeat }
  );
}

/** Checkered kitchen tiles. */
export function tileTexture(repeat, a = '#f4efe6', b = '#e46a5a') {
  return canvasTexture(
    128,
    128,
    (ctx, w) => {
      const n = 4;
      const s = w / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = (i + j) % 2 ? a : b;
          ctx.fillRect(i * s, j * s, s, s);
        }
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= n; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s, 0);
        ctx.lineTo(i * s, w);
        ctx.moveTo(0, i * s);
        ctx.lineTo(w, i * s);
        ctx.stroke();
      }
    },
    { repeat }
  );
}

/** Small square wall tiles (counter top, kitchen wall). */
export function smallTileTexture(repeat, base = '#ffffff', grout = '#d9d2c5') {
  return canvasTexture(
    128,
    128,
    (ctx, w) => {
      ctx.fillStyle = grout;
      ctx.fillRect(0, 0, w, w);
      const n = 8;
      const s = w / n;
      const rnd = mulberry(9);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const l = 245 - Math.floor(rnd() * 14);
          ctx.fillStyle = base === '#ffffff' ? `rgb(${l},${l},${l - 4})` : base;
          ctx.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
        }
    },
    { repeat }
  );
}

/** Bricks for the oven and the kitchen wall. */
export function brickTexture(repeat, tones = ['#c4553b', '#b44a33', '#cf6344', '#a9432f']) {
  const rnd = mulberry(5);
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#e8d7c0';
      ctx.fillRect(0, 0, w, h);
      const bh = 32;
      const bw = 64;
      for (let r = 0; r < h / bh; r++) {
        const off = r % 2 ? bw / 2 : 0;
        for (let x = -bw; x < w + bw; x += bw) {
          ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
          ctx.fillRect(x + off + 3, r * bh + 3, bw - 6, bh - 6);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(x + off + 3, r * bh + 3, bw - 6, 4);
        }
      }
    },
    { repeat }
  );
}

/** Striped cream wallpaper with a little pizza motif. */
export function wallpaperTexture(repeat) {
  return canvasTexture(
    128,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#fff3dc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffe7bf';
      for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 14, h);
      ctx.fillStyle = 'rgba(232,110,80,0.28)';
      for (let y = 30; y < h; y += 64) {
        for (const x of [16, 80]) {
          const yy = y + (x > 40 ? 32 : 0);
          ctx.beginPath();
          ctx.moveTo(x, yy - 8);
          ctx.lineTo(x - 7, yy + 6);
          ctx.lineTo(x + 7, yy + 6);
          ctx.closePath();
          ctx.fill();
        }
      }
    },
    { repeat }
  );
}

/** Red-white checkered tablecloth. */
export function clothTexture() {
  return canvasTexture(64, 64, (ctx, w) => {
    const n = 6;
    const s = w / n;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = 'rgba(226,65,60,0.85)';
    for (let i = 0; i < n; i++) {
      if (i % 2) {
        ctx.fillRect(i * s, 0, s, w);
        ctx.fillRect(0, i * s, w, s);
      }
    }
  });
}

/** Chalkboard menu listing the recipes and their prices. */
export function menuTexture(menu) {
  return canvasTexture(512, 384, (ctx, w, h) => {
    ctx.fillStyle = '#7a4a28';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#29453a';
    ctx.fillRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 40, 2);
    ctx.fillStyle = '#ffe68a';
    ctx.font = '900 46px system-ui, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THỰC ĐƠN', w / 2, 66);
    ctx.font = '700 30px system-ui, Arial, sans-serif';
    const rows = menu.slice(0, 7);
    const y0 = 116;
    const step = Math.min(40, (h - y0 - 20) / Math.max(1, rows.length));
    rows.forEach((r, i) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${r.icon} ${r.name.replace('Pizza ', '')}`, 40, y0 + i * step);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd36b';
      ctx.fillText(`${r.price}`, w - 40, y0 + i * step);
    });
  });
}

/** The shop sign: "PIZZA POKÉMON" with a Pokéball. */
export function signTexture() {
  return canvasTexture(512, 160, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e2412f');
    g.addColorStop(1, '#b8281d');
    ctx.fillStyle = '#ffe1a0';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 40);
    ctx.fill();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(10, 10, w - 20, h - 20, 32);
    ctx.fill();
    // pokéball
    const bx = 82;
    const by = h / 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.arc(bx, by, 46, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1f1f';
    ctx.fillRect(bx - 46, by - 5, 92, 10);
    ctx.beginPath();
    ctx.arc(bx, by, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d0';
    ctx.font = '900 64px system-ui, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#7a1a10';
    ctx.strokeText('PIZZA', 150, h / 2 - 22);
    ctx.fillText('PIZZA', 150, h / 2 - 22);
    ctx.font = '900 40px system-ui, Arial, sans-serif';
    ctx.fillStyle = '#ffd84a';
    ctx.strokeText('POKÉMON', 154, h / 2 + 34);
    ctx.fillText('POKÉMON', 154, h / 2 + 34);
  });
}

/** Lid of a pizza box with the shop logo. */
export function boxTexture() {
  return canvasTexture(128, 128, (ctx, w) => {
    ctx.fillStyle = '#f2dcb4';
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = '#d9bb8a';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, w - 12);
    ctx.fillStyle = '#e2412f';
    ctx.beginPath();
    ctx.arc(64, 56, 30, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(64, 56, 30, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#3a2a20';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 56, 30, 0, Math.PI * 2);
    ctx.moveTo(34, 56);
    ctx.lineTo(94, 56);
    ctx.stroke();
    ctx.fillStyle = '#3a2a20';
    ctx.beginPath();
    ctx.arc(64, 56, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8281d';
    ctx.font = '900 20px system-ui, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PIZZA', 64, 112);
  });
}

/** Soft round blob shadow. */
export function shadowTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
    g.addColorStop(0, 'rgba(60,30,10,0.42)');
    g.addColorStop(1, 'rgba(60,30,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** White radial glow (particles, lamps, fire). */
export function glowTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** Heart sprite. */
export function heartTexture(color = '#ff4f7b') {
  return canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    const heart = (s) => {
      ctx.beginPath();
      ctx.moveTo(32, 54 * s + 32 * (1 - s));
      ctx.bezierCurveTo(4 * s + 32 * (1 - s), 34 * s + 32 * (1 - s), 10 * s + 32 * (1 - s), 6 * s + 32 * (1 - s), 32, 20 * s + 32 * (1 - s));
      ctx.bezierCurveTo(54 * s + 32 * (1 - s), 6 * s + 32 * (1 - s), 60 * s + 32 * (1 - s), 34 * s + 32 * (1 - s), 32, 54 * s + 32 * (1 - s));
      ctx.fill();
    };
    heart(1);
    ctx.fillStyle = color;
    heart(0.82);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(22, 22, 6, 4, -0.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

/**
 * Speech bubble over a customer: the pizza with its topping icons ("!" when the order is not taken yet).
 * mode: 'order' | 'wait' | 'angry' | 'happy'.
 */
export function bubbleTexture({ icons = [], mode = 'order' }) {
  return canvasTexture(256, 176, (ctx, w) => {
    const bg = mode === 'angry' ? '#ffe1dc' : mode === 'happy' ? '#fff3c4' : '#ffffff';
    const edge = mode === 'angry' ? '#ef4444' : mode === 'order' ? '#f59e0b' : '#94a3b8';
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.roundRect(10, 14, w - 20, 128, 40);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, 124, 40);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 20, 128);
    ctx.lineTo(w / 2, 168);
    ctx.lineTo(w / 2 + 20, 128);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = bg;
    ctx.fillRect(w / 2 - 17, 120, 34, 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode === 'happy') {
      ctx.font = `76px ${EMOJI_FONT}`;
      ctx.fillText('😋', w / 2, 72);
      return;
    }
    const list = ['🍕', ...icons].slice(0, 5);
    const size = list.length > 3 ? 46 : 60;
    ctx.font = `${size}px ${EMOJI_FONT}`;
    const gap = size * 1.02;
    const x0 = w / 2 - ((list.length - 1) * gap) / 2;
    list.forEach((ic, i) => ctx.fillText(ic, x0 + i * gap, 72));
    if (mode === 'order' || mode === 'angry') {
      ctx.fillStyle = mode === 'angry' ? '#ef4444' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(w - 30, 30, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 38px system-ui, Arial, sans-serif';
      ctx.fillText(mode === 'angry' ? '!!' : '!', w - 30, 33);
    }
  });
}

/** Framed poster with a Pokémon artwork (falls back to a coloured Pokéball). */
export function posterTexture(url, color = '#ffd84a', title = '') {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 256;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const base = () => {
    if (!ctx) return;
    ctx.fillStyle = '#5b3a22';
    ctx.fillRect(0, 0, 192, 256);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, color);
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.fillRect(10, 10, 172, 236);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(96, 110, 30 + i * 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3b2a20';
    ctx.font = '900 22px system-ui, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 96, 228);
  };
  base();
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(96, 110, 40, 0, Math.PI * 2);
    ctx.fill();
  }
  if (url && typeof Image !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!ctx) return;
      base();
      try {
        ctx.drawImage(img, 16, 22, 160, 160);
      } catch {
        // tainted / broken image: keep the plain poster
      }
      tex.needsUpdate = true;
    };
    img.src = url;
  }
  return tex;
}

/** Sky seen through the windows: a vertical gradient that we tint for morning → evening. */
export function skyTexture() {
  return canvasTexture(16, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#d8d8d8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** House facade across the street (windows lit in the evening through emissive map). */
export function facadeTexture(color, seed, lit = false) {
  const rnd = mulberry(seed);
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = lit ? '#000000' : color;
    ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < 2; r++)
      for (let k = 0; k < 3; k++) {
        const x = 14 + k * 38;
        const y = 18 + r * 52;
        if (lit) {
          ctx.fillStyle = rnd() < 0.7 ? '#ffd27a' : '#000000';
          ctx.fillRect(x, y, 24, 30);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 3, y - 3, 30, 36);
          ctx.fillStyle = '#8fc9ee';
          ctx.fillRect(x, y, 24, 30);
          rnd();
        }
      }
  });
}
