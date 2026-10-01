// Canvas textures and small props for the "Vượt chướng ngại Pokémon" scene (no image files).
import * as THREE from 'three';

export function canvasTexture(w, h, draw, { repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 4;
  return tex;
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Surface detail per theme, drawn on white so it multiplies with the vertex colours. */
export function surfaceTexture(theme) {
  const rnd = mulberry(7);
  return canvasTexture(
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      if (theme === 'candy') {
        // sprinkles
        const cols = ['#ffd0e6', '#d6f5ff', '#fff2b8', '#e2ffd6', '#f0dcff'];
        for (let i = 0; i < 26; i++) {
          ctx.save();
          ctx.translate(rnd() * w, rnd() * h);
          ctx.rotate(rnd() * Math.PI);
          ctx.fillStyle = cols[i % cols.length];
          ctx.beginPath();
          ctx.roundRect?.(-7, -2, 14, 4, 2);
          if (!ctx.roundRect) ctx.rect(-7, -2, 14, 4);
          ctx.fill();
          ctx.restore();
        }
      } else if (theme === 'castle') {
        ctx.strokeStyle = 'rgba(80,60,120,0.25)';
        ctx.lineWidth = 3;
        for (let row = 0; row < 4; row++) {
          const y = (row * h) / 4;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          for (let k = 0; k < 2; k++) {
            const x = ((k + (row % 2) * 0.5) * w) / 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + h / 4);
            ctx.stroke();
          }
        }
      } else if (theme === 'factory') {
        ctx.strokeStyle = 'rgba(60,70,90,0.28)';
        ctx.lineWidth = 3;
        ctx.strokeRect(3, 3, w - 6, h - 6);
        ctx.fillStyle = 'rgba(60,70,90,0.35)';
        for (const [x, y] of [
          [12, 12],
          [w - 12, 12],
          [12, h - 12],
          [w - 12, h - 12],
        ]) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (theme === 'mountain') {
        for (let i = 0; i < 60; i++) {
          ctx.fillStyle = `rgba(110,80,50,${0.06 + rnd() * 0.12})`;
          ctx.beginPath();
          ctx.arc(rnd() * w, rnd() * h, 2 + rnd() * 7, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // rainbow: tiny stars
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = `rgba(200,220,255,${0.4 + rnd() * 0.4})`;
          ctx.beginPath();
          ctx.arc(rnd() * w, rnd() * h, 2 + rnd() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    { repeat: true }
  );
}

export const stripeTexture = (a, b, n = 6, angle = true) =>
  canvasTexture(
    128,
    32,
    (ctx, w, h) => {
      ctx.fillStyle = a;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = b;
      for (let i = -1; i < n * 2; i++) {
        const x = (i * w) / n;
        ctx.beginPath();
        if (angle) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x + w / n / 2, 0);
          ctx.lineTo(x + w / n / 2 + h * 0.6, h);
          ctx.lineTo(x + h * 0.6, h);
        } else ctx.rect(x, 0, w / n / 2, h);
        ctx.fill();
      }
    },
    { repeat: true }
  );

export function arrowTexture() {
  return canvasTexture(
    64,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.75);
      ctx.lineTo(w * 0.2, h * 0.4);
      ctx.lineTo(w * 0.35, h * 0.4);
      ctx.lineTo(w * 0.35, h * 0.15);
      ctx.lineTo(w * 0.65, h * 0.15);
      ctx.lineTo(w * 0.65, h * 0.4);
      ctx.lineTo(w * 0.8, h * 0.4);
      ctx.closePath();
      ctx.fill();
    },
    { repeat: true }
  );
}

/** Voltorb (red top, white bottom, angry-cute eyes). Equirect: u = longitude, v = latitude. */
export function voltorbTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8413c';
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, h / 2, w, h / 2);
    ctx.fillStyle = '#2a2230';
    ctx.fillRect(0, h / 2 - 3, w, 6);
    // eyes on the front (u = 0.25 faces +z with three.js sphere UVs)
    for (const dx of [-16, 16]) {
      const cx = w * 0.25 + dx;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.38, 11, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2230';
      ctx.beginPath();
      ctx.ellipse(cx + (dx > 0 ? -3 : 3), h * 0.4, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2a2230';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx - 12, h * 0.27 + (dx > 0 ? 6 : 0));
      ctx.lineTo(cx + 12, h * 0.27 + (dx > 0 ? 0 : 6));
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(w * 0.12, h * 0.18, 18, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function mushroomTexture(color) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    const rnd = mulberry(3);
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.ellipse(rnd() * w, rnd() * h * 0.6 + 6, 10 + rnd() * 8, 8 + rnd() * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function pokeballEmblem() {
  return canvasTexture(128, 128, (ctx, w) => {
    const c = w / 2;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(c, c, 46, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c, c, 46, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(c - 46, c - 5, 92, 10);
    ctx.beginPath();
    ctx.arc(c, c, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c, c, 8, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function bannerTexture(text, bg = '#ff5fa2', fg = '#ffffff') {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect?.(4, 4, w - 8, h - 8, 40);
    if (!ctx.roundRect) ctx.rect(4, 4, w - 8, h - 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.font = '900 70px system-ui, "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
}

/** Name tag sprite texture. */
export function tagTexture(text, { bg = 'rgba(30,41,59,0.72)', fg = '#ffffff' } = {}) {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.font = '800 34px system-ui, "Segoe UI", Arial, sans-serif';
    const tw = Math.min(w - 8, ctx.measureText(text).width + 28);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect?.((w - tw) / 2, 6, tw, h - 12, 24);
    if (!ctx.roundRect) ctx.rect((w - tw) / 2, 6, tw, h - 12);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2, w - 20);
  });
}

export function glowTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

export function starTexture() {
  return canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#ffe14d';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 12 : 28;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

/** Soft circle for blob shadows. */
export function shadowTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(20,10,40,0.45)');
    g.addColorStop(1, 'rgba(20,10,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** Round badge with the child's artwork (falls back to a coloured disc). */
export function badgeTexture(url, color, letter) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const base = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(64, 64, 55, 0, Math.PI * 2);
    ctx.fill();
  };
  base();
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 56px system-ui, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 64, 68);
  }
  if (url && typeof Image !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!ctx) return;
      base();
      ctx.save();
      ctx.beginPath();
      ctx.arc(64, 64, 55, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(0, 0, 128, 128);
      ctx.drawImage(img, 10, 10, 108, 108);
      ctx.restore();
      tex.needsUpdate = true;
    };
    img.src = url;
  }
  return tex;
}
