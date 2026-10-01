// "Cho Snorlax ăn": a Cut the Rope style physics puzzle. An Oran berry hangs from ropes;
// swipe to cut them so it falls (or swings, floats, bounces) into sleeping Snorlax's mouth,
// picking up the three stars on the way. Pure and deterministic: fixed 1/120 s steps, no
// randomness, so a level's `solution` (timed actions) replays exactly the same every time.

import { LEVELS, WORLDS } from './snorlaxLevels';

export { LEVELS, WORLDS };

export const SNORLAX_W = 360;
export const SNORLAX_H = 560;
export const DT = 1 / 120;
export const GRAVITY = 700;
export const BERRY_R = 17;
export const MOUTH_R = 34;
export const STAR_R = 14;
export const BUBBLE_R = 26;
export const PUFF_RANGE = 330;
export const PUFF_POWER = 340; // px/s added at point blank
export const PAD_POWER = 430; // a bounce pad always throws at least this fast
export const SPIKE_R = 8;
export const WEB_R = 64;
const DAMP = 0.9995;
const BUBBLE_LIFT = -0.24; // times gravity, upwards while in a bubble
const BUBBLE_DAMP = 0.992;

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/** Closest point on segment AB to P, with the parameter u in [0, 1]. */
export function closestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return { x: ax + dx * u, y: ay + dy * u, u };
}

/** Do segments P1P2 and Q1Q2 cross? */
export function segmentsCross(p1x, p1y, p2x, p2y, q1x, q1y, q2x, q2y) {
  const d = (p2x - p1x) * (q2y - q1y) - (p2y - p1y) * (q2x - q1x);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((q1x - p1x) * (q2y - q1y) - (q1y - p1y) * (q2x - q1x)) / d;
  const u = ((q1x - p1x) * (p2y - p1y) - (q1y - p1y) * (p2x - p1x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Point on the curve A -> B that sags by h below the middle (a quadratic Bezier)
const sagPoint = (ax, ay, bx, by, h, u) => {
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2 + h;
  const v = 1 - u;
  return { x: v * v * ax + 2 * v * u * cx + u * u * bx, y: v * v * ay + 2 * v * u * cy + u * u * by };
};
function sagLength(ax, ay, bx, by, h) {
  let len = 0;
  let prev = sagPoint(ax, ay, bx, by, h, 0);
  for (let i = 1; i <= 24; i++) {
    const p = sagPoint(ax, ay, bx, by, h, i / 24);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

/** The visual chain of a rope, already hanging in a gentle curve when it is slack. */
function makeChain(ax, ay, bx, by, len) {
  const n = Math.max(6, Math.min(24, Math.round(len / 14)));
  let h = 0;
  if (len > Math.hypot(bx - ax, by - ay) * 1.01) {
    let lo = 0;
    let hi = len * 2;
    for (let k = 0; k < 30; k++) {
      h = (lo + hi) / 2;
      if (sagLength(ax, ay, bx, by, h) > len) hi = h;
      else lo = h;
    }
  }
  const points = [];
  for (let i = 0; i <= n; i++) {
    const p = sagPoint(ax, ay, bx, by, h, i / n);
    points.push({ x: p.x, y: p.y, px: p.x, py: p.y });
  }
  return { points, seg: len / n };
}

/** Where a star is at time t (some stars glide back and forth or in circles). */
export function starAt(star, t) {
  const m = star.move;
  if (!m) return { x: star.x, y: star.y };
  const a = m.w * t + (m.ph || 0);
  return { x: star.x + (m.ax || 0) * Math.sin(a), y: star.y + (m.ay || 0) * Math.sin(a + (m.circle ? Math.PI / 2 : 0)) };
}

/** A fresh level (index into LEVELS, or a level object for tests). */
export function createSnorlax(level = 0) {
  const lv = typeof level === 'number' ? LEVELS[level] : level;
  const b = lv.berry;
  const ropes = (lv.ropes || []).map((r) => {
    const len = r.len ?? dist(r.x, r.y, b.x, b.y);
    return { ax: r.x, ay: r.y, len, attached: true, active: true, web: -1, ...makeChain(r.x, r.y, b.x, b.y, len), tail: null };
  });
  const webs = (lv.webs || []).map((w, i) => {
    ropes.push({ ax: w.x, ay: w.y, len: 0, attached: false, active: false, web: i, points: [], seg: 0, tail: null });
    return { x: w.x, y: w.y, r: w.r ?? WEB_R, used: false, rope: ropes.length - 1 };
  });
  const s = {
    level: typeof level === 'number' ? level : -1,
    def: lv,
    t: 0,
    berry: { x: b.x, y: b.y, px: b.x - (b.vx || 0) * DT, py: b.y - (b.vy || 0) * DT, bubble: -1, alive: true },
    ropes,
    webs,
    bubbles: (lv.bubbles || []).map((q) => ({ x: q.x, y: q.y, r: q.r ?? BUBBLE_R, state: 'free' })),
    puffers: (lv.puffers || []).map((p) => ({ x: p.x, y: p.y, angle: p.angle, cool: 0 })),
    pads: (lv.pads || []).map((p) => ({ ...p, squish: 0 })),
    spikes: (lv.spikes || []).map((p) => ({ ...p })),
    stars: (lv.stars || []).map((st) => ({ ...st, got: false, cx: st.x, cy: st.y })),
    mouth: { x: lv.mouth.x, y: lv.mouth.y },
    collected: 0,
    near: 0,
    status: 'play', // play | won | lost
    reason: null,
    earned: 0, // stars won (set on a win)
    log: [], // actions done so far ({ cut } / { pop } / { puff }), for the hint
    events: [],
  };
  for (const st of s.stars) {
    const p = starAt(st, 0);
    st.cx = p.x;
    st.cy = p.y;
  }
  return s;
}

const berryVel = (s) => ({ vx: (s.berry.x - s.berry.px) / DT, vy: (s.berry.y - s.berry.py) / DT });
function setVel(s, vx, vy) {
  s.berry.px = s.berry.x - vx * DT;
  s.berry.py = s.berry.y - vy * DT;
}

/** Cut rope `index` at chain segment `segIndex` (default: the middle). */
export function cutRope(s, index, segIndex) {
  const r = s.ropes[index];
  if (!r || !r.attached || s.status !== 'play') return false;
  const n = r.points.length - 1;
  const k = Math.max(0, Math.min(n - 1, segIndex ?? Math.floor(n / 2)));
  r.attached = false;
  r.tail = { points: r.points.slice(k + 1).map((p) => ({ ...p })), life: 1.2 };
  r.points = r.points.slice(0, k + 1);
  s.log.push({ cut: index });
  s.events.push({ type: 'cut', rope: index, x: (r.points[k].x + r.tail.points[0].x) / 2, y: (r.points[k].y + r.tail.points[0].y) / 2 });
  return true;
}

/** A finger swiped from (x1, y1) to (x2, y2): cut every rope it crosses. Returns the cut indexes. */
export function swipe(s, x1, y1, x2, y2) {
  const cut = [];
  if (s.status !== 'play') return cut;
  s.ropes.forEach((r, i) => {
    if (!r.attached) return;
    for (let k = 0; k < r.points.length - 1; k++) {
      const a = r.points[k];
      const b = k + 1 === r.points.length - 1 ? s.berry : r.points[k + 1];
      if (segmentsCross(x1, y1, x2, y2, a.x, a.y, b.x, b.y)) {
        if (cutRope(s, i, k)) cut.push(i);
        return;
      }
    }
  });
  return cut;
}

/** Pop bubble `index` (the berry inside drops again). */
export function popBubble(s, index) {
  const q = s.bubbles[index];
  if (!q || q.state === 'popped' || s.status !== 'play') return false;
  if (q.state === 'held') s.berry.bubble = -1;
  q.state = 'popped';
  s.log.push({ pop: index });
  s.events.push({ type: 'pop', bubble: index, x: q.x, y: q.y });
  return true;
}

/** Jigglypuff `index` blows a puff of air; pushes the berry if it is in front, stronger when close. */
export function puff(s, index) {
  const p = s.puffers[index];
  if (!p || s.status !== 'play') return false;
  p.cool = 0.35;
  s.log.push({ puff: index });
  const dx = Math.cos(p.angle);
  const dy = Math.sin(p.angle);
  s.events.push({ type: 'puff', puffer: index, x: p.x, y: p.y });
  const b = s.berry;
  const d = dist(b.x, b.y, p.x, p.y);
  if (d > PUFF_RANGE || d < 1) return true;
  const facing = ((b.x - p.x) * dx + (b.y - p.y) * dy) / d;
  if (facing < 0.45) return true;
  const power = PUFF_POWER * (1 - (d / PUFF_RANGE) * 0.55) * (b.bubble >= 0 ? 1.25 : 1);
  const v = berryVel(s);
  setVel(s, v.vx + dx * power, v.vy + dy * power);
  return true;
}

/** Tap at (x, y): pops a bubble or squeezes a Jigglypuff. Returns what was hit. */
export function tapAt(s, x, y) {
  if (s.status !== 'play') return null;
  for (let i = 0; i < s.bubbles.length; i++) {
    const q = s.bubbles[i];
    if (q.state !== 'popped' && dist(x, y, q.x, q.y) < q.r + 14) {
      popBubble(s, i);
      return { kind: 'pop', index: i };
    }
  }
  for (let i = 0; i < s.puffers.length; i++) {
    const p = s.puffers[i];
    if (dist(x, y, p.x, p.y) < 34) {
      puff(s, i);
      return { kind: 'puff', index: i };
    }
  }
  return null;
}

/** Apply one solution action. */
export function applyAction(s, a) {
  if (a.cut != null) return cutRope(s, a.cut);
  if (a.pop != null) return popBubble(s, a.pop);
  if (a.puff != null) return puff(s, a.puff);
  return false;
}

function stepChain(points, ax, ay, end, seg, dt) {
  // Visual rope: Verlet with both ends pinned (end may be null for a dangling piece)
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const vx = (p.x - p.px) * 0.985;
    const vy = (p.y - p.py) * 0.985;
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy + GRAVITY * dt * dt;
  }
  for (let it = 0; it < 8; it++) {
    if (ax != null) {
      points[0].x = ax;
      points[0].y = ay;
    }
    if (end) {
      const last = points[points.length - 1];
      last.x = end.x;
      last.y = end.y;
    }
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      const diff = (d - seg) / d / 2;
      const pinA = (i === 0 && ax != null) ? 0 : 1;
      const pinB = (i + 1 === points.length - 1 && end) ? 0 : 1;
      const wa = pinA && pinB ? 1 : pinA ? 2 : 0;
      const wb = pinA && pinB ? 1 : pinB ? 2 : 0;
      a.x += dx * diff * wa;
      a.y += dy * diff * wa;
      b.x -= dx * diff * wb;
      b.y -= dy * diff * wb;
    }
  }
}

function lose(s, reason) {
  if (s.status !== 'play') return;
  s.status = 'lost';
  s.reason = reason;
  s.berry.alive = false;
  s.events.push({ type: 'lost', reason, x: s.berry.x, y: s.berry.y });
}

/** One fixed step of the world. */
export function stepOnce(s) {
  const dt = DT;
  s.t += dt;
  const b = s.berry;
  for (const p of s.puffers) p.cool = Math.max(0, p.cool - dt);
  for (const p of s.pads) p.squish = Math.max(0, p.squish - dt * 4);
  for (const st of s.stars) {
    const p = starAt(st, s.t);
    st.cx = p.x;
    st.cy = p.y;
  }
  if (s.status === 'play') {
    // Berry: Verlet with gravity (or lift in a bubble)
    const inBubble = b.bubble >= 0;
    const damp = inBubble ? BUBBLE_DAMP : DAMP;
    const vx = (b.x - b.px) * damp;
    const vy = (b.y - b.py) * damp;
    b.px = b.x;
    b.py = b.y;
    b.x += vx;
    b.y += vy + (inBubble ? BUBBLE_LIFT : 1) * GRAVITY * dt * dt;
    // Ropes can't stretch: keep the berry within each rope's length of its anchor
    for (let it = 0; it < 8; it++) {
      for (const r of s.ropes) {
        if (!r.attached) continue;
        const dx = b.x - r.ax;
        const dy = b.y - r.ay;
        const d = Math.hypot(dx, dy);
        if (d > r.len) {
          b.x = r.ax + (dx / d) * r.len;
          b.y = r.ay + (dy / d) * r.len;
        }
      }
    }
    // Bounce pads
    for (let i = 0; i < s.pads.length; i++) {
      const pad = s.pads[i];
      const c = closestOnSegment(b.x, b.y, pad.x1, pad.y1, pad.x2, pad.y2);
      const d = dist(b.x, b.y, c.x, c.y);
      if (d < BERRY_R + 5 && d > 0.0001) {
        const nx = (b.x - c.x) / d;
        const ny = (b.y - c.y) / d;
        const v = { vx: (b.x - b.px) / dt, vy: (b.y - b.py) / dt };
        const vn = v.vx * nx + v.vy * ny;
        b.x = c.x + nx * (BERRY_R + 5);
        b.y = c.y + ny * (BERRY_R + 5);
        if (vn < 0) {
          const out = Math.max(-vn * 0.9, pad.power ?? PAD_POWER);
          const tx = v.vx - vn * nx;
          const ty = v.vy - vn * ny;
          setVel(s, tx + nx * out, ty + ny * out);
          pad.squish = 1;
          if (b.bubble >= 0) popBubble(s, b.bubble);
          s.events.push({ type: 'bounce', pad: i, x: c.x, y: c.y });
        }
      }
    }
    // Bubbles catch the berry and carry it up
    if (b.bubble < 0) {
      for (let i = 0; i < s.bubbles.length; i++) {
        const q = s.bubbles[i];
        if (q.state === 'free' && dist(b.x, b.y, q.x, q.y) < q.r + BERRY_R * 0.4) {
          q.state = 'held';
          b.bubble = i;
          const v = berryVel(s);
          setVel(s, v.vx * 0.25, v.vy * 0.25);
          s.events.push({ type: 'bubble', bubble: i, x: q.x, y: q.y });
          break;
        }
      }
    }
    if (b.bubble >= 0) {
      const q = s.bubbles[b.bubble];
      q.x = b.x;
      q.y = b.y;
    }
    // Spinarak webs throw a new rope when the berry comes near
    for (const w of s.webs) {
      if (w.used) continue;
      const d = dist(b.x, b.y, w.x, w.y);
      if (d < w.r) {
        w.used = true;
        const r = s.ropes[w.rope];
        Object.assign(r, { len: Math.max(d, 20), attached: true, active: true, ...makeChain(w.x, w.y, b.x, b.y, Math.max(d, 20)) });
        s.events.push({ type: 'web', rope: w.rope, x: w.x, y: w.y });
      }
    }
    // Stars
    for (let i = 0; i < s.stars.length; i++) {
      const st = s.stars[i];
      if (!st.got && dist(b.x, b.y, st.cx, st.cy) < BERRY_R + STAR_R) {
        st.got = true;
        s.collected += 1;
        s.events.push({ type: 'star', star: i, x: st.cx, y: st.cy, count: s.collected });
      }
    }
    // Ferrothorn thorns
    for (const sp of s.spikes) {
      const c = closestOnSegment(b.x, b.y, sp.x1, sp.y1, sp.x2, sp.y2);
      if (dist(b.x, b.y, c.x, c.y) < BERRY_R + SPIKE_R) {
        lose(s, 'spike');
        break;
      }
    }
    // Snorlax
    const dm = dist(b.x, b.y, s.mouth.x, s.mouth.y);
    s.near = Math.max(0, Math.min(1, 1 - (dm - MOUTH_R) / 150));
    if (s.status === 'play' && dm < MOUTH_R) {
      s.status = 'won';
      s.earned = Math.max(1, s.collected);
      s.near = 1;
      s.events.push({ type: 'won', stars: s.earned, x: s.mouth.x, y: s.mouth.y });
    }
    if (s.status === 'play' && (b.x < -50 || b.x > SNORLAX_W + 50 || b.y > SNORLAX_H + 50 || b.y < -70)) lose(s, b.y < 0 ? 'flew' : 'fell');
  }
  // Ropes (visual chains; skipped by fast replays)
  if (s.fast) return;
  for (const r of s.ropes) {
    if (!r.points.length) continue;
    stepChain(r.points, r.ax, r.ay, r.attached && b.alive && s.status === 'play' ? b : null, r.seg, dt);
    if (r.tail) {
      r.tail.life -= dt;
      if (r.tail.life <= 0 || !r.tail.points.length) r.tail = null;
      else stepChain(r.tail.points, null, null, s.status === 'play' ? b : null, r.seg, dt);
    }
  }
}

/** Advance by `seconds` in fixed steps; returns the number of steps taken. */
export function stepSnorlax(s, seconds) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) stepOnce(s);
  return n;
}

/**
 * Replay timed actions ({ t, cut } / { t, pop } / { t, puff }) with the pure engine until the
 * level is won or lost (or `maxT` seconds pass). Returns the final state.
 */
export function replay(level, actions = [], maxT = 14) {
  const s = createSnorlax(level);
  s.fast = true;
  const queue = [...actions].sort((a, b) => a.t - b.t);
  let next = 0;
  while (s.status === 'play' && s.t < maxT) {
    while (next < queue.length && s.t >= queue[next].t - 1e-9) applyAction(s, queue[next++]);
    stepOnce(s);
    s.events.length = 0;
  }
  return s;
}

/** The next solution action not done yet (matched against what was done), with where to point. */
export function hintFor(s) {
  const sol = s.def.solution || [];
  const done = [...s.log];
  const same = (a, b) => (a.cut != null && a.cut === b.cut) || (a.pop != null && a.pop === b.pop) || (a.puff != null && a.puff === b.puff);
  let todo = null;
  for (const a of sol) {
    const k = done.findIndex((d) => same(a, d));
    if (k >= 0) done.splice(k, 1);
    else {
      todo = a;
      break;
    }
  }
  if (!todo) return null;
  if (todo.cut != null) {
    const r = s.ropes[todo.cut];
    if (!r.points.length) return { kind: 'cut', x: r.ax, y: r.ay + 30, t: todo.t };
    const p = r.points[Math.floor(r.points.length / 2)];
    return { kind: 'cut', x: p.x, y: p.y, t: todo.t };
  }
  if (todo.pop != null) {
    const q = s.bubbles[todo.pop];
    return { kind: 'pop', x: q.x, y: q.y, t: todo.t };
  }
  const p = s.puffers[todo.puff];
  return { kind: 'puff', x: p.x, y: p.y, t: todo.t };
}

/** Elements a level uses (for the intro tip). */
export function levelKinds(lv) {
  const k = [];
  if (lv.bubbles?.length) k.push('bubble');
  if (lv.puffers?.length) k.push('puffer');
  if (lv.pads?.length) k.push('pad');
  if (lv.spikes?.length) k.push('spike');
  if (lv.webs?.length) k.push('web');
  return k;
}

export const worldOf = (index) => Math.floor(index / 6);
