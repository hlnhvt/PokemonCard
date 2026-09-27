import { describe, it, expect, beforeEach } from 'vitest';
import {
  BABIES,
  RARITY,
  TOTAL_WEIGHT,
  SHINY_CHANCE,
  GOLD,
  EGG_STYLES,
  CRACK_STAGES,
  MIN_TAPS,
  MAX_TAPS,
  COLLECTION_KEY,
  hatchChances,
  rollBaby,
  createHatch,
  tapHatch,
  crackStage,
  hatchOutcome,
  addToCollection,
  cleanCollection,
  loadCollection,
  saveCollection,
  recordHatch,
  collectionProgress,
  createShakeDetector,
  shakeHit,
} from './eggs';
import { seeded } from '../../test/seeded';

/** A tiny in-memory storage. */
function memory() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

beforeEach(() => localStorage.removeItem(COLLECTION_KEY));

describe('egg lottery', () => {
  it('CE-01 18 distinct baby Pokémon, 6 egg styles, rare ones are rarer', () => {
    expect(BABIES).toHaveLength(18);
    expect(new Set(BABIES.map((b) => b.dex)).size).toBe(18);
    expect(BABIES.map((b) => b.dex)).toEqual([172, 173, 174, 175, 236, 238, 239, 240, 298, 360, 406, 433, 438, 439, 440, 446, 447, 458]);
    expect(EGG_STYLES).toHaveLength(6);
    expect(RARITY.rare.weight).toBeLessThan(RARITY.common.weight);
    const chances = hatchChances();
    expect(Object.values(chances).reduce((a, p) => a + p, 0)).toBeCloseTo(1, 10);
    expect(TOTAL_WEIGHT).toBe(BABIES.reduce((a, b) => a + RARITY[b.rarity].weight, 0));
  });

  it('CE-02 the weighted odds and the ~3% shiny rate hold over many rolls', () => {
    const random = seeded(11);
    const N = 60000;
    const counts = {};
    let shiny = 0;
    let rare = 0;
    for (let i = 0; i < N; i++) {
      const b = rollBaby(random);
      counts[b.dex] = (counts[b.dex] || 0) + 1;
      if (b.shiny) shiny++;
      if (b.rarity === 'rare') rare++;
    }
    const chances = hatchChances();
    for (const b of BABIES) expect(Math.abs(counts[b.dex] / N - chances[b.dex])).toBeLessThan(0.006);
    expect(shiny / N).toBeGreaterThan(SHINY_CHANCE - 0.006);
    expect(shiny / N).toBeLessThan(SHINY_CHANCE + 0.006);
    const rareShare = BABIES.filter((b) => b.rarity === 'rare').reduce((a, b) => a + chances[b.dex], 0);
    expect(Math.abs(rare / N - rareShare)).toBeLessThan(0.01);
  });

  it('CE-03 rollBaby maps the random number onto the weights (edges included)', () => {
    const seq = (...v) => {
      let i = 0;
      return () => v[i++ % v.length];
    };
    expect(rollBaby(seq(0, 0.99))).toMatchObject({ dex: 172, shiny: false });
    expect(rollBaby(seq(0.999999, 0.01))).toMatchObject({ dex: 458, shiny: true });
    // Togepi (rare, 4th) sits right after the three commons
    expect(rollBaby(seq(30 / TOTAL_WEIGHT + 1e-9, 0.5)).dex).toBe(175);
    expect(rollBaby(seq(34 / TOTAL_WEIGHT + 1e-9, 0.5)).dex).toBe(236);
  });

  it('CE-04 tapping cracks the egg step by step; it bursts after `need` taps', () => {
    const random = seeded(5);
    for (let n = 0; n < 50; n++) {
      let h = createHatch({ random, egg: n % 6 });
      expect(h.need).toBeGreaterThanOrEqual(MIN_TAPS);
      expect(h.need).toBeLessThanOrEqual(MAX_TAPS);
      expect(crackStage(h)).toBe(0);
      let prev = 0;
      for (let t = 1; t < h.need; t++) {
        h = tapHatch(h);
        const st = crackStage(h);
        expect(st).toBeGreaterThanOrEqual(prev);
        expect(st).toBeGreaterThanOrEqual(1);
        expect(h.hatched).toBe(false);
        prev = st;
      }
      expect(prev).toBe(CRACK_STAGES);
      h = tapHatch(h);
      expect(h.hatched).toBe(true);
      expect(tapHatch(h)).toBe(h);
    }
  });

  it('CE-05 gold: new 10, duplicate 5, shiny duplicate 20; the album counts and keeps shiny', () => {
    const pichu = { ...BABIES[0], shiny: false };
    let col = {};
    expect(hatchOutcome(col, pichu)).toEqual({ isNew: true, duplicate: false, gold: GOLD.new, firstShiny: false });
    col = addToCollection(col, pichu);
    expect(hatchOutcome(col, pichu)).toMatchObject({ isNew: false, duplicate: true, gold: GOLD.duplicate });
    col = addToCollection(col, pichu);
    const shinyPichu = { ...pichu, shiny: true };
    expect(hatchOutcome(col, shinyPichu)).toMatchObject({ duplicate: true, gold: GOLD.shinyDuplicate, firstShiny: true });
    col = addToCollection(col, shinyPichu);
    expect(col[172]).toEqual({ count: 3, shiny: true });
    col = addToCollection(col, pichu);
    expect(col[172]).toEqual({ count: 4, shiny: true }); // shiny is never lost
    // A shiny that is new counts as new (10 gold) and as the first shiny
    expect(hatchOutcome(col, { ...BABIES[5], shiny: true })).toMatchObject({ isNew: true, gold: GOLD.new, firstShiny: true });
    expect([GOLD.new, GOLD.duplicate, GOLD.shinyDuplicate]).toEqual([10, 5, 20]);
  });

  it('CE-06 the album is saved and loaded from localStorage; bad data is ignored', () => {
    const baby = { ...BABIES[3], shiny: false };
    const r1 = recordHatch(baby);
    expect(r1).toMatchObject({ isNew: true, gold: 10 });
    const r2 = recordHatch({ ...baby, shiny: true });
    expect(r2).toMatchObject({ isNew: false, gold: 20 });
    expect(JSON.parse(localStorage.getItem(COLLECTION_KEY))).toEqual({ 175: { count: 2, shiny: true } });
    expect(loadCollection()).toEqual({ 175: { count: 2, shiny: true } });
    expect(collectionProgress(loadCollection())).toEqual({ owned: 1, total: 18, shinies: 1, complete: false });

    localStorage.setItem(COLLECTION_KEY, 'not json');
    expect(loadCollection()).toEqual({});
    localStorage.setItem(COLLECTION_KEY, JSON.stringify({ 172: { count: 2.7 }, 999: { count: 4 }, 173: { count: -1 }, 174: 'x' }));
    expect(loadCollection()).toEqual({ 172: { count: 2, shiny: false } });
    expect(cleanCollection([1, 2])).toEqual({});

    // A custom storage, and a broken one
    const mem = memory();
    saveCollection({ 440: { count: 1, shiny: false } }, mem);
    expect(loadCollection(mem)).toEqual({ 440: { count: 1, shiny: false } });
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadCollection(broken)).toEqual({});
    expect(saveCollection({ 440: { count: 1 } }, broken)).toEqual({ 440: { count: 1, shiny: false } });
  });

  it('CE-07 a strong shake counts as a tap, with a cooldown; gentle moves do not', () => {
    const det = createShakeDetector();
    expect(shakeHit(det, { x: 1, y: 2, z: 0.5 }, 0)).toBe(false);
    expect(shakeHit(det, { x: 14, y: 3, z: 0 }, 0.1)).toBe(true);
    expect(shakeHit(det, { x: 16, y: 3, z: 0 }, 0.2)).toBe(false); // too soon
    expect(shakeHit(det, { x: 16, y: 3, z: 0 }, 0.4)).toBe(true);
    // With gravity included, resting is ~9.8 and does not count
    expect(shakeHit(det, { x: 0, y: 0, z: 9.81 }, 2, { gravity: true })).toBe(false);
    expect(shakeHit(det, { x: 18, y: 10, z: 9 }, 2.5, { gravity: true })).toBe(true);
    expect(shakeHit(det, null, 5)).toBe(false);
  });

  it('CE-08 balance: gold per ticket, tickets to fill the album, shiny rate (simulated kids)', () => {
    const random = seeded(2024);
    const KIDS = 400;
    let totalTickets = 0;
    let gold20 = 0;
    let goldAll = 0;
    let shinies = 0;
    let firstRare = 0;
    for (let k = 0; k < KIDS; k++) {
      let col = {};
      let t = 0;
      let firstRareAt = null;
      while (!collectionProgress(col).complete) {
        const h = createHatch({ random });
        const out = hatchOutcome(col, h.baby);
        col = addToCollection(col, h.baby);
        t++;
        if (t <= 20) gold20 += out.gold;
        goldAll += out.gold;
        if (h.baby.shiny) shinies++;
        if (firstRareAt == null && h.baby.rarity === 'rare') firstRareAt = t;
      }
      totalTickets += t;
      firstRare += firstRareAt;
    }
    const avgTickets = totalTickets / KIDS;
    const perTicket20 = gold20 / (KIDS * 20);
    const perTicketAll = goldAll / totalTickets;
    const shinyRate = shinies / totalTickets;
    console.info(
      `[eggs] full album in ${avgTickets.toFixed(1)} tickets on average; gold/ticket first 20 = ${perTicket20.toFixed(2)}, whole album = ${perTicketAll.toFixed(2)}; shiny ${(shinyRate * 100).toFixed(2)}%; first rare after ${(firstRare / KIDS).toFixed(1)} tickets`,
    );
    // The album takes a while but is reachable; gold stays in the lucky wheel's range (8-15 per ticket early on)
    expect(avgTickets).toBeGreaterThan(40);
    expect(avgTickets).toBeLessThan(120);
    expect(perTicket20).toBeGreaterThan(7);
    expect(perTicket20).toBeLessThan(10.5);
    expect(perTicketAll).toBeGreaterThan(5);
    expect(perTicketAll).toBeLessThan(9);
    expect(shinyRate).toBeGreaterThan(0.02);
    expect(shinyRate).toBeLessThan(0.04);
  });
});
