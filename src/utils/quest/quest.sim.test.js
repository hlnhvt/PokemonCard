// Balance check: a bot plays act 1 with a typical team of starters (quest.sim.test.js).
// It must level up, evolve at least one starter line and beat the act-1 boss in a
// reasonable time, without the whole team fainting more than once.
import { describe, it, expect } from 'vitest';
import { createQuest, step, applyEvolution } from './engine';
import { createBot, botStep } from './bot';
import { seeded } from '../../test/seeded';
import { OPPONENT_POOL } from '../battle/opponentPool';
import { memberFromPool } from '../team/members';
import { claimReward, GOLD_PER_HOUR } from './items';

const TEAM = ['Charmander', 'Bulbasaur', 'Squirtle', 'Pikachu', 'Eevee'].map((n) => memberFromPool(OPPONENT_POOL.find((p) => p.name === n)));
const STARTERS = new Set(['Charmander', 'Bulbasaur', 'Squirtle']);
const DT = 1 / 30;

function runAct1(seed, maxMinutes = 25) {
  const s = createQuest({ team: TEAM, seed: seed * 101, random: seeded(seed) });
  const bot = createBot();
  const log = { evolutions: [], bossAt: null, levelUps: 0 };
  let t = 0;
  while (t < maxMinutes * 60 && !s.beaten.includes(0)) {
    step(s, DT, botStep(s, bot));
    t += DT;
    for (const e of s.events) {
      if (e.kind === 'evolved') log.evolutions.push({ t, from: e.from, to: e.to });
      if (e.kind === 'levelup') log.levelUps += 1;
      if (e.kind === 'boss-wake') log.bossAt = t;
    }
    s.events.length = 0;
    // The component plays the evolution sequence, then applies it
    if (s.pendingEvolution) applyEvolution(s);
  }
  return { s, t, log };
}

describe('quest balance (bot simulation)', () => {
  it('SIM-01 act 1: the bot levels up, a starter evolves and the boss falls in time', { timeout: 120000 }, () => {
    const rows = [];
    for (const seed of [1, 2, 3, 4]) {
      const { s, t, log } = runAct1(seed);
      rows.push({ seed, minutes: +(t / 60).toFixed(1), boss: log.bossAt ? +((t - log.bossAt) / 60).toFixed(2) : null, levels: s.party.map((m) => m.level), kills: s.stats.kills, wipes: s.stats.wipes, faints: s.stats.faints, gold: s.gold, evolved: log.evolutions.map((e) => e.to) });
      expect(s.beaten).toContain(0);
      expect(t / 60).toBeGreaterThan(3.5);
      expect(t / 60).toBeLessThan(18);
      expect(s.stats.wipes).toBeLessThanOrEqual(1);
      expect(Math.min(...s.party.map((m) => m.level))).toBeGreaterThanOrEqual(14);
      expect(log.evolutions.some((e) => STARTERS.has(e.from))).toBe(true);
      // The boss is a real fight but not a long one
      expect((t - log.bossAt) / 60).toBeGreaterThan(0.4);
      expect((t - log.bossAt) / 60).toBeLessThan(4);
      // App gold stays within the hourly cap
      const pay = claimReward(s.reward);
      expect(pay).toBeLessThanOrEqual((GOLD_PER_HOUR * t) / 3600 + 5);
    }
    // Printed with --reporter=verbose for tuning
    console.info(JSON.stringify(rows));
  });
});

describe('quest boss for young children', () => {
  it('SIM-02 act 1 boss: a level-15 team wins even when the child only stands and watches', { timeout: 60000 }, () => {
    const res = [];
    for (const seed of [1, 2, 3]) {
      const team = TEAM.map((m) => ({ ...m, level: 15 }));
      const s = createQuest({ save: { v: 1, seed: seed * 7, act: 0, area: 4, party: team, unlocked: 0, beaten: [] }, random: seeded(seed) });
      const boss = s.enemies.find((e) => e.boss);
      s.trainer.x = boss.x - 260;
      s.trainer.y = boss.y;
      let t = 0;
      while (t < 240 && !s.beaten.includes(0) && !s.wipe) {
        step(s, DT, {});
        s.events.length = 0;
        if (s.pendingEvolution) applyEvolution(s);
        t += DT;
      }
      res.push({ seed, seconds: Math.round(t), won: s.beaten.includes(0), fainted: s.party.filter((m) => m.fainted).length });
    }
    console.info(JSON.stringify(res));
    for (const r of res) expect(r.won).toBe(true);
  });
});
