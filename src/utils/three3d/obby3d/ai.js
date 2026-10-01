// Waypoint-following racers for "Vượt chướng ngại Pokémon" (also the scripted test bot / autopilot).
import { clamp } from './physics';

const TAU = Math.PI * 2;
const wrap = (a) => {
  let d = a % TAU;
  if (d < 0) d += TAU;
  return d;
};

/** Pose of a sliding collider at time t (for predicting movers and gates). */
export function slideX(c, t) {
  const m = c.motion;
  return m.bx + m.ax * m.amp * Math.sin((TAU * t) / m.period + m.phase);
}

/** Pendulum head x at time t. */
export function pendulumX(ob, t) {
  const phi = ob.amp * Math.sin((TAU * t) / ob.period + ob.phase);
  return ob.px + ob.len * Math.sin(phi);
}

export function newBrain(random, skill) {
  return { wi: 0, lane: random() * 2 - 1, skill, late: -1, diveT: -1, door: -1, solid: new Set(), stuck: 0, smart: true, smartFor: -1, reactRoll: 0, reactT: 0, wait: 0 };
}

/** True when a sweeper bar will reach the racer very soon. */
function barComing(ob, r, within) {
  const dx = r.x - ob.x;
  const dz = r.z - ob.z;
  const rho = Math.hypot(dx, dz);
  if (rho > ob.len + 0.9 || rho < 0.6 || Math.abs(r.y - ob.y) > 1.6) return false;
  const phiR = Math.atan2(dz, dx);
  // the racer moves around the pivot too: use the relative angular speed
  const wr = (dx * r.vz - dz * r.vx) / (rho * rho);
  const rate = wr - ob.w;
  const hw = (ob.r + 0.5) / rho;
  const arms = ob.arms === 2 ? [ob.angle, ob.angle + Math.PI] : [ob.angle];
  for (const a of arms) {
    let d = wrap(phiR - a);
    if (d > Math.PI) d -= TAU;
    if (Math.abs(d) < hw) return true;
    if (d * rate < 0 && (Math.abs(d) - hw) / Math.abs(rate) < within) return true;
  }
  return false;
}

/**
 * Inputs for an AI racer: { mx, mz, jump, dive } in world space.
 * The bot (skill.bot) never fumbles and always waits for hammers, gates and movers.
 */
export function aiInput(s, r, random) {
  const b = r.brain;
  const out = { mx: 0, mz: 0, jump: false, dive: false };
  if (r.finished) {
    // walk a few metres past the line, then stop and cheer
    if (r.z > s.course.finishZ - 5) out.mz = -0.5;
    return out;
  }
  if (r.out) return out;
  const W = s.course.waypoints;
  const sk = b.skill;
  const dt = s.dt;

  // Late jump after a fumble, dive after a jump
  if (b.late >= 0) {
    b.late -= dt;
    if (b.late < 0) out.jump = true;
  }
  if (b.diveT >= 0) {
    b.diveT -= dt;
    if (b.diveT < 0) out.dive = true;
  }

  // Advance through waypoints the racer has passed
  while (b.wi < W.length && r.z <= W[b.wi].z + 0.25) {
    const w = W[b.wi];
    if (w.act === 'jump' || w.act === 'dive') {
      const fumble = !sk.bot && random() < sk.mistake;
      if (fumble) b.late = 0.18 + random() * 0.2;
      else out.jump = true;
      if (w.act === 'dive') b.diveT = fumble ? 0.55 : 0.22;
    }
    b.wi += 1;
    b.smartFor = -1;
  }
  const w = W[Math.min(b.wi, W.length - 1)];
  if (!w) return out;

  // Will this racer be careful at the next tricky spot?
  if (b.smartFor !== b.wi) {
    b.smartFor = b.wi;
    b.smart = sk.bot || random() < sk.react;
  }

  let tx = w.x + b.lane * w.w;
  let tz = w.z;
  let hold = false;
  const near = r.z - w.z; // metres before the waypoint

  if (w.mover) {
    // Wait at the edge until the moving platform will be under us when we land
    const c = w.mover;
    const future = slideX(c, s.t + 0.62);
    // Where we will be when we land (a racer on a mover keeps half of its sideways speed)
    const sup = r.support && r.support.motion && r.support.motion.type === 'slide' ? r.support : null;
    const drift = sup ? ((slideX(sup, s.t + 0.05) - slideX(sup, s.t)) / 0.05) * 0.5 * 0.62 : 0;
    const off = future - (r.x + drift);
    if (near < 1.6 && Math.abs(off) > c.hx - 1.1) {
      hold = true;
      tx = sup ? r.x : clamp(future, w.x - 4.5, w.x + 4.5);
    } else tx = r.x + off * 0.25;
  } else if (w.follow) {
    tx = w.follow.x;
  } else if (w.fromMover) {
    tx = r.x;
  } else if (w.gate) {
    // Aim for the wider side of the sliding wall when we get there
    const c = w.gate;
    const arrive = s.t + Math.max(0.2, near / 6.5);
    const gx = slideX(c, arrive);
    const left = gx - c.hx - (w.x - 6);
    const right = w.x + 6 - (gx + c.hx);
    tx = left > right ? (w.x - 6 + gx - c.hx) / 2 : (gx + c.hx + w.x + 6) / 2;
  } else if (w.afterGate) {
    const c = w.afterGate;
    const gx = c.x;
    const left = gx - c.hx - (w.x - 6);
    const right = w.x + 6 - (gx + c.hx);
    tx = left > right ? (w.x - 6 + gx - c.hx) / 2 : (gx + c.hx + w.x + 6) / 2;
  } else if (w.doors != null || w.afterDoors) {
    const ob = s.course.obstacles[w.doors != null ? w.doors : W[b.wi - 1]?.doors];
    if (ob) {
      if (b.doorsOb !== ob) {
        b.doorsOb = ob;
        b.door = -1;
        b.solid.clear();
      }
      if (b.door < 0 || b.solid.has(b.door) || (r.blockedDoor && r.blockedDoor === ob.doors[b.door] && r.blockedT > 0)) {
        if (b.door >= 0 && r.blockedDoor === ob.doors[b.door]) b.solid.add(b.door);
        b.door = pickDoor(ob, r, b, random);
      }
      tx = ob.doors[b.door].x;
    }
  } else if (w.hazard != null && b.smart && near < 2.4) {
    const ob = s.course.obstacles[w.hazard];
    // Cross when the head stays away from our line for the next moment
    const clear = ob.head.r + 0.75;
    const safe = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9].every((k) => Math.abs(pendulumX(ob, s.t + k) - r.x) > clear);
    if (b.cross !== b.wi) {
      if (safe) b.cross = b.wi;
      else hold = true;
    }
  }

  // Dodge rolling Voltorbs ahead in our lane
  if (w.dodge != null) {
    const ob = s.course.obstacles[w.dodge];
    const look = b.smart ? 15 : 8;
    const lo = ob.x - ob.w / 2 + 0.9;
    const hi = ob.x + ob.w / 2 - 0.9;
    // Pick the lane with the most room from the balls coming down at us
    let best = tx;
    let bestCost = Infinity;
    for (let k = 0; k <= 10; k++) {
      const cx = lo + ((hi - lo) * k) / 10;
      let cost = Math.abs(cx - r.x) * 0.08 + Math.abs(cx - tx) * 0.04;
      for (const ball of ob.list) {
        const ahead = r.z - ball.z;
        if (ahead < -1.2 || ahead > look) continue;
        const gap = Math.abs(ball.x - cx) - ob.R - 0.45;
        if (gap < 1.2) cost += (1.2 - gap) * (1 + (look - ahead) / look) * 3;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = cx;
      }
    }
    // steer sideways firmly (a far waypoint would make the sidestep too gentle)
    if (Math.abs(best - r.x) > 0.4) tz = Math.max(tz, r.z - 3);
    tx = best;
  }

  let dx = tx - r.x;
  let dz = tz - r.z;
  if (hold) {
    dz = w.z + 1.3 - r.z;
    dx *= 0.6;
  }
  const len = Math.hypot(dx, dz);
  if (len > 1e-3) {
    const sp = hold ? Math.min(1, len) * 0.5 : sk.speed;
    out.mx = (dx / len) * sp;
    out.mz = (dz / len) * sp;
  }

  // Hop over sweeper bars
  for (const ob of s.near) {
    if (ob.type !== 'sweeper') continue;
    if (barComing(ob, r, 0.3)) {
      b.reactT -= dt;
      if (b.reactT <= 0) {
        b.reactT = 1.0;
        // Once knocked, a racer watches the bar more carefully for a while
        b.reactRoll = sk.bot || r.alert > 0 || random() < sk.react;
      }
      if (b.reactRoll) out.jump = true;
    }
  }

  // Stuck (pushing a wall or a pillar): hop and pick another line
  if (hold || r.stun > 0 || r.z < b.bestZ - 0.4) {
    b.stuck = 0;
    b.bestZ = Math.min(b.bestZ ?? r.z, r.z);
  } else if (r.grounded) {
    b.stuck += dt;
    if (b.stuck > 1.4) {
      b.stuck = 0;
      b.bestZ = r.z;
      out.jump = true;
      b.lane = random() * 2 - 1;
    }
  }
  return out;
}

function pickDoor(ob, r, b, random) {
  let best = -1;
  let bestScore = Infinity;
  ob.doors.forEach((d, k) => {
    if (b.solid.has(k)) return;
    const dist = Math.abs(d.x - r.x);
    // Open (broken) doors are obvious; otherwise the nearest one, with a little randomness
    const score = (d.door.broken ? -6 : 0) + dist + random() * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = k;
    }
  });
  if (best < 0) {
    b.solid.clear();
    best = Math.floor(random() * ob.doors.length);
  }
  return best;
}
