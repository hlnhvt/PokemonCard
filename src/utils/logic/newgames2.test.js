import { describe, it, expect } from 'vitest';
import { LEVELS as ODD_LEVELS, QUESTIONS, PER_LEVEL, POKEMON, makeQuestion, createOddGame, answer, nextQuestion, oddStars } from './oddone';
import { LEVELS as SPOT_LEVELS, KINDS, makeScene, makeDifferences, createSpot, tapAt, giveHint, nextLevel, levelStars, spotStars } from './spot';
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

  it('SP-02 taps: a difference is found once, a miss is counted, hints light one up; five levels then done', () => {
    let s = createSpot({ random: seeded(7) });
    const d0 = s.diffs[0];
    let out = tapAt(s, d0.x + 3, d0.y - 3);
    expect(out.result).toBe('found');
    expect(tapAt(out.state, d0.x, d0.y).result).toBe('again');
    out = tapAt(out.state, 2, 2); // a corner of the sky: nothing changed there
    expect(out.result).toBe('miss');
    s = giveHint(out.state);
    expect(s.hint).toBe(s.diffs.find((d) => !s.found.includes(d.id)).id);
    for (let lv = 0; lv < SPOT_LEVELS.length; lv++) {
      for (const d of s.diffs) if (!s.found.includes(d.id)) s = tapAt(s, d.x, d.y).state;
      if (lv < SPOT_LEVELS.length - 1) {
        expect(s.status).toBe('levelDone');
        s = nextLevel(s);
        expect(s.level).toBe(lv + 1);
      }
    }
    expect(s.status).toBe('done');
    expect(s.stars).toHaveLength(SPOT_LEVELS.length);
    expect(s.stars[0]).toBe(levelStars(1, 1));
    expect([levelStars(0, 0), levelStars(3, 0), levelStars(2, 2)]).toEqual([3, 2, 1]);
    expect(spotStars([3, 3, 2, 3, 3])).toBe(3);
  });
});
