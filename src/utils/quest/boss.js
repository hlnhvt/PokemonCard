// The act bosses. Each wakes up when the trainer comes close, walks towards the team and
// uses big attacks announced first by red warning shapes on the ground (like the arena
// boss raid in utils/moba/boss.js):
//   slam   - a circle round the boss, then a shock wave
//   meteor - circles under team members, then rocks / fire / ice fall
//   charge - a long strip towards one member, then the boss dashes along it
//   ring   - bolts fired out in every direction
// Below 35% HP it gets angry (faster). At 66% and 33% it calls a few helpers.
import { ACTS, moveCircle, TILE } from './world';
import { speciesInfo } from './species';
import { enemyStats } from './progress';
import { artworkUrl } from '../../services/pokemonOnlineService';
import { makeEnemy, damageMember, emit, dist } from './combat';

export const BOSS_R = 50;
export const ENRAGE_AT = 0.35;
export const BOSS_ATTACKS = {
  slam: { warn: 1.15, cd: 5.5, r: 170, mult: 2.2, range: 240 },
  meteor: { warn: 1.35, cd: 7, r: 80, mult: 1.9, count: 3 },
  charge: { warn: 1.0, cd: 8, len: 470, w: 84, mult: 2.2, speed: 900 },
  ring: { warn: 0.7, cd: 6.5, bolts: 12, mult: 0.9 },
};

export function makeBoss(state, act, pos) {
  const def = ACTS[act].boss;
  const info = speciesInfo(def.dex);
  const st = enemyStats(def.level, info.bst);
  const b = makeEnemy(state, def.dex, def.level, { boss: true, x: pos.x, y: pos.y, ranged: false });
  Object.assign(b, {
    name: def.name,
    title: def.title,
    r: BOSS_R,
    maxHp: Math.round(st.maxHp * def.hp),
    atk: st.atk * 1.45 * (def.dmg ?? 1),
    speed: 78,
    attacks: def.attacks,
    cds: { slam: 3, meteor: 5, charge: 7, ring: 4 },
    attack: null,
    dash: null,
    awake: false,
    angry: false,
    summoned: 0,
    minions: def.minions,
    meleeCd: 1.6,
    image: artworkUrl(def.dex),
  });
  b.hp = b.maxHp;
  return b;
}

const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};

const inCircle = (f, c) => Math.hypot(f.x - c.x, f.y - c.y) <= c.r + f.r * 0.5;
function inStrip(f, st) {
  const dx = f.x - st.x;
  const dy = f.y - st.y;
  const along = dx * Math.cos(st.ang) + dy * Math.sin(st.ang);
  const side = -dx * Math.sin(st.ang) + dy * Math.cos(st.ang);
  return along >= -f.r && along <= st.len + f.r && Math.abs(side) <= st.w / 2 + f.r * 0.5;
}
/** Is a Pokemon inside a warning shape? (team members step out of them by themselves) */
export const insideWarning = (f, sh) => (sh.shape === 'strip' ? inStrip(f, sh) : inCircle(f, sh));

function begin(state, b, kind, shapes) {
  const a = BOSS_ATTACKS[kind];
  const warn = a.warn * (b.angry ? 0.85 : 1);
  b.attack = { kind, t: warn, shapes };
  for (const sh of shapes) state.telegraphs.push({ ...sh, kind, type: b.types[0], t: warn, max: warn, id: state.nextId++ });
  emit(state, { kind: 'boss-warn', attack: kind, x: b.x, y: b.y });
}

function hitMembers(state, b, test, mult, from) {
  for (const m of state.party) {
    if (m.fainted || !test(m)) continue;
    if (from) {
      const d = norm(m.x - from.x, m.y - from.y);
      m.knock = { vx: d.x * 520, vy: d.y * 520, t: 0.2 };
    }
    damageMember(state, b, m, mult);
  }
}

function release(state, b) {
  const at = b.attack;
  const a = BOSS_ATTACKS[at.kind];
  state.telegraphs = [];
  b.attack = null;
  b.cds[at.kind] = a.cd * (b.angry ? 0.7 : 1);
  if (at.kind === 'slam') {
    const c = at.shapes[0];
    emit(state, { kind: 'boss-slam', x: c.x, y: c.y, r: c.r, type: b.types[0] });
    hitMembers(state, b, (m) => inCircle(m, c), a.mult, c);
  } else if (at.kind === 'meteor') {
    for (const c of at.shapes) {
      emit(state, { kind: 'boss-meteor', x: c.x, y: c.y, r: c.r, type: b.types[0] });
      hitMembers(state, b, (m) => inCircle(m, c), a.mult, null);
    }
  } else if (at.kind === 'charge') {
    const st = at.shapes[0];
    b.dash = { ang: st.ang, left: st.len, hit: new Set() };
    emit(state, { kind: 'boss-charge', x: b.x, y: b.y, name: b.name });
  } else if (at.kind === 'ring') {
    const n = a.bolts;
    const off = state.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const ang = off + (i / n) * Math.PI * 2;
      state.projectiles.push({ id: state.nextId++, side: 'enemy', owner: b.id, type: b.types[0], x: b.x, y: b.y - 10, vx: Math.cos(ang) * 290, vy: Math.sin(ang) * 290, life: 2.2, r: 12, mult: a.mult, pierce: false, big: true });
    }
    emit(state, { kind: 'boss-ring', x: b.x, y: b.y, type: b.types[0] });
  }
}

function choose(state, b, target) {
  const d = dist(b, target);
  const alive = state.party.filter((m) => !m.fainted);
  for (const kind of b.attacks) {
    if (b.cds[kind] > 0) continue;
    if (kind === 'slam' && d < BOSS_ATTACKS.slam.range) return begin(state, b, 'slam', [{ shape: 'circle', x: b.x, y: b.y, r: BOSS_ATTACKS.slam.r }]);
    if (kind === 'meteor') {
      const shapes = alive.slice(0, BOSS_ATTACKS.meteor.count + (b.angry ? 1 : 0)).map((m) => ({ shape: 'circle', x: m.x + (state.random() - 0.5) * 30, y: m.y + (state.random() - 0.5) * 30, r: BOSS_ATTACKS.meteor.r }));
      return begin(state, b, 'meteor', shapes);
    }
    if (kind === 'charge' && d > 120) {
      return begin(state, b, 'charge', [{ shape: 'strip', x: b.x, y: b.y, ang: Math.atan2(target.y - b.y, target.x - b.x), len: BOSS_ATTACKS.charge.len, w: BOSS_ATTACKS.charge.w }]);
    }
    if (kind === 'ring' && d < 420) return begin(state, b, 'ring', [{ shape: 'circle', x: b.x, y: b.y, r: 60 }]);
  }
  return null;
}

/** Advance the boss (called by engine.step while it is alive). */
export function stepBoss(state, b, dt) {
  const t = state.trainer;
  if (!b.awake) {
    if (dist(b, t) < 470) b.awake = true;
    else return;
  }
  if (!b.woke) {
    b.woke = true;
    emit(state, { kind: 'boss-wake', name: b.name, title: b.title });
  }
  const alive = state.party.filter((m) => !m.fainted);
  if (!alive.length) return;
  // Angry below 35%, helpers at 66% and 33%
  if (!b.angry && b.hp / b.maxHp < ENRAGE_AT) {
    b.angry = true;
    b.speed *= 1.25;
    emit(state, { kind: 'boss-enrage', x: b.x, y: b.y });
  }
  const ratio = b.hp / b.maxHp;
  if ((b.summoned === 0 && ratio < 0.66) || (b.summoned === 1 && ratio < 0.33)) {
    b.summoned += 1;
    const lv = Math.max(1, b.level - 3);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + state.random();
      const mn = makeEnemy(state, b.minions[i % b.minions.length], lv, { x: b.x + Math.cos(a) * 110, y: b.y + Math.sin(a) * 110, pack: -2 });
      mn.mode = 'chase';
      mn.minion = true;
      mn.home = { x: b.x, y: b.y };
    }
    emit(state, { kind: 'boss-summon', x: b.x, y: b.y, name: b.name });
  }
  for (const k of Object.keys(b.cds)) b.cds[k] = Math.max(0, b.cds[k] - dt);
  b.meleeCd = Math.max(0, b.meleeCd - dt);

  if (b.dash) {
    const step = Math.min(b.dash.left, BOSS_ATTACKS.charge.speed * dt);
    const dx = Math.cos(b.dash.ang) * step;
    const dy = Math.sin(b.dash.ang) * step;
    const moved = moveCircle(state.area, b, dx, dy, b.r * 0.7);
    b.dash.left -= step;
    b.moving = true;
    if (Math.abs(dx) > 0.1) b.facing = dx > 0 ? 1 : -1;
    for (const m of alive) {
      if (b.dash.hit.has(m.idx) || dist(m, b) > b.r + m.r + 6) continue;
      b.dash.hit.add(m.idx);
      const d = norm(m.x - b.x, m.y - b.y);
      m.knock = { vx: d.x * 560, vy: d.y * 560, t: 0.2 };
      damageMember(state, b, m, BOSS_ATTACKS.charge.mult);
    }
    if (b.dash.left <= 0 || !moved) b.dash = null;
    return;
  }
  if (b.attack) {
    b.attack.t -= dt;
    b.moving = false;
    for (const w of state.telegraphs) w.t = b.attack.t;
    if (b.attack.t <= 0) release(state, b);
    return;
  }
  const target = alive.reduce((a, m) => (dist(m, b) < dist(a, b) ? m : a), alive[0]);
  if (choose(state, b, target)) return;
  const d = dist(b, target);
  if (d > b.r + target.r + 18) {
    const dir = norm(target.x - b.x, target.y - b.y);
    moveCircle(state.area, b, dir.x * b.speed * dt, dir.y * b.speed * dt, b.r * 0.7);
    b.moving = true;
    if (Math.abs(dir.x) > 0.2) b.facing = dir.x > 0 ? 1 : -1;
  } else {
    b.moving = false;
    if (b.meleeCd <= 0) {
      b.meleeCd = b.angry ? 1.2 : 1.6;
      emit(state, { kind: 'bite', x: target.x, y: target.y, type: b.types[0], big: true });
      damageMember(state, b, target, 1.1);
    }
  }
  // Never leave the arena
  const ar = state.area.arena;
  if (ar) {
    const k = ((b.x - ar.x) / (ar.rx - TILE)) ** 2 + ((b.y - ar.y) / (ar.ry - TILE)) ** 2;
    if (k > 1) {
      const s = 1 / Math.sqrt(k);
      b.x = ar.x + (b.x - ar.x) * s;
      b.y = ar.y + (b.y - ar.y) * s;
    }
  }
}
