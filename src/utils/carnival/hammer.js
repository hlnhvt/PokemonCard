// "Búa sức mạnh Machop": a carnival strength tester. A power meter swings up and down;
// the child taps to stop it, Machop brings the hammer down and the puck flies up the tower
// as high as the power. 95% or more rings the bell. 5 swings, each meter a little faster.
// Pure rules; `random` is injectable.
import { starsFor } from './tickets';

export const SWINGS = 5;
/** Meter swings (full up-and-down cycles) per second, one per swing: the last is fastest. */
export const METER_SPEED = [0.5, 0.6, 0.7, 0.82, 1.0];
export const BELL_AT = 0.95;
export const BELL_BONUS = 50;
/** Stage timings (seconds). */
export const STRIKE_TIME = 0.32; // hammer comes down
export const FLY_TIME = 0.75; // puck goes up
export const HANG_TIME = 0.55; // it stays at the top a moment
export const FALL_TIME = 0.5; // and slides back down
export const REST_TIME = 0.45; // before the next swing

const TAU = Math.PI * 2;

export function createHammer({ random = Math.random } = {}) {
  return { random, swing: 0, stage: 'aim', t: 0, phase: 0, meter: 0, power: 0, puck: 0, score: 0, best: 0, bells: 0, results: [], status: 'play', events: [] };
}

/** Meter value (0..1) for a phase in cycles: slow near the bottom and the top, like a real swing. */
export const meterAt = (phase) => (1 - Math.cos(phase * TAU)) / 2;

/** Points for one swing. */
export const pointsFor = (power) => Math.round(Math.max(0, Math.min(1, power)) * 100) + (power >= BELL_AT ? BELL_BONUS : 0);

const easeOut = (x) => 1 - (1 - x) ** 3;
const easeIn = (x) => x * x;

export function stepHammer(s, dt) {
  if (s.status !== 'play') return s;
  s.t += dt;
  if (s.stage === 'aim') {
    s.phase += METER_SPEED[s.swing] * dt;
    s.meter = meterAt(s.phase);
  } else if (s.stage === 'strike') {
    if (s.t >= STRIKE_TIME) {
      s.stage = 'fly';
      s.t = 0;
      s.events.push({ type: 'hit', power: s.power });
    }
  } else if (s.stage === 'fly') {
    s.puck = s.power * easeOut(Math.min(1, s.t / FLY_TIME));
    if (s.t >= FLY_TIME) {
      s.stage = 'hang';
      s.t = 0;
      s.puck = s.power;
      const bell = s.power >= BELL_AT;
      const points = pointsFor(s.power);
      s.score += points;
      s.best = Math.max(s.best, s.power);
      if (bell) s.bells += 1;
      s.results.push({ power: s.power, points, bell });
      s.events.push({ type: bell ? 'bell' : 'top', power: s.power, points });
    }
  } else if (s.stage === 'hang') {
    if (s.t >= HANG_TIME) {
      s.stage = 'fall';
      s.t = 0;
    }
  } else if (s.stage === 'fall') {
    s.puck = s.power * (1 - easeIn(Math.min(1, s.t / FALL_TIME)));
    if (s.t >= FALL_TIME) {
      s.stage = 'rest';
      s.t = 0;
      s.puck = 0;
      s.events.push({ type: 'land' });
    }
  } else if (s.stage === 'rest' && s.t >= REST_TIME) {
    s.swing += 1;
    s.t = 0;
    if (s.swing >= SWINGS) {
      s.swing = SWINGS - 1;
      s.status = 'done';
      s.stage = 'done';
      s.events.push({ type: 'end', score: s.score });
    } else {
      s.stage = 'aim';
      s.phase = 0;
      s.meter = 0;
      s.events.push({ type: 'next', swing: s.swing });
    }
  }
  return s;
}

/** The child taps: stop the meter and swing. Returns the power, or null when not aiming. */
export function strike(s) {
  if (s.status !== 'play' || s.stage !== 'aim') return null;
  s.power = s.meter;
  s.stage = 'strike';
  s.t = 0;
  s.events.push({ type: 'swing', power: s.power });
  return s.power;
}

/** Angle of the hammer (radians, 0 = resting on the pad, negative = raised behind). */
export function hammerAngle(s) {
  if (s.stage === 'aim') return -0.5 - 0.12 * Math.sin(s.phase * TAU); // held, breathing
  if (s.stage === 'strike') {
    const k = s.t / STRIKE_TIME;
    if (k < 0.45) return -0.5 - 1.6 * easeOut(k / 0.45); // wind up
    return -2.1 + 2.1 * easeIn((k - 0.45) / 0.55); // slam
  }
  if (s.stage === 'fly' && s.t < 0.15) return 0.08 * Math.sin((s.t / 0.15) * Math.PI); // bounce
  if (s.stage === 'rest') return -0.5 * easeOut(Math.min(1, s.t / REST_TIME)); // picked up again
  return 0;
}

export const MAX_SCORE = SWINGS * (100 + BELL_BONUS);
export const hammerStars = (s) => starsFor(s.score, 380, 600);
