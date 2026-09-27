// "Tàu lượn siêu tốc": a side-view roller coaster ride. The track (hills, drops, loops and
// sharp curves) is built from seeded random pieces. HOLD to boost - it matters on the way up a
// hill: too slow and the cart rolls back a bit ("Ối!") before the chain lift pulls it up. RELEASE
// on the curves marked with a warning sign: holding there makes the cart wobble and drop stars.
// Stars float along the track; the high ones over the hill tops are only reached with airtime,
// by coming over the top fast. Rolling back or wobbling makes stars fall out of the cart. One ride is about 45 s. Pure rules; `random` is injectable.
import { starsFor } from './tickets';

export const CO_W = 360;
export const CO_H = 560;
export const GRAVITY = 300; // px/s² along the slope
export const BOOST = 230;
export const DRAG = 0.12;
export const VMAX = 270;
export const AIR_SPEED = 205; // over a hill top at least this fast = airtime
export const AIR_TIME = 0.55;
export const LIFT_SPEED = 100; // the chain lift after a roll back
export const ROLL_TIME = 0.8;
export const WOBBLE_GAP = 0.6;
export const MAX_TIME = 90;
export const CART_GAP = 38; // distance between the cars of the train
export const LOW_H = 24; // star heights above the rail
export const HIGH_H = 74;
const STEP = 4;

/** Build the track: sampled points with their distance along the rail. */
export function buildTrack(random = Math.random, targetLength = 10000) {
  const xs = [0];
  const ys = [0];
  const pieces = []; // { kind, d0, d1 }
  const hills = []; // hill tops: { d }
  const curves = []; // { d0, d1, sign }
  const stars = [];
  let len = 0;
  const dist = [0];
  const push = (x, y) => {
    const px = xs[xs.length - 1];
    const py = ys[ys.length - 1];
    const d = Math.hypot(x - px, y - py);
    if (d < 0.01) return;
    len += d;
    xs.push(x);
    ys.push(y);
    dist.push(len);
  };
  const cur = () => ({ x: xs[xs.length - 1], y: ys[ys.length - 1] });
  // A piece given by f(t) -> {dx, dy} from its start
  const piece = (kind, n, f) => {
    const o = cur();
    const d0 = len;
    for (let i = 1; i <= n; i++) {
      const p = f(i / n);
      push(o.x + p.x, o.y + p.y);
    }
    pieces.push({ kind, d0, d1: len });
    return { d0, d1: len };
  };
  const alt = () => -cur().y; // height above the start (y grows downwards)
  const flat = (L, kind = 'flat') => piece(kind, Math.ceil(L / STEP), (t) => ({ x: L * t, y: 0 }));
  const climb = (L, H) => piece('climb', Math.ceil(L / STEP), (t) => ({ x: L * t, y: (-H * (1 - Math.cos(Math.PI * t))) / 2 }));
  const drop = (L, D) => piece('drop', Math.ceil(L / STEP), (t) => ({ x: L * t, y: (D * (1 - Math.cos(Math.PI * t))) / 2 }));
  const hill = (L, H) => {
    const p = piece('hill', Math.ceil(L / STEP), (t) => ({ x: L * t, y: (-H * (1 - Math.cos(2 * Math.PI * t))) / 2 }));
    const top = (p.d0 + p.d1) / 2;
    hills.push({ d: top, h: H });
    for (const k of [-34, 0, 34]) stars.push({ d: top + k, h: HIGH_H, high: true, hill: hills.length - 1 });
    return p;
  };
  const loop = (R) => {
    const shift = 46;
    const p = piece('loop', Math.ceil((2 * Math.PI * R) / STEP), (t) => {
      const a = t * 2 * Math.PI;
      return { x: R * Math.sin(a) + shift * t, y: -R * (1 - Math.cos(a)) };
    });
    // Stars all round the loop
    for (let i = 1; i <= 4; i++) stars.push({ d: p.d0 + ((p.d1 - p.d0) * i) / 5, h: LOW_H });
    return p;
  };
  const curve = (L) => {
    const p = flat(L, 'curve');
    curves.push({ d0: p.d0, d1: p.d1, sign: Math.max(0, p.d0 - 150) });
    for (let i = 1; i <= 3; i++) stars.push({ d: p.d0 + (L * i) / 4, h: LOW_H });
    return p;
  };
  const lowStars = (p, n) => {
    for (let i = 1; i <= n; i++) stars.push({ d: p.d0 + ((p.d1 - p.d0) * i) / (n + 1), h: LOW_H });
  };
  const r = random;
  // Station, a gentle roll to get going, the big lift hill and the first drop
  flat(140, 'station');
  lowStars(drop(200, 50), 1);
  climb(300, 200 + r() * 30);
  lowStars(drop(280, 260), 1);
  const kinds = ['hill', 'curve', 'loop', 'hill', 'curve', 'bighill', 'hill', 'curve', 'loop', 'hill', 'curve', 'hill'];
  let k = 0;
  while (len < targetLength - 500) {
    const kind = kinds[k % kinds.length];
    k += 1;
    if (kind === 'hill') {
      if (alt() > 60) lowStars(drop(160, Math.min(alt() - 10, 90 + r() * 40)), 1);
      hill(260 + r() * 60, 95 + r() * 45);
      flat(70 + r() * 40);
    } else if (kind === 'curve') {
      flat(60);
      curve(260 + r() * 60);
      flat(60);
    } else if (kind === 'loop') {
      if (alt() < 150) climb(240, 170 - alt() + r() * 30);
      lowStars(drop(220, alt() + 10 * r()), 1);
      flat(40);
      loop(84 + r() * 12);
      flat(80);
    } else {
      // A tall hill: climb, then a long drop
      climb(260, 140 + r() * 40);
      flat(40);
      const p = drop(260, Math.max(40, alt() - 5));
      lowStars(p, 1);
    }
  }
  if (alt() > 20) lowStars(drop(220, alt()), 1);
  flat(420, 'brake');
  return { xs, ys, dist, length: len, pieces, hills, curves, stars };
}

/** Index of the sample at or just before distance d. */
function indexAt(track, d) {
  const { dist } = track;
  let lo = 0;
  let hi = dist.length - 1;
  if (d <= 0) return 0;
  if (d >= dist[hi]) return hi - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (dist[mid] <= d) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Point on the rail at distance d: { x, y, angle } (angle of travel, screen coordinates). */
export function trackAt(track, d) {
  const i = indexAt(track, d);
  const j = Math.min(track.xs.length - 1, i + 1);
  const seg = track.dist[j] - track.dist[i] || 1;
  const k = Math.max(0, Math.min(1, (d - track.dist[i]) / seg));
  const x = track.xs[i] + (track.xs[j] - track.xs[i]) * k;
  const y = track.ys[i] + (track.ys[j] - track.ys[i]) * k;
  return { x, y, angle: Math.atan2(track.ys[j] - track.ys[i], track.xs[j] - track.xs[i]) };
}

export const pieceAt = (track, d) => track.pieces.find((p) => d >= p.d0 && d < p.d1) || track.pieces[track.pieces.length - 1];
export const curveAt = (track, d) => track.curves.find((c) => d >= c.d0 && d < c.d1) || null;
/** The next curve whose sign is passed but not yet its end (for the "THẢ RA!" warning). */
export const curveAhead = (track, d) => track.curves.find((c) => d >= c.sign && d < c.d1) || null;

export function createCoaster({ random = Math.random, length } = {}) {
  const track = buildTrack(random, length);
  return {
    random,
    track,
    time: 0,
    d: 20,
    v: 0,
    holding: false,
    roll: 0, // rolling back
    lift: false, // chain lift pulling us up
    air: 0,
    airHill: -1,
    wobble: 0,
    wobbleCool: 0,
    nextStar: 0, // index into track.stars (sorted by d)
    got: 0,
    dropped: 0,
    rollbacks: 0,
    wobbles: 0,
    airs: 0,
    maxSpeed: 0,
    lastHill: -1,
    inCurve: false,
    warned: -1,
    piece: 'station',
    status: 'play',
    events: [],
  };
}

export const setHold = (s, on) => {
  s.holding = !!on;
};

/** Up-hill slope of the rail under the cart (>0 going up), -1..1. */
export const climbAt = (s) => -Math.sin(trackAt(s.track, s.d).angle);

export function stepCoaster(s, dt) {
  if (s.status !== 'play') return s;
  const t = s.track;
  s.time += dt;
  s.air = Math.max(0, s.air - dt);
  s.wobble = Math.max(0, s.wobble - dt);
  s.wobbleCool = Math.max(0, s.wobbleCool - dt);
  const piece = pieceAt(t, s.d);
  if (piece.kind !== s.piece) {
    s.piece = piece.kind;
    if (piece.kind === 'loop') s.events.push({ type: 'loop' });
    if (piece.kind === 'drop' && piece.d1 - piece.d0 > 150 && s.v > 60) s.events.push({ type: 'whee' });
  }
  const up = climbAt(s);
  const inLoop = piece.kind === 'loop';
  const curve = curveAt(t, s.d);
  if (s.roll > 0) {
    // Rolling back down a little, then the chain lift takes over
    s.roll -= dt;
    s.v = -70 * Math.min(1, s.roll / 0.3 + 0.2);
    if (s.roll <= 0) {
      s.lift = true;
      s.v = LIFT_SPEED;
    }
  } else if (s.lift) {
    s.v = LIFT_SPEED + (s.holding ? 40 : 0);
    if (up < 0.02) s.lift = false;
  } else {
    let a = -GRAVITY * up * (inLoop ? 0.5 : 1) - DRAG * s.v;
    if (s.holding && !curve) a += BOOST;
    if (piece.kind === 'brake') a = -Math.max(0, s.v - 70) * 2.2;
    s.v = Math.min(VMAX, s.v + a * dt);
    // Kind floors: never stuck on the flat, never stuck in a loop
    if (inLoop) s.v = Math.max(s.v, 170);
    else if (up < 0.05 && s.v < 55) s.v = Math.min(55, s.v + 120 * dt);
    if (up > 0.08 && s.v <= 6 && !inLoop) {
      s.roll = ROLL_TIME;
      s.rollbacks += 1;
      // Two stars bounce out of the cart
      const lost = Math.min(2, s.got);
      s.got -= lost;
      s.dropped += lost;
      s.events.push({ type: 'rollback', lost });
    }
  }
  const before = s.d;
  s.d = Math.max(0, s.d + s.v * dt);
  s.maxSpeed = Math.max(s.maxSpeed, s.v);
  // Over a hill top: fast = airtime
  t.hills.forEach((h, i) => {
    if (i > s.lastHill && before < h.d && s.d >= h.d) {
      s.lastHill = i;
      if (s.v >= AIR_SPEED) {
        s.air = AIR_TIME;
        s.airHill = i;
        s.airs += 1;
        s.events.push({ type: 'air', hill: i });
      } else s.events.push({ type: 'slowtop', hill: i });
    }
  });
  // The warning sign before a curve
  const ahead = curveAhead(t, s.d);
  if (ahead) {
    const idx = t.curves.indexOf(ahead);
    if (idx > s.warned) {
      s.warned = idx;
      s.events.push({ type: 'curve', index: idx });
    }
  }
  // Holding in a sharp curve: wobble, drop a star
  if (curve && s.holding && s.wobbleCool <= 0) {
    s.wobble = 0.7;
    s.wobbleCool = WOBBLE_GAP;
    s.wobbles += 1;
    const lost = s.got > 0 ? 1 : 0;
    s.got -= lost;
    s.dropped += lost;
    s.events.push({ type: 'wobble', lost });
  }
  // Stars the cart passes
  while (s.nextStar < t.stars.length && t.stars[s.nextStar].d <= s.d) {
    const star = t.stars[s.nextStar];
    const ok = star.high ? s.air > 0 && s.airHill === star.hill : s.wobble <= 0;
    star.taken = ok;
    if (ok) {
      s.got += 1;
      s.events.push({ type: 'star', index: s.nextStar, high: !!star.high });
    } else s.events.push({ type: 'missStar', index: s.nextStar, high: !!star.high });
    s.nextStar += 1;
  }
  if (s.d >= t.length - 30 || s.time >= MAX_TIME) {
    s.status = 'done';
    s.v = 0;
    s.events.push({ type: 'end' });
  }
  return s;
}

/** The ride's score: 10 per star kept, plus a bonus for a smooth ride. */
export const smoothBonus = (s) => Math.max(0, 100 - 20 * s.rollbacks - 12 * s.wobbles);
export const coasterScore = (s) => s.got * 10 + smoothBonus(s);
export const STAR_TWO = 300;
export const STAR_THREE = 460;
export const coasterStars = (s) => starsFor(coasterScore(s), STAR_TWO, STAR_THREE);
export const progress = (s) => Math.min(1, s.d / s.track.length);
