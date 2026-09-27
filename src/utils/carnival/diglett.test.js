import { describe, it, expect } from 'vitest';
import { createWhack, stepWhack, whack, whackStars, DURATION } from './diglett';
import { ticketsForStars, starsFor, addTickets, getTickets, spendTicket } from './tickets';
import { seeded } from '../../test/seeded';

const DT = 1 / 60;

/** Play a whole game: `tapper(s, hole, h)` decides whether to tap a hole that is up. */
function play(seed, tapper) {
  const s = createWhack({ random: seeded(seed) });
  while (s.status === 'play') {
    stepWhack(s, DT);
    s.holes.forEach((h, i) => {
      if (h && !h.hit && tapper(s, i, h)) whack(s, i);
    });
    s.events.length = 0;
  }
  return s;
}

describe('whack a Diglett', () => {
  it('CV-01 holes fill and empty, gets faster, ends after the time; tapping a Diglett scores, a Voltorb costs', () => {
    const s = createWhack({ random: seeded(1) });
    let ups = 0;
    let early = 0;
    let late = 0;
    let kinds = new Set();
    while (s.status === 'play') {
      stepWhack(s, DT);
      for (const e of s.events) {
        if (e.type !== 'up') continue;
        ups++;
        kinds.add(e.kind);
        if (s.time < DURATION / 3) early++;
        else if (s.time > (DURATION * 2) / 3) late++;
      }
      s.events.length = 0;
    }
    expect(s.time).toBeGreaterThanOrEqual(DURATION);
    expect(late).toBeGreaterThan(early);
    expect([...kinds].sort()).toEqual(['diglett', 'golden', 'voltorb']);
    expect(s.missed).toBeGreaterThan(0);
    // Tapping
    const t = createWhack({ random: seeded(2) });
    t.holes[0] = { id: 1, kind: 'diglett', t: 0.3, life: 1, hit: false };
    t.holes[1] = { id: 2, kind: 'voltorb', t: 0.3, life: 1, hit: false };
    expect(whack(t, 0)).toMatchObject({ result: 'hit', points: 10 });
    expect(whack(t, 0).result).toBe('empty'); // already hit
    expect(whack(t, 1)).toMatchObject({ result: 'boom', points: -40 });
    expect(t.score).toBe(0);
    expect(t.combo).toBe(0);
    expect(whack(t, 5).result).toBe('empty');
  });

  it('CV-02 a quick child who leaves Voltorb alone gets 3 stars; one who taps everything gets fewer; slow taps get 1', () => {
    const quick = play(3, (s, i, h) => h.kind !== 'voltorb' && h.t > 0.25);
    const everything = play(3, (s, i, h) => h.t > 0.25);
    const slow = play(3, (s, i, h) => h.kind !== 'voltorb' && h.t > h.life - 0.02 && s.random() < 0.4);
    console.info(`[diglett] careful ${quick.score}, taps everything ${everything.score}, slow ${slow.score}`);
    expect(whackStars(quick)).toBe(3);
    expect(everything.score).toBeLessThan(quick.score);
    expect(whackStars(everything)).toBeLessThan(3);
    expect(whackStars(slow)).toBe(1);
  });
});

describe('tickets', () => {
  it('CV-00 tickets are kept, spent one at a time; a game pays its stars, a perfect one more', () => {
    localStorage.removeItem('pokescan_tickets_v1');
    expect(getTickets()).toBe(0);
    expect(spendTicket()).toBe(-1);
    expect(addTickets(3)).toBe(3);
    expect(spendTicket()).toBe(2);
    expect([ticketsForStars(1), ticketsForStars(2), ticketsForStars(3)]).toEqual([1, 2, 4]);
    expect([starsFor(5, 10, 20), starsFor(10, 10, 20), starsFor(25, 10, 20)]).toEqual([1, 2, 3]);
    localStorage.removeItem('pokescan_tickets_v1');
  });
});
