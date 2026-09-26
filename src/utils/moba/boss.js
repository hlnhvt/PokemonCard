// "Săn Boss": the whole team against one huge Pokemon on the arena map. The boss walks
// towards the children and uses four big attacks, each announced by a red warning shape on
// the ground first (so children can run out of it):
//   slam   - a circle round the boss, then a shock wave
//   meteor - circles under several children, then rocks fall
//   charge - a long strip towards one child, then the boss dashes along it
//   ring   - bolts fired out in every direction
// Below 40% HP the boss gets angry: faster attacks and it walks faster.
// Pure rules; runs inside engine.step through `state.bossStep`.
import { createMatch, fighterById, dealDamage, FIGHTER_R, statsFor, SKILLS } from './engine';
import { CENTER, collide } from './map';
import { artworkUrl } from '../../services/pokemonOnlineService';

export const BOSS_R = 46;
export const ENRAGE_AT = 0.4;

export const BOSSES = [
  { id: 'mewtwo', name: 'Mewtwo', dex: 150, types: ['psychic'], power: 680, title: 'Siêu linh tối thượng' },
  { id: 'rayquaza', name: 'Rayquaza', dex: 384, types: ['dragon', 'flying'], power: 680, title: 'Rồng bầu trời' },
  { id: 'groudon', name: 'Groudon', dex: 383, types: ['ground'], power: 670, title: 'Chúa tể mặt đất' },
  { id: 'kyogre', name: 'Kyogre', dex: 382, types: ['water'], power: 670, title: 'Chúa tể đại dương' },
  { id: 'tyranitar', name: 'Tyranitar', dex: 248, types: ['rock', 'dark'], power: 600, title: 'Quái vật núi đá' },
  { id: 'dragonite', name: 'Dragonite', dex: 149, types: ['dragon', 'flying'], power: 600, title: 'Rồng hiền lành' },
];
export const bossById = (id) => BOSSES.find((b) => b.id === id) || BOSSES[0];
export const bossImage = (b) => artworkUrl(b.dex);

// Boss HP as a multiple of the whole team's HP, and how hard it hits
export const DIFFICULTY = {
  easy: { label: 'Dễ', hp: 5, dmg: 0.8, cd: 1.2, icon: '🙂' },
  normal: { label: 'Vừa', hp: 10, dmg: 1, cd: 1, icon: '😤' },
  hard: { label: 'Khó', hp: 12.5, dmg: 1.25, cd: 0.85, icon: '🔥' },
};

// Attack timings (seconds): warning time and cooldown; multipliers of the boss attack
export const ATTACKS = {
  slam: { warn: 1.0, cd: 6.5, r: 165, dmg: 3.0, range: 230 },
  meteor: { warn: 1.3, cd: 8.5, r: 75, dmg: 2.6, count: 3 },
  charge: { warn: 0.9, cd: 9.5, len: 460, w: 70, dmg: 2.8, speed: 900 },
  ring: { warn: 0.6, cd: 7, bolts: 14, dmg: 1.1 },
};

const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};

/**
 * team: the children's members { name, image, types, power }; boss: one of BOSSES.
 * The boss is fighter `red0`, flagged `boss`.
 */
export function createBossMatch({ team, boss = BOSSES[0], difficulty = 'normal', duration = 180, random = Math.random, control = 0, mapId = 'forest' }) {
  const d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const s = createMatch({ blue: team, red: [{ name: boss.name, image: bossImage(boss), types: boss.types, power: boss.power }], duration, random, control, mapId });
  const teamHp = s.fighters.filter((f) => f.team === 'blue').reduce((a, f) => a + f.maxHp, 0);
  const b = fighterById(s, 'red0');
  const base = statsFor(boss.power, boss.types);
  Object.assign(b, {
    boss: true,
    bossId: boss.id,
    title: boss.title,
    r: BOSS_R,
    maxHp: Math.round(teamHp * d.hp),
    atk: base.atk * 1.6 * d.dmg,
    speed: 88,
    x: CENTER.x + 120,
    y: CENTER.y,
    facing: -1,
    angry: false,
    attack: null, // the attack being wound up
    cds: { slam: 3, meteor: 6, charge: 9, ring: 5 },
    cdScale: d.cd,
  });
  b.hp = b.maxHp;
  s.boss = true;
  s.difficulty = difficulty;
  s.telegraphs = [];
  s.bossStep = stepBoss;
  return s;
}

export const bossOf = (s) => s.fighters.find((f) => f.boss);

function start(s, b, kind, shapes) {
  const a = ATTACKS[kind];
  b.attack = { kind, t: a.warn, shapes };
  for (const sh of shapes) s.telegraphs.push({ ...sh, kind, t: a.warn, max: a.warn, owner: b.id, id: s.nextId++ });
  s.events.push({ kind: 'boss-warn', attack: kind, x: b.x, y: b.y });
}

const inCircle = (f, c) => Math.hypot(f.x - c.x, f.y - c.y) <= c.r + f.r * 0.5;
function inStrip(f, st) {
  const dx = f.x - st.x;
  const dy = f.y - st.y;
  const along = dx * Math.cos(st.ang) + dy * Math.sin(st.ang);
  const side = -dx * Math.sin(st.ang) + dy * Math.cos(st.ang);
  return along >= -f.r && along <= st.len + f.r && Math.abs(side) <= st.w / 2 + f.r * 0.5;
}
/** Is fighter f standing inside a warning shape? (the bots use this to dodge) */
export const insideWarning = (f, sh) => (sh.shape === 'strip' ? inStrip(f, sh) : inCircle(f, sh));

function hitChildren(s, b, test, mult, knock) {
  for (const f of s.fighters) {
    if (f.team !== 'blue' || f.dead || !test(f)) continue;
    if (knock) {
      const d = norm(f.x - knock.x, f.y - knock.y);
      f.knock = { vx: d.x * knock.power, vy: d.y * knock.power, t: 0.22 };
    }
    dealDamage(s, b, f, mult);
  }
}

function release(s, b) {
  const at = b.attack;
  const a = ATTACKS[at.kind];
  s.telegraphs = s.telegraphs.filter((t) => t.owner !== b.id);
  if (at.kind === 'slam') {
    const c = at.shapes[0];
    s.events.push({ kind: 'boss-slam', x: c.x, y: c.y, r: c.r, type: b.types[0] });
    hitChildren(s, b, (f) => inCircle(f, c), a.dmg, { x: c.x, y: c.y, power: 650 });
    b.attack = null;
  } else if (at.kind === 'meteor') {
    for (const c of at.shapes) {
      s.events.push({ kind: 'boss-meteor', x: c.x, y: c.y, r: c.r, type: b.types[0] });
      hitChildren(s, b, (f) => inCircle(f, c), a.dmg, { x: c.x, y: c.y, power: 300 });
    }
    b.attack = null;
  } else if (at.kind === 'charge') {
    const st = at.shapes[0];
    b.dash = { ang: st.ang, left: st.len, hit: [] };
    s.events.push({ kind: 'boss-charge', x: b.x, y: b.y, ang: st.ang });
    b.attack = null;
  } else if (at.kind === 'ring') {
    const n = a.bolts + (b.angry ? 6 : 0);
    const off = s.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const ang = off + (i / n) * Math.PI * 2;
      s.projectiles.push({ id: s.nextId++, owner: b.id, team: b.team, type: b.types[0], skill: 's1', x: b.x + Math.cos(ang) * b.r, y: b.y + Math.sin(ang) * b.r, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420, life: 1.5, r: 13, dmg: a.dmg, pierce: false, hit: [] });
    }
    s.events.push({ kind: 'boss-ring', x: b.x, y: b.y, type: b.types[0] });
    b.attack = null;
  }
}

/** The boss's own turn inside engine.step (before the fighters move). */
export function stepBoss(s, dt) {
  const b = bossOf(s);
  if (!b || b.dead) return;
  if (!b.angry && b.hp <= b.maxHp * ENRAGE_AT) {
    b.angry = true;
    b.speed *= 1.2;
    b.cdScale *= 0.7;
    s.events.push({ kind: 'boss-enrage', x: b.x, y: b.y });
  }
  for (const k of Object.keys(b.cds)) b.cds[k] = Math.max(0, b.cds[k] - dt);
  for (const t of s.telegraphs) t.t -= dt;
  b.wantMove = { x: 0, y: 0 };

  // Dashing along a charge: hits every child on the way once
  if (b.dash) {
    const step = Math.min(b.dash.left, ATTACKS.charge.speed * dt);
    b.x += Math.cos(b.dash.ang) * step;
    b.y += Math.sin(b.dash.ang) * step;
    b.dash.left -= step;
    collide(b);
    for (const f of s.fighters) {
      if (f.team !== 'blue' || f.dead || b.dash.hit.includes(f.id)) continue;
      if (Math.hypot(f.x - b.x, f.y - b.y) <= b.r + f.r) {
        b.dash.hit.push(f.id);
        const side = norm(-Math.sin(b.dash.ang), Math.cos(b.dash.ang));
        const sign = (f.x - b.x) * side.x + (f.y - b.y) * side.y >= 0 ? 1 : -1;
        f.knock = { vx: side.x * sign * 600, vy: side.y * sign * 600, t: 0.22 };
        dealDamage(s, b, f, ATTACKS.charge.dmg);
      }
    }
    if (b.dash.left <= 0) b.dash = null;
    b.skipAct = true;
    return;
  }
  // Winding up an attack: the boss stands still until it lands
  if (b.attack) {
    b.attack.t -= dt;
    if (b.attack.t <= 0) release(s, b);
    b.skipAct = true;
    return;
  }
  b.skipAct = false;

  const kids = s.fighters.filter((f) => f.team === 'blue' && !f.dead);
  if (!kids.length) return;
  const near = kids.reduce((a, f) => (Math.hypot(f.x - b.x, f.y - b.y) < Math.hypot(a.x - b.x, a.y - b.y) ? f : a));
  const dNear = Math.hypot(near.x - b.x, near.y - b.y);
  const cd = (k) => ATTACKS[k].cd * b.cdScale;

  // Pick an attack that is ready and makes sense
  if (b.cds.slam <= 0 && dNear < ATTACKS.slam.range) {
    b.cds.slam = cd('slam');
    return start(s, b, 'slam', [{ shape: 'circle', x: b.x, y: b.y, r: ATTACKS.slam.r * (b.angry ? 1.15 : 1) }]);
  }
  if (b.cds.charge <= 0 && dNear > 160 && dNear < 600) {
    b.cds.charge = cd('charge');
    const ang = Math.atan2(near.y - b.y, near.x - b.x);
    return start(s, b, 'charge', [{ shape: 'strip', x: b.x, y: b.y, ang, len: ATTACKS.charge.len, w: ATTACKS.charge.w }]);
  }
  if (b.cds.meteor <= 0 && dNear < 700) {
    b.cds.meteor = cd('meteor');
    const n = ATTACKS.meteor.count + (b.angry ? 2 : 0);
    const targets = [...kids].sort(() => s.random() - 0.5).slice(0, n);
    return start(s, b, 'meteor', targets.map((f) => ({ shape: 'circle', x: f.x, y: f.y, r: ATTACKS.meteor.r })));
  }
  if (b.cds.ring <= 0 && dNear < 450) {
    b.cds.ring = cd('ring');
    return start(s, b, 'ring', [{ shape: 'circle', x: b.x, y: b.y, r: b.r + 30 }]);
  }
  // Otherwise walk towards the nearest child and hit with big basic orbs
  if (dNear > b.r + FIGHTER_R + 60) {
    const d = norm(near.x - b.x, near.y - b.y);
    b.wantMove = { x: d.x * b.speed, y: d.y * b.speed };
    b.moving = true;
    if (Math.abs(d.x) > 0.1) b.facing = d.x > 0 ? 1 : -1;
  } else b.moving = false;
  if (b.cd.basic <= 0 && dNear < SKILLS.basic.range + 60) {
    b.cd.basic = SKILLS.basic.cd * 1.4;
    const d = norm(near.x - b.x, near.y - b.y);
    s.projectiles.push({ id: s.nextId++, owner: b.id, team: b.team, type: b.types[0], skill: 'basic', x: b.x + d.x * b.r, y: b.y + d.y * b.r, vx: d.x * 480, vy: d.y * 480, life: 0.6, r: 11, dmg: 1.3, pierce: false, hit: [] });
  }
}

/** Share of the boss's HP the team took off (0..1). */
export const bossDamage = (s) => {
  const b = bossOf(s);
  return b ? 1 - Math.max(0, b.hp) / b.maxHp : 0;
};
