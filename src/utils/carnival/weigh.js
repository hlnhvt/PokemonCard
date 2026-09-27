// "Đoán cân nặng Snorlax": a big carnival balance scale. Each round shows Pokemon and asks
// "Bạn nào nặng hơn?" (later "nhẹ hơn?", and at the end "Xếp từ nhẹ đến nặng" with three).
// After the answer they drop onto the scale, it tilts on a spring and their real Pokedex
// weights appear. 10 rounds; the weights get closer as the rounds go on.
// Pure rules; `random` is injectable.
import { starsFor } from './tickets';

/** Real Pokedex weights (kg). */
export const POKEMON_WEIGHTS = [
  { dex: 1, name: 'Bulbasaur', kg: 6.9 },
  { dex: 3, name: 'Venusaur', kg: 100.0 },
  { dex: 4, name: 'Charmander', kg: 8.5 },
  { dex: 6, name: 'Charizard', kg: 90.5 },
  { dex: 7, name: 'Squirtle', kg: 9.0 },
  { dex: 9, name: 'Blastoise', kg: 85.5 },
  { dex: 10, name: 'Caterpie', kg: 2.9 },
  { dex: 16, name: 'Pidgey', kg: 1.8 },
  { dex: 25, name: 'Pikachu', kg: 6.0 },
  { dex: 35, name: 'Clefairy', kg: 7.5 },
  { dex: 37, name: 'Vulpix', kg: 9.9 },
  { dex: 39, name: 'Jigglypuff', kg: 5.5 },
  { dex: 50, name: 'Diglett', kg: 0.8 },
  { dex: 52, name: 'Meowth', kg: 4.2 },
  { dex: 54, name: 'Psyduck', kg: 19.6 },
  { dex: 58, name: 'Growlithe', kg: 19.0 },
  { dex: 59, name: 'Arcanine', kg: 155.0 },
  { dex: 66, name: 'Machop', kg: 19.5 },
  { dex: 68, name: 'Machamp', kg: 130.0 },
  { dex: 74, name: 'Geodude', kg: 20.0 },
  { dex: 76, name: 'Golem', kg: 300.0 },
  { dex: 77, name: 'Ponyta', kg: 30.0 },
  { dex: 78, name: 'Rapidash', kg: 95.0 },
  { dex: 94, name: 'Gengar', kg: 40.5 },
  { dex: 95, name: 'Onix', kg: 210.0 },
  { dex: 129, name: 'Magikarp', kg: 10.0 },
  { dex: 130, name: 'Gyarados', kg: 235.0 },
  { dex: 131, name: 'Lapras', kg: 220.0 },
  { dex: 133, name: 'Eevee', kg: 6.5 },
  { dex: 143, name: 'Snorlax', kg: 460.0 },
  { dex: 149, name: 'Dragonite', kg: 210.0 },
  { dex: 150, name: 'Mewtwo', kg: 122.0 },
  { dex: 151, name: 'Mew', kg: 4.0 },
  { dex: 175, name: 'Togepi', kg: 1.5 },
  { dex: 202, name: 'Wobbuffet', kg: 28.5 },
  { dex: 448, name: 'Lucario', kg: 54.0 },
];

export const ROUNDS = 10;
/**
 * Round plan: the question and how different the weights are (ratio heavy / light).
 * Order rounds use the ratio between neighbours.
 */
export const PLAN = [
  { mode: 'heavy', min: 8, max: Infinity },
  { mode: 'heavy', min: 5, max: Infinity },
  { mode: 'heavy', min: 3, max: 12 },
  { mode: 'heavy', min: 2, max: 6 },
  { mode: 'heavy', min: 1.5, max: 3.5 },
  { mode: 'light', min: 4, max: Infinity },
  { mode: 'light', min: 1.7, max: 5 },
  { mode: 'light', min: 1.2, max: 2.2 },
  { mode: 'order', min: 2.5, max: Infinity },
  { mode: 'order', min: 1.4, max: 6 },
];
export const REVEAL_TIME = 3.4; // seconds on the scale before the next round
export const QUESTION = {
  heavy: 'Bạn nào nặng hơn?',
  light: 'Bạn nào nhẹ hơn?',
  order: 'Xếp từ nhẹ đến nặng',
};

const byDex = new Map(POKEMON_WEIGHTS.map((p) => [p.dex, p]));
export const pokemon = (dex) => byDex.get(dex);

function shuffle(list, random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick the Pokemon for one round; prefers ones not seen yet this game. */
export function pickRound(plan, random, used = new Set()) {
  const n = plan.mode === 'order' ? 3 : 2;
  const fits = (list) => {
    const w = list.map((p) => p.kg).sort((a, b) => a - b);
    for (let i = 1; i < w.length; i++) {
      const r = w[i] / w[i - 1];
      if (r < plan.min || r > plan.max) return false;
    }
    return true;
  };
  for (let relax = 0; relax < 3; relax++) {
    const pool = relax === 0 ? POKEMON_WEIGHTS.filter((p) => !used.has(p.dex)) : POKEMON_WEIGHTS;
    for (let tries = 0; tries < 600; tries++) {
      const pick = shuffle(pool, random).slice(0, n);
      if (pick.length === n && fits(pick)) return pick.map((p) => p.dex);
    }
  }
  // Never happens with the list above; still give a fair round
  const sorted = [...POKEMON_WEIGHTS].sort((a, b) => a.kg - b.kg);
  return (n === 3 ? [sorted[0], sorted[15], sorted[35]] : [sorted[2], sorted[30]]).map((p) => p.dex);
}

export function createWeigh({ random = Math.random } = {}) {
  const used = new Set();
  const rounds = PLAN.map((plan) => {
    const dex = pickRound(plan, random, used);
    dex.forEach((d) => used.add(d));
    return { mode: plan.mode, dex };
  });
  return {
    random,
    rounds,
    round: 0,
    phase: 'ask', // ask | reveal | done
    picks: [], // order mode: the dex numbers tapped so far
    choice: null,
    correct: 0,
    results: [],
    reveal: 0,
    // Spring for the beam (radians, + = right side down), or the three dial needles (0..1)
    springs: [{ x: 0, v: 0, target: 0 }],
    events: [],
  };
}

export const current = (s) => s.rounds[Math.min(s.round, ROUNDS - 1)];
/** The right answer: the dex to tap (pair), or the dex numbers light → heavy (order). */
export function answerOf(round) {
  const list = round.dex.map((d) => pokemon(d));
  if (round.mode === 'order') return [...list].sort((a, b) => a.kg - b.kg).map((p) => p.dex);
  const best = list.reduce((b, p) => (round.mode === 'heavy' ? (p.kg > b.kg ? p : b) : p.kg < b.kg ? p : b));
  return best.dex;
}

/** Beam angle for two weights: the heavier side goes down, more for a bigger difference. */
export const MAX_TILT = 0.36;
export const beamTarget = (left, right) => MAX_TILT * Math.tanh(Math.log(right / left) * 0.9);
/** Dial needle (0 .. 1) for a weight on a log scale from 0.5 kg to 500 kg. */
export const dialTarget = (kg) => Math.max(0.04, Math.min(1, Math.log10(kg / 0.5) / 3));

function startReveal(s, ok) {
  const r = current(s);
  s.phase = 'reveal';
  s.reveal = 0;
  if (ok) s.correct += 1;
  s.results.push(ok);
  const w = r.dex.map((d) => pokemon(d).kg);
  s.springs =
    r.mode === 'order'
      ? w.map((kg) => ({ x: 0, v: 0, target: dialTarget(kg) }))
      : [{ x: s.springs[0]?.x || 0, v: 0, target: beamTarget(w[0], w[1]) }];
  s.events.push({ type: ok ? 'right' : 'wrong', round: s.round });
}

/**
 * The child taps a Pokemon. Pair rounds: that is the answer. Order rounds: taps add to the
 * order (the last one goes by itself). Returns 'right' | 'wrong' | 'picked' | 'ignored'.
 */
export function choose(s, dex) {
  if (s.phase !== 'ask') return 'ignored';
  const r = current(s);
  if (!r.dex.includes(dex)) return 'ignored';
  if (r.mode !== 'order') {
    s.choice = dex;
    const ok = answerOf(r) === dex;
    startReveal(s, ok);
    return ok ? 'right' : 'wrong';
  }
  if (s.picks.includes(dex)) {
    // Tap again to take it back
    s.picks = s.picks.filter((d) => d !== dex);
    s.events.push({ type: 'unpick', dex });
    return 'picked';
  }
  s.picks = [...s.picks, dex];
  s.events.push({ type: 'pick', dex, n: s.picks.length });
  if (s.picks.length === 2) s.picks = [...s.picks, r.dex.find((d) => !s.picks.includes(d))];
  if (s.picks.length < 3) return 'picked';
  const ok = s.picks.every((d, i) => d === answerOf(r)[i]);
  startReveal(s, ok);
  return ok ? 'right' : 'wrong';
}

/** Go on after the reveal (also happens by itself after REVEAL_TIME). */
export function nextRound(s) {
  if (s.phase !== 'reveal') return;
  s.round += 1;
  s.picks = [];
  s.choice = null;
  if (s.round >= ROUNDS) {
    s.phase = 'done';
    s.events.push({ type: 'end' });
    return;
  }
  s.phase = 'ask';
  // The beam goes back to level
  s.springs = [{ x: s.springs.length === 1 ? s.springs[0].x : 0, v: 0, target: 0 }];
  s.events.push({ type: 'round', round: s.round });
}

// Spring: bouncy but settles in about a second
const K = 90;
const C = 7;
export function stepWeigh(s, dt) {
  // Wait a moment (the drop) before the scale moves
  const drop = s.phase === 'reveal' && s.reveal < 0.42;
  for (const sp of s.springs) {
    if (drop) continue;
    const a = -K * (sp.x - sp.target) - C * sp.v;
    sp.v += a * dt;
    sp.x += sp.v * dt;
  }
  if (s.phase === 'reveal') {
    const before = s.reveal;
    s.reveal += dt;
    if (before < 0.42 && s.reveal >= 0.42) s.events.push({ type: 'land' });
    if (s.reveal >= REVEAL_TIME) nextRound(s);
  }
  return s;
}

export const weighStars = (s) => starsFor(s.correct, 6, 9);
