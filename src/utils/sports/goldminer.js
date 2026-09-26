// "Pokémon Đào vàng": a claw swings under the Pokemon; tap to shoot it down, it grabs what
// it touches and reels it back (heavy things slowly). Reach the money target of each level
// before the time runs out. Five levels, each needs more money and hides more rocks.
// Pure rules, stepped with dt; `random` is injectable for tests.

export const MINER_W = 360;
export const MINER_H = 560;
export const ORIGIN = { x: 180, y: 104 };
export const LEVEL_TIME = 40;
export const HOOK_OUT_SPEED = 300;
export const HOOK_EMPTY_BACK = 560;
export const HOOK_PULL = 240; // reel speed for weight 1
const SWING_MAX = 1.25; // radians either side
const SWING_SPEED = 1.5;

export const ITEM_KINDS = {
  goldS: { value: 50, r: 13, weight: 1.2, name: 'Vàng nhỏ' },
  goldM: { value: 150, r: 21, weight: 2.3, name: 'Vàng vừa' },
  goldL: { value: 450, r: 34, weight: 4.6, name: 'Vàng to' },
  rockS: { value: 15, r: 15, weight: 2.6, name: 'Đá nhỏ' },
  rockL: { value: 40, r: 27, weight: 5.2, name: 'Đá to' },
  diamond: { value: 600, r: 10, weight: 1, name: 'Kim cương' },
  bag: { value: 0, r: 15, weight: 1.4, name: 'Túi bí ẩn' },
  diglett: { value: 80, r: 16, weight: 1.3, name: 'Diglett' },
};

// Cumulative money target, and what each level hides
export const LEVELS = [
  { target: 700, mix: { goldS: 5, goldM: 3, goldL: 1, rockS: 2, rockL: 1, diamond: 0, bag: 1, diglett: 0 } },
  { target: 1800, mix: { goldS: 4, goldM: 3, goldL: 1, rockS: 3, rockL: 2, diamond: 1, bag: 1, diglett: 1 } },
  { target: 3700, mix: { goldS: 4, goldM: 2, goldL: 2, rockS: 3, rockL: 3, diamond: 1, bag: 1, diglett: 2 } },
  { target: 6200, mix: { goldS: 3, goldM: 2, goldL: 2, rockS: 4, rockL: 3, diamond: 2, bag: 2, diglett: 2 } },
  { target: 9400, mix: { goldS: 3, goldM: 2, goldL: 2, rockS: 4, rockL: 4, diamond: 3, bag: 2, diglett: 3 } },
];

/** Items of a level, placed without overlapping; big gold and diamonds sit deeper. */
export function makeItems(level, random = Math.random) {
  const cfg = LEVELS[Math.min(level, LEVELS.length - 1)];
  const items = [];
  let id = 1;
  const order = ['goldL', 'rockL', 'goldM', 'diamond', 'diglett', 'bag', 'rockS', 'goldS'];
  for (const kind of order) {
    const k = ITEM_KINDS[kind];
    for (let n = 0; n < cfg.mix[kind]; n++) {
      const deep = kind === 'goldL' || kind === 'diamond';
      for (let tries = 0; tries < 80; tries++) {
        const x = 30 + k.r + random() * (MINER_W - 60 - k.r * 2);
        const y = (deep ? 360 : 205) + random() * ((deep ? 530 : 520) - (deep ? 360 : 205) - k.r);
        if (items.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + k.r + 10)) {
          const item = { id: id++, kind, x, y, r: k.r, weight: k.weight, value: k.value };
          if (kind === 'diglett') {
            item.vx = (random() < 0.5 ? -1 : 1) * (40 + level * 10);
            item.diamond = level >= 2; // from level 3 some Diglett carry a diamond
            if (item.diamond) item.value += ITEM_KINDS.diamond.value;
          }
          if (kind === 'bag') item.value = [30, 80, 150, 250, 500, 700][Math.floor(random() * 6)];
          items.push(item);
          break;
        }
      }
    }
  }
  return items;
}

export function createMiner({ random = Math.random, level = 0, money = 0, dynamite = 1 } = {}) {
  return {
    random,
    level,
    money,
    target: LEVELS[level].target,
    time: LEVEL_TIME,
    clock: 0,
    items: makeItems(level, random),
    hook: { angle: 0, len: 0, state: 'swing', grabbed: null },
    dynamite,
    status: 'play', // play | cleared | failed | won
    events: [],
  };
}

export const hookDir = (angle) => ({ x: Math.sin(angle), y: Math.cos(angle) });
export function hookTip(s) {
  const d = hookDir(s.hook.angle);
  const len = 26 + s.hook.len;
  return { x: ORIGIN.x + d.x * len, y: ORIGIN.y + d.y * len };
}

/** Shoot the claw (only while it swings). */
export function fire(s) {
  if (s.status !== 'play' || s.hook.state !== 'swing') return false;
  s.hook.state = 'out';
  s.events.push({ type: 'fire' });
  return true;
}

/** Blow up what the claw is dragging: it comes back empty and fast. */
export function blast(s) {
  const h = s.hook;
  if (s.status !== 'play' || h.state !== 'back' || !h.grabbed || s.dynamite <= 0) return false;
  s.dynamite -= 1;
  s.events.push({ type: 'blast', item: h.grabbed, at: hookTip(s) });
  h.grabbed = null;
  return true;
}

const valuables = (s) => s.items.some((i) => i.kind.startsWith('gold') || i.kind === 'diamond' || i.kind === 'bag' || i.kind === 'diglett');

export function stepMiner(s, dt) {
  if (s.status !== 'play') return s;
  s.clock += dt;
  s.time = Math.max(0, s.time - dt);
  const h = s.hook;
  for (const it of s.items) {
    if (it.kind !== 'diglett' || it === h.grabbed) continue;
    it.x += it.vx * dt;
    if (it.x < 30 + it.r || it.x > MINER_W - 30 - it.r) {
      it.vx *= -1;
      it.x = Math.max(30 + it.r, Math.min(MINER_W - 30 - it.r, it.x));
    }
  }
  if (h.state === 'swing') {
    h.swingT = (h.swingT || 0) + dt;
    h.angle = SWING_MAX * Math.sin(h.swingT * SWING_SPEED);
  } else if (h.state === 'out') {
    h.len += HOOK_OUT_SPEED * dt;
    const tip = hookTip(s);
    const hit = s.items.find((it) => Math.hypot(it.x - tip.x, it.y - tip.y) < it.r + 7);
    if (hit) {
      h.grabbed = hit;
      s.items = s.items.filter((it) => it !== hit);
      h.state = 'back';
      s.events.push({ type: 'grab', item: hit, heavy: hit.weight >= 4 });
    } else if (tip.x < 4 || tip.x > MINER_W - 4 || tip.y > MINER_H - 6) {
      h.state = 'back';
      s.events.push({ type: 'miss' });
    }
  } else if (h.state === 'back') {
    const speed = h.grabbed ? HOOK_PULL / h.grabbed.weight : HOOK_EMPTY_BACK;
    h.len = Math.max(0, h.len - speed * dt);
    if (h.grabbed) {
      const tip = hookTip(s);
      h.grabbed.x = tip.x;
      h.grabbed.y = tip.y + h.grabbed.r * 0.6;
    }
    if (h.len <= 0) {
      if (h.grabbed) {
        const it = h.grabbed;
        s.money += it.value;
        s.events.push({ type: 'collect', item: it, value: it.value });
        if (it.kind === 'bag' && it.value >= 500) s.events.push({ type: 'jackpot' });
      }
      h.grabbed = null;
      h.state = 'swing';
    }
  }
  // The level ends when time is up (after the claw is back) or nothing worth grabbing is left
  if (h.state === 'swing' && (s.time <= 0 || !valuables(s))) {
    s.status = s.money >= s.target ? (s.level === LEVELS.length - 1 ? 'won' : 'cleared') : 'failed';
    s.events.push({ type: 'end', status: s.status });
  }
  return s;
}

/** The next level keeps the money and one extra stick of dynamite. */
export const nextLevel = (s) => createMiner({ random: s.random, level: s.level + 1, money: s.money, dynamite: s.dynamite + 1 });

/** Result of a whole run for the reward: all 5 levels = win, 2+ = draw, fewer = lose. */
export function minerResult(levelsCleared) {
  if (levelsCleared >= LEVELS.length) return 'win';
  if (levelsCleared >= 2) return 'draw';
  return 'lose';
}
