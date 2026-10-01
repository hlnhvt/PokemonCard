// The Poké Ball reveal after a scan, as a pure timeline: drop & bounce, three wobbles, burst
// (flash, light rays, particles), the Pokémon materialises (white → colour), lands with a squash
// and cries while the camera orbits in. revealPose(t) gives every animated value at time t.

export const REVEAL = {
  drop: 1.0, // ball falls and bounces
  wobbleStart: 1.05,
  wobbleLen: 0.42,
  wobbleGap: 0.12,
  burst: 2.75,
  appearEnd: 3.75, // Pokémon fully grown, hits the ground
  colorEnd: 4.0,
  land: 3.75,
  cry: 3.85,
  end: 4.7,
};
/** Opening a card from the collection: start at the burst (the ball pops right away). */
export const QUICK_START = REVEAL.burst - 0.35;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
/** Elastic grow 0 → 1 with a small overshoot. */
export const elastic = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + 2 ** (-9 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) * 0.6);

/** Ball height during the drop: falls from 3.2, two bounces. */
function dropY(t) {
  const H = 3.2;
  const t1 = 0.55; // first impact
  if (t <= t1) {
    const k = t / t1;
    return H * (1 - k * k);
  }
  const b1 = 0.28;
  if (t <= t1 + b1) {
    const k = (t - t1) / b1;
    return 0.45 * 4 * k * (1 - k);
  }
  const b2 = 0.17;
  if (t <= t1 + b1 + b2) {
    const k = (t - t1 - b1) / b2;
    return 0.14 * 4 * k * (1 - k);
  }
  return 0;
}

const WOBBLES = [0, 1, 2].map((i) => REVEAL.wobbleStart + i * (REVEAL.wobbleLen + REVEAL.wobbleGap));
const IMPACTS = [0.55, 0.83, 1.0];

/**
 * Everything the scene needs at time t (seconds since the reveal started):
 * ball { y, squash, tilt, open (0..1), visible, glow }, flash (0..1), rays (0..1),
 * poke { scale, y, white (1 = white silhouette), squash (0..1) }, camera { yaw, dist, lift }, done.
 */
export function revealPose(t) {
  const R = REVEAL;
  // Ball
  let squash = 0;
  for (const it of IMPACTS) {
    const d = t - it;
    if (d >= 0 && d < 0.12) squash = Math.max(squash, (1 - d / 0.12) * (it === IMPACTS[0] ? 0.35 : 0.2));
  }
  let tilt = 0;
  let glow = 0;
  for (const w of WOBBLES) {
    const k = (t - w) / R.wobbleLen;
    if (k >= 0 && k <= 1) {
      tilt = Math.sin(k * Math.PI * 2) * 0.5 * (1 - k * 0.4);
      glow = Math.sin(k * Math.PI);
    }
  }
  const open = clamp01((t - R.burst) / 0.22);
  const ballVisible = t < R.burst + 0.9;
  const by = dropY(Math.min(t, R.drop));
  const ball = { y: by < 1e-6 ? 0 : by, squash, tilt, open, visible: ballVisible, glow, fade: clamp01((t - R.burst - 0.5) / 0.4) };

  // Flash & rays
  const fb = t - R.burst;
  const flash = fb < 0 ? 0 : fb < 0.08 ? fb / 0.08 : Math.max(0, 1 - (fb - 0.08) / 0.55);
  const rays = fb < 0 ? 0 : fb < 0.2 ? fb / 0.2 : Math.max(0, 1 - (fb - 0.2) / 0.9);

  // Pokémon
  const grow = clamp01((t - (R.burst + 0.1)) / (R.appearEnd - R.burst - 0.1));
  const scale = elastic(grow);
  const fall = clamp01((t - (R.appearEnd - 0.35)) / 0.35);
  const y = t < R.appearEnd - 0.35 ? 0.55 * Math.min(1, grow * 2) : 0.55 * (1 - fall * fall);
  const white = 1 - clamp01((t - (R.appearEnd - 0.4)) / (R.colorEnd - R.appearEnd + 0.4));
  const ld = t - R.land;
  const pSquash = ld >= 0 && ld < 0.35 ? Math.sin((ld / 0.35) * Math.PI) * (1 - ld / 0.35 * 0.5) : 0;
  const poke = { scale: t < R.burst ? 0 : scale, y, white, squash: pSquash, visible: t >= R.burst + 0.1 };

  // Camera: starts low and to the side, glides in and around
  const c = easeInOut(clamp01(t / R.end));
  const camera = { yaw: -0.7 + 0.7 * c, dist: 1.25 - 0.25 * easeOut(clamp01(t / R.end)), lift: 0.35 * (1 - c) };

  return { t, ball, flash, rays, poke, camera, done: t >= R.end };
}

/** Sound/FX cues crossed in (t0, t1]: 'impact', 'wobble', 'burst', 'cry', 'done'. */
export function revealEvents(t0, t1) {
  const out = [];
  const cross = (at, type, extra) => {
    if (at > t0 && at <= t1) out.push({ type, at, ...extra });
  };
  IMPACTS.forEach((at, i) => cross(at, 'impact', { strength: i === 0 ? 1 : 0.5 }));
  WOBBLES.forEach((at, i) => cross(at, 'wobble', { index: i }));
  cross(REVEAL.burst, 'burst');
  cross(REVEAL.land, 'land');
  cross(REVEAL.cry, 'cry');
  cross(REVEAL.end, 'done');
  return out;
}
