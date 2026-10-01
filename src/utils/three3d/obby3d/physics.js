// Tiny deterministic physics for "Vượt chướng ngại Pokémon": a racer is a sphere, the world is
// oriented boxes and vertical cylinders (static or kinematic) plus "pushers" (capsules / balls)
// that knock racers back. Pure maths, no three.js.
// Rotation order matches three.js Euler 'YXZ': R = Ry(yaw) · Rx(pitch) · Rz(roll).

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function rotMatrix(yaw = 0, pitch = 0, roll = 0) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  const cz = Math.cos(roll);
  const sz = Math.sin(roll);
  // Ry * Rx
  const a = [cy, sy * sx, sy * cx, 0, cx, -sx, -sy, cy * sx, cy * cx];
  // (Ry*Rx) * Rz
  return [
    a[0] * cz + a[1] * sz, -a[0] * sz + a[1] * cz, a[2],
    a[3] * cz + a[4] * sz, -a[3] * sz + a[4] * cz, a[5],
    a[6] * cz + a[7] * sz, -a[6] * sz + a[7] * cz, a[8],
  ];
}

/** world = c + R · local */
export const toWorld = (m, c, lx, ly, lz) => ({
  x: c.x + m[0] * lx + m[1] * ly + m[2] * lz,
  y: c.y + m[3] * lx + m[4] * ly + m[5] * lz,
  z: c.z + m[6] * lx + m[7] * ly + m[8] * lz,
});
/** local = Rᵀ · (p - c) */
export const toLocal = (m, c, px, py, pz) => {
  const dx = px - c.x;
  const dy = py - c.y;
  const dz = pz - c.z;
  return { x: m[0] * dx + m[3] * dy + m[6] * dz, y: m[1] * dx + m[4] * dy + m[7] * dz, z: m[2] * dx + m[5] * dy + m[8] * dz };
};
const rotate = (m, x, y, z) => ({ x: m[0] * x + m[1] * y + m[2] * z, y: m[3] * x + m[4] * y + m[5] * z, z: m[6] * x + m[7] * y + m[8] * z });

/** Refresh a collider's rotation matrix from its yaw/pitch/roll. */
export function updatePose(c) {
  c.m = rotMatrix(c.yaw || 0, c.pitch || 0, c.roll || 0);
}

/** Saves the pose so the carry of standing racers can be computed after the collider moves. */
export function savePose(c) {
  c.px = c.x;
  c.py = c.y;
  c.pz = c.z;
  c.pm = c.m;
}

/** Where a point riding on the collider ends up after its last move. */
export function carryPoint(c, x, y, z) {
  if (!c.pm) return { x, y, z };
  const l = toLocal(c.pm, { x: c.px, y: c.py, z: c.pz }, x, y, z);
  return toWorld(c.m, c, l.x, l.y, l.z);
}

/** Sphere (x,y,z,r) against an oriented box: { nx, ny, nz, depth } or null. */
export function sphereBox(c, x, y, z, r) {
  const l = toLocal(c.m, c, x, y, z);
  const qx = clamp(l.x, -c.hx, c.hx);
  const qy = clamp(l.y, -c.hy, c.hy);
  const qz = clamp(l.z, -c.hz, c.hz);
  const dx = l.x - qx;
  const dy = l.y - qy;
  const dz = l.z - qz;
  const d2 = dx * dx + dy * dy + dz * dz;
  let n;
  let depth;
  if (d2 > 1e-10) {
    if (d2 >= r * r) return null;
    const d = Math.sqrt(d2);
    n = { x: dx / d, y: dy / d, z: dz / d };
    depth = r - d;
  } else {
    // Centre inside the box: leave by the nearest face
    const ex = c.hx - Math.abs(l.x);
    const ey = c.hy - Math.abs(l.y);
    const ez = c.hz - Math.abs(l.z);
    if (ey <= ex && ey <= ez) {
      n = { x: 0, y: Math.sign(l.y) || 1, z: 0 };
      depth = ey + r;
    } else if (ex <= ez) {
      n = { x: Math.sign(l.x) || 1, y: 0, z: 0 };
      depth = ex + r;
    } else {
      n = { x: 0, y: 0, z: Math.sign(l.z) || 1 };
      depth = ez + r;
    }
  }
  const w = rotate(c.m, n.x, n.y, n.z);
  return { nx: w.x, ny: w.y, nz: w.z, depth, ly: l.y, lx: l.x, lz: l.z };
}

/** Sphere against a vertical cylinder (axis = the collider's local Y). */
export function sphereCyl(c, x, y, z, r) {
  const l = toLocal(c.m, c, x, y, z);
  const d = Math.hypot(l.x, l.z);
  const ux = d > 1e-9 ? l.x / d : 1;
  const uz = d > 1e-9 ? l.z / d : 0;
  let n;
  let depth;
  if (d <= c.r && Math.abs(l.y) <= c.hy) {
    const ey = c.hy - Math.abs(l.y);
    const er = c.r - d;
    if (ey <= er) {
      n = { x: 0, y: Math.sign(l.y) || 1, z: 0 };
      depth = ey + r;
    } else {
      n = { x: ux, y: 0, z: uz };
      depth = er + r;
    }
  } else {
    const qr = Math.min(d, c.r);
    const qy = clamp(l.y, -c.hy, c.hy);
    const dx = l.x - ux * qr;
    const dz = l.z - uz * qr;
    const dy = l.y - qy;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r * r || d2 < 1e-12) return null;
    const dd = Math.sqrt(d2);
    n = { x: dx / dd, y: dy / dd, z: dz / dd };
    depth = r - dd;
  }
  const w = rotate(c.m, n.x, n.y, n.z);
  return { nx: w.x, ny: w.y, nz: w.z, depth, ly: l.y, lx: l.x, lz: l.z };
}

/** Closest point on segment a-b to p, and its parameter. */
export function closestOnSegment(ax, ay, az, bx, by, bz, px, py, pz) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const len2 = abx * abx + aby * aby + abz * abz || 1e-9;
  const t = clamp(((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / len2, 0, 1);
  return { x: ax + abx * t, y: ay + aby * t, z: az + abz * t, t };
}

/** Sphere against a sphere of radius R at (cx,cy,cz). */
export function sphereSphere(cx, cy, cz, R, x, y, z, r) {
  const dx = x - cx;
  const dy = y - cy;
  const dz = z - cz;
  const d2 = dx * dx + dy * dy + dz * dz;
  const rr = R + r;
  if (d2 >= rr * rr) return null;
  const d = Math.sqrt(d2) || 1e-6;
  return { nx: dx / d, ny: dy / d, nz: dz / d, depth: rr - d };
}

export const contact = (c, x, y, z, r) => (c.kind === 'cyl' ? sphereCyl(c, x, y, z, r) : sphereBox(c, x, y, z, r));

/** Height of the collider's top surface at (x, z), or null when (x, z) is outside its footprint. */
export function topAt(c, x, z) {
  if (!c.active) return null;
  if (c.kind === 'cyl') {
    const l = toLocal(c.m, c, x, c.y, z);
    if (l.x * l.x + l.z * l.z > c.r * c.r) return null;
    return c.y + c.hy;
  }
  // Plane of the top face: point p0 = c + R·(0,hy,0), normal n = R·(0,1,0)
  const n = rotate(c.m, 0, 1, 0);
  if (n.y < 0.2) return null;
  const p0 = toWorld(c.m, c, 0, c.hy, 0);
  const y = p0.y - (n.x * (x - p0.x) + n.z * (z - p0.z)) / n.y;
  const l = toLocal(c.m, c, x, y, z);
  if (Math.abs(l.x) > c.hx || Math.abs(l.z) > c.hz) return null;
  return y;
}

/** Z range a collider can ever reach (used by the z buckets). */
export function zRange(c, reach = 0) {
  if (c.kind === 'cyl') return [c.z - c.r - reach, c.z + c.r + reach];
  const ext = Math.hypot(c.hx, c.hy, c.hz);
  return [c.z - ext - reach, c.z + ext + reach];
}

/** Buckets of colliders along z so each racer only tests what is near it. */
export function buildBuckets(colliders, size = 8) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of colliders) {
    const reach = c.reach || 0;
    const [a, b] = zRange(c, reach);
    c.z0 = a;
    c.z1 = b;
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  }
  const n = Math.max(1, Math.ceil((hi - lo) / size) + 1);
  const buckets = Array.from({ length: n }, () => []);
  for (const c of colliders) {
    const i0 = Math.floor((c.z0 - lo) / size);
    const i1 = Math.floor((c.z1 - lo) / size);
    for (let i = i0; i <= i1; i++) buckets[i].push(c);
  }
  return { lo, size, buckets };
}

/** Colliders near z (within one bucket on each side), each listed once. */
export function nearby(index, z, out = []) {
  out.length = 0;
  const i = Math.floor((z - index.lo) / index.size);
  const seen = nearby.seen || (nearby.seen = new Set());
  seen.clear();
  for (let k = i - 1; k <= i + 1; k++) {
    const b = index.buckets[k];
    if (!b) continue;
    for (const c of b) {
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}
