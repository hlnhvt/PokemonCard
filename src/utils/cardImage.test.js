// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { createCanvas as napiCanvas } from '@napi-rs/canvas';
import { detectCard, extractCard, preprocess, mapRectToVideoFrame, cropCardZone } from './cardImage';

beforeAll(() => {
  globalThis.document = { createElement: () => napiCanvas(1, 1) };
});

// A yellow-bordered "card" (63:88) with a dark title bar, on a blue background
function photo({ frameW = 600, frameH = 800, cardW = 300, angleDeg = 0, fillFrame = false } = {}) {
  const canvas = napiCanvas(frameW, frameH);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a4d8f';
  ctx.fillRect(0, 0, frameW, frameH);
  const w = fillFrame ? frameW : cardW;
  const h = fillFrame ? frameH : Math.round(cardW * (88 / 63));
  ctx.save();
  ctx.translate(frameW / 2, frameH / 2);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.fillStyle = '#f2d23c';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#eeeeee';
  ctx.fillRect(-w / 2 + w * 0.05, -h / 2 + h * 0.05, w * 0.9, h * 0.9);
  ctx.fillStyle = '#111111';
  ctx.fillRect(-w / 2 + w * 0.08, -h / 2 + h * 0.05, w * 0.5, h * 0.04);
  ctx.restore();
  return { canvas, cardW: w, cardH: h };
}

describe('detectCard', () => {
  it('finds a card on a background', () => {
    const { canvas, cardW, cardH } = photo();
    const { box, angle } = detectCard(canvas);
    expect(box.x).toBeCloseTo((600 - cardW) / 2, -1);
    expect(box.y).toBeCloseTo((800 - cardH) / 2, -1);
    expect(box.width).toBeCloseTo(cardW, -1);
    expect(box.height).toBeCloseTo(cardH, -1);
    expect(Math.abs(angle)).toBeLessThan(0.02);
  });

  it('estimates the tilt of a rotated card', () => {
    const { canvas } = photo({ angleDeg: 6 });
    const { angle } = detectCard(canvas);
    expect((angle * 180) / Math.PI).toBeCloseTo(6, 0);
  });

  it('returns null when the card fills the image', () => {
    expect(detectCard(photo({ fillFrame: true }).canvas)).toBeNull();
  });

  it('returns null for a plain image without a card shape', () => {
    const canvas = napiCanvas(400, 400);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#777';
    ctx.fillRect(0, 0, 400, 400);
    expect(detectCard(canvas)).toBeNull();
  });

  it('returns null for an empty source', () => {
    expect(detectCard({ width: 0, height: 0 })).toBeNull();
  });
});

describe('extractCard', () => {
  it('crops and straightens the card to roughly card proportions', () => {
    const { canvas, cardW, cardH } = photo({ angleDeg: 5 });
    const { card, found } = extractCard(canvas);
    expect(found).toBe(true);
    expect(card.width).toBeGreaterThan(cardW * 0.9);
    expect(card.width).toBeLessThan(cardW * 1.15);
    expect(card.height / card.width).toBeGreaterThan(1.25);
    expect(card.height / card.width).toBeLessThan(1.55);
    expect(cardH).toBeGreaterThan(0);
  });

  it('keeps the whole image when no card is found', () => {
    const { canvas } = photo({ fillFrame: true });
    const { card, found } = extractCard(canvas);
    expect(found).toBe(false);
    expect([card.width, card.height]).toEqual([600, 800]);
  });
});

describe('preprocess', () => {
  function pixelsOf(canvas) {
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  }

  it('binary mode makes light text on a dark background dark on light', () => {
    const src = napiCanvas(100, 40);
    const ctx = src.getContext('2d');
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, 100, 40);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(10, 10, 30, 20); // "text"
    const out = pixelsOf(preprocess(src, 'binary'));
    const at = (x, y) => out[(y * 100 + x) * 4];
    expect(at(2, 2)).toBe(255); // background became white
    expect(at(20, 20)).toBe(0); // text became black
  });

  it('max mode keeps black text dark on a saturated background', () => {
    const src = napiCanvas(100, 40);
    const ctx = src.getContext('2d');
    ctx.fillStyle = '#c01010'; // red bar: luminance is dark, max channel is bright
    ctx.fillRect(0, 0, 100, 40);
    ctx.fillStyle = '#000';
    ctx.fillRect(10, 10, 30, 20);
    const maxOut = pixelsOf(preprocess(src, 'max'));
    const grayOut = pixelsOf(preprocess(src, 'gray'));
    const bg = (d) => d[(2 * 100 + 2) * 4];
    const text = (d) => d[(20 * 100 + 20) * 4];
    expect(bg(maxOut) - text(maxOut)).toBeGreaterThan(200);
    expect(bg(grayOut) - text(grayOut)).toBeGreaterThan(200); // stretch helps both here
  });
});

describe('cropCardZone', () => {
  it('scales the zone so the card is normalised to the requested height', () => {
    const card = napiCanvas(300, 420);
    const strip = cropCardZone(card, { x: 0, y: 0, width: 1, height: 0.1 }, 840);
    expect(strip.width).toBe(600);
    expect(strip.height).toBe(84);
  });
});

describe('mapRectToVideoFrame', () => {
  it('maps a centred reticle through object-fit: cover', () => {
    // 1280x720 landscape stream shown in a 400x500 portrait box: scale 500/720, sides cropped
    const videoRect = { left: 0, top: 0, width: 400, height: 500 };
    const reticle = { left: 100, top: 50, width: 200, height: 400 };
    const r = mapRectToVideoFrame(reticle, videoRect, 1280, 720);
    const scale = 500 / 720;
    const offsetX = (400 - 1280 * scale) / 2;
    expect(r.x).toBeCloseTo((100 - offsetX) / scale, 5);
    expect(r.y).toBeCloseTo(50 / scale, 5);
    expect(r.width).toBeCloseTo(200 / scale, 5);
    expect(r.height).toBeCloseTo(400 / scale, 5);
  });

  it('accounts for the element position and clamps with margin', () => {
    const videoRect = { left: 20, top: 100, width: 720, height: 1280 };
    const reticle = { left: 20, top: 100, width: 720, height: 1280 };
    const r = mapRectToVideoFrame(reticle, videoRect, 720, 1280, 0.1);
    expect(r).toEqual({ x: 0, y: 0, width: 720, height: 1280 });
  });
});
