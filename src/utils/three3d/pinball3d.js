// "Pinball Pokémon": pure pinball engine (no three.js, no DOM).
// The table is a 2D plane: x to the right (0..10), y up the slope (0 = flippers end, 20 = top arc).
// Gravity pulls along -y. A fixed step (DT) is split into substeps so that nothing moves more
// than SUB_MAX per substep: the ball (radius 0.27) can never jump over a wall or a flipper.

export const DT = 1 / 120;
export const W = 10;
export const H = 20;
export const BALL_R = 0.27;
export const GRAVITY = 14;
export const MAX_SPEED = 40;
export const SUB_MAX = 0.1; // largest relative movement per substep
export const LANE_X = 9.2; // plunger lane wall
export const CX = 4.6; // playfield centre (left of the plunger lane)
export const BALLS = 3;
export const SAVE_TIME = 10;
export const CATCH_TIME = 30;
export const CATCH_HITS = 3;
export const CENTER_HITS = 3;
export const MAX_MULT = 5;
export const STAR2 = 25000;
export const STAR3 = 80000;

export const POINTS = {
  bumper: 100,
  sling: 30,
  lane: 200,
  lanesDone: 1500,
  inlane: 100,
  outlane: 500,
  drop: 500,
  dugtrio: 3000,
  spin: 50,
  ramp: 1500,
  jackpot: 10000,
  orbit: 1000,
  combo: 500,
  center: 300,
  hole: 1000,
  catchHit: 1000,
  caught: 10000,
  kickback: 500,
};

/** Wild Pokémon that can appear in catch mode. */
export const WILD = [
  { id: 'pikachu', name: 'Pikachu', dex: 25, color: '#facc15' },
  { id: 'bulbasaur', name: 'Bulbasaur', dex: 1, color: '#4ade80' },
  { id: 'charmander', name: 'Charmander', dex: 4, color: '#fb923c' },
  { id: 'squirtle', name: 'Squirtle', dex: 7, color: '#60a5fa' },
  { id: 'jigglypuff', name: 'Jigglypuff', dex: 39, color: '#f9a8d4' },
  { id: 'meowth', name: 'Meowth', dex: 52, color: '#fde68a' },
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mirror = (x) => 2 * CX - x;

// ---------------------------------------------------------------- table layout
const FLIPPER = { length: 1.45, r0: 0.26, r1: 0.13, rest: -0.5, up: 0.5, upSpeed: 24, downSpeed: 16, e: 0.3 };
export { FLIPPER };

function buildTable() {
  const walls = [];
  const add = (x1, y1, x2, y2, o = {}) => walls.push({ x1, y1, x2, y2, e: 0.45, kind: 'rail', ...o });
  // Outer frame
  add(0, -1.5, 0, 15, { kind: 'outer' });
  const ARC = 28;
  for (let i = 0; i < ARC; i++) {
    const a0 = Math.PI - (Math.PI * i) / ARC;
    const a1 = Math.PI - (Math.PI * (i + 1)) / ARC;
    add(5 + 5 * Math.cos(a0), 15 + 5 * Math.sin(a0), 5 + 5 * Math.cos(a1), 15 + 5 * Math.sin(a1), { kind: 'outer', arc: true });
  }
  add(10, 15, 10, -1.5, { kind: 'outer' });
  // Plunger lane
  add(LANE_X, -1.5, LANE_X, 13.8, { kind: 'laneWall' });
  add(LANE_X, 0.6, 10, 0.6, { kind: 'plunger', e: 0.1 });
  add(LANE_X, 13.8, 10, 15, { kind: 'gate', oneWay: true, e: 0.3 });
  // Outlane separators and inlane guides into the flippers
  for (const m of [false, true]) {
    const X = (x) => (m ? mirror(x) : x);
    add(X(0.75), 5.0, X(0.75), 3.3, { kind: 'rail' });
    add(X(0.75), 3.3, X(2.85), 2.2, { kind: 'rail' });
  }
  // Slingshots: triangle, the long face kicks
  const slings = [];
  for (const m of [false, true]) {
    const X = (x) => (m ? mirror(x) : x);
    const A = [X(1.55), 5.5];
    const B = [X(1.55), 3.85];
    const C = [X(2.55), 3.3];
    slings.push({ side: m ? 'R' : 'L', pts: [A, B, C] });
    // Faces in winding order so the kick face is A->C
    add(A[0], A[1], C[0], C[1], { kind: 'sling', sling: m ? 1 : 0, e: 0.5 });
    add(A[0], A[1], B[0], B[1], { kind: 'slingSide' });
    add(B[0], B[1], C[0], C[1], { kind: 'slingSide' });
  }
  // Left orbit inner wall, ramp walls (the ramp's right wall is the right orbit's inner wall)
  add(1.05, 11.0, 1.05, 14.4, { kind: 'rail' });
  add(7.3, 9.4, 7.3, 11.3, { kind: 'rail' });
  add(8.5, 9.4, 8.5, 14.4, { kind: 'rail' });
  add(7.3, 11.3, 8.5, 11.3, { kind: 'rampLip', e: 0.3 });
  // Right orbit exit deflector
  add(LANE_X, 7.2, 8.7, 6.2, { kind: 'rail' });
  // Diglett bank (the targets stand in front of it)
  add(0, 9.9, 0.3, 9.6, { kind: 'bank' });
  add(0.3, 9.6, 0.3, 6.9, { kind: 'bank' });
  add(0.3, 6.9, 0, 6.6, { kind: 'bank' });
  // Top lane separators
  const lanePosts = [2.95, 4.05, 5.15, 6.25];
  for (const x of lanePosts) add(x, 16.9, x, 17.7, { kind: 'post' });

  const bumpers = [
    { x: 3.4, y: 13.4, r: 0.6, kind: 'voltorb' },
    { x: 5.8, y: 13.4, r: 0.6, kind: 'voltorb' },
    { x: 4.6, y: 15.3, r: 0.6, kind: 'electrode' },
  ];
  const drops = [7.35, 8.2, 9.05].map((y) => ({ x: 0.62, y0: y - 0.36, y1: y + 0.36, y }));
  const lanes = [3.5, 4.6, 5.7].map((x) => ({ x, y: 17.3, r: 0.36 }));
  const inlanes = [
    { x: 1.15, y: 4.6, r: 0.33, side: 'L', kind: 'inlane' },
    { x: mirror(1.15), y: 4.6, r: 0.33, side: 'R', kind: 'inlane' },
    { x: 0.37, y: 4.2, r: 0.33, side: 'L', kind: 'outlane' },
    { x: mirror(0.37), y: 4.2, r: 0.33, side: 'R', kind: 'outlane' },
  ];
  const flippers = [
    { side: 'L', px: 2.85, py: 2.2 },
    { side: 'R', px: mirror(2.85), py: 2.2 },
  ];
  return {
    walls,
    slings,
    bumpers,
    drops,
    lanes,
    lanePosts,
    inlanes,
    flippers,
    posts: [{ x: 1.05, y: 14.6, r: 0.22, kind: 'psyduck' }],
    center: { x: CX, y: 10.4, r: 0.42 },
    wild: { x: CX, y: 10.4, r: 0.65 },
    hole: { x: CX, y: 7.7, r: 0.38 },
    kickback: { x: 0.37, y: 1.6, r: 0.36 },
    spinner: { y: 12.6, x0: 0, x1: 1.05 },
    orbitL: { y: 14.2, x0: 0, x1: 1.05 },
    orbitR: { y: 14.2, x0: 8.5, x1: LANE_X },
    rampIn: { y: 10.5, x0: 7.3, x1: 8.5, minSpeed: 4 },
    plunger: { x: (LANE_X + 10) / 2, y: 0.6 },
    spit: { x: 1.15, y: 5.95, vx: 0.2, vy: -3 },
    drain: -0.8,
  };
}

export const TABLE = buildTable();

/**
 * 3D path of the wire ramp (table x, table y, height above the playfield), from the entrance on
 * the right, up and over the top, down the left rail into Cloyster's shell.
 */
export const RAMP_PATH = [
  [7.9, 10.5, 0.05],
  [7.9, 12.5, 0.55],
  [7.85, 14.8, 1.05],
  [7.2, 17.3, 1.45],
  [5.6, 18.7, 1.65],
  [3.4, 18.6, 1.65],
  [1.4, 17.4, 1.55],
  [-0.35, 15.2, 1.4],
  [-0.45, 11.5, 1.2],
  [-0.4, 8.2, 1.0],
  [0.05, 6.55, 0.95],
];
export const CLOYSTER = { x: 0.2, y: 6.05, h: 0.6 };
export const RAMP_TIME = 1.5;
export const CLOYSTER_HOLD = 0.9;
export const HOLE_HOLD = 1.5;

// ---------------------------------------------------------------- state
function newFlipper(def) {
  return { ...def, a: FLIPPER.rest, w: 0, held: false };
}

export function createPinball({ random = Math.random } = {}) {
  return {
    random,
    t: 0,
    status: 'ready', // ready | play | over
    score: 0,
    ballNo: 1,
    mult: 1,
    balls: [],
    nextId: 1,
    flippers: TABLE.flippers.map(newFlipper),
    bumpers: TABLE.bumpers.map((b) => ({ ...b, flash: 0, hits: 0 })),
    slingFlash: [0, 0],
    drops: TABLE.drops.map((d) => ({ ...d, up: true, t: 0 })),
    dropReset: 0,
    dugtrio: 0,
    spinner: { angle: 0, w: 0, acc: 0, spins: 0 },
    lanes: [false, false, false],
    laneFlash: 0,
    inlaneLit: [false, false],
    kickback: true,
    saveLeft: 0,
    saveStarted: false,
    centerHits: 0,
    centerCool: 0,
    centerFlash: 0,
    holeOpen: false,
    catch: null,
    caught: [],
    ramps: 0,
    orbits: 0,
    multiball: false,
    lastShot: -99,
    combo: 0,
    bestCombo: 0,
    orbitArm: null,
    launchQueue: 0,
    autoLaunch: 0,
    pause: 0,
    pull: 0,
    stats: { bumpers: 0, drops: 0, spins: 0, ramps: 0, orbits: 0, saves: 0, kickbacks: 0, multiballs: 0, lanes: 0, catches: 0 },
    events: [],
  };
}

function spawnLaneBall(s) {
  const b = { id: s.nextId++, x: TABLE.plunger.x, y: TABLE.plunger.y + BALL_R + 0.001, vx: 0, vy: 0, mode: 'play', t: 0, inside: {}, inLane: true, still: 0, hit: 0 };
  s.balls.push(b);
  return b;
}

/** Puts a ball in play at (x, y) with velocity (vx, vy) (tests, demos). */
export function addBall(s, x, y, vx = 0, vy = 0) {
  const b = { id: s.nextId++, x, y, px: x, py: y, vx, vy, mode: 'play', t: 0, inside: {}, inLane: x > LANE_X, still: 0, hit: 0 };
  s.balls.push(b);
  return b;
}

/** Starts the game: the first ball waits on the plunger. */
export function startGame(s) {
  if (s.status !== 'ready') return;
  s.status = 'play';
  newBall(s);
}

function newBall(s) {
  s.balls = [];
  s.mult = 1;
  s.kickback = true;
  s.saveLeft = 0;
  s.saveStarted = false;
  s.multiball = false;
  s.inlaneLit = [false, false];
  s.combo = 0;
  spawnLaneBall(s);
  s.events.push({ type: 'newBall', ballNo: s.ballNo });
}

/** The ball resting on the plunger, if any. */
export function laneBall(s) {
  return s.balls.find((b) => b.mode === 'play' && b.x > LANE_X && b.y < 1.6 && Math.abs(b.vy) < 2.5) || null;
}

/** True when the player may pull the plunger. */
export const canLaunch = (s) => s.status === 'play' && s.autoLaunch <= 0 && !!laneBall(s);

/** Plunger pull for the visuals (0..1). */
export function setPull(s, p) {
  s.pull = clamp(p, 0, 1);
}

/** Releases the plunger: power 0..1. Returns true when a ball was shot. */
export function launch(s, power = 0.8) {
  const b = laneBall(s);
  if (!b || s.status !== 'play') return false;
  const p = clamp(power, 0, 1);
  b.vy = 16 + 16 * p;
  b.vx = 0;
  s.pull = 0;
  s.events.push({ type: 'launch', power: p });
  return true;
}

const add = (s, base) => {
  const v = base * s.mult;
  s.score += v;
  return v;
};
const ev = (s, type, extra = {}) => s.events.push({ type, ...extra });

// ---------------------------------------------------------------- collision helpers
const hit = { nx: 0, ny: 0, vn: 0 };

/** Pushes ball b out of a disc (cx, cy, rad) moving with velocity (sx, sy). Sets `hit`; returns true on contact. */
function contact(b, cx, cy, rad, e, sx = 0, sy = 0, fallbackNx = 0, fallbackNy = 1, friction = 0.03) {
  const dx = b.x - cx;
  const dy = b.y - cy;
  const R = rad + BALL_R;
  const d2 = dx * dx + dy * dy;
  if (d2 >= R * R) return false;
  const d = Math.sqrt(d2);
  let nx = fallbackNx;
  let ny = fallbackNy;
  if (d > 1e-7) {
    nx = dx / d;
    ny = dy / d;
  }
  b.x = cx + nx * R;
  b.y = cy + ny * R;
  const rvx = b.vx - sx;
  const rvy = b.vy - sy;
  const vn = rvx * nx + rvy * ny;
  hit.nx = nx;
  hit.ny = ny;
  hit.vn = 0;
  if (vn < 0) {
    const tx = -ny;
    const ty = nx;
    const vt = (rvx * tx + rvy * ty) * (1 - friction);
    const out = -vn * e;
    b.vx = sx + nx * out + tx * vt;
    b.vy = sy + ny * out + ty * vt;
    hit.vn = -vn;
  }
  return true;
}

function closest(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return [ax + dx * t, ay + dy * t, t];
}

function wallContact(b, w) {
  if (w.oneWay) {
    // Solid only from its left-hand side, and only for a ball moving into it
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const l = Math.hypot(dx, dy);
    const nx = -dy / l;
    const ny = dx / l;
    if ((b.x - w.x1) * nx + (b.y - w.y1) * ny < 0) return false;
    if (b.vx * nx + b.vy * ny > 0) return false;
  }
  const [cx, cy] = closest(b.x, b.y, w.x1, w.y1, w.x2, w.y2);
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const l = Math.hypot(dx, dy) || 1;
  return contact(b, cx, cy, 0, w.e, 0, 0, -dy / l, dx / l);
}

/** World angle, tip and angular velocity of a flipper. */
export function flipperPose(f) {
  const th = f.side === 'L' ? f.a : Math.PI - f.a;
  return { th, tx: f.px + Math.cos(th) * FLIPPER.length, ty: f.py + Math.sin(th) * FLIPPER.length, w: f.side === 'L' ? f.w : -f.w };
}

function flipperContact(b, f) {
  const p = flipperPose(f);
  const [cx, cy, t] = closest(b.x, b.y, f.px, f.py, p.tx, p.ty);
  const rad = FLIPPER.r0 + (FLIPPER.r1 - FLIPPER.r0) * t;
  // Surface velocity at the contact point (rigid rotation about the pivot)
  const rx = cx - f.px;
  const ry = cy - f.py;
  const sx = -p.w * ry;
  const sy = p.w * rx;
  const nx = -Math.sin(p.th);
  const ny = Math.cos(p.th);
  return contact(b, cx, cy, rad, FLIPPER.e, sx, sy, f.side === 'L' ? nx : -nx, f.side === 'L' ? ny : -ny, 0.02);
}

/** Line crossing between the previous and the current position: +1 upwards, -1 downwards. */
function crossed(b, line) {
  if (b.x < line.x0 || b.x > line.x1) return 0;
  if (b.py < line.y && b.y >= line.y) return 1;
  if (b.py >= line.y && b.y < line.y) return -1;
  return 0;
}

// ---------------------------------------------------------------- game rules
function shot(s, kind, x, y) {
  if (s.t - s.lastShot < 4) s.combo += 1;
  else s.combo = 1;
  s.lastShot = s.t;
  if (s.combo >= 2) {
    const v = add(s, POINTS.combo * s.combo);
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    ev(s, 'combo', { n: s.combo, points: v, x, y });
  }
  ev(s, kind === 'ramp' ? 'rampShot' : 'orbitShot', { x, y });
}

function startCatch(s) {
  const left = WILD.filter((w) => !s.caught.includes(w.id));
  const pool = left.length ? left : WILD;
  const mon = pool[Math.floor(s.random() * pool.length) % pool.length];
  s.catch = { mon, hits: 0, timeLeft: CATCH_TIME, cool: 0, state: 'wild', anim: 0 };
  s.holeOpen = false;
  ev(s, 'catchStart', { mon });
  ev(s, 'banner', { text: `${mon.name} hoang dã xuất hiện!`, kind: 'catch' });
}

function endCatch(s, ok) {
  const c = s.catch;
  if (!c || c.state !== 'wild') return;
  if (ok) {
    c.state = 'caught';
    c.anim = 2.8;
    s.caught.push(c.mon.id);
    s.stats.catches += 1;
    const v = add(s, POINTS.caught);
    ev(s, 'caught', { mon: c.mon, points: v });
    ev(s, 'banner', { text: `Bắt được ${c.mon.name}!`, kind: 'caught' });
  } else {
    c.state = 'fled';
    c.anim = 1.2;
    ev(s, 'catchFail', { mon: c.mon });
  }
  s.centerHits = 0;
}

function startMultiball(s) {
  s.multiball = true;
  s.stats.multiballs += 1;
  s.launchQueue += 1;
  s.saveLeft = Math.max(s.saveLeft, 8);
  ev(s, 'multiball');
  ev(s, 'banner', { text: 'MULTIBALL!', kind: 'multi' });
}

function onBallSensors(s, b) {
  // Rollover circles (enter only)
  const enter = (key, x, y, r) => {
    const inside = (b.x - x) ** 2 + (b.y - y) ** 2 < r * r;
    const was = !!b.inside[key];
    b.inside[key] = inside;
    return inside && !was;
  };
  TABLE.lanes.forEach((l, i) => {
    if (enter(`lane${i}`, l.x, l.y, l.r)) {
      if (!s.lanes[i]) {
        s.lanes[i] = true;
        add(s, POINTS.lane);
        ev(s, 'lane', { i, x: l.x, y: l.y });
        if (s.lanes.every(Boolean)) {
          s.lanes = [false, false, false];
          s.laneFlash = 1.2;
          s.stats.lanes += 1;
          const v = add(s, POINTS.lanesDone);
          if (s.mult < MAX_MULT) s.mult += 1;
          ev(s, 'mult', { mult: s.mult, points: v });
          ev(s, 'banner', { text: `ĐIỂM x${s.mult}!`, kind: 'mult' });
        }
      } else {
        add(s, 50);
        ev(s, 'laneAgain', { i });
      }
    }
  });
  TABLE.inlanes.forEach((l, i) => {
    if (!enter(`in${i}`, l.x, l.y, l.r)) return;
    if (l.kind === 'inlane') {
      add(s, POINTS.inlane);
      const k = l.side === 'L' ? 0 : 1;
      s.inlaneLit[k] = true;
      ev(s, 'inlane', { side: l.side });
      if (s.inlaneLit[0] && s.inlaneLit[1]) {
        s.inlaneLit = [false, false];
        if (!s.kickback) {
          s.kickback = true;
          ev(s, 'kickbackLit');
        }
      }
    } else {
      add(s, POINTS.outlane);
      ev(s, 'outlane', { side: l.side });
    }
  });
  const kb = TABLE.kickback;
  if (enter('kick', kb.x, kb.y, kb.r) && s.kickback && b.vy < 0) {
    s.kickback = false;
    b.vx = 0.4;
    b.vy = 24;
    s.stats.kickbacks += 1;
    add(s, POINTS.kickback);
    ev(s, 'kickback', { x: kb.x, y: kb.y });
    ev(s, 'banner', { text: 'KICKBACK!', kind: 'save' });
  }
  // Spinner
  if (crossed(b, TABLE.spinner)) {
    s.spinner.w = Math.max(s.spinner.w, Math.min(60, Math.abs(b.vy) * 3.2)) * (b.vy >= 0 ? 1 : 1);
    s.spinner.dir = b.vy >= 0 ? 1 : -1;
    ev(s, 'spinner', { speed: Math.abs(b.vy) });
  }
  // Orbits: up one side, down the other
  const ol = crossed(b, TABLE.orbitL);
  const or = crossed(b, TABLE.orbitR);
  if (ol > 0) s.orbitArm = { side: 'L', t: s.t };
  else if (or > 0) s.orbitArm = { side: 'R', t: s.t };
  else if ((ol < 0 && s.orbitArm?.side === 'R') || (or < 0 && s.orbitArm?.side === 'L')) {
    if (s.t - s.orbitArm.t < 3) {
      s.orbits += 1;
      s.stats.orbits += 1;
      const v = add(s, POINTS.orbit);
      ev(s, 'orbit', { points: v, x: b.x, y: b.y });
      shot(s, 'orbit', b.x, b.y);
    }
    s.orbitArm = null;
  }
  // Ramp entrance
  const ri = TABLE.rampIn;
  if (crossed(b, ri) > 0 && b.vy >= ri.minSpeed) {
    b.mode = 'ramp';
    b.t = 0;
    b.vx = 0;
    b.vy = 0;
    ev(s, 'rampEnter');
  }
  // Catch hole
  const h = TABLE.hole;
  if (s.holeOpen && !s.catch && b.mode === 'play' && (b.x - h.x) ** 2 + (b.y - h.y) ** 2 < (h.r - 0.05) ** 2) {
    b.mode = 'hole';
    b.t = 0;
    b.x = h.x;
    b.y = h.y;
    b.vx = 0;
    b.vy = 0;
    add(s, POINTS.hole);
    ev(s, 'hole', { x: h.x, y: h.y });
    startCatch(s);
  }
}

function collideBall(s, b) {
  const T = TABLE;
  for (let it = 0; it < 2; it++) {
    for (const w of T.walls) {
      if (!wallContact(b, w)) continue;
      if (w.kind === 'sling' && hit.vn > 0.8 && hit.nx * (w.sling ? -1 : 1) > 0) {
        b.vx += hit.nx * 8.5;
        b.vy += hit.ny * 8.5;
        s.slingFlash[w.sling] = 0.25;
        add(s, POINTS.sling);
        ev(s, 'sling', { side: w.sling ? 'R' : 'L', x: b.x, y: b.y });
      } else if (hit.vn > 3 && it === 0) ev(s, 'wall', { speed: hit.vn });
    }
    for (const p of T.posts) if (contact(b, p.x, p.y, p.r, 0.5) && hit.vn > 2 && it === 0) ev(s, 'post', { kind: p.kind });
    // Pop bumpers
    s.bumpers.forEach((bp, i) => {
      if (!contact(b, bp.x, bp.y, bp.r, 0.4)) return;
      const vn = b.vx * hit.nx + b.vy * hit.ny;
      const kick = 11;
      b.vx += hit.nx * (kick - Math.min(vn, kick * 0.5));
      b.vy += hit.ny * (kick - Math.min(vn, kick * 0.5));
      if (bp.flash < 0.12) {
        bp.flash = 0.3;
        bp.hits += 1;
        s.stats.bumpers += 1;
        const v = add(s, POINTS.bumper * (bp.kind === 'electrode' ? 2 : 1));
        ev(s, 'bumper', { i, kind: bp.kind, x: bp.x, y: bp.y, points: v });
      }
    });
    // Diglett drop targets
    s.drops.forEach((d, i) => {
      if (!d.up) return;
      if (!wallContact(b, { x1: d.x, y1: d.y0, x2: d.x, y2: d.y1, e: 0.35 })) return;
      if (hit.vn > 1.2 && hit.nx > 0) {
        d.up = false;
        d.t = 0;
        s.stats.drops += 1;
        const v = add(s, POINTS.drop);
        ev(s, 'drop', { i, x: d.x, y: d.y, points: v });
        if (s.drops.every((x) => !x.up)) {
          const vb = add(s, POINTS.dugtrio);
          s.dugtrio = 2.2;
          s.dropReset = 2.2;
          ev(s, 'dugtrio', { points: vb });
          ev(s, 'banner', { text: 'DUGTRIO!', kind: 'dugtrio' });
        }
      }
    });
    // Centre target / the wild Pokémon
    const c = s.catch;
    if (c && c.state === 'wild') {
      const wd = T.wild;
      if (contact(b, wd.x, wd.y, wd.r, 0.5)) {
        b.vx += hit.nx * 6;
        b.vy += hit.ny * 6;
        if (c.cool <= 0) {
          c.cool = 0.4;
          c.hits += 1;
          c.flash = 0.4;
          const v = add(s, POINTS.catchHit);
          ev(s, 'catchHit', { hits: c.hits, mon: c.mon, points: v, x: wd.x, y: wd.y });
          if (c.hits >= CATCH_HITS) endCatch(s, true);
        }
      }
    } else if (!c) {
      const ct = T.center;
      if (contact(b, ct.x, ct.y, ct.r, 0.55) && hit.vn > 1.5 && s.centerCool <= 0) {
        s.centerCool = 0.35;
        s.centerFlash = 0.4;
        if (!s.holeOpen) {
          s.centerHits += 1;
          const v = add(s, POINTS.center);
          ev(s, 'center', { hits: s.centerHits, points: v, x: ct.x, y: ct.y });
          if (s.centerHits >= CENTER_HITS) {
            s.holeOpen = true;
            ev(s, 'holeOpen');
            ev(s, 'banner', { text: 'LỖ BẮT POKÉMON MỞ!', kind: 'catch' });
          }
        } else add(s, 100);
      }
    }
    for (const f of s.flippers) {
      if (flipperContact(b, f) && hit.vn > 2 && it === 0) ev(s, 'flipHit', { side: f.side, speed: hit.vn });
    }
  }
}

function collideBalls(s) {
  const list = s.balls;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.mode !== 'play') continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.mode !== 'play') continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const R = BALL_R * 2;
      if (d2 >= R * R || d2 < 1e-10) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const push = (R - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const j2 = -vn * 0.95;
        a.vx -= nx * j2;
        a.vy -= ny * j2;
        b.vx += nx * j2;
        b.vy += ny * j2;
      }
    }
  }
}

function drainBall(s, b) {
  s.balls = s.balls.filter((x) => x !== b);
  if (s.saveLeft > 0) {
    s.stats.saves += 1;
    s.launchQueue += 1;
    ev(s, 'save');
    ev(s, 'banner', { text: 'CỨU BÓNG!', kind: 'save' });
    return;
  }
  if (s.balls.length > 0 || s.launchQueue > 0) {
    if (s.multiball && s.balls.length + s.launchQueue === 1) {
      s.multiball = false;
      ev(s, 'multiballEnd');
    }
    return;
  }
  // Ball lost
  if (s.catch && s.catch.state === 'wild') endCatch(s, false);
  ev(s, 'drain', { ballNo: s.ballNo });
  s.pause = 1.8;
}

function rampProgress(s, b, dt) {
  b.t += dt;
  if (b.mode === 'ramp' && b.t >= RAMP_TIME) {
    b.mode = 'cloyster';
    b.t = 0;
    s.ramps += 1;
    s.stats.ramps += 1;
    const v = add(s, s.multiball ? POINTS.jackpot : POINTS.ramp);
    ev(s, 'ramp', { n: s.ramps, points: v, jackpot: s.multiball });
    ev(s, 'cloysterEat');
    if (s.multiball) ev(s, 'banner', { text: 'JACKPOT!', kind: 'jackpot' });
    shot(s, 'ramp', CLOYSTER.x, CLOYSTER.y);
    if (!s.multiball && s.ramps % 3 === 0) startMultiball(s);
  } else if (b.mode === 'cloyster' && b.t >= CLOYSTER_HOLD) {
    const sp = TABLE.spit;
    b.mode = 'play';
    b.x = sp.x;
    b.y = sp.y;
    b.vx = sp.vx;
    b.vy = sp.vy;
    b.px = b.x;
    b.py = b.y;
    b.inside = {};
    ev(s, 'cloysterSpit', { x: sp.x, y: sp.y, id: b.id });
  } else if (b.mode === 'hole' && b.t >= HOLE_HOLD) {
    b.mode = 'play';
    const dir = s.random() < 0.5 ? -1 : 1;
    b.vx = dir * 6.5;
    b.vy = 5;
    b.x = TABLE.hole.x + dir * 0.05;
    b.px = b.x;
    b.py = b.y;
    ev(s, 'holeEject', { x: b.x, y: b.y });
  }
}

function timers(s, dt) {
  for (const bp of s.bumpers) bp.flash = Math.max(0, bp.flash - dt);
  s.slingFlash = s.slingFlash.map((v) => Math.max(0, v - dt));
  s.centerCool = Math.max(0, s.centerCool - dt);
  s.centerFlash = Math.max(0, s.centerFlash - dt);
  s.laneFlash = Math.max(0, s.laneFlash - dt);
  s.dugtrio = Math.max(0, s.dugtrio - dt);
  for (const d of s.drops) d.t += dt;
  if (s.dropReset > 0) {
    s.dropReset -= dt;
    if (s.dropReset <= 0) {
      for (const d of s.drops) {
        d.up = true;
        d.t = 0;
      }
      ev(s, 'dropReset');
    }
  }
  const inField = s.balls.some((b) => b.mode !== 'play' || b.x < LANE_X);
  if (s.saveLeft > 0 && inField) s.saveLeft = Math.max(0, s.saveLeft - dt);
  const c = s.catch;
  if (c) {
    c.cool = Math.max(0, c.cool - dt);
    c.flash = Math.max(0, (c.flash || 0) - dt);
    if (c.state === 'wild') {
      c.timeLeft -= dt;
      if (c.timeLeft <= 0) endCatch(s, false);
    } else {
      c.anim -= dt;
      if (c.anim <= 0) s.catch = null;
    }
  }
  // Spinner: spins down, one spin every half turn
  const sp = s.spinner;
  if (sp.w > 0) {
    const da = sp.w * dt;
    sp.angle += da * (sp.dir || 1);
    sp.acc += da;
    while (sp.acc >= Math.PI) {
      sp.acc -= Math.PI;
      sp.spins += 1;
      s.stats.spins += 1;
      add(s, POINTS.spin);
      ev(s, 'spin', { n: sp.spins });
    }
    sp.w = Math.max(0, sp.w - dt * (6 + sp.w * 0.9));
  }
  // Automatic plunges (ball save, multiball)
  if (s.launchQueue > 0 && !s.balls.some((b) => b.mode === 'play' && b.x > LANE_X && b.y < 3)) {
    s.launchQueue -= 1;
    spawnLaneBall(s);
    s.autoLaunch = 0.7;
  }
  if (s.autoLaunch > 0) {
    s.autoLaunch -= dt;
    if (s.autoLaunch <= 0) {
      s.autoLaunch = 0;
      launch(s, 0.82);
    }
  }
}

/** Advances the game by dt (call with DT). input = { left, right } flipper buttons. */
export function step(s, dt = DT, input = {}) {
  if (s.status !== 'play') return;
  s.t += dt;
  if (s.pause > 0) {
    s.pause -= dt;
    if (s.pause <= 0) {
      s.pause = 0;
      if (s.ballNo >= BALLS) {
        s.status = 'over';
        ev(s, 'over', { score: s.score });
        return;
      }
      s.ballNo += 1;
      newBall(s);
    }
  }
  // Flipper buttons
  const want = [!!input.left, !!input.right];
  s.flippers.forEach((f, i) => {
    if (want[i] && !f.held) ev(s, 'flip', { side: f.side });
    f.held = want[i];
  });
  timers(s, dt);
  for (const b of s.balls) if (b.mode !== 'play') rampProgress(s, b, dt);

  // Substeps: the fastest relative movement stays under SUB_MAX
  let vmax = 0;
  for (const b of s.balls) if (b.mode === 'play') vmax = Math.max(vmax, Math.hypot(b.vx, b.vy));
  const tip = Math.max(FLIPPER.upSpeed, FLIPPER.downSpeed) * (FLIPPER.length + FLIPPER.r0);
  const moving = s.flippers.some((f) => (f.held ? f.a < FLIPPER.up : f.a > FLIPPER.rest));
  const rel = vmax + (moving ? tip : 0);
  const n = Math.min(24, Math.max(1, Math.ceil((rel * dt) / SUB_MAX)));
  const h = dt / n;
  for (let k = 0; k < n; k++) {
    for (const f of s.flippers) {
      if (f.held) f.w = f.a < FLIPPER.up ? FLIPPER.upSpeed : 0;
      else f.w = f.a > FLIPPER.rest ? -FLIPPER.downSpeed : 0;
      f.a += f.w * h;
      if (f.a >= FLIPPER.up) f.a = FLIPPER.up;
      if (f.a <= FLIPPER.rest) f.a = FLIPPER.rest;
    }
    for (const b of s.balls) {
      if (b.mode !== 'play') continue;
      b.vy -= GRAVITY * h;
      const damp = 1 - 0.06 * h;
      b.vx *= damp;
      b.vy *= damp;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_SPEED) {
        b.vx *= MAX_SPEED / sp;
        b.vy *= MAX_SPEED / sp;
      }
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * h;
      b.y += b.vy * h;
      collideBall(s, b);
      onBallSensors(s, b);
      if (b.inLane && b.x < LANE_X - 0.05) {
        b.inLane = false;
        if (!s.saveStarted) {
          s.saveStarted = true;
          s.saveLeft = SAVE_TIME;
        }
      } else if (b.x > LANE_X) b.inLane = true;
    }
    if (s.balls.length > 1) collideBalls(s);
  }
  // After the substeps: drains and stuck balls
  for (const b of [...s.balls]) {
    if (b.mode !== 'play') continue;
    if (b.y < TABLE.drain) {
      drainBall(s, b);
      continue;
    }
    const slow = Math.hypot(b.vx, b.vy) < 0.25 && !(b.x > LANE_X && b.y < 1.6);
    b.still = slow ? b.still + dt : 0;
    const cradled = s.flippers.some((f) => f.held) && b.y < 3.5;
    if (b.still > 4 && !cradled) {
      b.still = 0;
      b.vx += (s.random() - 0.5) * 6;
      b.vy += 4;
      ev(s, 'nudge');
    }
  }
}

/** The plain numbers the HUD shows. */
export function snap(s) {
  const c = s.catch;
  return {
    status: s.status,
    score: s.score,
    ballNo: s.ballNo,
    ballsLeft: Math.max(0, BALLS - s.ballNo),
    mult: s.mult,
    save: Math.ceil(s.saveLeft),
    kickback: s.kickback,
    centerHits: s.centerHits,
    holeOpen: s.holeOpen,
    lanes: [...s.lanes],
    catch: c ? { id: c.mon.id, name: c.mon.name, hits: c.hits, timeLeft: Math.ceil(Math.max(0, c.timeLeft)), state: c.state } : null,
    caught: [...s.caught],
    multiball: s.multiball,
    ready: canLaunch(s),
    combo: s.combo,
    balls: s.balls.length,
  };
}

export const starsForScore = (score) => (score >= STAR3 ? 3 : score >= STAR2 ? 2 : 1);
/** Gold for a finished game: by stars, plus 2 per Pokémon caught (max 30). */
export const goldForGame = (stars, caught = 0) => Math.min(30, Math.max(1, stars) * 5 + 2 * Math.max(0, caught));

// ---------------------------------------------------------------- bot (tests and demos)
/**
 * A simple flipper player: flips when a ball is about to touch the outer part of a flipper.
 * `skill` 0..1: a weaker player reacts at a random moment (sometimes too early or too late).
 * Returns { left, right }.
 */
export function botInput(s, mem = {}, skill = 1) {
  const out = { left: false, right: false };
  s.flippers.forEach((f, i) => {
    const key = i ? 'right' : 'left';
    if (mem[i] > 0) {
      mem[i] -= DT;
      out[key] = true;
      return;
    }
    const pose = flipperPose({ ...f, a: FLIPPER.rest });
    for (const b of s.balls) {
      if (b.mode !== 'play' || b.x > LANE_X || b.vy > 0.5) continue;
      const lead = 0.035 + (1 - skill) * (s.random() - 0.5) * 0.12;
      const x = b.x + b.vx * lead;
      const y = b.y + b.vy * lead;
      const [cx, cy, t] = closest(x, y, f.px, f.py, pose.tx, pose.ty);
      const d = Math.hypot(x - cx, y - cy);
      if (t > 0.25 && d < FLIPPER.r0 + BALL_R + 0.2 && y > cy - 0.1) {
        mem[i] = 0.22;
        out[key] = true;
        break;
      }
    }
  });
  return out;
}

/** Plays a whole game with the bot (or idle when skill < 0). Returns the final state. */
export function simulate({ random = Math.random, skill = 1, maxTime = 900, idle = false } = {}) {
  const s = createPinball({ random });
  startGame(s);
  const mem = {};
  let launchIn = 0.5;
  while (s.status === 'play' && s.t < maxTime) {
    if (canLaunch(s)) {
      launchIn -= DT;
      if (launchIn <= 0) {
        launch(s, 0.55 + random() * 0.45);
        launchIn = 0.5;
      }
    }
    step(s, DT, idle ? {} : botInput(s, mem, skill));
    s.events.length = 0;
  }
  return s;
}
