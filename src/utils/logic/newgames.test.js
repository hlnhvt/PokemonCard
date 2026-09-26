import { describe, it, expect } from 'vitest';
import { PAIR_LEVELS, createBoard, flipCard, hideMiss, pairStars } from './pairs';
import { RHYTHM_SONGS, makeChart, createRun, tapLane, sweepMisses, accuracy, rhythmStars, laneOf, LANES, WINDOWS } from './rhythm';
import { GYMS, LEAGUE, createLeague, recordGym, goldForGym, arenaForGym, aceOf } from '../league';
import { seeded } from '../../test/seeded';

describe('memory pairs', () => {
  it('PR-01 every level has each pair twice, shuffled; type level uses different types', () => {
    PAIR_LEVELS.forEach((level, i) => {
      const b = createBoard(i, seeded(i + 1));
      expect(b.cards).toHaveLength(level.pairs * 2);
      for (let p = 0; p < level.pairs; p++) expect(b.cards.filter((c) => c.pair === p)).toHaveLength(2);
      if (level.id === 'type') {
        const types = b.cards.filter((c) => c.face === 'type').map((c) => c.pokemon.types[0]);
        expect(new Set(types).size).toBe(level.pairs);
      }
    });
  });

  it('PR-02 matching, missing and finishing; a perfect memory gets 3 stars', () => {
    let b = createBoard(0, seeded(3));
    const first = b.cards[0];
    const wrong = b.cards.find((c) => c.pair !== first.pair);
    b = flipCard(b, first.uid).state;
    let out = flipCard(b, wrong.uid);
    expect(out.result).toBe('miss');
    expect(flipCard(out.state, b.cards[5].uid).result).toBe('ignored'); // two already open
    b = hideMiss(out.state);
    for (let p = 0; p < PAIR_LEVELS[0].pairs; p++) {
      const [x, y] = b.cards.filter((c) => c.pair === p);
      b = flipCard(b, x.uid).state;
      out = flipCard(b, y.uid);
      expect(out.result).toBe('match');
      b = out.state;
    }
    expect(b.done).toBe(true);
    expect(b.moves).toBe(PAIR_LEVELS[0].pairs + 1);
    expect(pairStars(b.moves, 6)).toBe(3);
    expect([pairStars(13, 6), pairStars(20, 6)]).toEqual([2, 1]);
  });
});

describe('rhythm', () => {
  it('RH-01 charts follow the songs, lanes go low to high, notes in time order', () => {
    expect(laneOf(0)).toBe(0);
    expect(laneOf(7)).toBe(LANES - 1);
    for (const s of RHYTHM_SONGS) {
      const c = makeChart(s.id);
      expect(c.length).toBeGreaterThanOrEqual(10);
      for (let i = 1; i < c.length; i++) expect(c[i].time).toBeGreaterThan(c[i - 1].time);
    }
  });

  it('RH-02 perfect taps score perfect, combos grow, a full perfect run is 3 stars', () => {
    let run = createRun('twinkle');
    for (const n of run.chart) {
      const out = tapLane(run, n.lane, n.time + 0.05);
      expect(out.judgement).toBe('perfect');
      run = out.state;
    }
    run = sweepMisses(run, run.end + 0.1).state;
    expect(run.done).toBe(true);
    expect(run.maxCombo).toBe(run.chart.length);
    expect(accuracy(run)).toBe(1);
    expect(rhythmStars(run)).toBe(3);
  });

  it('RH-03 late taps are good, very late or wrong lane nothing; unhit notes become misses and break the combo', () => {
    let run = createRun('hotcross');
    const [n0, n1] = run.chart;
    expect(tapLane(run, n0.lane, n0.time + WINDOWS.good + 0.05).judgement).toBeNull();
    expect(tapLane(run, (n0.lane + 1) % LANES, n0.time).judgement).toBeNull();
    let out = tapLane(run, n0.lane, n0.time + 0.2);
    expect(out.judgement).toBe('good');
    run = out.state;
    out = sweepMisses(run, n1.time + 0.5);
    expect(out.missed.map((n) => n.id)).toContain(n1.id);
    expect(out.state.combo).toBe(0);
  });

  it('RH-04 a child tapping roughly on time (±0.2s, 80% of notes) gets 2 stars or more', () => {
    const r = seeded(4);
    let run = createRun('mary');
    for (const n of run.chart) {
      if (r() < 0.8) run = tapLane(run, n.lane, n.time + (r() - 0.5) * 0.4).state;
    }
    run = sweepMisses(run, run.end + 1).state;
    console.info(`[rhythm] rough child accuracy ${Math.round(accuracy(run) * 100)}%`);
    expect(rhythmStars(run)).toBeGreaterThanOrEqual(2);
  });
});

describe('league', () => {
  it('LE-01 eight gyms then the champion, getting stronger; gold grows', () => {
    expect(GYMS).toHaveLength(8);
    expect(LEAGUE[8].id).toBe('champion');
    for (let i = 1; i < LEAGUE.length; i++) expect(LEAGUE[i].level).toBeGreaterThan(LEAGUE[i - 1].level);
    expect(new Set(GYMS.map((g) => g.type)).size).toBe(8);
    expect(goldForGym(8)).toBeGreaterThan(goldForGym(7));
    // 5 vs 5: every gym has 5 different Pokemon, the ace last, and a ground that suits its type
    for (const g of LEAGUE) {
      expect(g.team).toHaveLength(5);
      expect(new Set(g.team).size).toBe(5);
      expect(aceOf(g)).toBe(g.team[4]);
    }
    expect(arenaForGym(GYMS[6]).id).toBe('volcano');
    expect(arenaForGym(GYMS[1]).id).toBe('ocean');
    expect(arenaForGym(GYMS[4]).id).toBe('stadium');
  });

  it('LE-02 a loss stays at the gym; wins collect badges until champion', () => {
    let s = createLeague();
    s = recordGym(s, false);
    expect(s).toMatchObject({ index: 0, losses: 1, badges: [] });
    for (let i = 0; i < LEAGUE.length; i++) s = recordGym(s, true);
    expect(s.done).toBe(true);
    expect(s.badges).toHaveLength(9);
    expect(recordGym(s, true)).toBe(s);
  });
});
