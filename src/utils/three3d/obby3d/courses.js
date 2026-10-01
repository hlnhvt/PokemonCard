// Five obstacle courses for "Vượt chướng ngại Pokémon", built from reusable sections.
// The course runs from z = 0 towards -z; x is left/right, y up. Platform tops sit at the builder's y.
import { updatePose, savePose } from './physics';

/**
 * Courses: id, name, icon, theme, ai = { speed: [min, max] of top speed, mistake: chance to fumble a
 * jump, react: chance to hop over a sweeper in time }, build(builder).
 */
export const COURSES = [
  {
    id: 1,
    name: 'Đồi kẹo ngọt',
    icon: '🍭',
    theme: 'candy',
    tip: 'Chạy, nhảy qua khe hở và nảy trên nấm kẹo!',
    ai: { speed: [0.74, 0.86], mistake: 0.22, react: 0.55 },
    build(b) {
      b.start();
      b.run(14);
      b.gaps(3, 2.2, 8);
      b.run(10, { checkpoint: true });
      b.pads(2);
      b.run(12, { checkpoint: true });
      b.sweeper({ r: 9, speed: 0.85, arms: 1 });
      b.run(10, { checkpoint: true });
      b.conveyor(28, { speed: 1.8 });
      b.seesaws(2);
      b.run(10, { checkpoint: true });
      b.pads(3);
      b.run(10);
      b.gaps(2, 2.4, 7);
      b.run(8, { checkpoint: true });
      b.sweeper({ r: 8, speed: 0.7, arms: 2 });
      b.run(8);
      b.steps(4);
      b.finish();
    },
  },
  {
    id: 2,
    name: 'Lâu đài Diglett',
    icon: '🏰',
    theme: 'castle',
    tip: 'Có cửa vỡ được, có cửa cứng! Thử cửa khác nếu bị chặn nhé.',
    ai: { speed: [0.78, 0.9], mistake: 0.18, react: 0.6 },
    build(b) {
      b.start();
      b.run(12);
      b.doors(5);
      b.run(10);
      b.doors(5);
      b.run(10, { checkpoint: true });
      b.hammers(3, { w: 6.5 });
      b.run(10, { checkpoint: true });
      b.spinners(3);
      b.run(10, { checkpoint: true });
      b.sweeper({ r: 9.5, speed: 1.0, arms: 2 });
      b.run(10);
      b.doors(6);
      b.run(10, { checkpoint: true });
      b.gaps(3, 2.6, 7);
      b.run(10, { checkpoint: true });
      b.pads(2);
      b.run(10);
      b.hammers(2, { w: 7 });
      b.run(8, { checkpoint: true });
      b.doors(4);
      b.run(6);
      b.finish();
    },
  },
  {
    id: 3,
    name: 'Cầu cầu vồng',
    icon: '🌈',
    theme: 'rainbow',
    tip: 'Đợi bục di chuyển tới gần rồi hãy nhảy. Ô tổ ong sẽ rơi đấy!',
    ai: { speed: [0.8, 0.92], mistake: 0.16, react: 0.65 },
    build(b) {
      b.start();
      b.run(10);
      b.movers(3);
      b.run(10, { checkpoint: true });
      b.honey(6);
      b.run(10, { checkpoint: true });
      b.pads(3);
      b.run(10);
      b.spinners(3, { speed: 0.75 });
      b.run(10, { checkpoint: true });
      b.hammers(2, { w: 5.5 });
      b.run(10, { checkpoint: true });
      b.gaps(2, 2.6, 7);
      b.gaps(1, 6.3, 8, { dive: true });
      b.run(10, { checkpoint: true });
      b.seesaws(2);
      b.run(8);
      b.honey(5);
      b.run(6);
      b.finish();
    },
  },
  {
    id: 4,
    name: 'Nhà máy Magnemite',
    icon: '🧲',
    theme: 'factory',
    tip: 'Băng chuyền kéo lùi, cửa trượt qua lại – canh khe hở mà chạy!',
    ai: { speed: [0.82, 0.94], mistake: 0.14, react: 0.7 },
    build(b) {
      b.start();
      b.run(10);
      b.conveyor(30, { speed: 2, sweeper: true });
      b.run(10, { checkpoint: true });
      b.gates(3);
      b.run(10, { checkpoint: true });
      b.seesaws(3);
      b.run(10, { checkpoint: true });
      b.honey(5);
      b.run(10, { checkpoint: true });
      b.hammers(3, { w: 6 });
      b.run(8);
      b.movers(2, { speed: 1.15 });
      b.run(10, { checkpoint: true });
      b.sweeper({ r: 9, speed: 1.0, arms: 2 });
      b.run(8);
      b.conveyor(26, { speed: 3 });
      b.finish();
    },
  },
  {
    id: 5,
    name: 'Núi Voltorb lăn',
    icon: '⚡',
    theme: 'mountain',
    tip: 'Voltorb lăn xuống dốc – chạy né sang bên nhé!',
    ai: { speed: [0.84, 0.96], mistake: 0.12, react: 0.72 },
    build(b) {
      b.start();
      b.run(10);
      b.slope(40, 7, { every: 1.5 });
      b.run(10, { checkpoint: true });
      b.pendulums(3);
      b.run(10, { checkpoint: true });
      b.doors(5);
      b.run(8);
      b.doors(6);
      b.run(10, { checkpoint: true });
      b.slope(46, 9, { every: 1.2 });
      b.run(10, { checkpoint: true });
      b.honey(5);
      b.run(10, { checkpoint: true });
      b.spinners(2, { speed: 0.9 });
      b.run(8);
      b.gaps(2, 2.6, 7);
      b.run(8, { checkpoint: true });
      b.slope(28, 5, { every: 1.4 });
      b.finish();
    },
  },
];

export const THEMES = {
  candy: { colors: ['#ff8fc7', '#ffd166', '#7ee0c3', '#a0c4ff', '#ffadad', '#caffbf'], accent: '#ff5fa2', sky: ['#ffd6ec', '#9fd8ff'], fog: '#ffe3f1', void: '#ffc4e1' },
  castle: { colors: ['#c4b5fd', '#f9a8d4', '#fcd34d', '#93c5fd', '#a7f3d0'], accent: '#a16207', sky: ['#c7b8ff', '#ffd9a8'], fog: '#e9ddff', void: '#a78bfa', stone: '#b9a6d8' },
  rainbow: { colors: ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'], accent: '#ffffff', sky: ['#a5d8ff', '#ffe8f4'], fog: '#e7f5ff', void: '#d0ebff' },
  factory: { colors: ['#94d2ff', '#ffd166', '#b8c0cc', '#ff9f6e', '#9be7c4'], accent: '#ffcc33', sky: ['#bde0fe', '#ffe5b4'], fog: '#dbe7f3', void: '#8aa1b9', metal: '#c9d3df' },
  mountain: { colors: ['#ffd8a8', '#b2f2bb', '#ffc9c9', '#a5d8ff', '#fff3bf'], accent: '#e8590c', sky: ['#8ecbff', '#fff1d6'], fog: '#e3f0ff', void: '#9ad0ff', rock: '#c8a27a' },
};

const TAU = Math.PI * 2;

/** Builds the colliders, obstacles, waypoints and checkpoints of one course. */
export class CourseBuilder {
  constructor(theme, random) {
    this.theme = THEMES[theme] ? theme : 'candy';
    this.palette = THEMES[this.theme];
    this.random = random;
    this.colliders = [];
    this.obstacles = [];
    this.waypoints = [];
    this.checkpoints = [];
    this.decor = []; // { type, x, y, z, ... } scenery hints for the 3D scene
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.ci = 0;
    this.minY = 0;
  }

  color() {
    const c = this.palette.colors[this.ci % this.palette.colors.length];
    this.ci += 1;
    return c;
  }

  add(c) {
    c.id = this.colliders.length;
    c.active = c.active ?? true;
    c.yaw = c.yaw || 0;
    c.pitch = c.pitch || 0;
    c.roll = c.roll || 0;
    updatePose(c);
    savePose(c);
    this.colliders.push(c);
    this.minY = Math.min(this.minY, c.y - (c.hy || 0));
    return c;
  }

  /** Box from z0 to z1 (z1 < z0), top at `top`. */
  slab(z0, z1, w, { x = this.x, top = this.y, thick = 1, color = this.color(), role = 'platform', ...rest } = {}) {
    return this.add({ kind: 'box', x, y: top - thick / 2, z: (z0 + z1) / 2, hx: w / 2, hy: thick / 2, hz: Math.abs(z0 - z1) / 2, role, color, ...rest });
  }

  wp(x, z, opts = {}) {
    this.waypoints.push({ x, z, y: this.y, w: 0, sec: this.sec, ...opts });
  }

  checkpoint() {
    this.checkpoints.push({ x: this.x, y: this.y, z: this.z - 3, wp: this.waypoints.length });
    this.decor.push({ type: 'flag', x: this.x, y: this.y, z: this.z - 1, w: 12, index: this.checkpoints.length - 1 });
  }

  start() {
    const w = 16;
    this.slab(6, -22, w, { color: this.palette.colors[0], role: 'start' });
    this.checkpoints.push({ x: 0, y: 0, z: -4, wp: 0 });
    this.decor.push({ type: 'startArch', x: 0, y: 0, z: -12, w });
    this.z = -22;
    this.wp(0, -20, { w: 5 });
  }

  run(len, { w = 12, checkpoint = false } = {}) {
    const z0 = this.z;
    this.slab(z0, z0 - len, w);
    if (checkpoint) this.checkpoint();
    this.z -= len;
    this.wp(this.x, this.z + Math.min(3, len / 3), { w: w * 0.3 });
    this.decor.push({ type: 'side', x: this.x, y: this.y, z: z0 - len / 2, len, w });
  }

  gaps(n, gap, len, { w = 10, dive = false } = {}) {
    for (let i = 0; i < n; i++) {
      this.wp(this.x, this.z + 0.9, { w: w * 0.25, act: dive ? 'dive' : 'jump' });
      this.z -= gap;
      this.slab(this.z, this.z - len, w);
      this.wp(this.x, this.z - 2.5, { w: w * 0.25 });
      this.z -= len;
    }
  }

  steps(n, { w = 10, rise = 0.85, len = 4.5 } = {}) {
    for (let i = 0; i < n; i++) {
      this.wp(this.x, this.z + 0.9, { w: w * 0.25, act: 'jump' });
      this.y += rise;
      this.slab(this.z, this.z - len, w, { thick: 1 + this.y });
      this.z -= len;
    }
  }

  /** Mushroom bounce pads over a gap below the floor. */
  pads(n, { w = 10 } = {}) {
    const padY = this.y - 1.6;
    let zc = this.z - 3.6;
    for (let i = 0; i < n; i++) {
      const pad = this.add({ kind: 'cyl', x: this.x, y: padY - 0.4, z: zc, r: 1.9, hy: 0.4, role: 'pad', color: this.palette.accent, bounce: 14.5, push: 7.2 });
      this.obstacles.push({ type: 'pad', collider: pad, squish: 0 });
      this.wp(this.x, zc + 0.6, { w: 0, pad: true });
      if (i < n - 1) zc -= 8.2;
    }
    this.z = zc - 4;
    this.slab(this.z, this.z - 6, w);
    this.wp(this.x, this.z - 3, { w: 1.5 });
    this.z -= 6;
  }

  /** Round platform with a rotating low bar (jump it!) and a centre pillar. */
  sweeper({ r = 9, speed = 1, arms = 1 } = {}) {
    const zc = this.z - r + 0.5;
    this.add({ kind: 'cyl', x: this.x, y: this.y - 0.5, z: zc, r, hy: 0.5, role: 'disc', color: this.color() });
    this.add({ kind: 'cyl', x: this.x, y: this.y + 0.8, z: zc, r: 0.9, hy: 0.8, role: 'pillar', color: this.palette.accent });
    const dir = this.random() < 0.5 ? 1 : -1;
    this.obstacles.push({ type: 'sweeper', x: this.x, y: this.y + 0.55, z: zc, len: r - 0.3, r: 0.36, w: speed * dir, arms, angle: this.random() * TAU, low: true });
    this.wp(this.x + 3, zc + 2, { w: 1.5 });
    this.wp(this.x + 3, zc - 2, { w: 1.5 });
    this.z = zc - r + 0.5;
    this.wp(this.x, this.z + 1, { w: 2 });
  }

  /** Spinning discs with small gaps. */
  spinners(n, { r = 5, gap = 1.8, speed = 0.6 } = {}) {
    for (let i = 0; i < n; i++) {
      this.wp(this.x, this.z + 0.9, { w: 0.6, act: 'jump' });
      const zc = this.z - gap - r;
      const w = speed * (i % 2 ? -1 : 1);
      this.add({ kind: 'cyl', x: this.x, y: this.y - 0.5, z: zc, r, hy: 0.5, role: 'spinner', color: this.color(), motion: { type: 'spin', w } });
      this.wp(this.x, zc, { w: 0.5 });
      this.z = zc - r;
    }
    this.wp(this.x, this.z + 0.9, { w: 0.6, act: 'jump' });
    this.z -= gap;
    this.slab(this.z, this.z - 6, 12);
    this.z -= 6;
  }

  /** Seesaws that tip under the racers (roll about the running direction). */
  seesaws(n, { len = 9, w = 7, gap = 1.6 } = {}) {
    for (let i = 0; i < n; i++) {
      this.wp(this.x, this.z + 0.9, { w: 0.6, act: 'jump' });
      this.z -= gap;
      const c = this.add({ kind: 'box', x: this.x + (i % 2 ? 1.2 : -1.2), y: this.y - 0.4, z: this.z - len / 2, hx: w / 2, hy: 0.4, hz: len / 2, role: 'seesaw', color: this.color(), motion: { type: 'seesaw' }, slide: true });
      this.obstacles.push({ type: 'seesaw', collider: c, angle: 0, av: 0 });
      this.wp(c.x, this.z - len / 2, { w: 1.2 });
      this.z -= len;
      this.decor.push({ type: 'pivot', x: c.x, y: this.y - 0.8, z: c.z, len });
    }
    this.wp(this.x, this.z + 0.9, { w: 0.6, act: 'jump' });
    this.z -= gap;
    this.slab(this.z, this.z - 6, 12);
    this.z -= 6;
  }

  /** Belt that pulls racers backwards (+z), with an optional sweeper on it. */
  conveyor(len, { w = 10, speed = 2, sweeper = false } = {}) {
    const z0 = this.z;
    this.slab(z0, z0 - len, w, { role: 'conveyor', belt: { x: 0, z: speed }, color: '#5b6b7f' });
    if (sweeper) {
      const zc = z0 - len / 2;
      this.add({ kind: 'cyl', x: this.x, y: this.y + 0.8, z: zc, r: 0.8, hy: 0.8, role: 'pillar', color: this.palette.accent });
      this.obstacles.push({ type: 'sweeper', x: this.x, y: this.y + 0.55, z: zc, len: w / 2 - 0.2, r: 0.36, w: 0.9, arms: 2, angle: 0.4, low: true });
    }
    // side rails so the belt is not a cliff
    for (const s of [-1, 1]) this.slab(z0, z0 - len, 0.6, { x: this.x + s * (w / 2 + 0.3), top: this.y + 1.3, thick: 2.3, role: 'rail', color: this.palette.accent });
    this.z -= len;
    this.wp(this.x + 2.6, z0 - len / 2, { w: sweeper ? 0.8 : 1.5 });
    this.wp(this.x, this.z + 1, { w: 2 });
  }

  /** Honeycomb tiles over the void: they shake, then drop a moment after being stepped on. */
  honey(rows, { cols = 5, r = 1.25 } = {}) {
    const dx = r * 1.75;
    const dz = r * 1.52;
    const tiles = [];
    const z0 = this.z - 0.6;
    for (let row = 0; row < rows; row++) {
      const n = row % 2 ? cols - 1 : cols;
      for (let k = 0; k < n; k++) {
        const x = this.x + (k - (n - 1) / 2) * dx;
        const z = z0 - r - row * dz;
        const t = this.add({ kind: 'cyl', x, y: this.y - 0.35, z, r: r * 0.97, hy: 0.35, role: 'tile', color: this.color(), tile: { state: 'solid', t: 0 } });
        tiles.push(t);
      }
    }
    this.obstacles.push({ type: 'honey', tiles });
    this.z = z0 - r * 2 - (rows - 1) * dz - 0.4;
    this.wp(this.x + 1, (z0 + this.z) / 2, { w: 3 });
    this.slab(this.z, this.z - 2, 12);
    this.z -= 2;
  }

  /** Platforms that slide left and right over a gap; jump when one comes close. */
  movers(n, { gap = 2.4, len = 6.5, w = 6, amp = 3.6, speed = 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const zc = this.z - gap - len / 2;
      const period = (7 - i * 0.5) / speed;
      const phase = this.random() * TAU;
      const c = this.add({ kind: 'box', x: this.x, y: this.y - 0.5, z: zc, hx: w / 2, hy: 0.5, hz: len / 2, role: 'mover', color: this.color(), motion: { type: 'slide', ax: 1, az: 0, amp, period, phase, bx: this.x, by: this.y - 0.5, bz: zc } });
      this.wp(this.x, this.z + 0.9, { w: 0, act: 'jump', mover: c });
      this.wp(this.x, zc, { w: 0, follow: c });
      this.z = zc - len / 2;
    }
    this.wp(this.x, this.z + 0.9, { w: 0, act: 'jump', fromMover: true });
    this.z -= gap;
    this.slab(this.z, this.z - 6, 12);
    this.z -= 6;
  }

  /** A bridge with big hammers swinging across it. */
  hammers(n, { w = 6, len = 9 } = {}) {
    const z0 = this.z;
    const total = n * len + 4;
    this.slab(z0, z0 - total, w, { role: 'bridge' });
    for (let i = 0; i < n; i++) {
      const z = z0 - 4 - i * len;
      this.obstacles.push({ type: 'hammer', px: this.x, py: this.y + 7.2, pz: z, len: 6, amp: 1.0, period: 2.8 + (i % 2) * 0.5, phase: this.random() * TAU, head: { r: 0.85, half: 1.0 }, angle: 0 });
      this.wp(this.x, z + 2, { w: 1, hazard: this.obstacles.length - 1 });
    }
    this.z -= total;
    this.wp(this.x, this.z + 1, { w: 1 });
  }

  /** Narrow bridge with Voltorb pendulums. */
  pendulums(n, { w = 6, len = 8 } = {}) {
    const z0 = this.z;
    const total = n * len + 4;
    this.slab(z0, z0 - total, w, { role: 'bridge' });
    for (let i = 0; i < n; i++) {
      const z = z0 - 4 - i * len;
      this.obstacles.push({ type: 'pendulum', px: this.x, py: this.y + 7.5, pz: z, len: 6.4, amp: 0.95, period: 3 + (i % 2) * 0.4, phase: this.random() * TAU, head: { r: 1.0, half: 0 }, angle: 0 });
      this.wp(this.x, z + 2, { w: 1, hazard: this.obstacles.length - 1 });
    }
    this.z -= total;
    this.wp(this.x, this.z + 1, { w: 1 });
  }

  /** Door dash: a wall of doors, some break when bumped, some are solid. */
  doors(n, { w = 13, h = 2.8 } = {}) {
    const z = this.z - 3;
    this.slab(this.z, this.z - 6, w);
    const dw = w / n;
    const doors = [];
    // About half break; never all solid and never all breakable
    const breakable = Array.from({ length: n }, () => this.random() < 0.5);
    if (!breakable.some(Boolean)) breakable[Math.floor(this.random() * n)] = true;
    if (breakable.every(Boolean)) breakable[Math.floor(this.random() * n)] = false;
    for (let k = 0; k < n; k++) {
      const x = this.x - w / 2 + dw * (k + 0.5);
      const d = this.add({ kind: 'box', x, y: this.y + h / 2, z, hx: dw / 2 - 0.12, hy: h / 2, hz: 0.3, role: 'door', color: this.color(), door: { breakable: breakable[k], broken: false, index: k } });
      doors.push(d);
    }
    // frame posts (too tall to jump over: the jump apex is about 1.6 m)
    for (const s of [-1, 1]) this.add({ kind: 'box', x: this.x + s * (w / 2 + 0.2), y: this.y + h / 2, z, hx: 0.25, hy: h / 2 + 0.01, hz: 0.45, role: 'post', color: this.palette.accent });
    this.obstacles.push({ type: 'doors', doors, z });
    this.wp(this.x, z + 1.6, { w: 0, doors: this.obstacles.length - 1 });
    this.wp(this.x, z - 1.4, { w: 0, afterDoors: true });
    this.z -= 6;
  }

  /** Sliding walls across a platform: run through the gap. */
  gates(n, { w = 12, len = 7 } = {}) {
    const z0 = this.z;
    const total = n * len + 2;
    this.slab(z0, z0 - total, w);
    for (let i = 0; i < n; i++) {
      const z = z0 - 3 - i * len;
      const period = 3.4 + (i % 2) * 0.6;
      const c = this.add({ kind: 'box', x: this.x, y: this.y + 1.2, z, hx: w * 0.27, hy: 1.2, hz: 0.5, role: 'gate', color: this.palette.accent, motion: { type: 'slide', ax: 1, az: 0, amp: w * 0.26, period, phase: this.random() * TAU, bx: this.x, by: this.y + 1.2, bz: z } });
      this.wp(this.x, z + 1.8, { w: 0, gate: c });
      this.wp(this.x, z - 1.2, { w: 0, afterGate: c });
    }
    this.z -= total;
  }

  /** An uphill ramp with Voltorbs rolling down it. */
  slope(len, rise, { w = 12, every = 1.5 } = {}) {
    const z0 = this.z;
    const pitch = Math.atan2(rise, len);
    const hyp = Math.hypot(len, rise);
    const c = this.add({ kind: 'box', x: this.x, y: this.y + rise / 2 - 0.5 / Math.cos(pitch), z: z0 - len / 2, hx: w / 2, hy: 0.5, hz: hyp / 2, pitch, role: 'ramp', color: this.color() });
    for (const s of [-1, 1]) this.add({ kind: 'box', x: this.x + s * (w / 2 + 0.3), y: this.y + rise / 2 + 0.4, z: z0 - len / 2, hx: 0.3, hy: 1.1, hz: hyp / 2, pitch, role: 'rail', color: this.palette.accent });
    this.obstacles.push({
      type: 'balls',
      ramp: c,
      x: this.x,
      w,
      top: { y: this.y + rise, z: z0 - len - 2 },
      bottom: { y: this.y, z: z0 },
      len,
      rise,
      every,
      next: 0.6,
      list: [],
      R: 1.05,
    });
    this.y += rise;
    this.z -= len;
    this.wp(this.x, z0 - len * 0.33, { w: 3, dodge: this.obstacles.length - 1 });
    this.wp(this.x, z0 - len * 0.66, { w: 3, dodge: this.obstacles.length - 1 });
    this.slab(this.z + 0.6, this.z - 4, w);
    this.z -= 4;
    this.wp(this.x, this.z + 1.5, { w: 2, dodge: this.obstacles.length - 1 });
  }

  finish({ len = 26, w = 16 } = {}) {
    const z0 = this.z;
    this.slab(z0, z0 - len, w, { role: 'finish', color: this.palette.colors[0] });
    this.finishZ = z0 - 8;
    this.finishY = this.y;
    this.wp(this.x, this.finishZ - 4, { w: 4 });
    this.wp(this.x, z0 - len + 4, { w: 5 });
    this.decor.push({ type: 'finishArch', x: this.x, y: this.y, z: this.finishZ, w });
    this.z -= len;
  }
}

/** Builds course `index` (0-based) with a seeded `random`. */
export function buildCourse(index, random) {
  const def = COURSES[index] || COURSES[0];
  const b = new CourseBuilder(def.theme, random);
  // Tag every waypoint with the section that made it (tests and debugging)
  let n = 0;
  const tagged = new Proxy(b, {
    get(target, key) {
      const v = target[key];
      if (typeof v !== 'function') return v;
      return (...args) => {
        target.sec = `${String(key)}#${(n += 1)}`;
        return v.apply(target, args);
      };
    },
  });
  def.build(tagged);
  return {
    index,
    id: def.id,
    name: def.name,
    icon: def.icon,
    theme: b.theme,
    palette: b.palette,
    def,
    colliders: b.colliders,
    obstacles: b.obstacles,
    waypoints: b.waypoints,
    checkpoints: b.checkpoints,
    decor: b.decor,
    finishZ: b.finishZ,
    finishY: b.finishY,
    endZ: b.z,
    killY: b.minY - 10,
    length: -b.finishZ,
  };
}
