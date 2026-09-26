// Bots for the arena: allies of the child and the whole enemy team.
// Simple and readable: retreat when hurt, fight the nearest enemy, otherwise walk a lane.
import { BASES, LANES_Y, CENTER, OBSTACLES } from './map';
import { SKILLS, ULT_MAX, nearestEnemy } from './engine';

// Enemy bots react a bit slower and use their skills less often than allies (children)
export const AI_SKILL = {
  blue: { castChance: 0.85, retreat: 0.35 },
  red: { castChance: 0.82, retreat: 0.3 },
};
const AGGRO = 430;
// Lanes by team size: alone in the middle, three one per lane, five with two in the middle
const LANES_FOR = { 1: [1], 3: [0, 1, 2], 5: [0, 1, 2, 1, 0] };

const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
/** Where to walk next towards (x, y). The map is open, trees are handled by `steer`. */
export const waypoint = (f, x, y) => ({ x, y });

/** Walking direction with a push away from trees and rocks just ahead. */
export function steer(f, to) {
  let d = norm(to.x - f.x, to.y - f.y);
  let ax = 0;
  let ay = 0;
  for (const o of OBSTACLES) {
    const ox = o.x - f.x;
    const oy = o.y - f.y;
    const dd = Math.hypot(ox, oy);
    const reach = o.r + f.r + 45;
    if (dd > reach || ox * d.x + oy * d.y < 0) continue; // far or behind
    // Slide sideways around it (pick the side away from the obstacle's centre)
    const cross = d.x * oy - d.y * ox;
    const s = cross > 0 ? -1 : 1;
    const w = (reach - dd) / reach;
    ax += -d.y * s * w * 2.2;
    ay += d.x * s * w * 2.2;
  }
  d = norm(d.x + ax, d.y + ay);
  return d;
}

/** The input for one bot this step. `memory` is a per-fighter object the caller keeps. */
export function decide(state, f, memory) {
  const cfg = AI_SKILL[f.team];
  const r = state.random;
  const home = BASES[f.team];
  const enemyBase = BASES[f.team === 'blue' ? 'red' : 'blue'];
  const inBase = Math.hypot(f.x - home.x, f.y - home.y) < home.r * 0.7;

  if (f.hp < f.maxHp * cfg.retreat) memory.retreating = true;
  if (memory.retreating && f.hp >= f.maxHp * 0.92) memory.retreating = false;
  if (memory.retreating) {
    const threat = nearestEnemy(state, f, SKILLS.basic.range);
    const to = inBase ? home : steer(f, waypoint(f, home.x, home.y));
    const flee = !!threat && f.cd.blink <= 0 && f.hp < f.maxHp * 0.25 && r() < cfg.castChance * 0.1;
    return { move: inBase ? { x: 0, y: 0 } : to, basic: !!threat, cast: flee ? 'blink' : undefined };
  }

  const target = nearestEnemy(state, f, AGGRO);
  if (target) {
    const d = Math.hypot(target.x - f.x, target.y - f.y);
    const input = { basic: d < SKILLS.basic.range + 10 };
    // Skills: not every frame, like a person reacting
    if (r() < cfg.castChance * 0.08) {
      if (f.ult >= ULT_MAX && d < SKILLS.ult.range && target.hp > target.maxHp * 0.25) input.cast = 'ult';
      else if (f.cd.s2 <= 0 && d < SKILLS.s2.radius + 10) input.cast = 's2';
      else if (f.cd.s1 <= 0 && d < SKILLS.s1.range) input.cast = 's1';
      else if (f.cd.blink <= 0 && d > 160 && d < 260 && target.hp < target.maxHp * 0.3) input.cast = 'blink';
    }
    if (d > SKILLS.basic.range * 0.8) {
      input.move = steer(f, waypoint(f, target.x, target.y));
    } else {
      // Strafe around the target, changing direction now and then
      if (!memory.strafe || r() < 0.02) memory.strafe = r() < 0.5 ? 1 : -1;
      const n = norm(target.x - f.x, target.y - f.y);
      input.move = { x: -n.y * memory.strafe * 0.7 - n.x * 0.15, y: n.x * memory.strafe * 0.7 - n.y * 0.15 };
    }
    return input;
  }

  // Walk the lane towards the enemy base
  const lanes = LANES_FOR[f.slots] || LANES_FOR[5];
  const laneY = LANES_Y[lanes[f.idx % lanes.length]];
  const dir = f.team === 'blue' ? 1 : -1;
  const ahead = f.x * dir < (CENTER.x + dir * 300) * dir ? { x: CENTER.x + dir * 300, y: laneY } : { x: enemyBase.x - dir * 170, y: enemyBase.y + (laneY - 450) * 0.5 };
  return { move: steer(f, waypoint(f, ahead.x, ahead.y)) };
}
