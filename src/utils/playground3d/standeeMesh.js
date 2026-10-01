// Artwork alpha mask → a puffy 3D "standee" mesh, as plain arrays (unit-testable without WebGL).
// 1. the opaque pixels are sampled on a grid (cells), tiny specks are dropped;
// 2. a chamfer distance transform gives each cell its distance to the edge;
// 3. a front and a mirrored back surface are built over the inside cells, pushed out by a
//    rounded profile of that distance (inflated = soft, round body), the outline is smoothed;
// 4. side walls close the rim. UVs map the artwork on the front (and mirrored on the back).
// Units: the figure is 1 tall, centred on x = 0 with its feet at y = 0, facing +Z.

const SQ2 = 1.4142;

/** Average alpha of a few pixels inside the block [x0, x1) × [y0, y1). */
function blockAlpha(data, width, x0, y0, x1, y1) {
  let sum = 0;
  let n = 0;
  const sx = Math.max(1, Math.floor((x1 - x0) / 3));
  const sy = Math.max(1, Math.floor((y1 - y0) / 3));
  for (let y = y0 + (sy >> 1); y < y1; y += sy) {
    for (let x = x0 + (sx >> 1); x < x1; x += sx) {
      sum += data[(y * width + x) * 4 + 3];
      n++;
    }
  }
  return n ? sum / n : 0;
}

/** Bounding box of the pixels with alpha > threshold, or null. */
export function opaqueBounds(img, threshold = 96) {
  const { width, height, data } = img;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/**
 * Grid mask of the artwork: { cols, rows, cell (px), ox, oy (px of cell 0,0), inside: Uint8Array }.
 * One empty cell of padding on every side so every inside cell has neighbours.
 */
export function buildMask(img, { grid = 56, threshold = 96, minIsland = 0.01 } = {}) {
  const b = opaqueBounds(img, threshold);
  if (!b) return null;
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  const cell = Math.max(1, Math.max(bw, bh) / grid);
  const cols = Math.ceil(bw / cell) + 2;
  const rows = Math.ceil(bh / cell) + 2;
  const ox = b.x0 - cell;
  const oy = b.y0 - cell;
  const inside = new Uint8Array(cols * rows);
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const x0 = Math.max(0, Math.floor(ox + c * cell));
      const y0 = Math.max(0, Math.floor(oy + r * cell));
      const x1 = Math.min(img.width, Math.max(x0 + 1, Math.floor(ox + (c + 1) * cell)));
      const y1 = Math.min(img.height, Math.max(y0 + 1, Math.floor(oy + (r + 1) * cell)));
      if (blockAlpha(img.data, img.width, x0, y0, x1, y1) > threshold) inside[r * cols + c] = 1;
    }
  }
  dropSmallIslands(inside, cols, rows, minIsland);
  return { cols, rows, cell, ox, oy, inside };
}

/** Removes 4-connected groups smaller than `fraction` of all inside cells (stray specks). */
export function dropSmallIslands(inside, cols, rows, fraction = 0.01) {
  const total = inside.reduce((s, v) => s + v, 0);
  const min = Math.max(3, Math.floor(total * fraction));
  const seen = new Uint8Array(inside.length);
  const stack = [];
  for (let i = 0; i < inside.length; i++) {
    if (!inside[i] || seen[i]) continue;
    const group = [];
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop();
      group.push(j);
      const c = j % cols;
      const r = (j / cols) | 0;
      const nb = [c > 0 ? j - 1 : -1, c < cols - 1 ? j + 1 : -1, r > 0 ? j - cols : -1, r < rows - 1 ? j + cols : -1];
      for (const k of nb) {
        if (k >= 0 && inside[k] && !seen[k]) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    if (group.length < min) for (const j of group) inside[j] = 0;
  }
  return inside;
}

/** Chamfer (1, √2) distance of every inside cell to the nearest outside cell; outside = 0. */
export function distanceField(inside, cols, rows) {
  const INF = 1e9;
  const d = new Float32Array(cols * rows);
  for (let i = 0; i < d.length; i++) d[i] = inside[i] ? INF : 0;
  const at = (c, r) => (c < 0 || r < 0 || c >= cols || r >= rows ? 0 : d[r * cols + c]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(c - 1, r) + 1, at(c, r - 1) + 1, at(c - 1, r - 1) + SQ2, at(c + 1, r - 1) + SQ2);
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(c + 1, r) + 1, at(c, r + 1) + 1, at(c + 1, r + 1) + SQ2, at(c - 1, r + 1) + SQ2);
    }
  }
  return d;
}

/** Rounded "pillow" profile: 0 at the rim, 1 from `reach` inwards (quarter circle). */
export function inflateProfile(dist, reach) {
  const k = Math.max(0, Math.min(1, dist / Math.max(1e-6, reach)));
  return Math.sqrt(1 - (1 - k) * (1 - k));
}

/**
 * Builds the standee mesh data from an ImageData-like { width, height, data }.
 * opts: grid (cells across the longer side), thickness (rim half-thickness, units),
 * inflate (extra bulge at the centre, units), smooth (outline smoothing passes).
 * Returns null when the image has no opaque pixels, else
 * { positions, uvs, indices, groups: [{ start, count, materialIndex }] (0 front, 1 back, 2 side),
 *   width, height, footprint, edgeColor: [r, g, b] 0..255, headTop: [x, y], cells, vertexCount }.
 */
export function buildStandee(img, { grid = 56, threshold = 96, thickness = 0.035, inflate = 0.11, smooth = 3 } = {}) {
  const mask = buildMask(img, { grid, threshold });
  if (!mask) return null;
  const { cols, rows, cell, ox, oy, inside } = mask;
  let count = 0;
  let minR = rows;
  let maxR = -1;
  let minC = cols;
  let maxC = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!inside[r * cols + c]) continue;
      count++;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
  }
  if (!count) return null;
  const dist = distanceField(inside, cols, rows);
  let maxDist = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] > maxDist) maxDist = dist[i];
  const reach = Math.max(2, maxDist * 0.7);

  const unit = 1 / (maxR - minR + 1); // cell size in world units
  const centerC = (minC + maxC + 1) / 2;
  const bottomR = maxR + 1;
  const isIn = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && inside[r * cols + c] === 1;

  // Corner grid: (cols + 1) × (rows + 1)
  const CW = cols + 1;
  const cornerId = new Int32Array(CW * (rows + 1)).fill(-1);
  const cx = [];
  const cy = [];
  const cz = [];
  const boundary = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const cells = [isIn(c - 1, r - 1), isIn(c, r - 1), isIn(c - 1, r), isIn(c, r)];
      const n = cells.filter(Boolean).length;
      if (!n) continue;
      const onEdge = n < 4;
      let d = 0;
      if (!onEdge) {
        const ds = [dist[(r - 1) * cols + c - 1], dist[(r - 1) * cols + c], dist[r * cols + c - 1], dist[r * cols + c]];
        d = Math.max(0, (ds[0] + ds[1] + ds[2] + ds[3]) / 4 - 0.5);
      }
      cornerId[r * CW + c] = cx.length;
      cx.push((c - centerC) * unit);
      cy.push((bottomR - r) * unit);
      cz.push(thickness + inflate * inflateProfile(d, reach));
      boundary.push(onEdge);
    }
  }

  // Boundary edges (cell inside, neighbour outside), oriented so the outside is on the left
  const edges = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isIn(c, r)) continue;
      const a = cornerId[r * CW + c];
      const b = cornerId[r * CW + c + 1];
      const cc = cornerId[(r + 1) * CW + c + 1];
      const d = cornerId[(r + 1) * CW + c];
      if (!isIn(c, r - 1)) edges.push([a, b]);
      if (!isIn(c + 1, r)) edges.push([b, cc]);
      if (!isIn(c, r + 1)) edges.push([cc, d]);
      if (!isIn(c - 1, r)) edges.push([d, a]);
    }
  }

  // Smooth the stair-stepped outline (only corners with exactly two rim neighbours)
  const nbrs = new Map();
  for (const [p, q] of edges) {
    if (!nbrs.has(p)) nbrs.set(p, []);
    if (!nbrs.has(q)) nbrs.set(q, []);
    nbrs.get(p).push(q);
    nbrs.get(q).push(p);
  }
  const ox0 = cx.slice();
  const oy0 = cy.slice();
  const maxMove = unit * 0.3; // never past the neighbouring corners (no folded triangles)
  for (let pass = 0; pass < smooth; pass++) {
    const nx = new Map();
    for (const [p, list] of nbrs) {
      if (list.length !== 2) continue;
      const [a, b] = list;
      nx.set(p, [cx[p] * 0.5 + (cx[a] + cx[b]) * 0.25, cy[p] * 0.5 + (cy[a] + cy[b]) * 0.25]);
    }
    for (const [p, [x, y]] of nx) {
      const dx = x - ox0[p];
      const dy = y - oy0[p];
      const d = Math.hypot(dx, dy);
      const k = d > maxMove ? maxMove / d : 1;
      cx[p] = ox0[p] + dx * k;
      cy[p] = Math.max(0, oy0[p] + dy * k);
    }
  }

  // Corner position → artwork UV (texture flipY: v = 1 at the top of the picture)
  const uvOf = (x, y) => {
    const px = ox + (x / unit + centerC) * cell;
    const py = oy + (bottomR - y / unit) * cell;
    return [px / img.width, 1 - py / img.height];
  };

  const nC = cx.length;
  const positions = [];
  const uvs = [];
  for (let i = 0; i < nC; i++) {
    positions.push(cx[i], cy[i], cz[i]);
    uvs.push(...uvOf(cx[i], cy[i]));
  }
  for (let i = 0; i < nC; i++) {
    positions.push(cx[i], cy[i], -cz[i] * 0.8); // the back is a little flatter
    uvs.push(...uvOf(cx[i], cy[i]));
  }

  const front = [];
  const back = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isIn(c, r)) continue;
      const a = cornerId[r * CW + c];
      const b = cornerId[r * CW + c + 1];
      const cc = cornerId[(r + 1) * CW + c + 1];
      const d = cornerId[(r + 1) * CW + c];
      front.push(a, d, cc, a, cc, b);
      back.push(a + nC, cc + nC, d + nC, a + nC, b + nC, cc + nC);
    }
  }
  const side = [];
  let v = nC * 2;
  for (const [p, q] of edges) {
    // p_f, q_f, q_b, p_b with their own vertices (crisp rim)
    positions.push(cx[p], cy[p], cz[p], cx[q], cy[q], cz[q], cx[q], cy[q], -cz[q] * 0.8, cx[p], cy[p], -cz[p] * 0.8);
    const up = uvOf(cx[p], cy[p]);
    const uq = uvOf(cx[q], cy[q]);
    uvs.push(...up, ...uq, ...uq, ...up);
    side.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  }

  // Average colour of the opaque pixels along the rim (for the side walls)
  const edgeColor = rimColor(img, mask, dist);
  // Feet width (bottom 12 % of the rows) for the ground shadow
  let fMin = Infinity;
  let fMax = -Infinity;
  const footRows = Math.max(1, Math.round((maxR - minR + 1) * 0.12));
  for (let r = maxR - footRows + 1; r <= maxR; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isIn(c, r)) continue;
      fMin = Math.min(fMin, c);
      fMax = Math.max(fMax, c + 1);
    }
  }
  // Head: centre of the top row of cells
  let tMin = Infinity;
  let tMax = -Infinity;
  for (let c = 0; c < cols; c++) {
    if (isIn(c, minR)) {
      tMin = Math.min(tMin, c);
      tMax = Math.max(tMax, c + 1);
    }
  }

  const indices = [...front, ...back, ...side];
  return {
    positions: Float32Array.from(positions),
    uvs: Float32Array.from(uvs),
    indices: Uint32Array.from(indices),
    groups: [
      { start: 0, count: front.length, materialIndex: 0 },
      { start: front.length, count: back.length, materialIndex: 1 },
      { start: front.length + back.length, count: side.length, materialIndex: 2 },
    ],
    width: (maxC - minC + 1) * unit,
    height: 1,
    footprint: Number.isFinite(fMin) ? (fMax - fMin) * unit : (maxC - minC + 1) * unit,
    headTop: [((tMin + tMax) / 2 - centerC) * unit, 1],
    depth: thickness + inflate,
    edgeColor,
    cells: count,
    vertexCount: positions.length / 3,
  };
}

function rimColor(img, mask, dist) {
  const { cols, rows, cell, ox, oy } = mask;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      const dd = dist[row * cols + c];
      if (!dd || dd > 2.5) continue;
      const px = Math.min(img.width - 1, Math.max(0, Math.floor(ox + (c + 0.5) * cell)));
      const py = Math.min(img.height - 1, Math.max(0, Math.floor(oy + (row + 0.5) * cell)));
      const i = (py * img.width + px) * 4;
      if (img.data[i + 3] < 128) continue;
      r += img.data[i];
      g += img.data[i + 1];
      b += img.data[i + 2];
      n++;
    }
  }
  if (!n) return [200, 200, 200];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/** Fake ImageData for tests and the fallback: a filled ellipse (or any predicate) of one colour. */
export function makeImageData(width, height, inside, rgb = [240, 120, 60]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      const i = (y * width + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}
