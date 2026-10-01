// Low-poly decoration models built from boxes / spheres with vertex colours (one geometry per part).
import * as THREE from 'three';
import { TREE, FLOWER, LANTERN, FENCE, BED, TABLE, STATUE, BERRY, FOUNTAIN } from '../../../utils/three3d/island3d';

const tmpColor = new THREE.Color();

/** A piece: geometry moved to (x, y, z) (y = bottom of the piece), coloured. */
function piece(geo, color, x = 0, y = 0, z = 0, { rotY = 0, center = false } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  geo.dispose();
  g.computeBoundingBox();
  const lift = center ? 0 : -g.boundingBox.min.y;
  const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y + lift, z);
  g.applyMatrix4(m);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const fn = typeof color === 'function' ? color : () => color;
  for (let i = 0; i < n; i++) {
    tmpColor.set(fn(g.attributes.position.getY(i), i));
    colors.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** Merge non-indexed coloured pieces into one geometry. */
export function mergePieces(pieces) {
  let n = 0;
  for (const p of pieces) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const p of pieces) {
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    col.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/**
 * Parts of each decoration: [{ geo, glow }]. Origin at the bottom centre of its cell.
 * `glow` parts shine at night.
 */
export function buildDecorModels() {
  const M = {};
  M[TREE] = [
    {
      geo: mergePieces([
        piece(box(0.26, 1.0, 0.26), '#8b5a2b'),
        piece(box(1.0, 0.8, 1.0), '#3f9d48', 0, 0.9),
        piece(box(0.7, 0.5, 0.7), '#4cb653', 0, 1.65),
        piece(box(0.32, 0.3, 0.32), '#5fd06a', 0.12, 2.1, -0.1),
        piece(box(0.16, 0.16, 0.16), '#ef4444', 0.42, 1.25, 0.51),
        piece(box(0.16, 0.16, 0.16), '#ef4444', -0.51, 1.45, -0.2),
      ]),
    },
  ];
  const petals = (c, x, z, h) => [
    piece(box(0.05, h, 0.05), '#2f8f3a', x, 0, z),
    piece(box(0.22, 0.07, 0.08), c, x, h, z),
    piece(box(0.08, 0.07, 0.22), c, x, h, z),
    piece(box(0.09, 0.09, 0.09), '#fde047', x, h + 0.01, z),
    piece(box(0.16, 0.04, 0.06), '#3fae4a', x + 0.08, h * 0.45, z),
  ];
  M[FLOWER] = [{ geo: mergePieces([...petals('#f472b6', -0.15, -0.1, 0.42), ...petals('#ffffff', 0.18, 0.05, 0.34), ...petals('#a78bfa', -0.02, 0.2, 0.28)]).scale(1.6, 1.5, 1.6) }];
  M[LANTERN] = [
    {
      geo: mergePieces([
        piece(box(0.34, 0.08, 0.34), '#475569'),
        piece(box(0.1, 0.9, 0.1), '#334155'),
        piece(box(0.4, 0.06, 0.4), '#334155', 0, 1.26),
        piece(box(0.2, 0.08, 0.2), '#334155', 0, 1.32),
      ]),
    },
    { geo: mergePieces([piece(box(0.3, 0.36, 0.3), '#ffd34d', 0, 0.9)]), glow: true },
  ];
  M[FENCE] = [
    {
      geo: mergePieces([
        piece(box(0.14, 0.7, 0.14), '#a0703f', -0.38, 0, 0),
        piece(box(0.14, 0.7, 0.14), '#a0703f', 0.38, 0, 0),
        piece(box(1.0, 0.1, 0.08), '#c08850', 0, 0.48, 0),
        piece(box(1.0, 0.1, 0.08), '#c08850', 0, 0.22, 0),
      ]),
    },
  ];
  M[BED] = [
    {
      geo: mergePieces([
        piece(box(0.9, 0.22, 0.98), '#8b5a2b'),
        piece(box(0.9, 0.5, 0.1), '#8b5a2b', 0, 0, -0.45),
        piece(box(0.82, 0.12, 0.9), '#ffffff', 0, 0.22, 0.02),
        piece(box(0.84, 0.1, 0.55), '#ef4444', 0, 0.3, 0.2),
        piece(box(0.5, 0.12, 0.22), '#fef3c7', 0, 0.32, -0.28),
      ]),
    },
  ];
  M[TABLE] = [
    {
      geo: mergePieces([
        piece(box(0.84, 0.1, 0.84), '#c99a5b', 0, 0.55),
        ...[
          [-0.34, -0.34],
          [0.34, -0.34],
          [-0.34, 0.34],
          [0.34, 0.34],
        ].map(([x, z]) => piece(box(0.1, 0.55, 0.1), '#8b5a2b', x, 0, z)),
        piece(box(0.18, 0.16, 0.18), '#f8fafc', 0.12, 0.65, 0.05),
        piece(box(0.12, 0.08, 0.12), '#f87171', -0.18, 0.65, -0.12),
      ]),
    },
  ];
  const ball = new THREE.SphereGeometry(0.4, 18, 12);
  M[STATUE] = [
    {
      geo: mergePieces([
        piece(box(0.86, 0.22, 0.86), '#9ca3af'),
        piece(box(0.7, 0.14, 0.7), '#b6bcc5', 0, 0.22),
        piece(ball, (y) => (y > 0.8 ? '#ef4444' : y > 0.72 ? '#1f2937' : '#f8fafc'), 0, 0.36),
        piece(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14).rotateX(Math.PI / 2), '#f8fafc', 0, 0.76, 0.38, { center: true }),
      ]),
    },
  ];
  M[BERRY] = [
    {
      geo: mergePieces([
        piece(box(0.8, 0.45, 0.7), '#2f8f3a'),
        piece(box(0.55, 0.3, 0.55), '#3aa547', 0.08, 0.4, 0.02),
        ...[
          [0.3, 0.3, 0.36, '#6366f1'],
          [-0.25, 0.22, 0.36, '#ec4899'],
          [0.05, 0.6, 0.2, '#6366f1'],
          [-0.42, 0.3, -0.1, '#ec4899'],
          [0.41, 0.18, -0.15, '#6366f1'],
        ].map(([x, y, z, c]) => piece(box(0.13, 0.13, 0.13), c, x, y, z)),
      ]),
    },
  ];
  M[FOUNTAIN] = [
    {
      geo: mergePieces([
        piece(new THREE.CylinderGeometry(0.48, 0.5, 0.3, 10), '#a8b0bb'),
        piece(new THREE.CylinderGeometry(0.1, 0.12, 0.6, 8), '#c3c9d2', 0, 0.2),
        piece(new THREE.CylinderGeometry(0.26, 0.16, 0.1, 10), '#a8b0bb', 0, 0.75),
      ]),
    },
    {
      geo: mergePieces([
        piece(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 10), '#38bdf8', 0, 0.23),
        piece(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10), '#7dd3fc', 0, 0.83),
        piece(new THREE.SphereGeometry(0.09, 8, 6), '#bae6fd', 0, 0.92),
      ]),
      water: true,
    },
  ];
  return M;
}

/** A voxel cloud: a few white boxes. */
export function cloudGeometry(random) {
  const parts = [];
  const n = 4 + Math.floor(random() * 4);
  for (let k = 0; k < n; k++) {
    const w = 2 + random() * 3;
    parts.push(piece(box(w, 1 + random() * 0.8, 1.6 + random() * 2), '#ffffff', (k - n / 2) * 1.6 + random(), random() * 0.6, (random() - 0.5) * 2));
  }
  return mergePieces(parts);
}
