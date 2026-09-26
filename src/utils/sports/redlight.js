// "Đèn xanh, đèn đỏ" (the squid-game race): hold to run towards the finish while the doll
// sings with its back turned. When it turns round (red light) anyone still moving is out.
// First over the line wins. Pure rules; `random` is injectable for tests.

export const TRACK = 1100; // distance from the start line to the finish line
export const RUN_SPEED = 118; // the child's Pokemon, per second
export const GRACE = 0.28; // seconds after the doll faces you before moving counts
export const TURN_TIME = 0.55; // the doll turning round (warning)
export const TIME_LIMIT = 60;
export const RIVALS = 5;

const greenTime = (random, clock) => {
  // Shorter songs as the race goes on
  const k = Math.min(1, clock / 35);
  return 2.4 + random() * 2.2 - k * 0.9;
};
const redTime = (random) => 1.8 + random() * 1.5;

export function createRedLight({ random = Math.random, rivals = RIVALS } = {}) {
  const runners = [{ id: 'player', lane: Math.floor(rivals / 2), y: 0, speed: RUN_SPEED, moving: false, out: false, place: 0 }];
  for (let i = 0; i < rivals; i++) {
    runners.push({ id: `cpu${i}`, lane: i < Math.floor(rivals / 2) ? i : i + 1, y: 0, speed: 100 + random() * 16, moving: false, out: false, place: 0, react: 0, wait: 0 });
  }
  return {
    random,
    clock: -3, // 3, 2, 1 countdown
    light: 'green', // green | turning | red
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
  if (light === 'green') s.lightT = greenTime(r, s.clock);
  else if (light === 'turning') {
    s.lightT = TURN_TIME;
    // Now and then a rival does not notice the doll turning and gets caught
    for (const c of s.runners) if (c.id !== 'player') c.slip = !c.out && !c.place && r() < 0.25;
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
  if (s.lightT <= 0) setLight(s, s.light === 'green' ? 'turning' : s.light === 'turning' ? 'red' : 'green');

  for (const c of s.runners) {
    if (c.out || c.place) {
      c.moving = false;
      continue;
    }
    if (c.id === 'player') c.moving = running;
    else if (s.light === 'red') c.moving = c.moving && s.redFor < c.react; // still stopping
    else if (s.light === 'turning') c.moving = c.slip ? c.moving : c.moving && s.random() > dt * 1.2; // most stop while it turns
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
