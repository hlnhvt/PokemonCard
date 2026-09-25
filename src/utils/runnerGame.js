// Engine of the "Pokemon runner" minigame (Chrome's offline dino game, with the scanned
// Pokemon as the runner). Pure and deterministic given `random`, so it can be unit tested;
// drawing lives in runnerDraw.js and input/loop in components/RunnerGame.jsx.
//
// Units: logical pixels in a WORLD.width x WORLD.height scene, heights measured upwards
// from the ground, time in milliseconds for public APIs.

export const WORLD = { width: 600, height: 220, groundY: 190 };
export const PLAYER = { x: 56, w: 46, h: 46, duckH: 28 };
export const PHYSICS = {
  gravity: 2400,
  jumpVelocity: 780,
  // Holding the jump button while rising makes the jump higher (like the original game)
  holdGravityFactor: 0.55,
  maxHoldMs: 220,
  // Ducking in the air pulls the runner down faster
  fastFallFactor: 2.4,
};
export const SPEED = { start: 250, accel: 6, max: 580 };
export const LIVES = 3;
export const INVINCIBLE_MS = 1500;
export const FLYERS_FROM_SCORE = 150;
export const BERRY_BONUS = 20;
// Hitboxes shrink by this much on every side so near misses count as misses (child-friendly)
export const HIT_INSET = 7;

// Other Pokemon that sometimes block the way (National Pokedex numbers)
export const GROUND_POKEMON = [
  { name: 'Diglett', id: 50, w: 40, h: 38 },
  { name: 'Geodude', id: 74, w: 50, h: 38 },
  { name: 'Voltorb', id: 100, w: 40, h: 40 },
  { name: 'Shellder', id: 90, w: 42, h: 38 },
  { name: 'Slowpoke', id: 79, w: 60, h: 44 },
  { name: 'Sudowoodo', id: 185, w: 40, h: 54 },
  { name: 'Ferroseed', id: 597, w: 40, h: 38 },
  { name: 'Snorlax', id: 143, w: 66, h: 50 },
];
export const FLYING_POKEMON = [
  { name: 'Pidgey', id: 16 },
  { name: 'Zubat', id: 41 },
  { name: 'Butterfree', id: 12 },
  { name: 'Hoothoot', id: 163 },
  { name: 'Wingull', id: 278 },
  { name: 'Fletchling', id: 661 },
];

// Flying obstacles cross at three heights (bottom edge above the ground):
// low -> jump over (too low to duck under), mid -> duck under or jump (hits a standing
// runner), high -> just keep running (only hits a jumping runner). Values account for HIT_INSET.
export const FLYER_TIERS = { low: 4, mid: 26, high: 56 };
const FLYER_SIZE = { w: 42, h: 34 };

const PROPS = ['rock', 'bush', 'stump', 'rocks'];

export function createRunner({ random = Math.random } = {}) {
  return {
    status: 'ready', // 'ready' | 'running' | 'over'
    random,
    time: 0,
    distance: 0,
    bonus: 0,
    speed: SPEED.start,
    lives: LIVES,
    invincibleMs: 0,
    lastMilestone: 0,
    nextSpawnIn: 320,
    nextId: 1,
    obstacles: [],
    events: [],
    // Berries picked up this run, by type; they go into the child's berry bag
    collected: { oran: 0, razz: 0 },
    player: { y: 0, vy: 0, onGround: true, ducking: false, holding: false, holdMs: 0 },
  };
}

export function score(state) {
  return Math.floor(state.distance / 10) + state.bonus;
}

/** Night falls every 500 points, like the original game. */
export function isNight(state) {
  return Math.floor(score(state) / 500) % 2 === 1;
}

export function start(state) {
  if (state.status === 'ready') state.status = 'running';
  return state;
}

export function jump(state) {
  const p = state.player;
  if (state.status !== 'running' || !p.onGround) return false;
  p.vy = PHYSICS.jumpVelocity;
  p.onGround = false;
  p.holding = true;
  p.holdMs = 0;
  p.ducking = false;
  state.events.push('jump');
  return true;
}

export function releaseJump(state) {
  state.player.holding = false;
}

export function setDuck(state, on) {
  state.player.ducking = !!on;
  if (on) state.player.holding = false;
}

export function playerBox(state) {
  const p = state.player;
  const h = p.ducking && p.onGround ? PLAYER.duckH : PLAYER.h;
  return { x: PLAYER.x, bottom: p.y, w: PLAYER.w, h };
}

/** Axis-aligned overlap test in ground-up coordinates, with the forgiving inset. */
export function overlaps(a, b, inset = HIT_INSET) {
  return (
    a.x + inset < b.x + b.w - inset &&
    b.x + inset < a.x + a.w - inset &&
    a.bottom + inset < b.bottom + b.h - inset &&
    b.bottom + inset < a.bottom + a.h - inset
  );
}

/** Seconds the runner's feet stay above `height` during a plain (not held) jump. */
export function airTimeAbove(height) {
  const { jumpVelocity: v, gravity: g } = PHYSICS;
  const d = v * v - 2 * g * height;
  return d <= 0 ? 0 : (2 * Math.sqrt(d)) / g;
}

const between = (random, lo, hi) => lo + random() * (hi - lo);
const pick = (random, list) => list[Math.floor(random() * list.length) % list.length];

function makeObstacle(state) {
  const { random } = state;
  const r = random();
  const flyersAllowed = score(state) >= FLYERS_FROM_SCORE;

  if (flyersAllowed && r < 0.22) {
    const tier = pick(random, Object.keys(FLYER_TIERS));
    const who = pick(random, FLYING_POKEMON);
    return { kind: 'flyer', tier, name: who.name, pokemonId: who.id, w: FLYER_SIZE.w, h: FLYER_SIZE.h, bottom: FLYER_TIERS[tier] };
  }
  if (r < 0.42) {
    const who = pick(random, GROUND_POKEMON);
    return { kind: 'pokemon', name: who.name, pokemonId: who.id, w: who.w, h: who.h, bottom: 0 };
  }
  const prop = pick(random, PROPS);
  const size = {
    rock: [between(random, 26, 38), between(random, 22, 32)],
    bush: [between(random, 32, 48), between(random, 28, 38)],
    stump: [between(random, 22, 28), between(random, 42, 54)],
    rocks: [between(random, 56, 76), between(random, 22, 30)],
  }[prop];
  return { kind: prop, w: Math.round(size[0]), h: Math.round(size[1]), bottom: 0 };
}

function spawn(state) {
  const { random } = state;
  const obstacle = makeObstacle(state);
  obstacle.id = state.nextId++;
  obstacle.x = WORLD.width + 20;
  obstacle.phase = random() * Math.PI * 2; // wing flap / bob offset for drawing
  state.obstacles.push(obstacle);

  // Leave enough room to land and react before the next obstacle
  const minGap = state.speed * 0.7 + obstacle.w + 110;
  const gap = minGap + random() * state.speed * 0.9;
  state.nextSpawnIn = gap;

  // Sometimes a berry floats in the gap, high enough that it takes a jump to grab it
  if (random() < 0.3) {
    state.obstacles.push({
      id: state.nextId++,
      kind: 'berry',
      berry: random() < 0.5 ? 'oran' : 'razz',
      x: obstacle.x + obstacle.w + gap / 2,
      w: 22,
      h: 22,
      bottom: 70,
      phase: 0,
    });
  }
}

/**
 * Advance the game by dtMs. Mutates and returns the state; `state.events` collects what
 * happened ('jump', 'land', 'hit', 'berry', 'milestone', 'gameover') for sounds/effects.
 */
export function step(state, dtMs) {
  if (state.status !== 'running') return state;
  const ms = Math.max(0, Math.min(dtMs, 50)); // avoid tunnelling after a tab switch
  const dt = ms / 1000;
  state.time += ms;
  state.speed = Math.min(SPEED.max, state.speed + SPEED.accel * dt);

  const dx = state.speed * dt;
  state.distance += dx;

  // Runner physics
  const p = state.player;
  if (!p.onGround) {
    let g = PHYSICS.gravity;
    if (p.holding && p.vy > 0 && p.holdMs < PHYSICS.maxHoldMs) {
      g *= PHYSICS.holdGravityFactor;
      p.holdMs += ms;
    }
    if (p.ducking) g *= PHYSICS.fastFallFactor;
    p.vy -= g * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.onGround = true;
      p.holding = false;
      state.events.push('land');
    }
  }

  // Scroll obstacles (flyers glide a little faster) and drop the ones that left the screen
  for (const o of state.obstacles) o.x -= dx * (o.kind === 'flyer' ? 1.1 : 1);
  state.obstacles = state.obstacles.filter((o) => o.x + o.w > -30);

  state.nextSpawnIn -= dx;
  if (state.nextSpawnIn <= 0) spawn(state);

  // Collisions
  const me = playerBox(state);
  for (const o of state.obstacles) {
    if (o.taken || o.hit || !overlaps(me, o)) continue;
    if (o.kind === 'berry') {
      o.taken = true;
      state.bonus += BERRY_BONUS;
      state.collected[o.berry] = (state.collected[o.berry] || 0) + 1;
      state.events.push('berry');
    } else if (state.invincibleMs <= 0) {
      o.hit = true;
      state.lives -= 1;
      state.invincibleMs = INVINCIBLE_MS;
      state.events.push('hit');
      if (state.lives <= 0) {
        state.status = 'over';
        state.events.push('gameover');
      }
    }
  }
  state.obstacles = state.obstacles.filter((o) => !o.taken);
  state.invincibleMs = Math.max(0, state.invincibleMs - ms);

  const milestone = Math.floor(score(state) / 100);
  if (milestone > state.lastMilestone) {
    state.lastMilestone = milestone;
    state.events.push('milestone');
  }
  return state;
}

/** Stars for the end screen. */
export function starsForScore(value) {
  if (value >= 1200) return 3;
  if (value >= 500) return 2;
  return 1;
}
