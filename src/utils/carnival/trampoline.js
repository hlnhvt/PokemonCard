// "Bạt nhún Jigglypuff" (trampoline): the child's Pokemon bounces on a pink trampoline. Tap
// just when it presses the mat down for a bigger bounce ("TUYỆT!"); too early or too late loses
// height. In the air, swipe left / right / up for tricks (spin, flip, star pose) for points –
// a trick still going when the Pokemon lands makes it land dizzy. 60 seconds.
// Heights are in metres. Pure rules; `random` is injectable.
import { starsFor } from './tickets';

export const DURATION = 60;
export const G = 40; // m/s², a quick, bouncy world
export const START_APEX = 3;
export const MIN_APEX = 2.5;
export const MAX_APEX = 64;
export const CONTACT = 0.32; // seconds the mat is pressed down
export const PERFECT = 0.065; // off the bottom of the press by at most this: "TUYỆT!"
export const GOOD = 0.13;
export const EARLY_AIR = 0.3; // a tap this close before landing counts (as early)

export const TRICKS = {
  spin: { dir: 'left', dur: 0.5, points: 25, name: 'Xoay vòng' },
  flip: { dir: 'right', dur: 0.6, points: 30, name: 'Lộn nhào' },
  star: { dir: 'up', dur: 0.45, points: 20, name: 'Tạo dáng ngôi sao' },
};
export const TRICK_FOR_DIR = { left: 'spin', right: 'flip', up: 'star' };
export const TAP_POINTS = { perfect: 15, good: 8, early: 0, late: 0, none: 0, dizzy: 0 };

/** Sky layers by height (metres), for the scene and the meter. */
export const LAYERS = [
  { from: 0, name: 'Công viên' },
  { from: 10, name: 'Mây trắng' },
  { from: 22, name: 'Đàn Pidgey' },
  { from: 36, name: 'Khinh khí cầu' },
  { from: 50, name: 'Ngàn sao' },
];
export const layerAt = (h) => LAYERS.reduce((cur, l, i) => (h >= l.from ? i : cur), 0);

export function nextApex(apex, quality) {
  switch (quality) {
    case 'perfect':
      return Math.min(MAX_APEX, apex * 1.22 + 1.5);
    case 'good':
      return Math.min(MAX_APEX, apex * 1.06 + 0.5);
    case 'early':
    case 'late':
      return Math.max(MIN_APEX, apex * 0.72);
    case 'dizzy':
      return Math.max(MIN_APEX, apex * 0.6);
    default:
      return Math.max(MIN_APEX, apex * 0.8);
  }
}

export function createTrampoline({ random = Math.random } = {}) {
  return {
    random,
    time: 0,
    y: START_APEX,
    vy: 0,
    phase: 'air', // air | contact
    contactT: 0,
    tap: null, // the quality of the first tap for this landing
    apex: START_APEX,
    peak: START_APEX, // highest point of the current jump
    trick: null, // { kind, t, dur }
    jumpTricks: [],
    dizzy: false,
    wasDizzy: false,
    score: 0,
    bounces: 0,
    perfects: 0,
    goods: 0,
    tricks: 0,
    dizzies: 0,
    best: START_APEX,
    status: 'play',
    events: [],
  };
}

export const timeLeft = (s) => Math.max(0, DURATION - s.time);

/** Seconds until the Pokemon reaches the mat (0 when on it). */
export function timeToLand(s) {
  if (s.phase === 'contact') return 0;
  return (s.vy + Math.sqrt(s.vy * s.vy + 2 * G * Math.max(0, s.y))) / G;
}

/** How far the mat is pressed down (0-1). */
export const press = (s) => (s.phase === 'contact' ? Math.sin((s.contactT / CONTACT) * Math.PI) : 0);

export function tapQuality(contactT) {
  const d = contactT - CONTACT / 2;
  if (Math.abs(d) <= PERFECT) return 'perfect';
  if (Math.abs(d) <= GOOD) return 'good';
  return d < 0 ? 'early' : 'late';
}

/** The child taps. Returns the quality ('perfect' | 'good' | 'early' | 'late'), or 'air' / 'done'. */
export function tapBounce(s) {
  if (s.status !== 'play') return 'done';
  if (s.tap) return 'done';
  if (s.phase === 'contact') {
    if (s.dizzy) return 'dizzy';
    s.tap = tapQuality(s.contactT);
  } else if (s.vy < 0 && timeToLand(s) <= EARLY_AIR) {
    s.tap = 'early';
  } else return 'air';
  s.events.push({ type: 'tap', quality: s.tap });
  return s.tap;
}

/** A swipe in the air: 'left' spin, 'right' flip, 'up' star pose. */
export function swipeTrick(s, dir) {
  const kind = TRICK_FOR_DIR[dir];
  if (s.status !== 'play' || !kind) return 'no';
  if (s.phase !== 'air') return 'ground';
  if (s.trick) return 'busy';
  s.trick = { kind, t: 0, dur: TRICKS[kind].dur };
  s.events.push({ type: 'trick-start', kind });
  return kind;
}

function land(s) {
  s.y = 0;
  s.phase = 'contact';
  s.contactT = 0;
  s.dizzy = false;
  if (s.trick) {
    // Still turning when the feet hit the mat
    s.events.push({ type: 'dizzy', kind: s.trick.kind });
    s.trick = null;
    s.dizzy = true;
    s.dizzies += 1;
  }
  if (s.tap && s.tap !== 'early') s.tap = null;
  s.events.push({ type: 'land', tapped: s.tap, dizzy: s.dizzy });
}

function launch(s) {
  const quality = s.dizzy ? 'dizzy' : s.tap || 'none';
  const before = s.apex;
  s.apex = nextApex(s.apex, quality);
  s.vy = Math.sqrt(2 * G * s.apex);
  s.y = 0.001;
  s.phase = 'air';
  s.bounces += 1;
  if (quality === 'perfect') s.perfects += 1;
  if (quality === 'good') s.goods += 1;
  const points = TAP_POINTS[quality] || 0;
  s.score += points;
  s.best = Math.max(s.best, s.apex);
  s.wasDizzy = s.dizzy;
  s.dizzy = false;
  s.jumpTricks = [];
  s.peak = s.apex;
  s.events.push({ type: 'bounce', quality, apex: s.apex, before, points, layer: layerAt(s.apex) });
  s.tap = null;
}

export function stepTrampoline(s, dt) {
  if (s.status !== 'play') return s;
  s.time += dt;
  if (s.phase === 'contact') {
    s.contactT += dt;
    if (s.contactT >= CONTACT) launch(s);
  } else {
    const wasUp = s.vy > 0;
    s.vy -= G * dt;
    s.y += s.vy * dt;
    if (wasUp && s.vy <= 0) {
      // Height points at the top of every jump
      const h = Math.round(s.y);
      s.score += h;
      s.events.push({ type: 'apex', h, points: h, layer: layerAt(s.y) });
    }
    if (s.trick) {
      s.trick.t += dt;
      if (s.trick.t >= s.trick.dur) {
        const kind = s.trick.kind;
        const n = s.jumpTricks.length;
        const repeat = s.jumpTricks[n - 1] === kind;
        const points = Math.round(TRICKS[kind].points * (1 + 0.25 * Math.min(4, n)) * (repeat ? 0.5 : 1));
        s.jumpTricks.push(kind);
        s.tricks += 1;
        s.score += points;
        s.trick = null;
        s.events.push({ type: 'trick', kind, points, combo: n + 1, repeat });
      }
    }
    if (s.y <= 0 && s.vy < 0) land(s);
  }
  if (s.time >= DURATION) {
    s.status = 'done';
    s.trick = null;
    s.events.push({ type: 'end' });
  }
  return s;
}

export const trampolineStars = (s) => starsFor(s.score, 1000, 3400);
