// "Đèn xanh, đèn đỏ" (the squid-game race): hold to run towards the finish while the doll
// sings with its back turned. When it turns round (red light) anyone still moving is out.
// First over the line wins. Pure rules; `random` is injectable for tests.

export const TRACK = 1900; // distance from the start line to the finish line
export const RUN_SPEED = 118; // the child's Pokemon, per second
export const GRACE = 0.28; // seconds after the doll faces you before moving counts
export const TURN_TIME = 0.55; // the doll turning round at the start (warning); quicker later
export const MIN_TURN_TIME = 0.36;
export const TIME_LIMIT = 100;
export const RIVALS = 5;
export const FAKE_CHANCE = 0.22; // the doll pretends to turn, then looks away again
export const SURPRISE_CHANCE = 0.22; // a very short song: the doll turns almost at once

// How far into the race (0..1): songs get shorter and the turn quicker
const pace = (clock) => Math.min(1, Math.max(0, clock) / 45);
const greenTime = (random, clock, afterFake = false) => {
  if (afterFake) return 0.35 + random() * 1.1; // right after a fake: often a quick real turn
  if (clock > 3 && random() < SURPRISE_CHANCE) return 0.5 + random() * 0.5;
  return 1.5 + random() * 2.3 - pace(clock) * 0.6;
};
const redTime = (random) => 1.3 + random() * 1.7;
export const turnTime = (clock) => TURN_TIME - (TURN_TIME - MIN_TURN_TIME) * pace(clock);

export function createRedLight({ random = Math.random, rivals = RIVALS } = {}) {
  const runners = [{ id: 'player', lane: Math.floor(rivals / 2), y: 0, speed: RUN_SPEED, moving: false, out: false, place: 0 }];
  for (let i = 0; i < rivals; i++) {
    runners.push({ id: `cpu${i}`, lane: i < Math.floor(rivals / 2) ? i : i + 1, y: 0, speed: 100 + random() * 16, moving: false, out: false, place: 0, react: 0, wait: 0 });
  }
  return {
    random,
    clock: -3, // 3, 2, 1 countdown
    light: 'green', // green | turning | red | fake (pretends to turn, then back to green)
    turnMax: TURN_TIME,
    fakes: 0,
    afterFake: false,
    lightT: greenTime(random, 0),
    redFor: 0, // seconds the doll has been watching
    runners,
    finished: 0,
    status: 'play', // play | won | finished | out | timeout
    events: [],
  };
}

export const playerOf = (s) => s.runners[0];

function setLight(s, light) {
  s.light = light;
  const r = s.random;
  if (light === 'green') {
    s.lightT = greenTime(r, s.clock, s.afterFake);
    s.afterFake = false;
  } else if (light === 'turning' || light === 'fake') {
    s.turnMax = turnTime(s.clock);
    s.lightT = light === 'fake' ? s.turnMax * 0.75 : s.turnMax;
    if (light === 'fake') {
      s.fakes += 1;
      s.afterFake = true;
    }
    // Now and then a rival does not notice the doll turning and gets caught
    for (const c of s.runners) if (c.id !== 'player') c.slip = light === 'turning' && !c.out && !c.place && r() < 0.1;
  }
  else {
    s.lightT = redTime(r);
    s.redFor = 0;
    // Each rival freezes after its own short reaction (a slipping one too late)
    for (const c of s.runners) {
      if (c.id === 'player' || c.out || c.place) continue;
      c.react = c.slip ? GRACE + 0.3 : 0.02 + r() * 0.22;
    }
  }
  s.events.push({ type: 'light', light });
}

/** One step. `running` = the child is holding the run button. */
export function stepRedLight(s, dt, running) {
  if (s.status !== 'play') return s;
  s.clock += dt;
  if (s.clock < 0) return s;
  if (s.clock - dt < 0) s.events.push({ type: 'go' });

  // The doll
  s.lightT -= dt;
  if (s.light === 'red') s.redFor += dt;
  if (s.lightT <= 0) {
    let next = 'green';
    if (s.light === 'green') next = s.clock > 4 && !s.afterFakeUsed && s.random() < FAKE_CHANCE ? 'fake' : 'turning';
    else if (s.light === 'turning') next = 'red';
    if (s.light === 'green') s.afterFakeUsed = next === 'fake'; // after a fake the next turn is real
    setLight(s, next);
  }

  for (const c of s.runners) {
    if (c.out || c.place) {
      c.moving = false;
      continue;
    }
    if (c.id === 'player') c.moving = running;
    else if (s.light === 'red') c.moving = c.moving && s.redFor < c.react; // still stopping
    else if (s.light === 'turning' || s.light === 'fake') c.moving = c.slip ? c.moving : c.moving && s.random() > dt * 1.2; // most stop while it turns (fooled by a fake too)
    else {
      // Green: run, with a short pause now and then to look natural
      if (c.wait > 0) c.wait -= dt;
      else if (s.random() < dt * 0.25) c.wait = 0.2 + s.random() * 0.4;
      c.moving = c.wait <= 0;
    }
    if (c.moving) c.y = Math.min(TRACK, c.y + c.speed * dt);

    // Caught moving while the doll looks
    if (s.light === 'red' && s.redFor > GRACE && c.moving) {
      c.out = true;
      c.moving = false;
      s.events.push({ type: 'out', id: c.id });
      if (c.id === 'player') {
        s.status = 'out';
        s.events.push({ type: 'end', status: 'out' });
        return s;
      }
      continue;
    }
    if (c.y >= TRACK && !c.place) {
      s.finished += 1;
      c.place = s.finished;
      s.events.push({ type: 'finish', id: c.id, place: c.place });
      if (c.id === 'player') {
        s.status = c.place === 1 ? 'won' : 'finished';
        s.events.push({ type: 'end', status: s.status, place: c.place });
        return s;
      }
    }
  }
  if (s.clock >= TIME_LIMIT) {
    s.status = 'timeout';
    s.events.push({ type: 'end', status: 'timeout' });
  }
  return s;
}

/** Reward: first = win, finished later = draw, caught or too slow = lose. */
export const redLightResult = (status) => (status === 'won' ? 'win' : status === 'finished' ? 'draw' : 'lose');
