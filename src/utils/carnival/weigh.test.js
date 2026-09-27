import { describe, it, expect } from 'vitest';
import {
  createWeigh,
  stepWeigh,
  choose,
  nextRound,
  answerOf,
  current,
  pokemon,
  beamTarget,
  dialTarget,
  weighStars,
  POKEMON_WEIGHTS,
  PLAN,
  ROUNDS,
  REVEAL_TIME,
} from './weigh';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;
const ratio = (round) => {
  const w = round.dex.map((d) => pokemon(d).kg).sort((a, b) => a - b);
  return Math.min(...w.slice(1).map((x, i) => x / w[i]));
};

/** Answer every round with `pick(round, s)` (returns the dex to tap, or a list for order). */
function play(seed, pick) {
  const s = createWeigh({ random: seeded(seed) });
  while (s.phase !== 'done') {
    const r = current(s);
    const a = pick(r, s);
    if (Array.isArray(a)) {
      choose(s, a[0]);
      choose(s, a[1]);
    } else choose(s, a);
    while (s.phase === 'reveal') stepWeigh(s, DT);
  }
  return s;
}

describe('Snorlax weigh-in', () => {
  it('WE-01 the weights are the real Pokedex ones, all different Pokemon', () => {
    const byName = Object.fromEntries(POKEMON_WEIGHTS.map((p) => [p.name, p.kg]));
    expect(byName).toMatchObject({ Pikachu: 6.0, Snorlax: 460.0, Onix: 210.0, Jigglypuff: 5.5, Charizard: 90.5, Gengar: 40.5, Eevee: 6.5, Mew: 4.0, Magikarp: 10.0, Gyarados: 235.0, Diglett: 0.8, Togepi: 1.5 });
    expect(new Set(POKEMON_WEIGHTS.map((p) => p.dex)).size).toBe(POKEMON_WEIGHTS.length);
    expect(POKEMON_WEIGHTS.length).toBeGreaterThanOrEqual(30);
  });

  it('WE-02 ten rounds: heavier, then lighter, then order three; weights get closer', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = createWeigh({ random: seeded(seed) });
      expect(s.rounds.map((r) => r.mode)).toEqual(PLAN.map((p) => p.mode));
      s.rounds.forEach((r, i) => {
        expect(r.dex.length).toBe(r.mode === 'order' ? 3 : 2);
        expect(new Set(r.dex).size).toBe(r.dex.length);
        expect(ratio(r)).toBeGreaterThanOrEqual(PLAN[i].min);
        expect(ratio(r)).toBeLessThanOrEqual(PLAN[i].max);
      });
      expect(ratio(s.rounds[0])).toBeGreaterThan(ratio(s.rounds[4]));
      expect(ratio(s.rounds[5])).toBeGreaterThan(ratio(s.rounds[7]));
    }
  });

  it('WE-03 answering: right / wrong, the scale tilts to the heavier side and springs, then the next round', () => {
    const s = createWeigh({ random: seeded(3) });
    const r = current(s);
    const heavy = answerOf(r);
    expect(pokemon(heavy).kg).toBe(Math.max(...r.dex.map((d) => pokemon(d).kg)));
    expect(choose(s, 99999)).toBe('ignored');
    expect(choose(s, heavy)).toBe('right');
    expect(choose(s, heavy)).toBe('ignored'); // already answered
    expect(s.correct).toBe(1);
    const target = beamTarget(pokemon(r.dex[0]).kg, pokemon(r.dex[1]).kg);
    expect(Math.sign(target)).toBe(r.dex[1] === heavy ? 1 : -1);
    // It overshoots (spring), then settles
    let peak = 0;
    for (let t = 0; t < 2; t += DT) {
      stepWeigh(s, DT);
      peak = Math.max(peak, Math.abs(s.springs[0].x));
    }
    expect(peak).toBeGreaterThan(Math.abs(target));
    expect(Math.abs(s.springs[0].x - target)).toBeLessThan(0.02);
    for (let t = 0; t < REVEAL_TIME; t += DT) stepWeigh(s, DT);
    expect(s.round).toBe(1);
    expect(s.phase).toBe('ask');
    // A wrong one
    const light = current(s).dex.find((d) => d !== answerOf(current(s)));
    expect(choose(s, light)).toBe('wrong');
    expect(s.results).toEqual([true, false]);
    nextRound(s);
    expect(s.round).toBe(2);
    // Order rounds: two taps, the last goes by itself; tapping again takes it back
    const o = createWeigh({ random: seeded(4) });
    o.round = 8;
    const want = answerOf(current(o));
    expect(choose(o, want[0])).toBe('picked');
    expect(choose(o, want[0])).toBe('picked');
    expect(o.picks).toEqual([]);
    choose(o, want[0]);
    expect(choose(o, want[1])).toBe('right');
    expect(o.picks).toEqual(want);
    expect(o.springs.map((x) => x.target)).toEqual(current(o).dex.map((d) => dialTarget(pokemon(d).kg)));
    expect(dialTarget(460)).toBeGreaterThan(dialTarget(6));
  });

  it('WE-04 balance: a child who knows the Pokemon gets 3 stars; guessing gets fewer', () => {
    const seeds = Array.from({ length: 60 }, (_, i) => i + 10);
    const smart = (r, s) => {
      const want = answerOf(r);
      // Knows it when the weights are far apart; close ones are a coin toss 20% of the time
      if (ratio(r) < 1.5 && s.random() < 0.2) return r.mode === 'order' ? [want[1], want[0]] : r.dex.find((d) => d !== want);
      return want;
    };
    const guess = (r, s) => {
      const list = [...r.dex].sort(() => s.random() - 0.5);
      return r.mode === 'order' ? list : list[0];
    };
    const good = seeds.map((seed) => play(seed, smart));
    const rnd = seeds.map((seed) => play(seed, guess));
    const mean = (list) => Math.round((list.reduce((n, s) => n + s.correct, 0) / list.length) * 10) / 10;
    const share = (list, n) => Math.round((list.filter((s) => weighStars(s) === n).length / list.length) * 100);
    console.info(`[weigh] knows them: ${mean(good)}/${ROUNDS} right, ${share(good, 3)}% 3 stars · guessing: ${mean(rnd)}/${ROUNDS}, ${share(rnd, 3)}% 3 stars, ${share(rnd, 1)}% 1 star`);
    expect(share(good, 3)).toBeGreaterThanOrEqual(90);
    expect(share(rnd, 3)).toBeLessThanOrEqual(5);
    expect(mean(rnd)).toBeLessThan(6);
    expect(good.every((s) => s.phase === 'done' && s.results.length === ROUNDS)).toBe(true);
  });
});
