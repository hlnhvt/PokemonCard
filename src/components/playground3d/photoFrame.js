// Photo mode: puts a sticker frame and the Pokémon's name around a 3D snapshot (2D canvas).
import { PHOTO_FRAMES } from '../../utils/playground3d/activities';

const loadImg = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Returns a PNG data URL (or the snapshot itself when 2D canvas is unavailable). */
export async function composePhoto(snapshot, frameId, name) {
  if (!snapshot) return null;
  const frame = PHOTO_FRAMES.find((f) => f.id === frameId) || PHOTO_FRAMES[0];
  try {
    const img = await loadImg(snapshot);
    const W = Math.min(1080, img.width);
    const Hh = Math.round((img.height / img.width) * W);
    const pad = Math.round(W * 0.05);
    const c = document.createElement('canvas');
    c.width = W + pad * 2;
    c.height = Hh + pad * 2 + Math.round(W * 0.12);
    const ctx = c.getContext('2d');
    if (!ctx) return snapshot;
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    frame.colors.forEach((cc, i) => g.addColorStop(i / Math.max(1, frame.colors.length - 1), cc));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    // white rounded mat
    ctx.fillStyle = '#ffffff';
    const r = pad * 0.6;
    const x0 = pad * 0.5;
    const y0 = pad * 0.5;
    const w0 = c.width - pad;
    const h0 = c.height - pad;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x0 + w0, y0, x0 + w0, y0 + h0, r);
    ctx.arcTo(x0 + w0, y0 + h0, x0, y0 + h0, r);
    ctx.arcTo(x0, y0 + h0, x0, y0, r);
    ctx.arcTo(x0, y0, x0 + w0, y0, r);
    ctx.fill();
    ctx.drawImage(img, 0, 0, img.width, img.height, pad, pad, W, Hh);
    // stickers in the corners
    ctx.font = `${Math.round(W * 0.1)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const s = W * 0.07;
    for (const [x, y] of [[pad + s, pad + s], [pad + W - s, pad + s], [pad + s, pad + Hh - s], [pad + W - s, pad + Hh - s]]) ctx.fillText(frame.emoji, x, y);
    // name
    ctx.fillStyle = '#1e293b';
    ctx.font = `900 ${Math.round(W * 0.07)}px "Nunito","Segoe UI",Arial,sans-serif`;
    ctx.fillText(`${name} ✨`, c.width / 2, pad + Hh + (c.height - pad - Hh - pad * 0.5) / 2);
    return c.toDataURL('image/png');
  } catch {
    return snapshot;
  }
}
