import { describe, it, expect } from 'vitest';
import { LEVELS as ODD_LEVELS, QUESTIONS, PER_LEVEL, POKEMON, makeQuestion, createOddGame, answer, nextQuestion, oddStars } from './oddone';
import { LEVELS as SPOT_LEVELS, TIERS as SPOT_TIERS, KINDS, makeScene, makeDifferences, createSpot, tapAt, giveHint, levelStars, levelOpen as spotOpen } from './spot';
import { RHYTHM_LEVELS, TIERS, SPEEDS, createRun, makeChart, tapLane, sweepMisses, rhythmStars, levelOpen, levelTitle, LANES } from './rhythm';
import { seeded } from '../../test/seeded';

describe('odd one out', () => {
  it('OD-01 every question: 4 different items, exactly one with a different tag, a rule to explain it', () => {
    for (let lv = 0; lv < ODD_LEVELS.length; lv++) {
      for (let s = 1; s <= 40; s++) {
        const q = makeQuestion(lv, seeded(lv * 100 + s));
        expect(q.items).toHaveLength(4);
        expect(new Set(q.items.map((i) => i.key)).size).toBe(4);
        const tags = q.items.map((i) => i.tag);
        expect(tags.filter((t) => t === q.groupTag)).toHaveLength(3);
        expect(tags[q.odd]).toBe(q.oddTag);
        expect(q.oddTag).not.toBe(q.groupTag);
        expect(q.rule.length).toBeGreaterThan(8);
      }
    }
  });

  it('OD-02 numbers follow the rule; family questions are tricky (the odd one usually has the same type)', () => {
    let sameType = 0;
    for (let s = 1; s <= 40; s++) {
      const n = makeQuestion(2, seeded(s));
      const rest = n.items.filter((_, i) => i !== n.odd).map((i) => i.value);
      if (n.groupTag === 'Số chẵn') expect(rest.every((v) => v % 2 === 0) && n.items[n.odd].value % 2 === 1).toBe(true);
      if (n.groupTag === 'Lớn hơn 10') expect(rest.every((v) => v > 10) && n.items[n.odd].value <= 10).toBe(true);
      const f = makeQuestion(3, seeded(s));
      const poke = (item) => POKEMON.find((p) => item.label === p.name);
      const fam = f.items.filter((_, i) => i !== f.odd).map(poke);
      expect(new Set(fam.map((p) => p.family)).size).toBe(1);
      expect(poke(f.items[f.odd]).family).not.toBe(fam[0].family);
      if (poke(f.items[f.odd]).type === fam[0].type) sameType++;
    }
    expect(sameType).toBeGreaterThan(20);
  });

  it('OD-03 a game: wrong taps count as mistakes, the right one moves on; level ups; stars', () => {
    let g = createOddGame(seeded(3));
    expect(g.questions).toHaveLength(QUESTIONS);
    const q = g.questions[0];
    const wrong = (q.odd + 1) % 4;
    let out = answer(g, wrong);
    expect(out.result).toBe('wrong');
    expect(answer(out.game, wrong).result).toBe('ignored'); // already marked
    out = answer(out.game, q.odd);
    expect(out.result).toBe('right');
    g = out.game;
    let levelUps = 0;
    for (let i = 0; i < QUESTIONS; i++) {
      if (g.status === 'ask') g = answer(g, g.questions[g.index].odd).game;
      const n = nextQuestion(g);
      if (n.levelUp) levelUps++;
      g = n.game;
    }
    expect(g.status).toBe('done');
    expect(levelUps).toBe(ODD_LEVELS.length - 1);
    expect(g.mistakes).toBe(1);
    expect([oddStars(1), oddStars(4), oddStars(9)]).toEqual([3, 2, 1]);
    expect(PER_LEVEL).toBeGreaterThanOrEqual(3);
  });
});

describe('spot the difference', () => {
  it('SP-01 scenes: right count, sky things in the sky, nothing overlapping; differences are all different objects', () => {
    for (let lv = 0; lv < SPOT_LEVELS.length; lv++) {
      for (let s = 1; s <= 20; s++) {
        const r = seeded(lv * 50 + s);
        const scene = makeScene(lv, r);
        expect(scene.objects).toHaveLength(SPOT_LEVELS[lv].objects);
        for (const o of scene.objects) expect(KINDS[o.kind].where === 'sky').toBe(o.y < 92);
        for (const a of scene.objects) for (const b of scene.objects) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(20);
        const { right, diffs } = makeDifferences(scene, SPOT_LEVELS[lv].diffs, r);
        expect(diffs).toHaveLength(SPOT_LEVELS[lv].diffs);
        expect(new Set(diffs.map((d) => `${Math.round(d.x)},${Math.round(d.y)}`)).size).toBe(diffs.length);
        // Each difference really changes the picture
        for (const d of diffs) {
          const before = scene.objects.find((o) => Math.hypot(o.x - d.x, o.y - d.y) < 1);
          const after = right.find((o) => Math.hypot(o.x - d.x, o.y - d.y) < 1);
          if (d.change === 'gone') expect(after).toBeUndefined();
          else if (d.change === 'extra') expect(before).toBeUndefined();
          else expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
        }
      }
    }
  });

  it('SP-02 one level: a difference is found once, a miss is counted, a hint lights one up; all found ends it with stars', () => {
    let s = createSpot({ random: seeded(7), level: 0 });
    const d0 = s.diffs[0];
    let out = tapAt(s, d0.x + 3, d0.y - 3);
    expect(out.result).toBe('found');
    expect(tapAt(out.state, d0.x, d0.y).result).toBe('again');
    out = tapAt(out.state, 2, 2);
    expect(out.result).toBe('miss');
    s = giveHint(out.state);
    expect(s.hint).toBe(s.diffs.find((d) => !s.found.includes(d.id)).id);
    for (const d of s.diffs) if (!s.found.includes(d.id)) s = tapAt(s, d.x, d.y).state;
    expect(s.status).toBe('done');
    expect(s.stars).toBe(levelStars(1, 1));
    expect([levelStars(0, 0), levelStars(3, 0), levelStars(2, 2)]).toEqual([3, 2, 1]);
  });

  it('SP-03 35 levels in 3 tiers: more things and differences, subtle changes in the hard tier, four sceneries; tiers open on their own', () => {
    expect(SPOT_LEVELS).toHaveLength(35);
    expect(new Set(SPOT_LEVELS.map((l) => l.id)).size).toBe(35);
    expect(SPOT_TIERS.map((t) => SPOT_LEVELS.filter((l) => l.tier === t.id).length)).toEqual([12, 12, 11]);
    for (let i = 1; i < 35; i++) {
      expect(SPOT_LEVELS[i].objects).toBeGreaterThanOrEqual(SPOT_LEVELS[i - 1].objects);
      expect(SPOT_LEVELS[i].diffs).toBeGreaterThanOrEqual(SPOT_LEVELS[i - 1].diffs);
    }
    expect(SPOT_LEVELS[34]).toMatchObject({ diffs: 7, subtle: true });
    expect(new Set(SPOT_LEVELS.map((l) => l.theme)).size).toBe(4);
    // Every level can be built with all its differences
    for (let i = 0; i < 35; i++) {
      const s = createSpot({ random: seeded(i + 1), level: i });
      expect(s.left).toHaveLength(SPOT_LEVELS[i].objects);
      expect(s.diffs).toHaveLength(SPOT_LEVELS[i].diffs);
    }
    const progress = { s1: 2 };
    expect([spotOpen(progress, 0), spotOpen(progress, 1), spotOpen(progress, 2), spotOpen(progress, 12), spotOpen(progress, 24)]).toEqual([true, true, false, true, true]);
  });
});

describe('rhythm levels', () => {
  it('RH-05 34 levels (the 4 old ones first), 3 tiers, faster and denser towards the end; every chart is playable', () => {
    expect(RHYTHM_LEVELS).toHaveLength(34);
    expect(new Set(RHYTHM_LEVELS.map((l) => l.id)).size).toBe(34);
    expect(RHYTHM_LEVELS.slice(0, 2).map((l) => l.id)).toEqual(['hotcross', 'twinkle']);
    expect(TIERS.map((t) => RHYTHM_LEVELS.filter((l) => l.tier === t.id).length)).toEqual([12, 11, 11]);
    const avg = (tier) => { const ls = RHYTHM_LEVELS.filter((l) => l.tier === tier); return ls.reduce((a, l) => a + l.speed, 0) / ls.length; };
    expect(avg('easy')).toBeLessThan(avg('medium'));
    expect(avg('medium')).toBeLessThan(avg('hard'));
    for (const lv of RHYTHM_LEVELS) {
      const chart = makeChart(lv.id);
      expect(levelTitle(lv).length).toBeGreaterThan(3);
      for (const n of chart) expect(n.lane >= 0 && n.lane < LANES).toBe(true);
      for (let i = 1; i < chart.length; i++) expect(chart[i].time).toBeGreaterThanOrEqual(chart[i - 1].time);
      // Two notes at the same moment only in chord levels, and never in the same lane
      const same = chart.filter((n, i) => i && n.time === chart[i - 1].time);
      if (lv.variant !== 'chord') expect(same).toHaveLength(0);
      for (const n of same) expect(chart.find((m) => m.time === n.time && m.id !== n.id).lane).not.toBe(n.lane);
      // A perfect run is 3 stars
      let run = createRun(lv.id);
      for (const n of run.chart) run = tapLane(run, n.lane, n.time + 0.02).state;
      run = sweepMisses(run, run.end + 1).state;
      expect(rhythmStars(run)).toBe(3);
    }
    const dense = makeChart('hotcross-dense');
    expect(dense.length).toBeGreaterThan(makeChart('hotcross').length);
  });

  it('RH-06 speed: faster songs and faster falling notes, the first note is always seen falling', () => {
    expect(SPEEDS.map((s) => s.value)).toEqual([0.75, 1, 1.25, 1.5]);
    const slow = createRun('twinkle', { speed: 0.75 });
    const fast = createRun('twinkle', { speed: 1.5 });
    const span = (r) => r.chart[r.chart.length - 1].time - r.chart[0].time;
    expect(span(slow)).toBeCloseTo(span(fast) * 2, 5);
    expect(fast.fall).toBeLessThan(slow.fall);
    for (const r of [slow, fast]) expect(r.chart[0].time).toBeGreaterThan(r.fall);
    expect([levelOpen({}, 0), levelOpen({}, 1), levelOpen({ hotcross: 1 }, 1), levelOpen({}, 12), levelOpen({}, 23)]).toEqual([true, false, true, true, true]);
  });
});

