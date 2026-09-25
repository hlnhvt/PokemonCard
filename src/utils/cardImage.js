// Image operations for card OCR: locate the card in a photo, straighten it,
// crop the name strip and prepare high-contrast variants for Tesseract.

// Pokemon card size is 63 x 88 mm
export const CARD_ASPECT = 88 / 63;

export function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function getSourceSize(source) {
  return {
    width: source.videoWidth || source.naturalWidth || source.width || 0,
    height: source.videoHeight || source.naturalHeight || source.height || 0,
  };
}

/**
 * Map an on-screen rectangle (e.g. the scanner reticle) to pixel coordinates of a
 * video stream shown with `object-fit: cover` in `videoRect`. Rects are
 * { left, top, width, height } in CSS pixels; returns { x, y, width, height }
 * clamped to the frame and grown by `margin` (fraction of the size) on each side.
 */
export function mapRectToVideoFrame(targetRect, videoRect, frameWidth, frameHeight, margin = 0) {
  const scale = Math.max(videoRect.width / frameWidth, videoRect.height / frameHeight);
  const offsetX = (videoRect.width - frameWidth * scale) / 2;
  const offsetY = (videoRect.height - frameHeight * scale) / 2;

  let x = (targetRect.left - videoRect.left - offsetX) / scale;
  let y = (targetRect.top - videoRect.top - offsetY) / scale;
  let width = targetRect.width / scale;
  let height = targetRect.height / scale;

  x -= width * margin;
  y -= height * margin;
  width *= 1 + 2 * margin;
  height *= 1 + 2 * margin;

  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(frameWidth, x + width);
  const y1 = Math.min(frameHeight, y + height);
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}

function toCanvas(source) {
  const { width, height } = getSourceSize(source);
  const canvas = createCanvas(width, height);
  canvas.getContext('2d').drawImage(source, 0, 0, width, height);
  return canvas;
}

function otsuThreshold(histogram, total) {
  let sum = 0;
  for (let i = 0; i < histogram.length; i++) sum += i * histogram[i];
  let sumB = 0;
  let weightB = 0;
  let best = 0;
  let threshold = 0;
  for (let i = 0; i < histogram.length; i++) {
    weightB += histogram[i];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += i * histogram[i];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const between = weightB * weightF * (meanB - meanF) ** 2;
    if (between > best) {
      best = between;
      threshold = i;
    }
  }
  return threshold;
}

/**
 * Find the card in an image by separating it from the background colour
 * (sampled on the image border). Returns { box, angle } in source pixels, where
 * box is the axis-aligned bounds and angle (radians) the estimated tilt of the
 * top edge, or null when the card fills the image or no card-shaped blob exists.
 */
export function detectCard(source) {
  const { width: srcW, height: srcH } = getSourceSize(source);
  if (!srcW || !srcH) return null;

  const scale = Math.min(1, 240 / Math.max(srcW, srcH));
  const w = Math.max(8, Math.round(srcW * scale));
  const h = Math.max(8, Math.round(srcH * scale));
  const small = createCanvas(w, h);
  const ctx = small.getContext('2d');
  ctx.drawImage(source, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Background colour: median of the outer ring
  const ring = Math.max(1, Math.round(Math.min(w, h) * 0.03));
  const rs = [];
  const gs = [];
  const bs = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= ring && x < w - ring && y >= ring && y < h - ring) continue;
      const i = (y * w + x) * 4;
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
    }
  }
  const median = (arr) => arr.sort((a, b) => a - b)[arr.length >> 1];
  const bg = [median(rs), median(gs), median(bs)];

  // Distance from background, thresholded with Otsu
  const dist = new Uint8Array(w * h);
  const histogram = new Array(256).fill(0);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const d = Math.min(255, Math.round(Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2])));
    dist[p] = d;
    histogram[d]++;
  }
  const threshold = Math.max(28, otsuThreshold(histogram, w * h));

  // Largest 4-connected foreground component
  const label = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  let bestCount = 0;
  let bestLabel = -1;
  let current = 0;
  for (let p = 0; p < w * h; p++) {
    if (dist[p] < threshold || label[p] !== -1) continue;
    let top = 0;
    stack[top++] = p;
    label[p] = current;
    let count = 0;
    while (top > 0) {
      const q = stack[--top];
      count++;
      const qx = q % w;
      const neighbours = [q - w, q + w, qx > 0 ? q - 1 : -1, qx < w - 1 ? q + 1 : -1];
      for (const n of neighbours) {
        if (n >= 0 && n < w * h && label[n] === -1 && dist[n] >= threshold) {
          label[n] = current;
          stack[top++] = n;
        }
      }
    }
    if (count > bestCount) {
      bestCount = count;
      bestLabel = current;
    }
    current++;
  }
  if (bestLabel < 0) return null;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== bestLabel) continue;
    const x = p % w;
    const y = (p / w) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  // The card already fills the picture (a scan or a tight crop). When it does, the card's
  // own coloured border is what gets sampled as "background" and the blob found is the
  // inner frame, leaving only a thin margin on every side.
  const thin = (gap, size) => gap < size * 0.08;
  if (thin(minX, w) && thin(w - 1 - maxX, w) && thin(minY, h) && thin(h - 1 - maxY, h)) return null;
  // Reject blobs that cannot be a card
  const ratio = bh / bw;
  if (bw * bh < w * h * 0.12 || ratio < 1.05 || ratio > 1.8) return null;

  // Tilt: fit a line through the first foreground row of each column across the top edge
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  for (let x = minX + Math.round(bw * 0.2); x <= maxX - Math.round(bw * 0.2); x++) {
    for (let y = minY; y <= maxY; y++) {
      if (label[y * w + x] === bestLabel) {
        n++;
        sx += x;
        sy += y;
        sxy += x * y;
        sxx += x * x;
        break;
      }
    }
  }
  const slope = n > 2 ? (n * sxy - sx * sy) / (n * sxx - sx * sx || 1) : 0;
  const angle = Math.atan(slope);

  return {
    box: { x: minX / scale, y: minY / scale, width: bw / scale, height: bh / scale },
    angle: Math.abs(angle) < (15 * Math.PI) / 180 ? angle : 0,
  };
}

/** Crop a rectangle (source pixels) into a new canvas, optionally scaled. */
export function cropCanvas(source, rect, scale = 1) {
  const { width: srcW, height: srcH } = getSourceSize(source);
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const w = Math.min(srcW - x, Math.ceil(rect.width));
  const h = Math.min(srcH - y, Math.ceil(rect.height));
  const canvas = createCanvas(w * scale, h * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Return a canvas containing just the card, straightened when it is tilted.
 * Falls back to the whole image when no separate card can be found.
 */
export function extractCard(source) {
  const detected = detectCard(source);
  if (!detected) return { card: toCanvas(source), found: false };

  const { box, angle } = detected;
  // Expand a little so rotation does not clip the corners
  const pad = Math.max(box.width, box.height) * 0.04;
  const region = cropCanvas(source, {
    x: box.x - pad,
    y: box.y - pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  });

  if (Math.abs(angle) > (0.7 * Math.PI) / 180) {
    const rotated = createCanvas(region.width, region.height);
    const ctx = rotated.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.translate(region.width / 2, region.height / 2);
    ctx.rotate(-angle);
    ctx.drawImage(region, -region.width / 2, -region.height / 2);
    // Re-detect on the straightened image for a tight box
    const again = detectCard(rotated);
    if (again) return { card: cropCanvas(rotated, again.box), found: true };
    return { card: rotated, found: true };
  }

  const again = detectCard(region);
  return { card: again ? cropCanvas(region, again.box) : region, found: true };
}

/**
 * Grayscale with a 2%-98% contrast stretch.
 * - 'gray': luminance
 * - 'max': brightest channel, so coloured backgrounds turn light while black
 *   name text stays black (luminance makes e.g. green or red bars dark)
 * - 'binary': Otsu on luminance, text forced dark on a light background
 */
export function preprocess(canvas, mode = 'gray') {
  const out = createCanvas(canvas.width, canvas.height);
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const total = d.length / 4;

  const gray = new Uint8ClampedArray(total);
  const histogram = new Array(256).fill(0);
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    const v =
      mode === 'max'
        ? Math.max(d[i], d[i + 1], d[i + 2])
        : Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    gray[p] = v;
    histogram[v]++;
  }

  // 2nd and 98th percentiles
  let lo = 0;
  let below = histogram[0];
  while (lo < 255 && below < total * 0.02) below += histogram[++lo];
  let hi = 255;
  let above = histogram[255];
  while (hi > 0 && above < total * 0.02) above += histogram[--hi];
  const range = Math.max(1, hi - lo);

  const stretchedHist = new Array(256).fill(0);
  for (let p = 0; p < total; p++) {
    const v = Math.max(0, Math.min(255, Math.round(((gray[p] - lo) * 255) / range)));
    gray[p] = v;
    stretchedHist[v]++;
  }

  if (mode === 'binary') {
    const t = otsuThreshold(stretchedHist, total);
    let dark = 0;
    for (let p = 0; p < total; p++) if (gray[p] <= t) dark++;
    const invert = dark > total / 2;
    for (let p = 0; p < total; p++) {
      const isDark = gray[p] <= t;
      gray[p] = isDark !== invert ? 0 : 255;
    }
  }

  for (let p = 0; p < total; p++) {
    const i = p * 4;
    d[i] = d[i + 1] = d[i + 2] = gray[p];
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/**
 * Crop a zone given in card-relative coordinates (0..1) and scale it so the card
 * would be `normalizedCardHeight` pixels tall, putting name text around 45px high.
 */
export function cropCardZone(card, zone, normalizedCardHeight = 1100) {
  const scale = Math.min(4, normalizedCardHeight / card.height);
  return cropCanvas(
    card,
    {
      x: card.width * zone.x,
      y: card.height * zone.y,
      width: card.width * zone.width,
      height: card.height * zone.height,
    },
    scale
  );
}
