import { describe, it, expect } from 'vitest';
import { createGallery, stepGallery, shoot, galleryStars, centreOf, targetAt, speedOf, timeLeft, DURATION, POINTS, W } from './psyduck';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

/** A whole game: every `every` seconds the child may shoot at what `pick(s, hand)` returns. */
function play(seed, every, pick) {
  const s = createGallery({ random: seeded(seed) });
  const hand = seeded(seed + 500);
  let wait = 0.8;
  while (s.status === 'play') {
    stepGallery(s, DT);
    wait -= DT;
    if (wait <= 0) {
      const at = pick(s, hand);
      if (at) {
        shoot(s, at.x, at.y);
        wait = every;
      }
    }
    s.events.length = 0;
  }
  return s;
}

const visible = (s) => s.targets.filter((t) => !t.hit && !t.claimed && t.x > 25 && t.x < W - 25);

describe('Psyduck shooting gallery', () => {
  it('PD-01 rows glide opposite ways, all kinds appear, it speeds up and ends after the time', () => {
    const s = createGallery({ random: seeded(1) });
    const kinds = new Set();
    const x0 = Object.fromEntries(s.targets.map((t) => [t.id, t.x]));
    stepGallery(s, 0.5);
    const moved = s.targets.filter((t) => x0[t.id] != null).map((t) => [t.row, Math.sign(t.x - x0[t.id])]);
    expect(moved.filter(([row]) => row === 0).every(([, d]) => d === 1)).toBe(true);
    expect(moved.filter(([row]) => row === 1).every(([, d]) => d === -1)).toBe(true);
    const early = speedOf(s, { row: 0, speedUp: 1 });
    while (s.status === 'play') {
      stepGallery(s, DT);
      s.targets.forEach((t) => kinds.add(t.kind));
      s.events.length = 0;
    }
    expect(speedOf(s, { row: 0, speedUp: 1 })).toBeGreaterThan(early * 1.5);
    expect(s.time).toBeGreaterThanOrEqual(DURATION);
    expect(timeLeft(s)).toBe(0);
    expect([...kinds].sort()).toEqual(['duck', 'gold', 'pikachu', 'small']);
  });

  it('PD-02 a ball hits the duck it was aimed at; nothing there breaks the combo; Pikachu costs points', () => {
    const s = createGallery({ random: seeded(2) });
    s.targets = [
      { id: 90, row: 2, kind: 'duck', x: 100, y: 420, speedUp: 1, down: 0, hit: false, bob: 0 },
      { id: 91, row: 2, kind: 'pikachu', x: 260, y: 420, speedUp: 1, down: 0, hit: false, bob: 0 },
    ];
    s.rows.forEach((r) => (r.next = 99));
    const c = centreOf(s.targets[0]);
    expect(targetAt(s, c.x + 5, c.y - 5)?.id).toBe(90);
    shoot(s, c.x, c.y);
    const types = [];
    for (let i = 0; i < 30; i++) {
      stepGallery(s, DT);
      types.push(...s.events.splice(0).map((e) => e.type));
    }
    expect(types).toContain('hit');
    expect(s.score).toBe(POINTS.duck);
    expect(s.combo).toBe(1);
    expect(s.targets[0].hit).toBe(true);
    shoot(s, 180, 60); // empty sky
    for (let i = 0; i < 30; i++) stepGallery(s, DT);
    expect(s.combo).toBe(0);
    expect(s.misses).toBe(1);
    const p = centreOf(s.targets[1]);
    shoot(s, p.x, p.y);
    for (let i = 0; i < 30; i++) stepGallery(s, DT);
    expect(s.oops).toBe(1);
    expect(s.score).toBe(0);
  });

  it('PD-03 balance: a quick careful shooter gets 3 stars, one who shoots everything fewer, a slow one 1', () => {
    // Picks the best-looking target (never Pikachu), with a small hand shake
    const avoidPika = (s, hand) => {
      const list = visible(s).filter((t) => t.kind !== 'pikachu');
      if (!list.length) return null;
      const c = centreOf(list.sort((a, b) => POINTS[b.kind] - POINTS[a.kind] || b.row - a.row)[0]);
      return { x: c.x + (hand() - 0.5) * 40, y: c.y + (hand() - 0.5) * 28 };
    };
    const good = [];
    const trigger = [];
    const slow = [];
    for (let seed = 1; seed <= 12; seed++) {
      good.push(play(seed, 0.75, avoidPika).score);
      // Shoots at anything, often a bit off
      trigger.push(play(seed, 0.4, (s, hand) => {
        const list = visible(s);
        if (!list.length) return { x: 180, y: 200 };
        const c = centreOf(list[Math.floor(hand() * list.length)]);
        return { x: c.x + (hand() - 0.5) * 100, y: c.y + (hand() - 0.5) * 70 };
      }).score);
      slow.push(play(seed, 3, avoidPika).score);
    }
    const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
    const three = good.filter((score) => galleryStars({ score }) === 3).length / good.length;
    console.info(`[psyduck] careful avg ${avg(good)} (3 stars ${Math.round(three * 100)}%), shoots everything avg ${avg(trigger)}, slow avg ${avg(slow)}`);
    expect(three).toBeGreaterThanOrEqual(0.7);
    expect(avg(trigger)).toBeLessThan(avg(good));
    expect(galleryStars({ score: avg(trigger) })).toBeLessThan(3);
    expect(galleryStars({ score: avg(slow) })).toBe(1);
  });
});
