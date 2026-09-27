// "Tiệm kẹo bông" (cotton candy stall): Pokemon customers order a cotton candy of a colour
// (or a two-colour swirl) and a size. The child picks the sugar colour(s), then draws circles
// around the spinning drum: every full turn wraps more candy on the stick. "Xong" serves it
// and the customer rates colour and size (stop near the size marker!). 6 customers.
// Pure rules; `random` is injectable.
import { starsFor } from './tickets';

export const CANDY_W = 360;
export const CANDY_H = 460;
/** Centre of the drum (canvas coordinates): circles are measured around it. */
export const DRUM = { x: 180, y: 330 };
export const MIN_RADIUS = 18; // closer to the centre the angle jumps about, ignore it
export const MAX_STEP = 1.6; // radians; a bigger jump between two points is a new stroke

export const CUSTOMERS = 6;
export const COLORS = ['pink', 'blue', 'yellow', 'purple'];
export const SIZES = { small: 0.35, medium: 0.6, big: 0.85 };
export const MAX_FLUFF = 1.1;
export const GROW_PER_TURN = 0.15; // fluff for one full circle
export const ARRIVE_TIME = 1.2;
export const REACT_TIME = 2.4;
export const TIP_TIME = 22; // served quicker than this earns a small tip
export const MAX_TIP = 15;

export const CUSTOMER_POOL = [
  { name: 'Pikachu', dex: 25 },
  { name: 'Jigglypuff', dex: 39 },
  { name: 'Togepi', dex: 175 },
  { name: 'Clefairy', dex: 35 },
  { name: 'Eevee', dex: 133 },
  { name: 'Snorlax', dex: 143 },
  { name: 'Bulbasaur', dex: 1 },
  { name: 'Squirtle', dex: 7 },
  { name: 'Charmander', dex: 4 },
  { name: 'Psyduck', dex: 54 },
  { name: 'Mew', dex: 151 },
  { name: 'Meowth', dex: 52 },
];

const SWIRLS = [
  ['pink', 'blue'],
  ['yellow', 'purple'],
  ['pink', 'yellow'],
  ['blue', 'purple'],
];
// Gentle start, swirls later, the last ones bigger
const PLAN = [
  { size: 'small', swirl: false },
  { size: 'medium', swirl: false },
  { size: 'big', swirl: false },
  { size: 'medium', swirl: true },
  { size: 'small', swirl: true },
  { size: 'big', swirl: true },
];

const pick = (list, random) => list[Math.floor(random() * list.length)];

export function makeOrders(random = Math.random, playerName = '') {
  const pool = CUSTOMER_POOL.filter((c) => c.name.toLowerCase() !== String(playerName).toLowerCase());
  const orders = [];
  let lastColor = '';
  for (let i = 0; i < CUSTOMERS; i++) {
    const plan = PLAN[i];
    const who = pool.splice(Math.floor(random() * pool.length), 1)[0];
    let colors;
    for (let tries = 0; tries < 5; tries++) {
      colors = plan.swirl ? pick(SWIRLS, random) : [pick(COLORS, random)];
      if (colors.join('+') !== lastColor) break;
    }
    lastColor = colors.join('+');
    orders.push({ ...who, colors, size: plan.size, target: SIZES[plan.size] });
  }
  return orders;
}

export function createCandy({ random = Math.random, playerName = '' } = {}) {
  const s = {
    random,
    time: 0,
    orders: makeOrders(random, playerName),
    index: 0,
    stage: 'arrive', // arrive | make | react | done
    stageT: 0,
    makeT: 0,
    selected: [],
    fluff: 0,
    layers: [],
    wind: 0, // signed angle turned in this stroke
    peak: 0, // the most the stroke has wound so far (back-and-forth does not count)
    lastAngle: null,
    turns: 0,
    spinSpeed: 0,
    results: [],
    score: 0,
    coins: 0,
    status: 'play',
    events: [],
  };
  s.events.push({ type: 'arrive', index: 0, order: s.orders[0] });
  return s;
}

export const currentOrder = (s) => s.orders[Math.min(s.index, s.orders.length - 1)];
const key = (colors) => [...colors].sort().join('+');

/** How well a mix of colours fits an order's colours (1, 0.5 or 0). */
export function colorMatch(have, want) {
  if (!have.length) return 0;
  if (key(have) === key(want)) return 1;
  return have.some((c) => want.includes(c)) ? 0.5 : 0;
}

/** Tap a sugar jar: select it (up to two, the oldest goes), or unselect it. */
export function pickColor(s, color) {
  if (s.status !== 'play' || !COLORS.includes(color) || s.stage === 'react' || s.stage === 'done') return s.selected;
  if (s.selected.includes(color)) s.selected = s.selected.filter((c) => c !== color);
  else {
    s.selected = [...s.selected, color];
    if (s.selected.length > 2) s.selected.shift();
  }
  s.events.push({ type: 'color', selected: [...s.selected] });
  return s.selected;
}

/** Wrap candy on the stick for `radians` of turning. Returns the fluff added. */
export function spin(s, radians) {
  if (s.status !== 'play' || s.stage !== 'make' || radians <= 0) return 0;
  if (!s.selected.length) {
    s.events.push({ type: 'need-color' });
    return 0;
  }
  if (s.fluff >= MAX_FLUFF) {
    s.events.push({ type: 'full' });
    return 0;
  }
  const before = s.fluff;
  const add = Math.min(MAX_FLUFF - s.fluff, (radians / (Math.PI * 2)) * GROW_PER_TURN);
  s.fluff += add;
  s.spinSpeed = Math.min(14, s.spinSpeed + radians * 3);
  const k = key(s.selected);
  const top = s.layers[s.layers.length - 1];
  if (top && top.key === k) top.amount += add;
  else s.layers.push({ key: k, colors: [...s.selected], amount: add });
  const turnsBefore = Math.floor(before / GROW_PER_TURN);
  const turnsNow = Math.floor(s.fluff / GROW_PER_TURN);
  if (turnsNow > turnsBefore) {
    s.turns = turnsNow;
    s.events.push({ type: 'turn', turns: turnsNow, fluff: s.fluff });
  }
  const target = currentOrder(s).target;
  if (before < target - 0.08 && s.fluff >= target - 0.08) s.events.push({ type: 'near-size' });
  if (s.fluff >= MAX_FLUFF) s.events.push({ type: 'full' });
  return add;
}

/**
 * The finger moves to (x, y) (canvas coordinates) while pressing. The angle around the drum
 * centre is accumulated; only winding further round (not back and forth) grows the candy.
 */
export function trace(s, x, y) {
  const dx = x - DRUM.x;
  const dy = y - DRUM.y;
  if (Math.hypot(dx, dy) < MIN_RADIUS) return 0;
  const a = Math.atan2(dy, dx);
  if (s.lastAngle == null) {
    s.lastAngle = a;
    return 0;
  }
  let d = a - s.lastAngle;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  s.lastAngle = a;
  if (Math.abs(d) > MAX_STEP) return 0;
  s.wind += d;
  const gain = Math.abs(s.wind) - s.peak;
  if (gain <= 0) return 0;
  s.peak = Math.abs(s.wind);
  return spin(s, gain);
}

/** The finger lifts: the next stroke starts fresh. */
export function traceEnd(s) {
  s.lastAngle = null;
  s.wind = 0;
  s.peak = 0;
}

/** Colour share (0-1) of the candy made with the right colours. */
export function candyColorMatch(s, want) {
  if (s.fluff <= 0) return 0;
  const sum = s.layers.reduce((t, l) => t + l.amount * colorMatch(l.colors, want), 0);
  return sum / s.fluff;
}

export function sizeMatch(fluff, target) {
  const d = Math.abs(fluff - target);
  return d <= 0.08 ? 1 : d <= 0.16 ? 0.7 : d <= 0.28 ? 0.4 : 0.1;
}

export const heartsFor = (points) => (points >= 85 ? 3 : points >= 60 ? 2 : points >= 35 ? 1 : 0);

/** "Xong": give the candy. Returns the rating, or { result: 'empty' } when nothing is made. */
export function serve(s) {
  if (s.status !== 'play' || s.stage !== 'make') return { result: 'wait' };
  if (s.fluff < 0.08) {
    s.events.push({ type: 'empty' });
    return { result: 'empty' };
  }
  const order = currentOrder(s);
  const color = candyColorMatch(s, order.colors);
  const size = sizeMatch(s.fluff, order.target);
  const points = Math.round(50 * color + 50 * size);
  const hearts = heartsFor(points);
  const tip = points >= 60 ? Math.max(0, Math.round(MAX_TIP * (1 - s.makeT / TIP_TIME))) : 0;
  const big = s.fluff > order.target + 0.08 ? 'big' : s.fluff < order.target - 0.08 ? 'small' : 'ok';
  const result = { result: 'served', index: s.index, points, tip, coins: points + tip, hearts, mood: hearts >= 2 ? 'happy' : 'grumpy', color, size, fit: big, fluff: s.fluff, layers: s.layers.map((l) => ({ ...l })) };
  s.results.push(result);
  s.score += points + tip;
  s.coins += points + tip;
  s.stage = 'react';
  s.stageT = 0;
  traceEnd(s);
  s.events.push({ type: 'serve', ...result });
  return result;
}

export function stepCandy(s, dt) {
  if (s.status !== 'play') return s;
  s.time += dt;
  s.stageT += dt;
  s.spinSpeed = Math.max(0, s.spinSpeed - dt * 6);
  if (s.stage === 'arrive' && s.stageT >= ARRIVE_TIME) {
    s.stage = 'make';
    s.stageT = 0;
    s.makeT = 0;
    s.events.push({ type: 'order', index: s.index, order: currentOrder(s) });
  } else if (s.stage === 'make') {
    s.makeT += dt;
  } else if (s.stage === 'react' && s.stageT >= REACT_TIME) {
    s.index += 1;
    s.fluff = 0;
    s.layers = [];
    s.turns = 0;
    s.selected = [];
    s.stageT = 0;
    if (s.index >= s.orders.length) {
      s.stage = 'done';
      s.status = 'done';
      s.events.push({ type: 'end' });
    } else {
      s.stage = 'arrive';
      s.events.push({ type: 'arrive', index: s.index, order: currentOrder(s) });
    }
  }
  return s;
}

export const candyStars = (s) => starsFor(s.score, 420, 630);
