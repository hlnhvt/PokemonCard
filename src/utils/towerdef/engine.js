// Thủ thành Pokémon: pure game engine. step(s, dt) moves everything; the component reads the
// state each frame for drawing and consumes s.events for sounds / effects.
import { LEVELS, ENEMIES, pointAt, waveSpawns, waveHp } from './levels';
import { LINES, HERO, EVOLVE_COST, HERO_LEVEL_COST, ENERGY_NEED, SELL_REFUND, MAX_STAGE, typeMult, heroType, lineUnlocked } from './towers';

export const START_LIVES = 20;
const FIRST_GAP = 22; // seconds before the next wave comes on its own once the last one has spawned
const CLEAR_GAP = 6; // ...or this once the field is empty
const KILL_ENERGY = 8;
const REWARD_POW = 0.75; // tougher waves pay more coins
const FLY_PENALTY = 0.8; // ground towers find flyers harder to hit
const PROJ_SPEED = { fireball: 300, bubble: 280, cannon: 340, leaf: 300, psy: 380, star: 340 };

export function createGame({ level = 0, player = null, random = Math.random } = {}) {
  const lv = LEVELS[level];
  return {
    level,
    lv,
    random,
    hero: player ? { name: player.name || 'Bạn', image: player.image || null, type: heroType(player) } : null,
    heroUsed: false,
    lives: START_LIVES,
    maxLives: START_LIVES,
    coins: lv.startCoins,
    wave: 0, // waves started
    waves: lv.waves.length,
    spawns: [],
    waveT: 0,
    nextIn: null,
    waveLeft: [],
    waveSpawned: [],
    enemies: [],
    towers: [],
    projectiles: [],
    drops: [],
    candies: 0,
    status: 'build',
    time: 0,
    nextId: 1,
    events: [],
    stats: { kills: 0, leaked: 0, evolutions: 0, built: 0, candyUsed: 0, damage: 0 },
  };
}

// ---------- Helpers ----------

const lineOf = (t) => (t.line === 'hero' ? HERO : LINES[t.line]);
export const statsOf = (t) => lineOf(t).stages[t.stage];

/** Energy a tower needs to evolve (towers do not scale, so neither does this). */
export const energyNeed = (s, t) => (t.stage >= MAX_STAGE ? 0 : ENERGY_NEED[t.stage]);
export const evolveCost = (t) => (t.stage >= MAX_STAGE ? 0 : (t.line === 'hero' ? HERO_LEVEL_COST : EVOLVE_COST)[t.stage]);
export const energyFull = (s, t) => t.stage < MAX_STAGE && t.energy >= energyNeed(s, t);
export const canEvolve = (s, t) => energyFull(s, t) && s.coins >= evolveCost(t) && !isOver(s);
export const sellValue = (t) => Math.floor(t.spent * SELL_REFUND);
export const isOver = (s) => s.status === 'won' || s.status === 'lost';

function nameOf(s, line, stage) {
  if (line === 'hero') return s.hero?.name || 'Bạn';
  return LINES[line].stages[stage].name;
}
const dexOf = (line, stage) => (line === 'hero' ? null : LINES[line].stages[stage].dex);

/** Stars from the hearts left: 3 at 80 %+, 2 at 40 %+, else 1 (0 if lost). */
export function starsFor(lives, maxLives = START_LIVES, won = true) {
  if (!won || lives <= 0) return 0;
  const r = lives / maxLives;
  return r >= 0.8 ? 3 : r >= 0.4 ? 2 : 1;
}

// ---------- Player actions ----------

export function towerAt(s, padId) {
  return s.towers.find((t) => t.pad === padId) || null;
}

export function canBuild(s, padId, line) {
  if (isOver(s) || towerAt(s, padId) || !s.lv.pads[padId]) return false;
  if (line === 'hero') return !!s.hero && !s.heroUsed;
  return !!LINES[line] && lineUnlocked(line, s.level) && s.coins >= LINES[line].cost;
}

export function build(s, padId, line) {
  if (!canBuild(s, padId, line)) return null;
  const pad = s.lv.pads[padId];
  const cost = line === 'hero' ? 0 : LINES[line].cost;
  s.coins -= cost;
  if (line === 'hero') s.heroUsed = true;
  const t = {
    id: s.nextId++,
    pad: padId,
    line,
    stage: 0,
    x: pad.x,
    y: pad.y,
    type: line === 'hero' ? s.hero.type : LINES[line].type,
    name: nameOf(s, line, 0),
    dex: dexOf(line, 0),
    energy: 0,
    cooldown: 0.2,
    spent: cost,
    angle: -Math.PI / 2,
    damage: 0,
    kills: 0,
  };
  s.towers.push(t);
  s.stats.built++;
  s.events.push({ type: 'build', tower: t.id, x: t.x, y: t.y, line });
  return t;
}

/** Evolve (or level up the hero): needs a full energy bar and the coins. */
export function evolve(s, towerId) {
  const t = s.towers.find((q) => q.id === towerId);
  if (!t || !canEvolve(s, t)) return false;
  const cost = evolveCost(t);
  const from = t.name;
  s.coins -= cost;
  t.spent += cost;
  t.stage++;
  t.energy = 0;
  t.name = nameOf(s, t.line, t.stage);
  t.dex = dexOf(t.line, t.stage);
  t.cooldown = 0.3;
  s.stats.evolutions++;
  s.events.push({ type: 'evolve', tower: t.id, from, to: t.name, stage: t.stage, line: t.line, dex: t.dex, x: t.x, y: t.y });
  return true;
}

export function sell(s, towerId) {
  const i = s.towers.findIndex((q) => q.id === towerId);
  if (i < 0 || isOver(s)) return 0;
  const t = s.towers[i];
  const refund = sellValue(t);
  s.coins += refund;
  s.towers.splice(i, 1);
  // The hero goes home but cannot come back this level
  s.events.push({ type: 'sell', tower: t.id, x: t.x, y: t.y, refund });
  return refund;
}

/** Tap a Rare Candy on the map to pick it up. */
export function collectCandy(s, dropId) {
  const i = s.drops.findIndex((d) => d.id === dropId);
  if (i < 0) return false;
  const d = s.drops[i];
  s.drops.splice(i, 1);
  s.candies++;
  s.events.push({ type: 'candy', x: d.x, y: d.y });
  return true;
}

/** Give a Rare Candy to a tower: its evolution energy fills up at once. */
export function feedCandy(s, towerId) {
  const t = s.towers.find((q) => q.id === towerId);
  if (!t || s.candies <= 0 || t.stage >= MAX_STAGE || energyFull(s, t)) return false;
  s.candies--;
  t.energy = energyNeed(s, t);
  s.stats.candyUsed++;
  s.events.push({ type: 'candyUsed', tower: t.id, x: t.x, y: t.y });
  return true;
}

/** Coins for calling the next wave early. */
export const earlyBonus = (s) => (s.status === 'play' && s.nextIn != null ? Math.max(1, Math.ceil(s.nextIn / 2)) : 0);

export const canCallWave = (s) => (s.status === 'build' || (s.status === 'play' && s.spawns.length === 0)) && s.wave < s.waves;

/** Start the first wave, or call the next one early for bonus coins. */
export function callWave(s) {
  if (!canCallWave(s)) return false;
  if (s.status === 'play') {
    const bonus = earlyBonus(s);
    if (bonus) {
      s.coins += bonus;
      s.events.push({ type: 'early', bonus });
    }
  }
  launchWave(s);
  return true;
}

function launchWave(s) {
  const w = s.wave;
  s.spawns = waveSpawns(s.level, w).map((sp) => ({ ...sp, wave: w }));
  s.waveLeft[w] = s.spawns.length;
  s.waveSpawned[w] = false;
  s.waveT = 0;
  s.wave++;
  s.nextIn = null;
  s.status = 'play';
  const boss = s.spawns.find((sp) => ENEMIES[sp.kind].boss);
  s.events.push({ type: 'wave', wave: s.wave, boss: boss ? ENEMIES[boss.kind].name : null });
}

// ---------- Simulation ----------

function spawnEnemy(s, kind, wave) {
  const e = ENEMIES[kind];
  const scale = waveHp(s.level, wave);
  const hp = Math.round(e.hp * scale);
  const p = pointAt(s.lv.path, 0);
  s.enemies.push({
    id: s.nextId++,
    kind,
    dex: e.dex,
    name: e.name,
    type: e.type,
    hp,
    maxHp: hp,
    speed: e.speed,
    reward: Math.round(e.reward * Math.pow(scale, REWARD_POW)),
    lives: e.lives,
    fly: !!e.fly,
    boss: !!e.boss,
    size: e.size,
    wave,
    dist: 0,
    lane: (s.random() - 0.5) * 12,
    x: p.x,
    y: p.y,
    angle: p.angle,
    slowT: 0,
    slowF: 1,
    poisonT: 0,
    poisonDps: 0,
    poisonBy: null,
    flash: 0,
  });
  if (e.boss) s.events.push({ type: 'boss', name: e.name, dex: e.dex });
}

function finishWaveCount(s, wave) {
  s.waveLeft[wave]--;
  if (s.waveLeft[wave] === 0) {
    const bonus = 10 + 3 * wave;
    s.coins += bonus;
    s.events.push({ type: 'waveClear', wave: wave + 1, bonus });
  }
}

function hurt(s, t, e, base) {
  if (e.hp <= 0) return 0;
  const tm = typeMult(t.type, e.type);
  const fly = e.fly && !lineOf(t).antiAir ? FLY_PENALTY : 1;
  const dmg = base * tm * fly;
  const dealt = Math.min(e.hp, dmg);
  e.hp -= dmg;
  e.flash = 0.12;
  if (t) {
    t.damage += dealt;
    s.stats.damage += dealt;
    if (t.stage < MAX_STAGE) t.energy = Math.min(energyNeed(s, t), t.energy + dealt);
  }
  s.events.push({ type: 'hit', x: e.x, y: e.y - 10, amount: Math.max(1, Math.round(dmg)), eff: tm > 1 ? 'super' : tm < 1 ? 'weak' : null, line: t.line });
  if (e.hp <= 0) faint(s, e, t);
  return dealt;
}

function faint(s, e, t) {
  s.coins += e.reward;
  s.stats.kills++;
  if (t) {
    t.kills++;
    if (t.stage < MAX_STAGE) t.energy = Math.min(energyNeed(s, t), t.energy + KILL_ENERGY);
  }
  s.events.push({ type: 'faint', x: e.x, y: e.y, coins: e.reward, dex: e.dex, boss: e.boss, size: e.size });
  if (e.boss) {
    const d = { id: s.nextId++, x: Math.max(20, Math.min(340, e.x + 18)), y: Math.max(30, Math.min(570, e.y - 6)), t: 0 };
    s.drops.push(d);
    s.events.push({ type: 'candyDrop', id: d.id, x: d.x, y: d.y });
  }
  finishWaveCount(s, e.wave);
}

function inRange(t, e, range) {
  return Math.hypot(e.x - t.x, e.y - t.y) <= range;
}

function pickTarget(s, t, range) {
  let best = null;
  for (const e of s.enemies) {
    if (e.hp <= 0 || !inRange(t, e, range)) continue;
    if (!best || e.dist > best.dist) best = e;
  }
  return best;
}

function applyEffects(e, st) {
  if (e.hp <= 0) return;
  if (st.slow) {
    const f = e.boss ? 1 - (1 - st.slow) / 2 : st.slow;
    e.slowF = Math.min(e.slowT > 0 ? e.slowF : 1, f);
    e.slowT = Math.max(e.slowT, st.slowT);
  }
  if (st.poison) {
    e.poisonDps = Math.max(e.poisonT > 0 ? e.poisonDps : 0, st.poison * 1);
    e.poisonT = st.poisonT;
  }
}

function attack(s, t, target) {
  const st = statsOf(t);
  t.angle = Math.atan2(target.y - t.y, target.x - t.x);
  const k = st.attack;
  const levelScale = 1; // tower damage does not scale; evolution is how towers keep up
  const dmg = st.dmg * levelScale;
  if (k === 'cone') {
    // Flamethrower: everything in front, within range
    for (const e of s.enemies) {
      if (e.hp <= 0 || !inRange(t, e, st.range)) continue;
      const a = Math.atan2(e.y - t.y, e.x - t.x);
      let diff = Math.abs(a - t.angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff <= st.cone) hurt(s, t, e, dmg);
    }
    s.events.push({ type: 'cone', tower: t.id, x: t.x, y: t.y, angle: t.angle, range: st.range, spread: st.cone });
  } else if (k === 'beam') {
    // Solar beam: a straight line through the target to the edge of the range
    const ex = t.x + Math.cos(t.angle) * st.range;
    const ey = t.y + Math.sin(t.angle) * st.range;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      if (segDist(t.x, t.y, ex, ey, e.x, e.y) <= 16) {
        hurt(s, t, e, dmg);
        applyEffects(e, st);
        if (e.hp > 0) e.poisonBy = t.id;
      }
    }
    s.events.push({ type: 'beam', tower: t.id, x: t.x, y: t.y, tx: ex, ty: ey });
  } else if (k === 'chain') {
    const hit = [target];
    let last = target;
    while (hit.length < st.chain) {
      let next = null;
      let nd = 72 + t.stage * 10;
      for (const e of s.enemies) {
        if (e.hp <= 0 || hit.includes(e)) continue;
        const d = Math.hypot(e.x - last.x, e.y - last.y);
        if (d < nd) {
          nd = d;
          next = e;
        }
      }
      if (!next) break;
      hit.push(next);
      last = next;
    }
    const pts = [{ x: t.x, y: t.y - 10 }, ...hit.map((e) => ({ x: e.x, y: e.y - 8 }))];
    hit.forEach((e, i) => hurt(s, t, e, dmg * Math.pow(0.85, i)));
    s.events.push({ type: 'chain', tower: t.id, points: pts, stage: t.stage });
  } else if (k === 'psywave') {
    for (const e of s.enemies) if (e.hp > 0 && inRange(t, e, st.range)) hurt(s, t, e, dmg);
    s.events.push({ type: 'psywave', tower: t.id, x: t.x, y: t.y, range: st.range });
  } else {
    const shots = k === 'cannon' ? [-7, 7] : [0];
    for (const off of shots) {
      const px = t.x + Math.cos(t.angle + Math.PI / 2) * off;
      const py = t.y - 8 + Math.sin(t.angle + Math.PI / 2) * off;
      s.projectiles.push({ id: s.nextId++, kind: k, tower: t.id, x: px, y: py, sx: px, sy: py, target: target.id, tx: target.x, ty: target.y, speed: PROJ_SPEED[k] || 300, dmg, stage: t.stage, line: t.line });
    }
    s.events.push({ type: 'shot', tower: t.id, kind: k, line: t.line });
  }
}

function segDist(ax, ay, bx, by, px, py) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(ax + dx * k - px, ay + dy * k - py);
}

function landProjectile(s, p) {
  const t = s.towers.find((q) => q.id === p.tower) || { id: p.tower, line: p.line, type: p.line === 'hero' ? s.hero?.type : LINES[p.line]?.type, stage: p.stage, energy: 0, damage: 0, kills: 0, ghost: true };
  const st = lineOf(t).stages[p.stage];
  const target = s.enemies.find((e) => e.id === p.target && e.hp > 0);
  if (target) {
    hurt(s, t, target, p.dmg);
    applyEffects(target, st);
    if (st.poison && target.hp > 0) target.poisonBy = t.id;
  }
  if (st.splash) {
    for (const e of s.enemies) {
      if (e === target || e.hp <= 0) continue;
      if (Math.hypot(e.x - p.tx, e.y - p.ty) <= st.splash) {
        hurt(s, t, e, p.dmg * 0.6);
        applyEffects(e, st);
      }
    }
  }
  s.events.push({ type: 'land', kind: p.kind, x: p.tx, y: p.ty, line: p.line, stage: p.stage, splash: st.splash || 0 });
}

export function step(s, dt) {
  if (isOver(s)) return s;
  s.time += dt;
  for (const d of s.drops) d.t += dt;
  if (s.status === 'build') {
    for (const t of s.towers) t.cooldown = Math.max(0, t.cooldown - dt);
    return s;
  }
  // Spawning
  s.waveT += dt;
  while (s.spawns.length && s.spawns[0].at <= s.waveT) {
    const sp = s.spawns.shift();
    spawnEnemy(s, sp.kind, sp.wave);
  }
  if (!s.spawns.length && s.wave > 0) s.waveSpawned[s.wave - 1] = true;

  // Enemies walk (slowed, poisoned)
  const path = s.lv.path;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) e.slowF = 1;
    }
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      const src = s.towers.find((q) => q.id === e.poisonBy) || null;
      const dmg = e.poisonDps * dt;
      if (src) {
        const before = e.hp;
        // Poison ticks quietly: no damage numbers
        e.hp -= dmg;
        const dealt = Math.min(before, dmg);
        src.damage += dealt;
        s.stats.damage += dealt;
        if (src.stage < MAX_STAGE) src.energy = Math.min(energyNeed(s, src), src.energy + dealt);
        if (e.hp <= 0) faint(s, e, src);
      } else {
        e.hp -= dmg;
        if (e.hp <= 0) faint(s, e, null);
      }
      if (e.hp <= 0) continue;
    }
    if (e.flash > 0) e.flash -= dt;
    e.dist += e.speed * e.slowF * dt;
    const p = pointAt(path, e.dist);
    const nx = Math.cos(p.angle + Math.PI / 2) * e.lane;
    const ny = Math.sin(p.angle + Math.PI / 2) * e.lane;
    e.x = p.x + nx;
    e.y = p.y + ny;
    e.angle = p.angle;
    if (e.dist >= path.length) {
      e.hp = 0;
      e.leaked = true;
      s.lives = Math.max(0, s.lives - e.lives);
      s.stats.leaked++;
      s.events.push({ type: 'leak', lives: e.lives, x: e.x, y: e.y, name: e.name });
      finishWaveCount(s, e.wave);
    }
  }

  // Towers attack
  for (const t of s.towers) {
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;
    const st = statsOf(t);
    const target = pickTarget(s, t, st.range);
    if (!target) {
      t.cooldown = 0;
      continue;
    }
    attack(s, t, target);
    t.cooldown += 1 / st.rate;
  }

  // Projectiles fly (homing while the target lives)
  for (let i = s.projectiles.length - 1; i >= 0; i--) {
    const p = s.projectiles[i];
    const target = s.enemies.find((e) => e.id === p.target && e.hp > 0);
    if (target) {
      p.tx = target.x;
      p.ty = target.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const move = p.speed * dt;
    if (d <= move + 4) {
      s.projectiles.splice(i, 1);
      landProjectile(s, p);
    } else {
      p.x += (dx / d) * move;
      p.y += (dy / d) * move;
    }
  }

  s.enemies = s.enemies.filter((e) => e.hp > 0);

  if (s.lives <= 0) {
    s.status = 'lost';
    s.projectiles = [];
    s.events.push({ type: 'end', status: 'lost', stars: 0 });
    return s;
  }

  // Next wave timer
  if (s.wave < s.waves && !s.spawns.length) {
    if (s.nextIn == null) s.nextIn = FIRST_GAP;
    if (!s.enemies.length) s.nextIn = Math.min(s.nextIn, CLEAR_GAP);
    s.nextIn -= dt;
    if (s.nextIn <= 0) launchWave(s);
  } else if (s.wave >= s.waves && !s.spawns.length && !s.enemies.length) {
    s.status = 'won';
    s.projectiles = [];
    const stars = starsFor(s.lives, s.maxLives, true);
    s.events.push({ type: 'end', status: 'won', stars });
  }
  return s;
}

/** Small copy for React state (the HUD and the build panel). */
export function snap(s) {
  return {
    status: s.status,
    level: s.level,
    lives: s.lives,
    maxLives: s.maxLives,
    coins: s.coins,
    wave: s.wave,
    waves: s.waves,
    nextIn: s.nextIn == null ? null : Math.ceil(s.nextIn),
    canCall: canCallWave(s),
    bonus: earlyBonus(s),
    candies: s.candies,
    heroUsed: s.heroUsed,
    boss: s.enemies.find((e) => e.boss) ? (() => {
      const b = s.enemies.find((e) => e.boss);
      return { name: b.name, hp: Math.max(0, Math.ceil(b.hp)), maxHp: b.maxHp, dex: b.dex };
    })() : null,
    towers: s.towers.map((t) => ({ id: t.id, pad: t.pad, line: t.line, stage: t.stage, name: t.name, dex: t.dex, energy: Math.floor(t.energy), need: energyNeed(s, t), full: energyFull(s, t), cost: evolveCost(t), sell: sellValue(t) })),
  };
}

export { LEVELS };
