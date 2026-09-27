// "Vòng quay may mắn": a prize wheel. One spin costs a carnival ticket. The prize is picked
// by weighted odds first, then the wheel is spun so that it lands exactly on that segment.
// Pure rules; `random` is injectable.

/** Segments clockwise from the top. `weight` is the chance (out of the total). */
export const SEGMENTS = [
  { id: 'gold5a', kind: 'gold', amount: 5, label: '5 vàng', color: '#facc15', weight: 12 },
  { id: 'oran', kind: 'berry', berry: 'oran', label: 'Quả Oran', color: '#38bdf8', weight: 11 },
  { id: 'gold10a', kind: 'gold', amount: 10, label: '10 vàng', color: '#f97316', weight: 20 },
  { id: 'ticket', kind: 'ticket', amount: 1, label: 'Thêm 1 vé', color: '#f43f5e', weight: 9 },
  { id: 'gold20', kind: 'gold', amount: 20, label: '20 vàng', color: '#a855f7', weight: 10 },
  { id: 'gold5b', kind: 'gold', amount: 5, label: '5 vàng', color: '#22c55e', weight: 12 },
  { id: 'razz', kind: 'berry', berry: 'razz', label: 'Quả Razz', color: '#ec4899', weight: 8 },
  { id: 'gold50', kind: 'gold', amount: 50, label: '50 vàng', color: '#3b82f6', weight: 4 },
  { id: 'jackpot', kind: 'jackpot', amount: 100, label: 'Jackpot 100 vàng', color: '#dc2626', weight: 2 },
  { id: 'miss', kind: 'miss', label: 'Chúc may mắn lần sau', color: '#64748b', weight: 12 },
];
export const SEG_ANGLE = 360 / SEGMENTS.length;
export const TOTAL_WEIGHT = SEGMENTS.reduce((a, s) => a + s.weight, 0);
export const SPIN_TIME = 4.8; // seconds for a normal spin
export const MIN_TURNS = 4;

/** Gold a segment pays (the jackpot too). */
export const goldOf = (seg) => (seg.kind === 'gold' || seg.kind === 'jackpot' ? seg.amount : 0);

/**
 * Average gold per ticket spent. A "one more ticket" prize is another spin for free,
 * so it counts as another go: EV / (1 - p(ticket)).
 */
export function goldPerTicket() {
  const ev = SEGMENTS.reduce((a, s) => a + goldOf(s) * s.weight, 0) / TOTAL_WEIGHT;
  const pTicket = SEGMENTS.filter((s) => s.kind === 'ticket').reduce((a, s) => a + s.weight, 0) / TOTAL_WEIGHT;
  return ev / (1 - pTicket);
}

/** Pick a segment index by weight. */
export function pickSegment(random = Math.random) {
  let r = random() * TOTAL_WEIGHT;
  for (let i = 0; i < SEGMENTS.length; i++) {
    r -= SEGMENTS[i].weight;
    if (r < 0) return i;
  }
  return SEGMENTS.length - 1;
}

const mod = (a, n) => ((a % n) + n) % n;

/** Which segment is under the pointer (at the top) when the wheel is turned `rotation` degrees clockwise. */
export const segmentAt = (rotation) => Math.floor(mod(-rotation, 360) / SEG_ANGLE) % SEGMENTS.length;

export function createWheel({ random = Math.random } = {}) {
  return { random, rotation: 0, spin: null, spins: 0, last: null, events: [] };
}

/**
 * Start spinning (the ticket is paid by the caller). `power` (0.5 .. 1.5, from a swipe)
 * makes the spin a little longer and livelier. Returns the chosen segment index.
 */
export function startSpin(s, { power = 1 } = {}) {
  if (s.spin) return -1;
  const p = Math.max(0.5, Math.min(1.5, power));
  const index = pickSegment(s.random);
  // Land somewhere inside the segment, never right on a peg
  const inside = (0.18 + s.random() * 0.64) * SEG_ANGLE;
  const a = index * SEG_ANGLE + inside; // angle of that spot on the wheel
  const turns = MIN_TURNS + Math.round(p * 2);
  const from = s.rotation;
  let to = from - mod(from, 360) + turns * 360 + mod(-a, 360);
  while (to - from < turns * 360) to += 360;
  s.spin = { from, to, t: 0, duration: SPIN_TIME * (0.85 + p * 0.15), index, peg: Math.floor(from / SEG_ANGLE) };
  s.events.push({ type: 'spin', index });
  return index;
}

/** Ease-out (quartic): fast at first, slowing down smoothly like a real wheel. */
export const spinEase = (k) => 1 - (1 - k) ** 4;
export const angleAt = (spin, t) => spin.from + (spin.to - spin.from) * spinEase(Math.min(1, t / spin.duration));

export function stepWheel(s, dt) {
  const sp = s.spin;
  if (!sp) return s;
  sp.t += dt;
  s.rotation = angleAt(sp, sp.t);
  // A click each time a peg passes the pointer
  const peg = Math.floor(s.rotation / SEG_ANGLE);
  if (peg !== sp.peg) {
    sp.peg = peg;
    s.events.push({ type: 'tick', speed: 1 - spinEase(Math.min(1, sp.t / sp.duration)) });
  }
  if (sp.t >= sp.duration) {
    s.rotation = sp.to;
    s.spin = null;
    s.spins += 1;
    s.last = sp.index;
    s.events.push({ type: 'stop', index: sp.index, segment: SEGMENTS[sp.index] });
  }
  return s;
}

/** Spinning speed, degrees per second (for motion blur and the flapper). */
export function spinSpeed(s) {
  const sp = s.spin;
  if (!sp) return 0;
  const k = Math.min(1, sp.t / sp.duration);
  return ((sp.to - sp.from) * 4 * (1 - k) ** 3) / sp.duration;
}
