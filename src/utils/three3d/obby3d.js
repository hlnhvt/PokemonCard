// "Vượt chướng ngại Pokémon": a Fall Guys style obstacle race for kids. Pure engine (no three.js, no DOM).
// World: x right, y up, the course runs towards -z. A racer's `yaw` 0 faces -z (three.js convention).
// Ten racers (the child + nine AI Pokémon); falling off just respawns at the last checkpoint.
import { clamp, contact, carryPoint, savePose, updatePose, buildBuckets, nearby, closestOnSegment, sphereSphere, topAt } from './obby3d/physics';
import { COURSES, buildCourse } from './obby3d/courses';
import { aiInput, newBrain } from './obby3d/ai';

export { COURSES, buildCourse, clamp };

export const OBBY3D_GAME = 'obby3d';
export const DT = 1 / 60;
export const RACERS = 10;

export const PHY = {
  R: 0.45,
  speed: 7.4,
  accel: 42,
  airAccel: 13,
  gravity: 25,
  jumpV: 9,
  coyote: 0.12,
  buffer: 0.14,
  diveSpeed: 11,
  diveUp: 4.5,
  diveHop: 4.5,
  recover: 0.35,
  knock: 8.5,
  knockUp: 6,
  stun: 0.55,
  maxFall: 26,
  outTime: 1,
  shield: 1.2, // seconds of sparkle after a respawn (no knocks)
  assistFalls: 5, // after this many falls at one checkpoint the next respawn moves on
};

/** The eight 3D racer models. */
export const SPECIES = [
  { id: 'pikachu', name: 'Pikachu', dex: 25, type: 'Electric' },
  { id: 'jigglypuff', name: 'Jigglypuff', dex: 39, type: 'Fairy' },
  { id: 'psyduck', name: 'Psyduck', dex: 54, type: 'Water' },
  { id: 'bulbasaur', name: 'Bulbasaur', dex: 1, type: 'Grass' },
  { id: 'squirtle', name: 'Squirtle', dex: 7, type: 'Water' },
  { id: 'charmander', name: 'Charmander', dex: 4, type: 'Fire' },
  { id: 'eevee', name: 'Eevee', dex: 133, type: 'Normal' },
  { id: 'piplup', name: 'Piplup', dex: 393, type: 'Water' },
];

/** Species id for a card name ("Pikachu V" -> pikachu), or null. */
export function speciesOf(name) {
  const n = String(name || '').toLowerCase();
  const hit = SPECIES.find((sp) => new RegExp(`(^|[^a-z])${sp.id}([^a-z]|$)`).test(n));
  return hit ? hit.id : null;
}

/** Placement -> stars: top 3 = 3, top 6 = 2, any finish = 1. */
export const starsForPlace = (place) => (!place ? 0 : place <= 3 ? 3 : place <= 6 ? 2 : 1);
export const medalForPlace = (place) => (place === 1 ? 'gold' : place === 2 ? 'silver' : place === 3 ? 'bronze' : place ? 'ribbon' : null);

/** Nine opponents: every other species once, then shiny repeats (never the child's species if possible). */
export function pickRoster(playerSpecies, random) {
  const pool = SPECIES.filter((sp) => sp.id !== playerSpecies);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const out = shuffled.map((sp) => ({ species: sp.id, name: sp.name, shiny: false }));
  let k = 0;
  while (out.length < RACERS - 1) {
    const sp = shuffled[k % shuffled.length];
    out.push({ species: sp.id, name: sp.name, shiny: true });
    k += 1;
  }
  return out;
}

const SLOTS = [
  [-6, 0],
  [-3, 0],
  [0, 0],
  [3, 0],
  [6, 0],
  [-4.5, 2.6],
  [-1.5, 2.6],
  [1.5, 2.6],
  [4.5, 2.6],
  [0, 5],
];

function makeRacer(id, info, cp, slot) {
  return {
    id,
    ...info,
    x: cp.x + SLOTS[slot][0],
    y: cp.y + PHY.R + 0.02,
    z: cp.z + SLOTS[slot][1],
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    grounded: true,
    support: null,
    nx: 0,
    ny: 1,
    nz: 0,
    coyote: 0,
    jumpBuf: 0,
    jumpHeld: false,
    diveHeld: false,
    diving: false,
    dived: false,
    recover: 0,
    stun: 0,
    knockCd: 0,
    shield: 0,
    out: false,
    outT: 0,
    cp: 0,
    falls: 0,
    cpFalls: 0,
    assists: 0,
    knocks: 0,
    finished: false,
    finishTime: 0,
    place: 0,
    blockedDoor: null,
    blockedT: 0,
    land: 0, // impact speed of the last landing (for squash)
    slot,
  };
}

/**
 * New race on course `index` (0-based).
 * opts = { random, player: { name, types }, bot: true -> the child's racer drives itself (tests) }
 */
export function createObby3D(index, { random = Math.random, player = {}, bot = false, waitAll = false } = {}) {
  const course = buildCourse(index, random);
  const def = course.def;
  const playerSpecies = speciesOf(player.name);
  const roster = pickRoster(playerSpecies, random);
  const cp0 = course.checkpoints[0];
  const racers = [];
  // The child starts in the middle of the front row
  const order = [2, 1, 3, 0, 4, 6, 7, 5, 8, 9];
  racers.push(makeRacer(0, { name: player.name || 'Pikachu', species: playerSpecies || 'generic', type: player.types?.[0] || 'Normal', isPlayer: true, shiny: false }, cp0, order[0]));
  roster.forEach((info, i) => racers.push(makeRacer(i + 1, { ...info, isPlayer: false }, cp0, order[i + 1])));
  const [lo, hi] = def.ai.speed;
  racers.forEach((r, i) => {
    const skill = r.isPlayer ? { bot: true, speed: 1, mistake: 0, react: 1 } : { speed: lo + ((hi - lo) * (i - 1)) / (RACERS - 2) + (random() - 0.5) * 0.03, mistake: def.ai.mistake, react: def.ai.react };
    r.brain = newBrain(random, skill);
    if (r.isPlayer) r.brain.lane = 0;
  });
  const kinematic = course.colliders.filter((c) => c.motion);
  for (const c of kinematic) {
    c.kinematic = true;
    c.reach = c.motion.type === 'slide' ? c.motion.amp : 0;
  }
  const index3 = buildBuckets(course.colliders, 8);
  const s = {
    level: index,
    course,
    racers,
    player: racers[0],
    bot,
    waitAll,
    random,
    t: 0,
    dt: DT,
    status: 'play', // play | finishing | done
    endT: 0,
    finishedCount: 0,
    events: [],
    camYaw: 0,
    kinematic,
    index: index3,
    near: [],
    tmp: [],
  };
  updateObstacles(s, 0);
  return s;
}

const TAU = Math.PI * 2;

/** Moves kinematic colliders and obstacles to time s.t. */
function updateObstacles(s, dt) {
  const t = s.t;
  for (const c of s.kinematic) {
    savePose(c);
    const m = c.motion;
    if (m.type === 'spin') c.yaw = m.w * t;
    else if (m.type === 'slide') {
      const k = m.amp * Math.sin((TAU * t) / m.period + m.phase);
      c.x = m.bx + m.ax * k;
      c.z = m.bz + (m.az || 0) * k;
    }
    updatePose(c);
  }
  for (const ob of s.course.obstacles) {
    if (ob.type === 'sweeper') ob.angle += ob.w * dt;
    else if (ob.type === 'hammer' || ob.type === 'pendulum') {
      ob.phi = ob.amp * Math.sin((TAU * t) / ob.period + ob.phase);
      ob.dphi = ((ob.amp * TAU) / ob.period) * Math.cos((TAU * t) / ob.period + ob.phase);
      ob.hx = ob.px + ob.len * Math.sin(ob.phi);
      ob.hy = ob.py - ob.len * Math.cos(ob.phi);
    } else if (ob.type === 'seesaw') {
      let torque = 0;
      const c = ob.collider;
      for (const r of s.racers) {
        if (r.grounded && r.support === c) torque += r.x - c.x;
      }
      const aa = -0.32 * torque - 3.2 * ob.angle - 2.4 * ob.av;
      ob.av += aa * dt;
      ob.angle += ob.av * dt;
      if (Math.abs(ob.angle) > 0.42) {
        ob.angle = Math.sign(ob.angle) * 0.42;
        ob.av = 0;
      }
      savePose(c);
      c.roll = ob.angle;
      updatePose(c);
    } else if (ob.type === 'honey') {
      for (const tile of ob.tiles) {
        const st = tile.tile;
        if (st.state === 'shake') {
          st.t += dt;
          if (st.t > 0.75) {
            st.state = 'gone';
            st.t = 0;
            tile.active = false;
            s.events.push({ type: 'tileDrop', id: tile.id, x: tile.x, y: tile.y, z: tile.z });
          }
        } else if (st.state === 'gone') {
          st.t += dt;
          if (st.t > 3.5) {
            st.state = 'solid';
            st.t = 0;
            tile.active = true;
            s.events.push({ type: 'tileBack', id: tile.id, x: tile.x, y: tile.y, z: tile.z });
          }
        }
      }
    } else if (ob.type === 'balls') {
      ob.next -= dt;
      if (ob.next <= 0 && dt > 0) {
        ob.next = ob.every * (0.75 + s.random() * 0.5);
        const span = ob.w / 2 - ob.R - 0.4;
        ob.list.push({ id: (ob.serial = (ob.serial || 0) + 1), x: ob.x + (s.random() * 2 - 1) * span, z: ob.top.z, y: ob.top.y + ob.R, v: 2.5, spin: 0 });
      }
      for (let i = ob.list.length - 1; i >= 0; i--) {
        const b = ob.list[i];
        b.v = Math.min(6.5, b.v + 4 * dt);
        b.z += b.v * dt;
        b.spin += (b.v * dt) / ob.R;
        // On the ramp the ball follows its surface; above/below it stays on the flat parts
        const z0 = ob.bottom.z;
        const zTop = ob.bottom.z - ob.len;
        const f = clamp((b.z - zTop) / (z0 - zTop), 0, 1);
        b.y = ob.top.y - ob.rise * f + ob.R;
        if (b.z > z0 + 3.5) {
          s.events.push({ type: 'ballPop', x: b.x, y: b.y, z: b.z });
          ob.list.splice(i, 1);
        }
      }
    } else if (ob.type === 'pad') {
      ob.squish = Math.max(0, ob.squish - dt * 3);
    }
  }
}

function knock(s, r, dx, dz, n, power, src) {
  if (r.shield > 0) return;
  if (r.knockCd > 0) return;
  let len = Math.hypot(dx, dz);
  if (len < 1e-3) {
    dx = n.nx;
    dz = n.nz;
    len = Math.hypot(dx, dz) || 1;
  }
  r.vx = (dx / len) * power + n.nx * 1.5;
  r.vz = (dz / len) * power + n.nz * 1.5;
  r.vy = PHY.knockUp;
  r.stun = PHY.stun;
  r.knockCd = 1.1;
  r.diving = false;
  r.grounded = false;
  r.support = null;
  r.knocks += 1;
  r.alert = 4;
  s.events.push({ type: 'knock', id: r.id, src, x: r.x, y: r.y, z: r.z });
}

const SOLID_ROLES = new Set(['door', 'lintel', 'post', 'pillar', 'gate', 'rail']);

/** Pushes the racer out of every collider it overlaps. */
function collide(s, r) {
  const R = PHY.R;
  const list = nearby(s.index, r.z, s.tmp);
  let grounded = false;
  for (const c of list) {
    if (!c.active) continue;
    const hit = contact(c, r.x, r.y, r.z, R);
    if (!hit) continue;
    if (c.door && !c.door.broken && Math.abs(hit.ny) < 0.5) {
      if (c.door.breakable) {
        c.door.broken = true;
        c.active = false;
        r.vz *= 0.7;
        s.events.push({ type: 'doorBreak', id: r.id, door: c.id, x: c.x, y: c.y, z: c.z });
        continue;
      }
      if (r.blockedDoor !== c || r.blockedT <= 0) s.events.push({ type: 'doorSolid', id: r.id, door: c.id, x: r.x, y: r.y, z: r.z });
      r.blockedDoor = c;
      r.blockedT = 0.5;
    }
    // Ledge catch: diving or jumping into the side of a platform just below its top pulls you up
    if (Math.abs(hit.ny) < 0.35 && !SOLID_ROLES.has(c.role) && !r.grounded && r.vy > -9) {
      const into = r.vx * hit.nx + r.vz * hit.nz;
      const top = topAt(c, r.x - hit.nx * (R + 0.15), r.z - hit.nz * (R + 0.15));
      if (into < 0 && top != null && top - (r.y - R) > -0.05 && top - (r.y - R) < 0.95) {
        r.y = top + R + 0.02;
        r.x -= hit.nx * 0.3;
        r.z -= hit.nz * 0.3;
        r.vy = 0;
        grounded = true;
        r.support = c;
        r.nx = 0;
        r.ny = 1;
        r.nz = 0;
        s.events.push({ type: 'ledge', id: r.id, x: r.x, y: r.y, z: r.z });
        continue;
      }
    }
    r.x += hit.nx * hit.depth;
    r.y += hit.ny * hit.depth;
    r.z += hit.nz * hit.depth;
    const vn = r.vx * hit.nx + r.vy * hit.ny + r.vz * hit.nz;
    if (vn < 0) {
      r.vx -= vn * hit.nx;
      r.vy -= vn * hit.ny;
      r.vz -= vn * hit.nz;
    }
    if (hit.ny > 0.55) {
      grounded = true;
      r.support = c;
      r.nx = hit.nx;
      r.ny = hit.ny;
      r.nz = hit.nz;
      if (c.bounce && hit.ny > 0.7) {
        r.vy = c.bounce;
        r.vz = -c.push;
        r.vx *= 0.4;
        r.diving = false;
        r.dived = false;
        r.stun = 0;
        grounded = false;
        r.support = null;
        r.bounced = true;
        const ob = s.course.obstacles.find((o) => o.collider === c);
        if (ob) ob.squish = 1;
        s.events.push({ type: 'bounce', id: r.id, x: r.x, y: r.y, z: r.z });
        return false;
      }
      if (c.tile && c.tile.state === 'solid') {
        c.tile.state = 'shake';
        c.tile.t = 0;
        s.events.push({ type: 'tileShake', id: c.id, x: c.x, y: c.y, z: c.z });
      }
    }
  }
  return grounded;
}

/** Sweepers, hammers, pendulums and Voltorbs knock racers back. */
function pushers(s, r) {
  const R = PHY.R;
  for (const ob of s.near) {
    if (ob.type === 'sweeper') {
      const ca = Math.cos(ob.angle);
      const sa = Math.sin(ob.angle);
      const a = ob.arms === 2 ? -ob.len : 0;
      const p = closestOnSegment(ob.x + ca * a, ob.y, ob.z + sa * a, ob.x + ca * ob.len, ob.y, ob.z + sa * ob.len, r.x, r.y, r.z);
      const hit = sphereSphere(p.x, p.y, p.z, ob.r, r.x, r.y, r.z, R);
      if (hit) {
        r.x += hit.nx * hit.depth;
        r.z += hit.nz * hit.depth;
        r.y += Math.max(0, hit.ny * hit.depth);
        const rho = a + (ob.len - a) * p.t;
        knock(s, r, -sa * ob.w * rho, ca * ob.w * rho, hit, PHY.knock, 'sweeper');
      }
    } else if (ob.type === 'hammer' || ob.type === 'pendulum') {
      const p = closestOnSegment(ob.hx, ob.hy, ob.pz - ob.head.half, ob.hx, ob.hy, ob.pz + ob.head.half, r.x, r.y, r.z);
      const hit = sphereSphere(p.x, p.y, p.z, ob.head.r, r.x, r.y, r.z, R);
      if (hit) {
        r.x += hit.nx * hit.depth;
        r.y += hit.ny * hit.depth;
        r.z += hit.nz * hit.depth;
        const v = ob.len * ob.dphi;
        knock(s, r, Math.cos(ob.phi) * v, 0, hit, PHY.knock + Math.min(3, Math.abs(v) * 0.15), ob.type);
      }
    } else if (ob.type === 'balls') {
      for (const b of ob.list) {
        const hit = sphereSphere(b.x, b.y, b.z, ob.R, r.x, r.y, r.z, R);
        if (hit) {
          r.x += hit.nx * hit.depth;
          r.z += hit.nz * hit.depth;
          r.y += Math.max(0, hit.ny * hit.depth);
          knock(s, r, hit.nx * 0.6, 1, hit, PHY.knock * 0.85, 'ball');
          if (!b.hit) {
            b.hit = true;
            s.events.push({ type: 'ballHit', id: r.id, x: b.x, y: b.y, z: b.z });
          }
        }
      }
    }
  }
}

function respawn(s, r) {
  const cps = s.course.checkpoints;
  // Kid-friendly assist: after many falls in one place the next respawn moves on
  if (r.cpFalls >= PHY.assistFalls && r.cp < cps.length - 1) {
    r.cp += 1;
    r.cpFalls = 0;
    r.assists += 1;
    s.events.push({ type: 'assist', id: r.id });
  }
  const cp = cps[r.cp];
  const slot = SLOTS[(r.slot + r.falls) % SLOTS.length];
  r.x = cp.x + slot[0] * 0.6;
  r.z = cp.z + slot[1] * 0.5;
  r.y = cp.y + PHY.R + 0.3;
  r.vx = r.vy = r.vz = 0;
  r.yaw = 0;
  r.out = false;
  r.stun = 0;
  r.diving = false;
  r.dived = false;
  r.recover = 0;
  r.shield = PHY.shield;
  r.grounded = false;
  r.support = null;
  r.brain.wi = cp.wp;
  r.brain.late = -1;
  r.brain.diveT = -1;
  r.brain.door = -1;
  s.events.push({ type: 'respawn', id: r.id, x: r.x, y: r.y, z: r.z });
}

/** One racer, one fixed step. inp = { mx, mz, jump, dive } (world space, |m| <= 1). */
function stepRacer(s, r, inp, dt) {
  if (r.out) {
    r.outT -= dt;
    if (r.outT <= 0) respawn(s, r);
    return;
  }
  r.stun = Math.max(0, r.stun - dt);
  r.knockCd = Math.max(0, r.knockCd - dt);
  r.shield = Math.max(0, r.shield - dt);
  r.blockedT = Math.max(0, r.blockedT - dt);
  r.recover = Math.max(0, r.recover - dt);
  r.alert = Math.max(0, (r.alert || 0) - dt);
  r.land = Math.max(0, r.land - dt * 4);
  r.bounced = false;

  // Ride whatever we stand on (spinning discs, movers, seesaws), conveyor belts push
  const sup = r.grounded ? r.support : null;
  let carryVx = 0;
  let carryVz = 0;
  if (sup && sup.kinematic) {
    const p = carryPoint(sup, r.x, r.y, r.z);
    carryVx = (p.x - r.x) / dt;
    carryVz = (p.z - r.z) / dt;
    r.x = p.x;
    r.y = p.y;
    r.z = p.z;
    if (sup.motion.type === 'spin') r.yaw += sup.motion.w * dt;
  }
  if (sup && sup.belt) {
    r.x += sup.belt.x * dt;
    r.z += sup.belt.z * dt;
  }

  let mx = inp.mx;
  let mz = inp.mz;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) {
    mx /= ml;
    mz /= ml;
  }
  const moving = ml > 0.08;
  if (moving && !r.diving && r.stun <= 0) {
    const want = Math.atan2(-mx, -mz);
    let d = want - r.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    r.yaw += d * Math.min(1, dt * 14);
  }

  // Horizontal control (in the air steering keeps the speed you have: bounces and knocks carry on)
  let tx = mx * PHY.speed;
  let tz = mz * PHY.speed;
  if (!r.grounded && moving) {
    const hs = Math.hypot(r.vx, r.vz);
    const want = Math.hypot(tx, tz);
    if (hs > want) {
      tx *= hs / want;
      tz *= hs / want;
    }
  }
  if (!r.diving) {
    // no stick in the air: keep flying (bounces, knocks); otherwise steer
    let rate = r.grounded ? PHY.accel : moving ? PHY.airAccel : 2;
    if (r.stun > 0) rate *= r.grounded ? 0.25 : 0.1;
    if (r.recover > 0) rate *= 0.3;
    const ex = tx - r.vx;
    const ez = tz - r.vz;
    const el = Math.hypot(ex, ez);
    const k = el > rate * dt ? (rate * dt) / el : 1;
    r.vx += ex * k;
    r.vz += ez * k;
  } else if (r.grounded) {
    r.vx *= 0.9;
    r.vz *= 0.9;
  }
  // Steep seesaws let you slide off
  if (r.grounded && sup && sup.slide) {
    const tilt = Math.hypot(r.nx, r.nz);
    if (tilt > 0.2) {
      r.vx += r.nx * PHY.gravity * 0.8 * dt;
      r.vz += r.nz * PHY.gravity * 0.8 * dt;
    }
  }

  // Jump (buffered, with coyote time) and dive
  const jumpEdge = inp.jump && !r.jumpHeld;
  r.jumpHeld = !!inp.jump;
  const diveEdge = inp.dive && !r.diveHeld;
  r.diveHeld = !!inp.dive;
  if (jumpEdge) r.jumpBuf = PHY.buffer;
  else r.jumpBuf = Math.max(0, r.jumpBuf - dt);
  r.coyote = r.grounded ? PHY.coyote : Math.max(0, r.coyote - dt);
  if (r.jumpBuf > 0 && r.coyote > 0 && r.stun <= 0 && !r.diving && r.recover <= 0.15) {
    r.vy = PHY.jumpV;
    r.vx += carryVx * 0.5;
    r.vz += carryVz * 0.5;
    r.grounded = false;
    r.support = null;
    r.coyote = 0;
    r.jumpBuf = 0;
    s.events.push({ type: 'jump', id: r.id, x: r.x, y: r.y, z: r.z });
  }
  if (diveEdge && !r.dived && r.stun <= 0) {
    const fx = moving ? mx / Math.max(ml, 1e-3) : -Math.sin(r.yaw);
    const fz = moving ? mz / Math.max(ml, 1e-3) : -Math.cos(r.yaw);
    r.yaw = Math.atan2(-fx, -fz);
    r.vx = fx * PHY.diveSpeed;
    r.vz = fz * PHY.diveSpeed;
    r.vy = r.grounded ? PHY.diveHop : Math.max(r.vy, PHY.diveUp);
    r.diving = true;
    r.dived = true;
    r.grounded = false;
    r.support = null;
    s.events.push({ type: 'dive', id: r.id, x: r.x, y: r.y, z: r.z });
  }

  // Gravity and motion (two sub-steps so nothing tunnels through thin tiles)
  r.vy = Math.max(-PHY.maxFall, r.vy - PHY.gravity * dt);
  const wasGrounded = r.grounded;
  const vyBefore = r.vy;
  let grounded = false;
  r.support = null;
  for (let k = 0; k < 2; k++) {
    r.x += (r.vx * dt) / 2;
    r.y += (r.vy * dt) / 2;
    r.z += (r.vz * dt) / 2;
    if (collide(s, r)) grounded = true;
    if (r.bounced) break;
  }
  pushers(s, r);
  r.grounded = grounded && !r.bounced;
  if (!r.grounded) r.support = null;
  if (r.grounded && !wasGrounded) {
    r.land = Math.min(1, Math.max(0, -vyBefore) / 14);
    if (r.diving) {
      r.diving = false;
      r.recover = PHY.recover;
    }
    r.dived = false;
    if (-vyBefore > 6) s.events.push({ type: 'land', id: r.id, x: r.x, y: r.y - PHY.R, z: r.z, power: r.land });
  }
  if (r.grounded) r.dived = false;

  // Fell off the course
  if (r.y < s.course.killY) {
    r.out = true;
    r.outT = PHY.outTime;
    r.falls += 1;
    r.cpFalls += 1;
    s.events.push({ type: 'fall', id: r.id, x: r.x, y: r.y, z: r.z });
    return;
  }

  // Checkpoints and the finish line
  const cps = s.course.checkpoints;
  if (r.grounded) {
    while (r.cp + 1 < cps.length && r.z < cps[r.cp + 1].z + 1.5) {
      r.cp += 1;
      r.cpFalls = 0;
      s.events.push({ type: 'checkpoint', id: r.id, index: r.cp, x: cps[r.cp].x, y: cps[r.cp].y, z: cps[r.cp].z });
    }
  }
  if (!r.finished && r.z < s.course.finishZ && r.y > s.course.finishY - 1) {
    r.finished = true;
    r.finishTime = s.t;
    s.finishedCount += 1;
    r.place = s.finishedCount;
    s.events.push({ type: 'finish', id: r.id, place: r.place, x: r.x, y: r.y, z: r.z });
  }
}

/** Racers bump into each other a little. */
function separate(s) {
  const rs = s.racers;
  const D = PHY.R * 2;
  for (let i = 0; i < rs.length; i++) {
    const a = rs[i];
    if (a.out) continue;
    for (let j = i + 1; j < rs.length; j++) {
      const b = rs[j];
      if (b.out || Math.abs(a.y - b.y) > 0.9) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= D * D || d2 < 1e-8) continue;
      const d = Math.sqrt(d2);
      // soft, so racers squeeze past each other instead of locking up in a doorway
      const push = ((D - d) / 2) * 0.3;
      const nx = dx / d;
      const nz = dz / d;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
    }
  }
}

/** Obstacles near the player... and everyone: those whose area overlaps any racer (small lists). */
function nearObstacles(s, z) {
  const out = [];
  for (const ob of s.course.obstacles) {
    const oz = ob.z ?? ob.pz ?? ob.ramp?.z ?? 0;
    const reach = ob.type === 'balls' ? ob.len / 2 + 6 : ob.type === 'sweeper' ? ob.len + 2 : 4;
    if (Math.abs(oz - z) < reach) out.push(ob);
  }
  return out;
}

/** Converts a camera-relative stick (x right, y forward) into a world direction. */
export function stickToWorld(sx, sy, camYaw) {
  // forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw)
  const c = Math.cos(camYaw);
  const sn = Math.sin(camYaw);
  return { mx: sx * c - sy * sn, mz: -sx * sn - sy * c };
}

/** Engine step. input = { sx, sy (camera-relative stick, y forward), jump, dive } for the child. */
export function step(s, dt, input = {}) {
  if (s.status === 'done') return s;
  s.dt = dt;
  s.t += dt;
  updateObstacles(s, dt);
  for (const r of s.racers) {
    s.near = nearObstacles(s, r.z);
    let inp;
    if (r.isPlayer && !s.bot && !r.finished) {
      const w = stickToWorld(input.sx || 0, input.sy || 0, s.camYaw);
      inp = { ...w, jump: !!input.jump, dive: !!input.dive };
    } else inp = aiInput(s, r, s.random);
    stepRacer(s, r, inp, dt);
  }
  separate(s);
  // Camera heading follows the path a little ahead of the child
  const p = s.player;
  const W = s.course.waypoints;
  const ahead = W.find((w) => w.z < p.z - 10) || W[W.length - 1];
  const want = clamp(Math.atan2(-(ahead.x - p.x), -(ahead.z - p.z)), -0.3, 0.3);
  s.camYaw += (want - s.camYaw) * Math.min(1, dt * 0.8);

  if (s.status === 'play' && p.finished) {
    s.status = 'finishing';
    s.endT = 3.2;
  } else if (s.status === 'finishing') {
    s.endT -= dt;
    if (s.endT <= 0 && (!s.waitAll || s.finishedCount === s.racers.length)) {
      s.status = 'done';
      s.events.push({ type: 'raceEnd', place: p.place });
    }
  }
  return s;
}

/** Progress along the course (0..1). */
export const progressOf = (s, r) => (r.finished ? 1 : clamp(-r.z / Math.max(1, -s.course.finishZ), 0, 1));

/** Live placement of every racer (finished first by time, then by distance). */
export function standings(s) {
  return [...s.racers].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return a.place - b.place;
    return a.z - b.z;
  });
}

/** Small copy of the state for the HUD. */
export function snap(s) {
  const p = s.player;
  const order = standings(s);
  return {
    t: s.t,
    status: s.status,
    place: order.indexOf(p) + 1,
    finished: p.finished,
    finalPlace: p.place,
    cp: p.cp,
    cps: s.course.checkpoints.length - 1,
    progress: progressOf(s, p),
    out: p.out,
    stun: p.stun > 0,
    falls: p.falls,
    finishedCount: s.finishedCount,
    grounded: p.grounded,
    diving: p.diving,
  };
}

/** Final result for the child. */
export function resultOf(s) {
  const p = s.player;
  const place = p.finished ? p.place : 0;
  return { place, stars: starsForPlace(place), medal: medalForPlace(place), time: p.finishTime, falls: p.falls, knocks: p.knocks, podium: standings(s).slice(0, 3).map((r) => ({ name: r.name, species: r.species, shiny: r.shiny, isPlayer: r.isPlayer })) };
}

/** Height of the floor under (x, z) at or below `y` (for blob shadows), or null over the void. */
export function floorBelow(s, x, z, y) {
  let best = null;
  for (const c of nearby(s.index, z, s.tmp)) {
    const top = topAt(c, x, z);
    if (top == null || top > y + 0.2) continue;
    if (best == null || top > best) best = top;
  }
  return best;
}

export const COURSE_COUNT = COURSES.length;
