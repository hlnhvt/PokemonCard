// Real-time 5 vs 5 arena (MOBA style). Pure simulation, stepped with a fixed dt;
// the component draws `state` and plays `state.events`. The child controls one fighter,
// every other fighter is driven by utils/moba/ai.js.
import { BASES, collide, blocked } from './map';
import { effectiveness } from '../battle/typeChart';

export const RESPAWN_TIME = 5;
export const FIGHTER_R = 20;
const ASSIST_WINDOW = 6;
const BASE_HEAL = 0.14; // of max HP per second, for allies inside their base
const BASE_BURN = 0.22; // of max HP per second, for enemies inside a base
export const ULT_MAX = 100;
const ULT_GAIN = { dealt: 0.14, taken: 0.1, kill: 30 }; // per damage point / per kill
// Children's team gets a little help (tuned with bot matches in moba.test.js)
export const TEAM_POWER = { blue: 1.02, red: 0.99 };

// Move names per type: [basic, skill 1, skill 2, ultimate]
const KIT_NAMES = {
  normal: ['Cú đấm', 'Lao tới', 'Tiếng hét', 'Siêu Tốc Liên Hoàn'],
  fire: ['Tàn lửa', 'Phun lửa', 'Vòng lửa', 'Hỏa Long Liên Hoàn'],
  water: ['Bong bóng', 'Súng nước', 'Sóng thần', 'Thủy Long Liên Hoàn'],
  electric: ['Tia lửa điện', 'Sấm sét', 'Điện trường', 'Lôi Thần Liên Hoàn'],
  grass: ['Lá bay', 'Roi dây leo', 'Bão lá', 'Mộc Thần Liên Hoàn'],
  ice: ['Mảnh băng', 'Tia băng', 'Bão tuyết', 'Băng Giá Liên Hoàn'],
  fighting: ['Đấm karate', 'Cú đá bay', 'Chấn động', 'Võ Thần Liên Hoàn'],
  poison: ['Kim độc', 'Bom bùn', 'Khí độc', 'Độc Xà Liên Hoàn'],
  ground: ['Ném bùn', 'Đá tảng', 'Động đất', 'Địa Chấn Liên Hoàn'],
  flying: ['Gió xoáy', 'Chém gió', 'Lốc xoáy', 'Thiên Không Liên Hoàn'],
  psychic: ['Niệm lực', 'Sóng tâm linh', 'Vòng siêu linh', 'Tâm Linh Liên Hoàn'],
  bug: ['Tơ nhện', 'Cắn xé', 'Bầy côn trùng', 'Trùng Vương Liên Hoàn'],
  rock: ['Ném đá', 'Đá lở', 'Bão cát', 'Thạch Thần Liên Hoàn'],
  ghost: ['Liếm ma', 'Bóng ma', 'Đêm tối', 'U Linh Liên Hoàn'],
  dragon: ['Hơi thở rồng', 'Móng rồng', 'Cơn thịnh nộ', 'Thần Long Liên Hoàn'],
  dark: ['Cắn', 'Nghiền nát', 'Bóng tối', 'Ám Dạ Liên Hoàn'],
  steel: ['Móng thép', 'Pháo thép', 'Cánh thép', 'Thép Thần Liên Hoàn'],
  fairy: ['Gió tiên', 'Ánh trăng', 'Hào quang', 'Tiên Nữ Liên Hoàn'],
};

// How each ability behaves (same shape for every type; the type decides looks and damage)
export const SKILLS = {
  basic: { cd: 0.75, range: 175, speed: 520, dmg: 1.0, radius: 7 },
  s1: { cd: 3.5, range: 320, speed: 700, dmg: 2.3, radius: 11, pierce: true },
  s2: { cd: 7, radius: 115, dmg: 2.5, knock: 70 },
  ult: { range: 280, hits: [1.4, 1.4, 1.6, 3.2], gap: 0.13, dash: 1400 },
};
const FAST = ['electric', 'flying'];
const SLOW = ['rock', 'ground', 'steel'];

export const kitOf = (types) => KIT_NAMES[types[0]] || KIT_NAMES.normal;

/** Stats from a strength number (base stat total like). Differences are squeezed so any Pokemon is fun. */
export function statsFor(power, types) {
  const eff = 350 + (Math.max(180, Math.min(700, power)) - 350) * 0.45;
  const maxHp = Math.round((380 + eff * 0.9) * 2.6);
  const atk = 22 + eff * 0.05;
  let speed = 125;
  if (types.some((t) => FAST.includes(t))) speed += 18;
  if (types.some((t) => SLOW.includes(t))) speed -= 14;
  return { maxHp, atk, speed };
}

function makeFighter(m, team, idx) {
  const types = (m.types || ['normal']).map((t) => String(t).toLowerCase());
  const s = statsFor(m.power || 400, types);
  const base = BASES[team];
  const spawn = spawnPoint(team, idx);
  return {
    id: `${team}${idx}`,
    team,
    idx,
    name: m.name,
    image: m.image,
    types,
    kit: kitOf(types),
    ...s,
    hp: s.maxHp,
    r: FIGHTER_R,
    x: spawn.x,
    y: spawn.y,
    facing: team === 'blue' ? 1 : -1,
    aim: { x: team === 'blue' ? 1 : -1, y: 0 },
    cd: { basic: 0, s1: 0, s2: 0 },
    ult: 0,
    dead: false,
    respawnIn: 0,
    hitters: {}, // fighter id -> time of their last hit (for assists)
    kills: 0,
    deaths: 0,
    assists: 0,
    dealt: 0,
    taken: 0,
    healed: 0,
    streak: 0,
    combo: null, // running ultimate
    knock: null,
    moving: false,
    base,
  };
}

export function spawnPoint(team, idx) {
  const b = BASES[team];
  const a = ((idx - 2) / 2) * 0.9;
  return { x: b.x + (team === 'blue' ? 1 : -1) * 35 * Math.cos(a), y: b.y + 70 * Math.sin(a) };
}

/**
 * blue / red: 5 members { name, image, types, power }. duration in seconds.
 * The child starts controlling blue fighter `control`.
 */
export function createMatch({ blue, red, duration = 180, random = Math.random, control = 0 }) {
  return {
    fighters: [...blue.map((m, i) => makeFighter(m, 'blue', i)), ...red.map((m, i) => makeFighter(m, 'red', i))],
    projectiles: [],
    events: [],
    time: 0,
    duration,
    control: `blue${control}`,
    score: { blue: 0, red: 0 },
    random,
    over: false,
    winner: null,
    nextId: 1,
  };
}

export const fighterById = (state, id) => state.fighters.find((f) => f.id === id);
export const enemiesOf = (state, f) => state.fighters.filter((o) => o.team !== f.team && !o.dead);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const timeLeft = (state) => Math.max(0, state.duration - state.time);

export function nearestEnemy(state, f, range = Infinity, needSight = false) {
  let best = null;
  let bestD = range;
  for (const o of enemiesOf(state, f)) {
    const d = dist(f, o);
    if (d < bestD && (!needSight || !blocked(f.x, f.y, o.x, o.y))) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

function damage(state, attacker, target, mult) {
  if (target.dead) return 0; // a shot still counts if its owner fainted meanwhile
  // Immunities would be frustrating in a fast game: they count as "not very effective"
  const eff = Math.max(0.5, effectiveness(attacker.types[0], target.types));
  const crit = state.random() < 0.08;
  const amount = Math.max(1, Math.round(attacker.atk * mult * eff * TEAM_POWER[attacker.team] * (0.9 + state.random() * 0.2) * (crit ? 1.6 : 1)));
  const dealt = Math.min(target.hp, amount);
  target.hp -= dealt;
  attacker.dealt += dealt;
  target.taken += dealt;
  attacker.ult = Math.min(ULT_MAX, attacker.ult + dealt * ULT_GAIN.dealt);
  target.ult = Math.min(ULT_MAX, target.ult + dealt * ULT_GAIN.taken);
  target.hitters[attacker.id] = state.time;
  state.events.push({ kind: 'hit', x: target.x, y: target.y - 26, amount: dealt, crit, eff, type: attacker.types[0], target: target.id, from: attacker.id });
  if (target.hp <= 0) kill(state, attacker, target);
  return dealt;
}

const MULTI = ['', '', 'HẠ GỤC ĐÔI!', 'TAM SÁT!', 'TỨ SÁT!', 'HUYỀN THOẠI!'];

function kill(state, killer, victim) {
  victim.dead = true;
  victim.hp = 0;
  victim.respawnIn = RESPAWN_TIME;
  victim.deaths += 1;
  victim.streak = 0;
  victim.combo = null;
  killer.kills += 1;
  killer.ult = Math.min(ULT_MAX, killer.ult + ULT_GAIN.kill);
  // Kills within a few seconds of each other make a multi-kill
  killer.streak = killer.lastKill != null && state.time - killer.lastKill < 8 ? killer.streak + 1 : 1;
  killer.lastKill = state.time;
  state.score[killer.team] += 1;
  const assists = Object.entries(victim.hitters)
    .filter(([id, t]) => id !== killer.id && state.time - t <= ASSIST_WINDOW && fighterById(state, id)?.team === killer.team)
    .map(([id]) => id);
  for (const id of assists) fighterById(state, id).assists += 1;
  victim.hitters = {};
  const first = state.score.blue + state.score.red === 1;
  state.events.push({ kind: 'kill', killer: killer.id, victim: victim.id, assists, x: victim.x, y: victim.y, multi: MULTI[Math.min(5, killer.streak)] || '', first });
}

function shoot(state, f, skill, dir) {
  const s = SKILLS[skill];
  state.projectiles.push({
    id: state.nextId++,
    owner: f.id,
    team: f.team,
    type: f.types[0],
    skill,
    x: f.x + dir.x * f.r,
    y: f.y + dir.y * f.r,
    vx: dir.x * s.speed,
    vy: dir.y * s.speed,
    life: s.range / s.speed,
    r: s.radius,
    dmg: s.dmg,
    pierce: !!s.pierce,
    hit: [],
  });
}

const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};

/** Direction to shoot: at the nearest enemy in range, else where the fighter faces. */
function aimFor(state, f, range) {
  const t = nearestEnemy(state, f, range + 40);
  return t ? norm(t.x - f.x, t.y - f.y) : f.aim;
}

/**
 * Apply an input to a fighter: { move: {x, y} (length 0..1), basic, cast: 's1' | 's2' | 'ult' }.
 * Returns true when a cast happened.
 */
export function act(state, f, input) {
  if (f.dead || f.combo) return false;
  const m = input.move || { x: 0, y: 0 };
  const len = Math.hypot(m.x, m.y);
  f.moving = len > 0.1;
  if (f.moving) {
    f.aim = norm(m.x, m.y);
    if (Math.abs(m.x) > 0.15) f.facing = m.x > 0 ? 1 : -1;
  }
  f.wantMove = f.moving ? { x: (m.x / Math.max(1, len)) * f.speed, y: (m.y / Math.max(1, len)) * f.speed } : { x: 0, y: 0 };

  if (input.cast === 'ult' && f.ult >= ULT_MAX) {
    const target = nearestEnemy(state, f, SKILLS.ult.range);
    if (target) {
      f.ult = 0;
      f.combo = { target: target.id, hit: 0, t: 0, dashing: true };
      state.events.push({ kind: 'ult', who: f.id, target: target.id, name: f.kit[3], type: f.types[0], x: f.x, y: f.y });
      return true;
    }
  }
  if (input.cast === 's2' && f.cd.s2 <= 0) {
    f.cd.s2 = SKILLS.s2.cd;
    state.events.push({ kind: 'nova', who: f.id, x: f.x, y: f.y, r: SKILLS.s2.radius, type: f.types[0], name: f.kit[2] });
    for (const o of enemiesOf(state, f)) {
      if (dist(f, o) <= SKILLS.s2.radius + o.r) {
        const d = norm(o.x - f.x, o.y - f.y);
        o.knock = { vx: d.x * SKILLS.s2.knock * 6, vy: d.y * SKILLS.s2.knock * 6, t: 0.18 };
        damage(state, f, o, SKILLS.s2.dmg);
      }
    }
    return true;
  }
  if (input.cast === 's1' && f.cd.s1 <= 0) {
    f.cd.s1 = SKILLS.s1.cd;
    const dir = aimFor(state, f, SKILLS.s1.range);
    f.aim = dir;
    if (Math.abs(dir.x) > 0.1) f.facing = dir.x > 0 ? 1 : -1;
    shoot(state, f, 's1', dir);
    state.events.push({ kind: 'cast', who: f.id, skill: 's1', type: f.types[0], name: f.kit[1] });
    return true;
  }
  if (input.basic && f.cd.basic <= 0) {
    const t = nearestEnemy(state, f, SKILLS.basic.range + 10);
    if (t || input.forceBasic) {
      f.cd.basic = SKILLS.basic.cd;
      const dir = t ? norm(t.x - f.x, t.y - f.y) : f.aim;
      if (Math.abs(dir.x) > 0.1) f.facing = dir.x > 0 ? 1 : -1;
      shoot(state, f, 'basic', dir);
      return true;
    }
  }
  return false;
}

function stepCombo(state, f, dt) {
  const c = f.combo;
  const target = fighterById(state, c.target);
  if (!target || target.dead) {
    f.combo = null;
    return;
  }
  c.t += dt;
  if (c.dashing) {
    const d = dist(f, target);
    if (d <= f.r + target.r + 6 || c.t > 0.35) {
      c.dashing = false;
      c.t = SKILLS.ult.gap; // first strike right away
    } else {
      const dir = norm(target.x - f.x, target.y - f.y);
      const step = Math.min(d - f.r - target.r, SKILLS.ult.dash * dt);
      f.x += dir.x * step;
      f.y += dir.y * step;
      if (Math.abs(dir.x) > 0.1) f.facing = dir.x > 0 ? 1 : -1;
      return;
    }
  }
  if (c.t >= SKILLS.ult.gap) {
    c.t = 0;
    const mult = SKILLS.ult.hits[c.hit];
    const final = c.hit === SKILLS.ult.hits.length - 1;
    state.events.push({ kind: 'combo-hit', who: f.id, target: target.id, n: c.hit + 1, final, x: target.x, y: target.y, type: f.types[0] });
    if (final) {
      const d = norm(target.x - f.x, target.y - f.y);
      target.knock = { vx: d.x * 700, vy: d.y * 700, t: 0.2 };
    }
    damage(state, f, target, mult);
    c.hit += 1;
    if (c.hit >= SKILLS.ult.hits.length || target.dead) f.combo = null;
  }
}

/**
 * Advance the match by dt seconds. `inputs` maps fighter id -> input (AI and the child).
 * Events of this step are appended to state.events (the caller empties it after playing them).
 */
export function step(state, dt, inputs = {}) {
  if (state.over) return state;
  state.time += dt;

  for (const f of state.fighters) {
    if (f.dead) {
      f.respawnIn -= dt;
      if (f.respawnIn <= 0) {
        const p = spawnPoint(f.team, f.idx);
        Object.assign(f, { dead: false, hp: f.maxHp, x: p.x, y: p.y, knock: null, combo: null, cd: { basic: 0, s1: 0, s2: 0 } });
        state.events.push({ kind: 'respawn', who: f.id, x: f.x, y: f.y });
      }
      continue;
    }
    f.cd.basic = Math.max(0, f.cd.basic - dt);
    f.cd.s1 = Math.max(0, f.cd.s1 - dt);
    f.cd.s2 = Math.max(0, f.cd.s2 - dt);
    if (inputs[f.id]) act(state, f, inputs[f.id]);

    if (f.combo) stepCombo(state, f, dt);
    else if (f.knock) {
      f.x += f.knock.vx * dt;
      f.y += f.knock.vy * dt;
      f.knock.t -= dt;
      if (f.knock.t <= 0) f.knock = null;
    } else if (f.wantMove) {
      f.x += f.wantMove.x * dt;
      f.y += f.wantMove.y * dt;
    }
    collide(f);

    // Bases: allies heal, enemies burn (no camping at the respawn point)
    for (const team of ['blue', 'red']) {
      const b = BASES[team];
      if (Math.hypot(f.x - b.x, f.y - b.y) > b.r) continue;
      if (team === f.team) {
        const heal = Math.min(f.maxHp - f.hp, f.maxHp * BASE_HEAL * dt);
        f.hp += heal;
        f.healed += heal;
      } else {
        const burn = f.maxHp * BASE_BURN * dt;
        f.hp -= burn;
        f.taken += burn;
        if (f.hp <= 0) {
          // Credited to the base team's last Pokemon to hit this one, else to that team's first member
          const lastHitter = Object.entries(f.hitters)
            .filter(([id]) => id.startsWith(team))
            .sort((a, b) => b[1] - a[1])[0];
          kill(state, fighterById(state, lastHitter ? lastHitter[0] : `${team}0`), f);
        }
      }
    }
  }

  // Projectiles
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    let gone = p.life <= 0 || blocked(p.x - p.vx * dt, p.y - p.vy * dt, p.x, p.y, 0);
    if (!gone) {
      const owner = fighterById(state, p.owner);
      for (const o of state.fighters) {
        if (o.team === p.team || o.dead || p.hit.includes(o.id)) continue;
        if (Math.hypot(o.x - p.x, o.y - p.y) <= o.r + p.r) {
          p.hit.push(o.id);
          damage(state, owner, o, p.dmg);
          if (!p.pierce) {
            gone = true;
            break;
          }
        }
      }
    }
    if (gone) {
      state.events.push({ kind: 'pop', x: p.x, y: p.y, type: p.type, big: p.skill !== 'basic' });
      state.projectiles.splice(i, 1);
    }
  }

  if (state.time >= state.duration) {
    state.over = true;
    state.winner = state.score.blue > state.score.red ? 'blue' : state.score.red > state.score.blue ? 'red' : 'draw';
    state.events.push({ kind: 'end', winner: state.winner });
  }
  return state;
}

/** Match summary for the dashboard. MVP = best (kills*3 + assists*1.5 - deaths + damage/400). */
export function summary(state) {
  const rate = (f) => f.kills * 3 + f.assists * 1.5 - f.deaths + f.dealt / 400;
  const rows = state.fighters.map((f) => ({ id: f.id, team: f.team, name: f.name, image: f.image, types: f.types, kills: f.kills, deaths: f.deaths, assists: f.assists, dealt: Math.round(f.dealt), taken: Math.round(f.taken), healed: Math.round(f.healed), rating: rate(f) }));
  const mvp = rows.reduce((a, b) => (b.rating > a.rating ? b : a), rows[0]);
  return { winner: state.winner, score: { ...state.score }, duration: state.duration, rows, mvp: mvp.id };
}
