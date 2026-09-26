// "Tìm điểm khác nhau": two pictures of the same Pokemon meadow; the right one has a few
// changes (something gone, a new colour, bigger or smaller, turned round, swapped for
// something else, or an extra thing). Tap a difference on either picture to circle it.
// Scenes are generated, so every game is new. Pure rules; `random` is injectable.

export const VIEW = { w: 320, h: 220 };
export const HORIZON = 92; // sky above, meadow below
export const LEVELS = [
  { objects: 10, diffs: 3 },
  { objects: 12, diffs: 4 },
  { objects: 14, diffs: 5 },
  { objects: 16, diffs: 5 },
  { objects: 18, diffs: 6 },
];

// kind: where it may stand (sky / ground), its size, the colours it comes in
export const KINDS = {
  sun: { where: 'sky', size: 22, colors: ['#facc15', '#fb923c'] },
  cloud: { where: 'sky', size: 24, colors: ['#ffffff', '#e0f2fe', '#fce7f3'] },
  star: { where: 'sky', size: 12, colors: ['#fde047', '#f472b6', '#a78bfa'] },
  butterfly: { where: 'sky', size: 12, colors: ['#f472b6', '#60a5fa', '#facc15', '#a3e635'], flips: true },
  tree: { where: 'ground', size: 28, colors: ['#16a34a', '#65a30d', '#15803d', '#f97316'] },
  flower: { where: 'ground', size: 12, colors: ['#ef4444', '#f472b6', '#facc15', '#a855f7', '#3b82f6'] },
  pokeball: { where: 'ground', size: 13, colors: ['#ef4444', '#3b82f6', '#facc15', '#111827'] },
  berry: { where: 'ground', size: 11, colors: ['#3b82f6', '#ec4899', '#f97316'] },
  rock: { where: 'ground', size: 16, colors: ['#a8a29e', '#78716c', '#d6d3d1'] },
  mushroom: { where: 'ground', size: 13, colors: ['#ef4444', '#f97316', '#8b5cf6'], flips: true },
  house: { where: 'ground', size: 30, colors: ['#f87171', '#60a5fa', '#fbbf24'], flips: true },
};
const SWAP = { flower: 'mushroom', mushroom: 'flower', berry: 'pokeball', pokeball: 'berry', star: 'butterfly', butterfly: 'star', rock: 'berry', tree: 'house', house: 'tree', cloud: 'sun', sun: 'cloud' };
export const CHANGE_TEXT = { gone: 'Biến mất', color: 'Đổi màu', size: 'To nhỏ khác nhau', flip: 'Quay ngược', swap: 'Đổi thành vật khác', extra: 'Có thêm' };

const pick = (list, random) => list[Math.floor(random() * list.length)];

/** The meadow: objects on a jittered grid (never overlapping); the child's Pokemon stays in the middle. */
export function makeScene(levelIndex, random = Math.random) {
  const n = LEVELS[levelIndex].objects;
  const cells = [];
  // Sky: 2 rows, ground: 3 rows; leave the middle-bottom for the child's Pokemon
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 7; c++) {
      const sky = r < 2;
      const x = 24 + c * 45;
      const y = sky ? 22 + r * 38 : HORIZON + 22 + (r - 2) * 40;
      if (!sky && c === 3 && r >= 3) continue;
      cells.push({ x, y, sky });
    }
  }
  const free = [...cells];
  const objects = [];
  for (let i = 0; i < n && free.length; i++) {
    const cell = free.splice(Math.floor(random() * free.length), 1)[0];
    const kinds = Object.keys(KINDS).filter((k) => (KINDS[k].where === 'sky') === cell.sky);
    const kind = pick(kinds, random);
    objects.push({
      id: i + 1,
      kind,
      x: cell.x + (random() - 0.5) * 12,
      y: cell.y + (random() - 0.5) * 8,
      size: KINDS[kind].size * (0.85 + random() * 0.3),
      color: pick(KINDS[kind].colors, random),
      flip: random() < 0.5,
    });
  }
  return { objects, free };
}

/** Copy of the scene with `count` changes; returns the right picture and where the changes are. */
export function makeDifferences(scene, count, random = Math.random) {
  const right = scene.objects.map((o) => ({ ...o }));
  const diffs = [];
  const chosen = [...scene.objects].sort(() => random() - 0.5);
  const free = [...scene.free];
  let extraUsed = false;
  for (const o of chosen) {
    if (diffs.length >= count) break;
    const k = KINDS[o.kind];
    const options = ['gone', 'color', 'size', 'swap'];
    if (k.flips) options.push('flip');
    if (!extraUsed && free.length) options.push('extra');
    const change = pick(options, random);
    const i = right.findIndex((r) => r.id === o.id);
    const hit = { x: o.x, y: o.y, r: Math.max(16, o.size * 1.1) };
    if (change === 'gone') right.splice(i, 1);
    else if (change === 'color') right[i].color = pick(k.colors.filter((c) => c !== o.color), random);
    else if (change === 'size') right[i].size = o.size * (random() < 0.5 ? 1.55 : 0.6);
    else if (change === 'flip') right[i].flip = !o.flip;
    else if (change === 'swap') {
      right[i].kind = SWAP[o.kind];
      right[i].color = pick(KINDS[SWAP[o.kind]].colors, random);
    } else if (change === 'extra') {
      extraUsed = true;
      const cell = free.splice(Math.floor(random() * free.length), 1)[0];
      const kinds = Object.keys(KINDS).filter((kk) => (KINDS[kk].where === 'sky') === cell.sky);
      const kind = pick(kinds, random);
      right.push({ id: 1000 + diffs.length, kind, x: cell.x, y: cell.y, size: KINDS[kind].size, color: pick(KINDS[kind].colors, random), flip: false });
      diffs.push({ id: diffs.length, change, x: cell.x, y: cell.y, r: Math.max(16, KINDS[kind].size * 1.1) });
      continue;
    }
    diffs.push({ id: diffs.length, change, ...hit });
  }
  return { right, diffs };
}

function newLevel(level, random) {
  const scene = makeScene(level, random);
  const { right, diffs } = makeDifferences(scene, LEVELS[level].diffs, random);
  return { left: scene.objects, right, diffs, found: [], misses: [], mistakes: 0, hints: 0, hint: null };
}

export function createSpot({ random = Math.random } = {}) {
  return { random, level: 0, stars: [], status: 'play', ...newLevel(0, random) }; // play | levelDone | done
}

/** A tap at (x, y) in picture coordinates (either picture). */
export function tapAt(s, x, y) {
  if (s.status !== 'play') return { state: s, result: 'ignored' };
  const d = s.diffs.find((q) => Math.hypot(q.x - x, q.y - y) <= q.r);
  if (d && s.found.includes(d.id)) return { state: s, result: 'again', diff: d };
  if (d) {
    const found = [...s.found, d.id];
    const done = found.length === s.diffs.length;
    const next = { ...s, found, hint: s.hint === d.id ? null : s.hint };
    if (done) {
      next.stars = [...s.stars, levelStars(s.mistakes, s.hints)];
      next.status = s.level === LEVELS.length - 1 ? 'done' : 'levelDone';
    }
    return { state: next, result: 'found', diff: d };
  }
  return { state: { ...s, mistakes: s.mistakes + 1, misses: [...s.misses, { x, y, id: s.misses.length }] }, result: 'miss' };
}

/** Light up one difference not found yet (counts against the stars). */
export function giveHint(s) {
  if (s.status !== 'play') return s;
  const d = s.diffs.find((q) => !s.found.includes(q.id));
  return d ? { ...s, hints: s.hints + 1, hint: d.id } : s;
}

export function nextLevel(s) {
  if (s.status !== 'levelDone') return s;
  const level = s.level + 1;
  return { ...s, level, status: 'play', ...newLevel(level, s.random) };
}

/** Stars of a level: 3 with at most one slip, 2 up to four, else 1 (a hint counts as two slips). */
export const levelStars = (mistakes, hints) => {
  const slips = mistakes + hints * 2;
  return slips <= 1 ? 3 : slips <= 4 ? 2 : 1;
};
export const spotStars = (stars) => (stars.length ? Math.round(stars.reduce((a, b) => a + b, 0) / stars.length) : 1);
