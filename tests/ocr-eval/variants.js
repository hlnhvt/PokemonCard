// Builds photo-like test images from clean card scans with @napi-rs/canvas.
import { createCanvas } from '@napi-rs/canvas';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintBackground(ctx, w, h, rand) {
  const hue = Math.floor(rand() * 360);
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `hsl(${hue}, 25%, ${25 + rand() * 40}%)`);
  grad.addColorStop(1, `hsl(${(hue + 40) % 360}, 20%, ${20 + rand() * 40}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Wood/cloth-like streaks so the background is not trivially uniform
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},${rand() > 0.5 ? 255 : 0},0.06)`;
    ctx.lineWidth = 2 + rand() * 10;
    ctx.beginPath();
    ctx.moveTo(rand() * w, 0);
    ctx.lineTo(rand() * w, h);
    ctx.stroke();
  }
}

function degrade(canvas, rand, { blur, noise, brightness, glare }) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;

  if (blur > 0) {
    // Cheap optical blur: downscale then upscale
    const small = createCanvas(Math.max(1, Math.round(w / blur)), Math.max(1, Math.round(h / blur)));
    small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(small, 0, 0, w, h);
  }

  if (glare) {
    const gx = w * (0.2 + rand() * 0.6);
    const gy = h * (0.2 + rand() * 0.6);
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.35);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * noise;
    d[i] = Math.max(0, Math.min(255, d[i] * brightness + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * brightness + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * brightness + n));
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Card placed on a background, as in a phone photo that gets uploaded.
 * Returns { canvas, cardBox } where cardBox is the card's axis-aligned bounds.
 */
function composePhoto(cardImage, seed, { frameW, frameH, cardW, maxAngle, blur, noise, glare }) {
  const rand = mulberry32(seed);
  const canvas = createCanvas(frameW, frameH);
  const ctx = canvas.getContext('2d');
  paintBackground(ctx, frameW, frameH, rand);

  const cardH = Math.round(cardW * (cardImage.height / cardImage.width));
  const cx = frameW / 2 + (rand() - 0.5) * frameW * 0.06;
  const cy = frameH / 2 + (rand() - 0.5) * frameH * 0.06;
  const angle = ((rand() - 0.5) * 2 * maxAngle * Math.PI) / 180;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 12;
  ctx.drawImage(cardImage, -cardW / 2, -cardH / 2, cardW, cardH);
  ctx.restore();

  degrade(canvas, rand, { blur, noise, brightness: 0.8 + rand() * 0.35, glare });
  return {
    canvas,
    cardBox: { x: cx - cardW / 2, y: cy - cardH / 2, width: cardW, height: cardH },
  };
}

export function makeVariants(cardImage, seed) {
  // 1. Clean scan, as when a user uploads an image of the card itself
  const scan = createCanvas(cardImage.width, cardImage.height);
  scan.getContext('2d').drawImage(cardImage, 0, 0);

  // 2. Uploaded phone photo: card with background around it, slight tilt, blur and noise
  const photo = composePhoto(cardImage, seed, {
    frameW: 900, frameH: 1200, cardW: 560, maxAngle: 5, blur: 1.6, noise: 18, glare: true,
  });

  // 3. Live camera frame (720x1280 portrait stream); the card sits in the on-screen reticle
  const camera = composePhoto(cardImage, seed + 1, {
    frameW: 720, frameH: 1280, cardW: 500, maxAngle: 3, blur: 1.4, noise: 14, glare: false,
  });
  const m = 0.04; // reticle is slightly larger than the aligned card
  const reticle = {
    x: camera.cardBox.x - camera.cardBox.width * m,
    y: camera.cardBox.y - camera.cardBox.height * m,
    width: camera.cardBox.width * (1 + 2 * m),
    height: camera.cardBox.height * (1 + 2 * m),
  };

  return [
    { variant: 'scan', canvas: scan, options: {} },
    { variant: 'photo', canvas: photo.canvas, options: {} },
    { variant: 'camera', canvas: camera.canvas, options: { region: reticle } },
  ];
}
