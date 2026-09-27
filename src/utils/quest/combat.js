// Shared rules of the quest fights: damage both ways, knock-outs, experience, level-ups,
// evolutions starting, loot on the ground. Used by engine.js and boss.js (no drawing here).
import { effectiveness } from '../battle/typeChart';
import { speciesInfo, nextEvolution } from './species';
import { memberStats, enemyStats, xpToNext, xpForKo, xpShare, MAX_LEVEL } from './progress';
import { rollDrops, rarityOf } from './items';
import { nearestFree } from './world';
import { artworkUrl } from '../../services/pokemonOnlineService';

export const ULT_MAX = 100;
export const MEMBER_R = 16;
export const ENEMY_R = 18;
export const ELITE_R = 23;
// Pokemon of these types hit in melee (a quick lunge); the others shoot
const MELEE_TYPES = new Set(['normal', 'fighting', 'rock', 'ground', 'bug', 'steel', 'dark', 'flying']);
export const isRangedType = (t) => !MELEE_TYPES.has(t);

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const OUT_MAX = 2;
/** The team members walking with the trainer and fighting (the lead and one companion). */
export const fighters = (state) => state.party.filter((m) => m.out && !m.fainted);
/** Keep the `out` flags in line with state.lead / state.companion. */
export function syncOut(state) {
  for (const m of state.party) m.out = m.idx === state.lead || m.idx === state.companion;
}
/** The healthiest Pokemon resting in its ball (to send out next), or null. */
export function bestBenched(state) {
  const bench = state.party.filter((m) => !m.out && !m.fainted);
  return bench.sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp)[0] || null;
}
/** A Pokemon comes out of its ball next to the trainer. */
export function placeOut(state, m) {
  const t = state.trainer;
  const p = nearestFree(state.area, t.x - t.dir.x * 38 + t.dir.y * 30, t.y - t.dir.y * 38 - t.dir.x * 30, m.r);
  m.x = p.x;
  m.y = p.y;
  m.target = null;
  m.knock = null;
  emit(state, { kind: 'sendout', idx: m.idx, x: m.x, y: m.y, fromX: t.x, fromY: t.y - 20, name: m.name });
}
export const emit = (state, e) => {
  state.events.push(e);
  if (state.events.length > 600) state.events.splice(0, state.events.length - 600);
};

// Immunities would be frustrating: they count as "not very effective"
const effOf = (type, defTypes) => Math.max(0.5, Math.min(2, effectiveness(type, defTypes)));

/** Recompute a member's stats after a level, evolution or charm (keeps the HP ratio). */
export function refreshStats(state, m) {
  const s = memberStats(m, state.charms);
  const ratio = m.maxHp ? m.hp / m.maxHp : 1;
  m.maxHp = s.maxHp;
  m.atk = s.atk;
  m.speed = s.speed;
  m.hp = m.fainted ? 0 : Math.max(1, Math.min(m.maxHp, Math.round(ratio * m.maxHp)));
}

export function makeEnemy(state, dex, level, { elite = false, boss = false, x, y, pack = -1, ranged = null } = {}) {
  const info = speciesInfo(dex) || { dex, name: `#${dex}`, types: ['normal'], bst: 320 };
  const st = enemyStats(level, info.bst, { elite });
  const act = state.actDef;
  const isRanged = ranged ?? (act?.ranged?.includes(dex) || isRangedType(info.types[0]));
  const r = elite ? ELITE_R : ENEMY_R;
  const p = nearestFree(state.area, x, y, r);
  const e = {
    id: state.nextId++,
    dex,
    name: info.name,
    image: artworkUrl(dex),
    types: info.types,
    level,
    elite,
    boss,
    x: p.x,
    y: p.y,
    r,
    hp: Math.round(st.maxHp * (act?.power?.hp || 1)),
    maxHp: Math.round(st.maxHp * (act?.power?.hp || 1)),
    atk: st.atk * (act?.power?.dmg || 1),
    speed: (isRanged ? 92 : 112) * (elite ? 0.95 : 1),
    ranged: isRanged,
    atkCd: isRanged ? 1.9 : 1.45,
    home: { x: p.x, y: p.y },
    mode: 'idle',
    target: null,
    retarget: 0,
    cd: 0.5 + state.random() * 0.8,
    windup: 0,
    wanderT: state.random() * 2,
    wx: p.x,
    wy: p.y,
    facing: state.random() < 0.5 ? -1 : 1,
    moving: false,
    pack,
    alertT: 0,
    knock: null,
    hitBy: new Set(),
    dead: false,
  };
  state.enemies.push(e);
  return e;
}

/** Wake a wild Pokemon (and its pack) up: it chases the team. */
export function alert(state, e) {
  if (e.mode === 'chase' || e.dead) return;
  e.mode = 'chase';
  e.alertT = 0.9;
  e.retarget = 0;
  e.lastAction = state.time;
  emit(state, { kind: 'alert', id: e.id, x: e.x, y: e.y });
  if (e.pack < 0) return;
  for (const o of state.enemies) if (o !== e && o.pack === e.pack && !o.dead && o.mode !== 'chase') {
    o.mode = 'chase';
    o.alertT = 0.9;
    o.retarget = 0;
    o.lastAction = state.time;
  }
}

/** A team member (or the whole-team ultimate when `m` has no idx) hits a wild Pokemon. */
export function damageEnemy(state, m, e, mult, { charge = true, knock = null } = {}) {
  if (e.dead) return 0;
  const eff = effOf(m.types[0], e.types);
  const crit = state.random() < 0.08;
  const amount = Math.max(1, Math.round(m.atk * mult * eff * (0.9 + state.random() * 0.2) * (crit ? 1.6 : 1)));
  e.hp -= amount;
  e.lastAction = state.time;
  if (m.idx != null) e.hitBy.add(m.idx);
  if (charge) state.ult = Math.min(ULT_MAX, state.ult + mult * 0.75);
  if (knock && !e.boss) e.knock = { vx: knock.x * 380, vy: knock.y * 380, t: 0.16 };
  state.stats.dealt += amount;
  emit(state, { kind: 'hit', x: e.x, y: e.y - e.r - 8, amount, crit, eff, type: m.types[0], target: e.id, boss: e.boss });
  if (e.mode !== 'chase' && !e.boss) alert(state, e);
  if (e.boss && !e.awake) e.awake = true;
  if (e.hp <= 0) koEnemy(state, e);
  return amount;
}

export function spawnDrop(state, x, y, drop, spread = 1) {
  const a = state.random() * Math.PI * 2;
  const v = (60 + state.random() * 90) * spread;
  state.drops.push({ id: state.nextId++, ...drop, rarity: rarityOf(drop), x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, z: 0, vz: 260 + state.random() * 120, age: 0 });
  emit(state, { kind: 'drop', x, y, rarity: rarityOf(drop), item: drop.item || 'coin' });
}

export function koEnemy(state, e) {
  e.dead = true;
  e.hp = 0;
  state.stats.kills += 1;
  state.ult = Math.min(ULT_MAX, state.ult + (e.elite ? 10 : 4));
  emit(state, { kind: 'ko', x: e.x, y: e.y, type: e.types[0], elite: e.elite, boss: e.boss, dex: e.dex, name: e.name, id: e.id });
  if (!e.noXp) {
    const base = xpForKo(e.level, e);
    for (const m of state.party) grantXp(state, m, xpShare(base, m.level, e.level, { hit: e.hitBy.has(m.idx), fainted: m.fainted, benched: !m.out }));
    for (const d of rollDrops(e, state.random)) spawnDrop(state, e.x, e.y, d, e.boss ? 2.2 : 1);
  }
}

/** Experience for one member: levels up (with a burst) and may start an evolution. */
export function grantXp(state, m, amount) {
  if (m.level >= MAX_LEVEL) return;
  m.xp += amount;
  while (m.level < MAX_LEVEL && m.xp >= xpToNext(m.level)) {
    m.xp -= xpToNext(m.level);
    levelUp(state, m);
  }
  if (m.level >= MAX_LEVEL) m.xp = 0;
}

export function levelUp(state, m) {
  if (m.level >= MAX_LEVEL) return false;
  const before = m.maxHp;
  m.level += 1;
  refreshStats(state, m);
  if (!m.fainted) m.hp = Math.min(m.maxHp, m.hp + (m.maxHp - before) + Math.round(m.maxHp * 0.2));
  state.stats.levels += 1;
  emit(state, { kind: 'levelup', idx: m.idx, level: m.level, x: m.x, y: m.y, name: m.name, fainted: m.fainted });
  checkEvolution(state, m);
  return true;
}

/** Start the evolution sequence when a member reaches its evolution level. */
export function checkEvolution(state, m, force = false) {
  if (state.pendingEvolution) return false;
  const step = nextEvolution(m.plan, m.dex);
  if (!step || (!force && m.level < step.level)) return false;
  state.pendingEvolution = { idx: m.idx, key: m.key, fromName: m.name, fromImage: m.image, fromDex: m.dex, toName: step.name, toImage: step.image, toDex: step.to, level: m.level };
  emit(state, { kind: 'evolve-start', idx: m.idx, x: m.x, y: m.y });
  return true;
}

/** Damage to a team member (wild Pokemon or boss). The trainer is never hit. */
export function damageMember(state, e, m, mult) {
  if (m.fainted) return 0;
  const eff = effOf(e.types[0], m.types);
  const crit = state.random() < 0.05;
  const amount = Math.max(1, Math.round(e.atk * mult * eff * (0.88 + state.random() * 0.24) * (crit ? 1.5 : 1)));
  m.hp -= amount;
  m.lastHurt = state.time;
  e.lastAction = state.time;
  state.stats.taken += amount;
  emit(state, { kind: 'hurt', idx: m.idx, x: m.x, y: m.y - 30, amount, crit, type: e.types[0] });
  if (m.hp <= 0) faint(state, m);
  return amount;
}

export function faint(state, m) {
  m.fainted = true;
  m.hp = 0;
  m.target = null;
  state.stats.faints += 1;
  emit(state, { kind: 'faint', idx: m.idx, x: m.x, y: m.y, name: m.name });
  const alive = state.party.filter((p) => !p.fainted);
  if (!alive.length) {
    state.wipe = true;
    state.wipeT = 2.8;
    state.telegraphs = [];
    emit(state, { kind: 'wipe' });
    return;
  }
  if (!m.out) return;
  // A rested Pokemon jumps out of its ball to take the place
  const next = bestBenched(state);
  if (m.idx === state.lead) {
    const comp = state.party[state.companion];
    if (comp && !comp.fainted) {
      state.lead = comp.idx;
      state.companion = next ? next.idx : -1;
    } else {
      state.lead = next ? next.idx : alive[0].idx;
      state.companion = -1;
    }
    emit(state, { kind: 'lead', idx: state.lead, auto: true });
  } else state.companion = next ? next.idx : -1;
  syncOut(state);
  if (next) placeOut(state, next);
}

/** Wild Pokemon stats for a level (exported for the boss and minions). */
export { enemyStats };
