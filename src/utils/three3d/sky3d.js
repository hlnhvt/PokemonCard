// "Cưỡi Charizard bay lượn": a Pilotwings style flight course for kids. Pure engine (no three.js, no DOM).
// World: x east, y up, z south. Heading `yaw` 0 flies towards -z (three.js convention, so
// an Object3D with rotation.y = yaw faces the way the player flies).

export const SKY3D_GAME = 'sky3d';
export const DT = 1 / 60;
export const WATER = 0;

export const FLIGHT = {
  baseSpeed: 30,
  boostSpeed: 48,
  minSpeed: 20,
  maxSpeed: 56,
  turnRate: 1.25, // rad/s at full stick
  turnResponse: 4, // how fast the stick is followed (1/s)
  maxPitch: 0.55,
  pitchResponse: 2.6,
  speedResponse: 1.6,
  boostDrain: 0.38, // meter per second while boosting
  boostRefill: 0.14,
  boostRestart: 0.15, // an empty meter must refill this much before boosting again
  clearance: 3, // never lower than this above ground / water
  assistHeight: 9, // pull-up assist starts this far above the clearance
  ceiling: 150,
};

export const RING_R = 7.5;
export const GOLD_RING_R = 6.5;
export const HIT_SLACK = 0.9; // the rider's body: a little generous
export const RING_BONUS = 3;
export const GOLD_BONUS = 6;
export const ITEM_BONUS = 1;
export const BUMP_PENALTY = 3;
export const TRAIL_BONUS = 0.25; // seconds per full second spent in a friend's trail
export const COMBO_GAP = 9; // seconds between rings to keep a combo going

export const TIMES_OF_DAY = ['morning', 'noon', 'afternoon', 'sunset', 'dusk', 'night'];

/**
 * Ten courses. rings: count, spacing: metres between rings, curve: max heading change per ring (rad),
 * climb: max height change per ring, gold / moving: how many golden / moving rings, items: stars and
 * Poke Balls, balloons: Team Rocket Meowth balloons, storms: storm clouds, clouds: puffy clouds on
 * the path, canyon / falls: a narrow canyon / waterfall curtains to fly through, friend: a flying
 * Pokemon to follow.
 */
export const LEVELS = [
  { id: 1, name: 'Bình minh đồng cỏ', icon: '🌅', tod: 'morning', rings: 8, spacing: 86, curve: 0.3, climb: 4, gold: 0, moving: 0, items: 4, balloons: 0, storms: 0, clouds: 2, tip: 'Kéo ngón tay để lái: sang trái/phải để rẽ, lên/xuống để bay lên/lao xuống!' },
  { id: 2, name: 'Thung lũng hồ xanh', icon: '🏞️', tod: 'noon', rings: 9, spacing: 86, curve: 0.42, climb: 6, gold: 1, moving: 0, items: 5, balloons: 0, storms: 0, clouds: 3, tip: 'Vòng vàng cộng thêm nhiều giây!' },
  { id: 3, name: 'Đảo mây bồng bềnh', icon: '☁️', tod: 'noon', rings: 10, spacing: 84, curve: 0.5, climb: 8, gold: 1, moving: 0, items: 6, balloons: 0, storms: 0, clouds: 7, tip: 'Bay xuyên qua mây mềm mại nào!' },
  { id: 4, name: 'Khinh khí cầu Rocket', icon: '🎈', tod: 'afternoon', rings: 10, spacing: 88, curve: 0.5, climb: 8, gold: 1, moving: 0, items: 6, balloons: 4, storms: 0, clouds: 3, tip: 'Né bóng bay Meowth của Đội Rocket nhé!' },
  { id: 5, name: 'Mây giông lấp lánh', icon: '⛈️', tod: 'afternoon', rings: 11, spacing: 86, curve: 0.55, climb: 9, gold: 1, moving: 0, items: 6, balloons: 2, storms: 4, clouds: 3, tip: 'Tránh mây giông, kẻo mất vài giây!' },
  { id: 6, name: 'Bay cùng Pidgeot', icon: '🐦', tod: 'sunset', rings: 12, spacing: 88, curve: 0.55, climb: 9, gold: 2, moving: 2, items: 6, balloons: 2, storms: 2, clouds: 3, friend: { dex: 18, name: 'Pidgeot' }, tip: 'Bay theo vệt sáng của Pidgeot để được thưởng giây!' },
  { id: 7, name: 'Hẻm núi hẹp', icon: '🏔️', tod: 'sunset', rings: 12, spacing: 80, curve: 0.5, climb: 5, gold: 2, moving: 1, items: 7, balloons: 1, storms: 1, clouds: 2, canyon: true, tip: 'Hẻm núi hẹp lắm, lái nhẹ tay thôi!' },
  { id: 8, name: 'Đường hầm thác nước', icon: '💦', tod: 'dusk', rings: 13, spacing: 84, curve: 0.5, climb: 6, gold: 2, moving: 2, items: 7, balloons: 2, storms: 2, clouds: 2, canyon: true, falls: true, friend: { dex: 149, name: 'Dragonite' }, tip: 'Xuyên qua màn thác nước cùng Dragonite!' },
  { id: 9, name: 'Vòng xoay chạng vạng', icon: '🌀', tod: 'dusk', rings: 14, spacing: 86, curve: 0.6, climb: 10, gold: 2, moving: 4, items: 8, balloons: 3, storms: 3, clouds: 4, tip: 'Vòng biết di chuyển! Canh chuẩn rồi bay qua.' },
  { id: 10, name: 'Lugia huyền thoại', icon: '🌙', tod: 'night', rings: 16, spacing: 88, curve: 0.6, climb: 10, gold: 3, moving: 4, items: 9, balloons: 3, storms: 3, clouds: 4, friend: { dex: 249, name: 'Lugia' }, tip: 'Đua cùng Lugia dưới bầu trời sao!' },
];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Shortest signed angle from a to b. */
export const angleDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
/** Heading that flies from the origin along (dx, dz). */
export const yawTo = (dx, dz) => Math.atan2(-dx, -dz);

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

/** Distance from (x, z) to the course centre line, and the line's height there. */
function pathInfo(course, x, z) {
  const p = course.path;
  let best = Infinity;
  let y = p[0].y;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i];
    const b = p[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / len2, 0, 1);
    const px = a.x + dx * t - x;
    const pz = a.z + dz * t - z;
    const d2 = px * px + pz * pz;
    if (d2 < best) {
      best = d2;
      y = a.y + (b.y - a.y) * t;
    }
  }
  return { d: Math.sqrt(best), y };
}

/** Terrain height (may be below the water). Shared with the 3D scene so both agree. */
export function heightAt(course, x, z) {
  const t = course.terrain;
  const n = 0.5 * Math.sin(x * 0.012 + t.s1) * Math.cos(z * 0.01 + t.s2) + 0.3 * Math.sin((x + z) * 0.021 + t.s3) + 0.2 * Math.sin(x * 0.043 - z * 0.037 + t.s4);
  const base = n * 0.5 + 0.5;
  let h = Math.pow(base, 1.6) * t.peak - 16 + 8 * Math.sin(x * 0.09 + t.s5) * Math.sin(z * 0.08 + t.s6) * base;
  // Islands in the sea: everything sinks away far from the course
  const far = Math.hypot(x - course.bounds.cx, z - course.bounds.cz);
  h = lerp(h, -18, smooth(course.bounds.r * 0.85, course.bounds.r * 1.3, far));
  const { d, y } = pathInfo(course, x, z);
  // Keep the flight path clear: low near the course line, mountains may rise further away
  h = Math.min(h, y - 15 + Math.max(0, d - 24) * 1.3);
  if (course.canyon) {
    const wall = y - 15 + smooth(course.canyon, course.canyon + 14, d) * 58;
    h = Math.max(h, lerp(wall, h, smooth(course.canyon + 60, course.canyon + 110, d)));
  }
  // Flat ground for the Pokemon Center town
  const tw = course.town;
  const dt = Math.hypot(x - tw.x, z - tw.z);
  h = lerp(h, tw.y, 1 - smooth(tw.r, tw.r + 22, dt));
  return h;
}

/** Ground or water under a point, whichever is higher. */
export const floorAt = (course, x, z) => Math.max(WATER, heightAt(course, x, z));

/** Centre of a ring at time t (moving rings slide along their axis). */
export function ringPos(ring, t) {
  if (!ring.move) return { x: ring.x, y: ring.y, z: ring.z };
  const m = ring.move;
  const o = Math.sin(t * m.freq + m.phase) * m.amp;
  return { x: ring.x + m.ax * o, y: ring.y + m.ay * o, z: ring.z + m.az * o };
}

/** The course of a level: rings, items, hazards, clouds, terrain parameters. Always the same per level. */
export function buildCourse(index) {
  const lv = LEVELS[index];
  const rnd = mulberry(4242 + index * 7919);
  const start = { x: 0, y: lv.canyon ? 30 : 38, z: 0 };
  const pts = [start];
  let yaw = 0;
  let x = 0;
  let z = 0;
  let y = start.y;
  let turnSign = rnd() < 0.5 ? -1 : 1;
  for (let i = 0; i < lv.rings; i++) {
    if (i > 0) {
      // Wind gently: keep turning one way for a while, then the other
      if (rnd() < 0.35) turnSign = -turnSign;
      yaw += turnSign * lv.curve * (0.45 + rnd() * 0.55);
    }
    const dist = i === 0 ? 80 : lv.spacing * (0.9 + rnd() * 0.2);
    x += -Math.sin(yaw) * dist;
    z += -Math.cos(yaw) * dist;
    if (i > 0) y = clamp(y + (rnd() * 2 - 1) * lv.climb, lv.canyon ? 24 : 26, lv.canyon ? 40 : 70);
    pts.push({ x, y, z });
  }
  const goldAt = new Set();
  while (goldAt.size < lv.gold) goldAt.add(2 + Math.floor(rnd() * (lv.rings - 2)));
  const moveAt = new Set();
  while (moveAt.size < lv.moving) moveAt.add(1 + Math.floor(rnd() * (lv.rings - 1)));
  const rings = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const c = pts[i];
    // Face along the path (average of the way in and the way out)
    let nx = (c.x - a.x) / 2 + (i + 1 < pts.length ? (b.x - c.x) / 2 : (c.x - a.x) / 2);
    let ny = 0;
    let nz = (c.z - a.z) / 2 + (i + 1 < pts.length ? (b.z - c.z) / 2 : (c.z - a.z) / 2);
    const len = Math.hypot(nx, nz) || 1;
    nx /= len;
    nz /= len;
    const gold = goldAt.has(i - 1);
    const ring = { i: i - 1, x: c.x, y: c.y, z: c.z, nx, ny, nz, r: gold ? GOLD_RING_R : RING_R, gold, move: null, curtain: !!lv.falls && i % 3 === 2 };
    if (moveAt.has(i - 1)) {
      const vertical = (i + index) % 2 === 0;
      ring.move = vertical ? { ax: 0, ay: 1, az: 0, amp: 4.5, freq: 0.8, phase: rnd() * 6.28 } : { ax: nz, ay: 0, az: -nx, amp: 6, freq: 0.7, phase: rnd() * 6.28 };
    }
    rings.push(ring);
  }
  const lateral = (a, b, side) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    return { x: (-dz / l) * side, z: (dx / l) * side };
  };
  // Stars and Poke Balls between rings, a little off the straight line
  const items = [];
  for (let k = 0; k < lv.items; k++) {
    const seg = 1 + (k % (pts.length - 1));
    const a = pts[seg - 1];
    const b = pts[seg];
    const f = 0.35 + rnd() * 0.3;
    const off = lateral(a, b, (rnd() * 2 - 1) * 3);
    items.push({ i: k, kind: k % 2 === 0 ? 'star' : 'ball', x: lerp(a.x, b.x, f) + off.x, y: lerp(a.y, b.y, f) + (rnd() * 2 - 1) * 2, z: lerp(a.z, b.z, f) + off.z, taken: false });
  }
  // Hazards beside the line: close enough to need care, the straight line between rings stays clear
  const hazards = [];
  const addHazard = (kind, k) => {
    const seg = 2 + ((k * 3) % Math.max(1, pts.length - 2));
    const a = pts[seg - 1];
    const b = pts[Math.min(seg, pts.length - 1)];
    const f = 0.4 + rnd() * 0.2;
    const off = lateral(a, b, (rnd() < 0.5 ? -1 : 1) * (kind === 'storm' ? 14 + rnd() * 4 : 11 + rnd() * 4));
    hazards.push({ i: hazards.length, kind, x: lerp(a.x, b.x, f) + off.x, y: lerp(a.y, b.y, f) + (rnd() * 2 - 1) * 3, z: lerp(a.z, b.z, f) + off.z, r: kind === 'storm' ? 6.5 : 4.2, bob: 2 + rnd() * 2, phase: rnd() * 6.28 });
  };
  for (let k = 0; k < lv.balloons; k++) addHazard('balloon', k);
  for (let k = 0; k < lv.storms; k++) addHazard('storm', k + lv.balloons);
  // Puffy clouds: some on the path (fly through them!), more around for scenery
  const clouds = [];
  for (let k = 0; k < lv.clouds; k++) {
    const seg = 1 + Math.floor(rnd() * (pts.length - 1));
    const a = pts[seg - 1];
    const b = pts[seg];
    const f = 0.3 + rnd() * 0.4;
    clouds.push({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) + 1, z: lerp(a.z, b.z, f), r: 7 + rnd() * 3, onPath: true });
  }
  let cx = 0;
  let cz = 0;
  for (const p of pts) {
    cx += p.x / pts.length;
    cz += p.z / pts.length;
  }
  let far = 0;
  for (const p of pts) far = Math.max(far, Math.hypot(p.x - cx, p.z - cz));
  const bounds = { cx, cz, r: far + 90 };
  for (let k = 0; k < 18; k++) {
    const a = rnd() * Math.PI * 2;
    const d = bounds.r * (0.2 + rnd() * 0.9);
    clouds.push({ x: cx + Math.cos(a) * d, y: 62 + rnd() * 30, z: cz + Math.sin(a) * d, r: 9 + rnd() * 6, onPath: false });
  }
  // Pokemon Center town beside the first stretch
  const side = lateral(pts[0], pts[1], rnd() < 0.5 ? -1 : 1);
  const town = { x: pts[0].x + (pts[1].x - pts[0].x) * 0.45 + side.x * (lv.canyon ? 70 : 55), z: pts[0].z + (pts[1].z - pts[0].z) * 0.45 + side.z * (lv.canyon ? 70 : 55), y: 5, r: 22 };
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z);
  // Time: a relaxed pace plus the ring bonuses; 3 stars need every ring and some time left
  const timeLimit = Math.ceil((len / FLIGHT.baseSpeed) * 1.1 + 5);
  const star3 = lv.rings * RING_BONUS;
  const course = {
    index,
    level: lv,
    start,
    path: pts,
    rings,
    items,
    hazards,
    clouds,
    bounds,
    town,
    canyon: lv.canyon ? 15 : 0,
    terrain: { s1: rnd() * 6.28, s2: rnd() * 6.28, s3: rnd() * 6.28, s4: rnd() * 6.28, s5: rnd() * 6.28, s6: rnd() * 6.28, peak: lv.canyon ? 80 : 70 },
    length: len,
    timeLimit,
    star3,
  };
  return course;
}

/** Stars for a run: 3 = every ring with `star3` seconds left, 2 = three quarters of the rings, 1 = finished (or half the rings by the end of time). */
export function starsFor(course, { hits, timeLeft, finished }) {
  const n = course.rings.length;
  if (!finished) return hits >= Math.ceil(n / 2) ? 1 : 0;
  if (hits >= n && timeLeft >= course.star3) return 3;
  if (hits >= Math.ceil(n * 0.75)) return 2;
  return 1;
}

/** A new flight on level `index`. */
export function createSky3D(index, { random = Math.random } = {}) {
  const course = buildCourse(index);
  const first = course.rings[0];
  return {
    course,
    level: index,
    random,
    t: 0,
    timeLeft: course.timeLimit,
    status: 'play', // play | done | timeout
    x: course.start.x,
    y: course.start.y,
    z: course.start.z,
    yaw: yawTo(first.x - course.start.x, first.z - course.start.z),
    pitch: 0,
    bank: 0, // -1..1 (stick followed smoothly), positive = turning right
    speed: FLIGHT.baseSpeed,
    boost: 1,
    boosting: false,
    boostLocked: false,
    rings: course.rings.map((r) => ({ ...r, state: 'todo', at: 0 })),
    next: 0,
    hits: 0,
    missed: 0,
    golden: 0,
    combo: 0,
    bestCombo: 0,
    lastHit: -99,
    items: course.items.map((it) => ({ ...it })),
    stars: 0,
    balls: 0,
    hazards: course.hazards.map((h) => ({ ...h, phase: h.phase + random() * 0.5, cool: 0 })),
    bumps: 0,
    cloudCool: 0,
    splashCool: 0,
    outside: false,
    assist: false,
    skim: false,
    friend: course.level.friend ? { ...course.level.friend, x: course.start.x, y: course.start.y, z: course.start.z, along: 22, speed: 31, trail: [], trailT: 0, inTrail: false, inTrailTime: 0, bonus: 0 } : null,
    trailSeconds: 0,
    earned: 0,
    events: [],
  };
}

/** Position on the path polyline `along` metres from the start. */
function pathPoint(course, along) {
  const p = course.path;
  let left = along;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1];
    const b = p[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (left <= l) {
      const f = left / l;
      return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f), yaw: yawTo(b.x - a.x, b.z - a.z), end: false };
    }
    left -= l;
  }
  const a = p[p.length - 2];
  const b = p[p.length - 1];
  return { x: b.x, y: b.y, z: b.z, yaw: yawTo(b.x - a.x, b.z - a.z), end: true };
}

/** Distance of the player along the path (projected on the nearest segment). */
function alongOf(course, x, z) {
  const p = course.path;
  let best = Infinity;
  let res = 0;
  let acc = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1];
    const b = p[i];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1);
    const d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
    const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (d < best) {
      best = d;
      res = acc + l * t;
    }
    acc += l;
  }
  return res;
}

export const forwardOf = (s) => ({ x: -Math.sin(s.yaw) * Math.cos(s.pitch), y: Math.sin(s.pitch), z: -Math.cos(s.yaw) * Math.cos(s.pitch) });

function finish(s, status) {
  s.status = status;
  s.earned = starsFor(s.course, { hits: s.hits, timeLeft: s.timeLeft, finished: status === 'done' });
  s.events.push({ type: status === 'done' ? 'finish' : 'timeout', stars: s.earned });
}

function hitRing(s, k, x, y, z) {
  for (let j = s.next; j < k; j++) {
    s.rings[j].state = 'miss';
    s.rings[j].at = s.t;
    s.missed += 1;
    s.combo = 0;
    s.events.push({ type: 'miss', index: j });
  }
  const r = s.rings[k];
  r.state = 'hit';
  r.at = s.t;
  s.hits += 1;
  if (r.gold) s.golden += 1;
  s.combo = s.t - s.lastHit <= COMBO_GAP && s.combo > 0 ? s.combo + 1 : 1;
  s.bestCombo = Math.max(s.bestCombo, s.combo);
  s.lastHit = s.t;
  const bonus = r.gold ? GOLD_BONUS : RING_BONUS;
  s.timeLeft += bonus;
  s.next = k + 1;
  s.events.push({ type: 'ring', index: k, gold: r.gold, bonus, combo: s.combo, x, y, z, count: s.hits });
  if (s.combo >= 2) s.events.push({ type: 'combo', n: s.combo });
}

function missRing(s, k) {
  const r = s.rings[k];
  r.state = 'miss';
  r.at = s.t;
  s.missed += 1;
  s.combo = 0;
  s.next = k + 1;
  s.events.push({ type: 'miss', index: k });
}

/** Ring passing: crossing the ring's plane inside its disc, in order (later rings skip the ones before). */
function checkRings(s, x0, y0, z0) {
  const last = Math.min(s.rings.length - 1, s.next + 2);
  for (let k = s.next; k <= last; k++) {
    const r = s.rings[k];
    const c = ringPos(r, s.t);
    const d0 = (x0 - c.x) * r.nx + (y0 - c.y) * r.ny + (z0 - c.z) * r.nz;
    const d1 = (s.x - c.x) * r.nx + (s.y - c.y) * r.ny + (s.z - c.z) * r.nz;
    if ((d0 < 0) === (d1 < 0) || d0 === d1) continue;
    const f = d0 / (d0 - d1);
    const px = lerp(x0, s.x, f);
    const py = lerp(y0, s.y, f);
    const pz = lerp(z0, s.z, f);
    const off = Math.hypot(px - c.x, py - c.y, pz - c.z);
    if (off <= r.r + HIT_SLACK) {
      hitRing(s, k, c.x, c.y, c.z);
      return;
    }
    // Flew forwards past the next ring, close but outside: it is skipped
    if (k === s.next && d0 < 0 && off <= r.r * 2.4) {
      missRing(s, k);
      return;
    }
  }
}

/**
 * One physics step. input = { turn: -1..1 (right +), climb: -1..1 (up +), boost: bool }.
 */
export function step(s, dt, input = {}) {
  if (s.status !== 'play') return s;
  s.t += dt;
  s.timeLeft = Math.max(0, s.timeLeft - dt);
  const course = s.course;
  let turn = clamp(Number(input.turn) || 0, -1, 1);
  let climb = clamp(Number(input.climb) || 0, -1, 1);

  // Soft boundary: outside the course the wind turns the rider back to the middle
  const dc = Math.hypot(s.x - course.bounds.cx, s.z - course.bounds.cz);
  const wasOutside = s.outside;
  s.outside = dc > course.bounds.r;
  if (s.outside) {
    const home = yawTo(course.bounds.cx - s.x, course.bounds.cz - s.z);
    const w = clamp((dc - course.bounds.r) / 25 + 0.5, 0, 1);
    turn = lerp(turn, clamp(-angleDiff(s.yaw, home) * 2, -1, 1), w);
    if (!wasOutside) s.events.push({ type: 'wind' });
  }
  if (s.y > FLIGHT.ceiling - 10) climb = Math.min(climb, -0.3);

  // Bank and turn
  s.bank += (turn - s.bank) * Math.min(1, FLIGHT.turnResponse * dt);
  s.yaw -= s.bank * FLIGHT.turnRate * dt;

  // Pull-up assist: look under and ahead, never let the ground or water come too close
  const fwd = forwardOf(s);
  const g0 = floorAt(course, s.x, s.z);
  const g1 = floorAt(course, s.x + fwd.x * 12, s.z + fwd.z * 12);
  const g2 = floorAt(course, s.x + fwd.x * 26, s.z + fwd.z * 26);
  const floor = Math.max(g0, g1, g2 - 4);
  const margin = s.y - (floor + FLIGHT.clearance);
  let pitchTarget = climb * FLIGHT.maxPitch;
  s.assist = margin < FLIGHT.assistHeight && pitchTarget < 0.45;
  if (s.assist) pitchTarget = Math.max(pitchTarget, ((FLIGHT.assistHeight - margin) / FLIGHT.assistHeight) * 0.5);
  s.pitch += (pitchTarget - s.pitch) * Math.min(1, FLIGHT.pitchResponse * dt);
  s.pitch = clamp(s.pitch, -FLIGHT.maxPitch, FLIGHT.maxPitch);

  // Boost meter
  if (s.boostLocked && s.boost >= FLIGHT.boostRestart) s.boostLocked = false;
  s.boosting = !!input.boost && !s.boostLocked && s.boost > 0;
  if (s.boosting) {
    s.boost = Math.max(0, s.boost - FLIGHT.boostDrain * dt);
    if (s.boost <= 0) {
      s.boostLocked = true;
      s.boosting = false;
      s.events.push({ type: 'boostEmpty' });
    }
  } else s.boost = Math.min(1, s.boost + FLIGHT.boostRefill * dt);
  const target = (s.boosting ? FLIGHT.boostSpeed : FLIGHT.baseSpeed) - Math.sin(s.pitch) * 8;
  s.speed += (target - s.speed) * Math.min(1, FLIGHT.speedResponse * dt);
  s.speed = clamp(s.speed, FLIGHT.minSpeed, FLIGHT.maxSpeed);

  // Move
  const x0 = s.x;
  const y0 = s.y;
  const z0 = s.z;
  const f = forwardOf(s);
  s.x += f.x * s.speed * dt;
  s.y += f.y * s.speed * dt;
  s.z += f.z * s.speed * dt;
  const ground = floorAt(course, s.x, s.z);
  if (s.y < ground + FLIGHT.clearance) {
    s.y = ground + FLIGHT.clearance;
    if (s.pitch < 0) s.pitch = 0;
  }
  if (s.y > FLIGHT.ceiling) s.y = FLIGHT.ceiling;
  const overWater = heightAt(course, s.x, s.z) < WATER;
  s.skim = overWater && s.y - WATER < 6;
  s.splashCool = Math.max(0, s.splashCool - dt);
  if (s.skim && s.splashCool <= 0) {
    s.splashCool = 0.25;
    s.events.push({ type: 'splash', x: s.x, y: WATER, z: s.z });
  }

  checkRings(s, x0, y0, z0);

  // Stars and Poke Balls
  for (const it of s.items) {
    if (it.taken) continue;
    if (Math.hypot(it.x - s.x, it.y - s.y, it.z - s.z) < 4.5) {
      it.taken = true;
      if (it.kind === 'star') s.stars += 1;
      else s.balls += 1;
      s.timeLeft += ITEM_BONUS;
      s.events.push({ type: 'item', kind: it.kind, index: it.i, x: it.x, y: it.y, z: it.z });
    }
  }

  // Team Rocket balloons and storm clouds: a bump costs a few seconds, never a crash
  for (const h of s.hazards) {
    h.cool = Math.max(0, h.cool - dt);
    const hy = h.y + Math.sin(s.t * 0.9 + h.phase) * h.bob;
    if (h.cool <= 0 && Math.hypot(h.x - s.x, hy - s.y, h.z - s.z) < h.r + 1.2) {
      h.cool = 2;
      s.bumps += 1;
      s.timeLeft = Math.max(0, s.timeLeft - BUMP_PENALTY);
      s.speed = Math.max(FLIGHT.minSpeed, s.speed * 0.7);
      s.combo = 0;
      s.events.push({ type: 'bump', kind: h.kind, index: h.i, x: s.x, y: s.y, z: s.z });
    }
  }

  // Puffy clouds: just a soft puff
  s.cloudCool = Math.max(0, s.cloudCool - dt);
  if (s.cloudCool <= 0) {
    for (const c of course.clouds) {
      if (Math.hypot(c.x - s.x, (c.y - s.y) * 1.6, c.z - s.z) < c.r) {
        s.cloudCool = 0.8;
        s.events.push({ type: 'cloud', x: s.x, y: s.y, z: s.z });
        break;
      }
    }
  }

  // A friend flies the course ahead; staying in their trail earns bonus seconds
  const fr = s.friend;
  if (fr) {
    const me = alongOf(course, s.x, s.z);
    const gap = fr.along - me;
    fr.speed = gap > 45 ? 20 : gap < 15 ? 38 : 31;
    fr.along += fr.speed * dt;
    const pp = pathPoint(course, fr.along);
    fr.x = pp.x;
    fr.y = pp.y + Math.sin(s.t * 2) * 0.8;
    fr.z = pp.z;
    fr.yaw = pp.yaw;
    fr.trailT += dt;
    if (fr.trailT >= 0.1) {
      fr.trailT = 0;
      fr.trail.push({ x: fr.x, y: fr.y, z: fr.z, t: s.t });
      while (fr.trail.length && s.t - fr.trail[0].t > 2.5) fr.trail.shift();
    }
    let inTrail = false;
    for (const p of fr.trail) {
      if (Math.hypot(p.x - s.x, p.y - s.y, p.z - s.z) < 7) {
        inTrail = true;
        break;
      }
    }
    fr.inTrail = inTrail && gap > 0;
    if (fr.inTrail) {
      fr.inTrailTime += dt;
      if (fr.inTrailTime >= 1) {
        fr.inTrailTime -= 1;
        s.trailSeconds += 1;
        s.timeLeft += TRAIL_BONUS;
        s.events.push({ type: 'trail', seconds: s.trailSeconds });
      }
    }
  }

  if (s.next >= s.rings.length) finish(s, 'done');
  else if (s.timeLeft <= 0) finish(s, 'timeout');
  return s;
}

/** Steps of DT for `seconds` with one input (tests and the bot). */
export function run(s, seconds, input) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n && s.status === 'play'; i++) step(s, DT, typeof input === 'function' ? input(s) : input);
  return s;
}

/**
 * Autopilot: steer to an approach point in front of the next ring, then through its centre;
 * sidestep hazards just ahead; boost on long straight stretches.
 */
export function autopilot(s, { boost = true } = {}) {
  const r = s.rings[s.next];
  if (!r) return { turn: 0, climb: 0, boost: false };
  const dist0 = Math.hypot(r.x - s.x, r.y - s.y, r.z - s.z);
  const c = ringPos(r, s.t + dist0 / Math.max(1, s.speed));
  const dx = c.x - s.x;
  const dy = c.y - s.y;
  const dz = c.z - s.z;
  const dist = Math.hypot(dx, dy, dz);
  // Aim a little before the ring along its normal so the ring is crossed head on
  const lead = clamp(dist * 0.35, 0, 18);
  let ax = c.x - r.nx * lead - s.x;
  let az = c.z - r.nz * lead - s.z;
  const ay = c.y - s.y;
  for (const h of s.hazards) {
    const hy = h.y + Math.sin(s.t * 0.9 + h.phase) * h.bob;
    const hx = h.x - s.x;
    const hz = h.z - s.z;
    const hd = Math.hypot(hx, hz);
    if (hd > 40 || hd > dist) continue;
    // Lateral offset of the hazard from our aim line
    const al = Math.hypot(ax, az) || 1;
    const side = (hx * az - hz * ax) / al;
    const ahead = (hx * ax + hz * az) / al;
    if (ahead > 0 && Math.abs(side) < h.r + 4 && Math.abs(hy - s.y) < h.r + 4) {
      const push = (h.r + 6 - Math.abs(side)) * (side >= 0 ? -1 : 1);
      const px = az / al;
      const pz = -ax / al;
      ax += px * push;
      az += pz * push;
    }
  }
  const want = yawTo(ax, az);
  const err = angleDiff(s.yaw, want);
  const turn = clamp(-err * 2.4, -1, 1);
  const wantPitch = Math.atan2(ay, Math.hypot(dx, dz));
  const climb = clamp((wantPitch - s.pitch) * 3 + wantPitch * 1.2, -1, 1);
  const go = boost && !s.boostLocked && Math.abs(err) < 0.12 && dist > 45 && s.boost > 0.3;
  return { turn, climb, boost: go };
}

/** What the HUD shows (copied into React state). */
export const snap = (s) => ({
  status: s.status,
  timeLeft: s.timeLeft,
  hits: s.hits,
  missed: s.missed,
  total: s.rings.length,
  next: s.next,
  boost: s.boost,
  boosting: s.boosting,
  boostLocked: s.boostLocked,
  outside: s.outside,
  stars: s.stars,
  balls: s.balls,
  combo: s.combo,
  earned: s.earned,
  inTrail: !!s.friend?.inTrail,
  trailSeconds: s.trailSeconds,
  golden: s.golden,
  bumps: s.bumps,
  altitude: Math.round(s.y),
});
