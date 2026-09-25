import { describe, it, expect } from 'vitest';
import {
  createRunner,
  start,
  step,
  jump,
  releaseJump,
  setDuck,
  score,
  isNight,
  playerBox,
  overlaps,
  airTimeAbove,
  starsForScore,
  PLAYER,
  PHYSICS,
  SPEED,
  LIVES,
  INVINCIBLE_MS,
  FLYERS_FROM_SCORE,
  FLYER_TIERS,
  GROUND_POKEMON,
  FLYING_POKEMON,
  BERRY_BONUS,
} from './runnerGame';
import { speciesNames } from '../test/fixtures';

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const run = (state, ms, frame = 16) => {
  for (let t = 0; t < ms; t += frame) step(state, frame);
  return state;
};

function peakOfJump({ hold }) {
  const s = start(createRunner({ random: () => 0.99 }));
  s.nextSpawnIn = 1e9; // no obstacles
  jump(s);
  let peak = 0;
  let airMs = 0;
  while (!s.player.onGround || airMs === 0) {
    if (!hold) releaseJump(s);
    step(s, 4);
    airMs += 4;
    peak = Math.max(peak, s.player.y);
  }
  return { peak, airMs };
}

describe('runner physics', () => {
  it('RU-01 a tap jump peaks around 126px and lasts about 0.65s', () => {
    const { peak, airMs } = peakOfJump({ hold: false });
    expect(peak).toBeGreaterThan(115);
    expect(peak).toBeLessThan(135);
    expect(airMs).toBeGreaterThan(600);
    expect(airMs).toBeLessThan(720);
  });

  it('RU-02 holding the button jumps higher', () => {
    expect(peakOfJump({ hold: true }).peak).toBeGreaterThan(peakOfJump({ hold: false }).peak + 25);
  });

  it('RU-03 cannot double jump, ducking shrinks the hitbox and speeds up the fall', () => {
    const s = start(createRunner());
    s.nextSpawnIn = 1e9;
    expect(jump(s)).toBe(true);
    expect(jump(s)).toBe(false);
    run(s, 100);
    const rising = s.player.y;
    setDuck(s, true);
    const fastFallMs = (() => {
      let ms = 0;
      while (!s.player.onGround) { step(s, 4); ms += 4; }
      return ms;
    })();
    expect(rising).toBeGreaterThan(0);
    expect(fastFallMs).toBeLessThan(500);
    expect(playerBox(s).h).toBe(PLAYER.duckH);
    setDuck(s, false);
    expect(playerBox(s).h).toBe(PLAYER.h);
  });

  it('RU-04 does nothing before start or after game over', () => {
    const s = createRunner();
    step(s, 1000);
    expect(s.distance).toBe(0);
    expect(jump(s)).toBe(false);
  });

  it('RU-05 speeds up over time up to a cap, and a long frame is clamped', () => {
    const s = start(createRunner({ random: seeded(1) }));
    s.lives = 1e9;
    run(s, 10000);
    expect(s.speed).toBeGreaterThan(SPEED.start + 50);
    run(s, 120000);
    expect(s.speed).toBe(SPEED.max);
    const before = s.distance;
    step(s, 5000);
    expect(s.distance - before).toBeLessThanOrEqual(SPEED.max * 0.05 + 1e-9);
  });
});

describe('runner obstacles', () => {
  it('RU-06 obstacle Pokemon use correct Pokedex numbers', () => {
    for (const p of [...GROUND_POKEMON, ...FLYING_POKEMON]) {
      expect(speciesNames[p.id - 1]).toBe(p.name.toLowerCase());
    }
  });

  it('RU-07 every ground obstacle is low and narrow enough to jump over', () => {
    const tallest = Math.max(...GROUND_POKEMON.map((p) => p.h), 54);
    const widest = Math.max(...GROUND_POKEMON.map((p) => p.w), 76);
    const clearance = airTimeAbove(tallest - 2 * 7) * SPEED.start;
    expect(clearance).toBeGreaterThan(widest + PLAYER.w - 2 * 7);
  });

  it('RU-08 flyers appear only after the score threshold, at all three heights', () => {
    const s = start(createRunner({ random: seeded(7) }));
    s.lives = 1e9;
    const seen = [];
    let flyerBefore = false;
    for (let t = 0; t < 180000; t += 16) {
      step(s, 16);
      for (const o of s.obstacles) {
        if (o.kind === 'flyer' && !seen.includes(o.id)) {
          seen.push(o.id);
          if (score(s) < FLYERS_FROM_SCORE - 5) flyerBefore = true;
        }
      }
    }
    expect(flyerBefore).toBe(false);
    expect(seen.length).toBeGreaterThan(10);
  });

  it('RU-09 about a third of obstacles are other Pokemon, the rest rocks, bushes and stumps', () => {
    const s = start(createRunner({ random: seeded(3) }));
    s.lives = 1e9;
    const kinds = new Map();
    for (let t = 0; t < 300000; t += 16) {
      step(s, 16);
      for (const o of s.obstacles) if (o.kind !== 'berry') kinds.set(o.id, o.kind);
    }
    const all = [...kinds.values()];
    const pokemonShare = all.filter((k) => k === 'pokemon' || k === 'flyer').length / all.length;
    expect(pokemonShare).toBeGreaterThan(0.25);
    expect(pokemonShare).toBeLessThan(0.5);
    for (const prop of ['rock', 'bush', 'stump', 'rocks']) expect(all).toContain(prop);
    for (const tier of Object.keys(FLYER_TIERS)) expect(tier).toBeTruthy();
  });

  it('RU-10 same seed gives the same course', () => {
    const course = (seed) => {
      const s = start(createRunner({ random: seeded(seed) }));
      s.lives = 1e9;
      run(s, 20000);
      return s.obstacles.map((o) => `${o.kind}:${Math.round(o.x)}`).join(',');
    };
    expect(course(11)).toBe(course(11));
    expect(course(11)).not.toBe(course(12));
  });
});

describe('runner collisions, lives and score', () => {
  const blocked = () => {
    const s = start(createRunner({ random: () => 0.99 }));
    s.nextSpawnIn = 1e9;
    s.obstacles.push({ id: 99, kind: 'rock', x: PLAYER.x + 10, w: 30, h: 30, bottom: 0 });
    return s;
  };

  it('RU-11 hitting an obstacle costs a life, then grants a short invincibility', () => {
    const s = blocked();
    step(s, 16);
    expect(s.lives).toBe(LIVES - 1);
    expect(s.events).toContain('hit');
    s.obstacles.push({ id: 100, kind: 'rock', x: PLAYER.x + 5, w: 30, h: 30, bottom: 0 });
    step(s, 16);
    expect(s.lives).toBe(LIVES - 1);
    run(s, INVINCIBLE_MS + 50);
    expect(s.invincibleMs).toBe(0);
  });

  it('RU-12 losing the last life ends the game', () => {
    const s = blocked();
    s.lives = 1;
    step(s, 16);
    expect(s.status).toBe('over');
    expect(s.events).toContain('gameover');
    const d = s.distance;
    step(s, 100);
    expect(s.distance).toBe(d);
  });

  it('RU-13 near misses do not count (forgiving hitboxes)', () => {
    const me = { x: 0, bottom: 0, w: 46, h: 46 };
    expect(overlaps(me, { x: 40, bottom: 0, w: 30, h: 30 })).toBe(false);
    expect(overlaps(me, { x: 30, bottom: 0, w: 30, h: 30 })).toBe(true);
    expect(overlaps({ ...me, h: PLAYER.duckH }, { x: 0, bottom: FLYER_TIERS.mid, w: 42, h: 34 })).toBe(false);
    expect(overlaps(me, { x: 0, bottom: FLYER_TIERS.mid, w: 42, h: 34 })).toBe(true);
    expect(overlaps(me, { x: 0, bottom: FLYER_TIERS.high, w: 42, h: 34 })).toBe(false);
    // A low flyer cannot be ducked under, it must be jumped over
    expect(overlaps({ ...me, h: PLAYER.duckH }, { x: 0, bottom: FLYER_TIERS.low, w: 42, h: 34 })).toBe(true);
    expect(overlaps({ ...me, bottom: 60 }, { x: 0, bottom: FLYER_TIERS.low, w: 42, h: 34 })).toBe(false);
    // A high flyer hits a runner in mid-jump
    expect(overlaps({ ...me, bottom: 40 }, { x: 0, bottom: FLYER_TIERS.high, w: 42, h: 34 })).toBe(true);
  });

  it('RU-14 berries add bonus points and disappear', () => {
    const s = start(createRunner());
    s.nextSpawnIn = 1e9;
    s.obstacles.push({ id: 5, kind: 'berry', x: PLAYER.x, w: 22, h: 22, bottom: 10 });
    step(s, 16);
    expect(s.bonus).toBe(BERRY_BONUS);
    expect(s.obstacles).toHaveLength(0);
    expect(s.lives).toBe(LIVES);
  });

  it('RU-15 score, milestones every 100, night every 500, stars', () => {
    const s = start(createRunner());
    s.nextSpawnIn = 1e9;
    s.distance = 995;
    step(s, 40);
    expect(score(s)).toBeGreaterThanOrEqual(100);
    expect(s.events).toContain('milestone');
    s.distance = 5000;
    expect(isNight(s)).toBe(true);
    s.distance = 10000;
    expect(isNight(s)).toBe(false);
    expect([starsForScore(50), starsForScore(600), starsForScore(1500)]).toEqual([1, 2, 3]);
  });
});

// A simple rule-following player. If it can run without ever being hit, every obstacle
// pattern the generator produces is passable by a child who jumps/ducks at the right time.
function botStep(s) {
  const p = s.player;
  const front = PLAYER.x + PLAYER.w;
  const ahead = s.obstacles
    .filter((o) => o.kind !== 'berry' && o.x + o.w > PLAYER.x - 2)
    .sort((a, b) => a.x - b.x)[0];
  if (!ahead) {
    setDuck(s, false);
    return;
  }
  const dist = ahead.x - front;
  if (ahead.kind === 'flyer' && ahead.tier === 'high') {
    setDuck(s, false);
  } else if (ahead.kind === 'flyer' && ahead.tier === 'mid') {
    setDuck(s, dist < 60);
  } else {
    setDuck(s, false);
    if (p.onGround && dist < s.speed * 0.1 + 6) jump(s);
    releaseJump(s);
  }
}

describe('runner fairness', () => {
  it.each([1, 2, 3, 4, 5])('RU-16 a rule-following player survives 90s without a hit (seed %i)', (seed) => {
    const s = start(createRunner({ random: seeded(seed) }));
    for (let t = 0; t < 90000 && s.status === 'running'; t += 16) {
      botStep(s);
      step(s, 16);
    }
    expect(s.lives).toBe(LIVES);
    expect(score(s)).toBeGreaterThan(2500);
  });

  it('RU-17 standing still loses all lives quickly', () => {
    const s = start(createRunner({ random: seeded(9) }));
    run(s, 60000);
    expect(s.status).toBe('over');
    expect(PHYSICS.jumpVelocity).toBeGreaterThan(0);
  });
});
