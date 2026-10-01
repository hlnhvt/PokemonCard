// "Đảo nhà Pokémon" engine: a voxel island the child builds for Pokémon residents.
// Pure (no three.js, no DOM): grid editing tools, undo, residents walking on the blocks,
// wishes with rewards and unlocks, and a compact save format.
import { W, H, D, AIR, WATER, isBlock, isDecor, isSolid, WISHES, WISH_BY_ID, STARTER_UNLOCKS, MAX_GUESTS, BLOCK_BY_ID, DECOR_BY_ID } from './island3d/catalog';
import { idx, inBounds, getCell, setCell, starterGrid, cloneGrid, encodeGrid, decodeGrid } from './island3d/grid';
import { checkWish } from './island3d/wishes';

export * from './island3d/catalog';
export { idx, inBounds, getCell, setCell, starterGrid, encodeGrid, decodeGrid, coords, countItems, MAX_SAVE_CHARS, surfaceY } from './island3d/grid';
export { checkWish, findRooms, largestPond, tallestTower, longestBridge } from './island3d/wishes';

export const SAVE_KEY = 'pokescan_island3d_v1';
export const MAX_UNDO = 60;
export const WALK_SPEED = 1.7; // cells per second

// ---------------------------------------------------------------- residents & pathing

/** A resident can stand in an air cell with a solid (non-water) block under it. */
export const standable = (g, x, y, z) => inBounds(x, y, z) && y >= 1 && getCell(g, x, y, z) === AIR && isSolid(getCell(g, x, y - 1, z));

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Cells one step from (x, y, z): flat, hop up 1 (head room needed) or step down 1. */
export function neighbours(g, x, y, z) {
  const out = [];
  for (const [dx, dz] of DIRS) {
    const nx = x + dx;
    const nz = z + dz;
    if (standable(g, nx, y, nz)) out.push([nx, y, nz]);
    else if (standable(g, nx, y + 1, nz) && getCell(g, x, y + 1, z) === AIR) out.push([nx, y + 1, nz]);
    else if (standable(g, nx, y - 1, nz) && getCell(g, nx, y, nz) === AIR) out.push([nx, y - 1, nz]);
  }
  return out;
}

/** Breadth-first search from a cell: Map idx -> { cell, parent, depth }. */
export function reachable(g, start, maxDepth = 12) {
  const seen = new Map();
  const s = idx(...start);
  seen.set(s, { cell: start, parent: -1, depth: 0 });
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const c = queue[q];
    const d = seen.get(idx(...c)).depth;
    if (d >= maxDepth) continue;
    for (const n of neighbours(g, ...c)) {
      const ni = idx(...n);
      if (seen.has(ni)) continue;
      seen.set(ni, { cell: n, parent: idx(...c), depth: d + 1 });
      queue.push(n);
    }
  }
  return seen;
}

/** Path (list of cells, without the start) from start to goal, or null. */
export function findPath(g, start, goal, maxDepth = 40) {
  const map = reachable(g, start, maxDepth);
  let k = idx(...goal);
  if (!map.has(k)) return null;
  const path = [];
  while (map.get(k).parent !== -1) {
    path.push(map.get(k).cell);
    k = map.get(k).parent;
  }
  return path.reverse();
}

/** Nearest standable cell to (x, y, z): straight up first, then outward rings. */
export function nearestStandable(g, x, y, z) {
  const cx = Math.max(0, Math.min(W - 1, x));
  const cz = Math.max(0, Math.min(D - 1, z));
  for (let r = 0; r < Math.max(W, D); r++) {
    let best = null;
    let bestD = Infinity;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        for (let ny = 1; ny < H; ny++) {
          if (!standable(g, cx + dx, ny, cz + dz)) continue;
          const dist = Math.abs(ny - y) * 0.6 + Math.hypot(dx, dz) + (ny < y ? 0.3 : 0);
          if (dist < bestD) {
            bestD = dist;
            best = [cx + dx, ny, cz + dz];
          }
        }
      }
    }
    if (best) return best;
  }
  return null;
}

function makeResident(s, { name, image = null, dex = null }, isPlayer = false) {
  const spot = nearestStandable(s.grid, Math.floor(W / 2) + (isPlayer ? 0 : Math.floor(s.random() * 5) - 2), 2, Math.floor(D / 2) + (isPlayer ? 0 : Math.floor(s.random() * 5) - 2)) || [W / 2, 2, D / 2];
  return {
    key: isPlayer ? 'player' : `guest-${name}`,
    name,
    image,
    dex,
    isPlayer,
    cell: spot,
    pos: { x: spot[0], y: spot[1], z: spot[2] },
    from: null,
    to: null,
    t: 0,
    path: [],
    wait: 0.5 + s.random() * 1.5,
    face: 1,
    emote: null, // { kind: 'heart' | 'note' | 'zzz' | 'wow', t }
    emoteIn: 3 + s.random() * 4,
    wishId: null,
    home: null,
    celebrate: 0,
  };
}

// ---------------------------------------------------------------- state

/**
 * New island state. `saved` = a parsed save (see serialize) to restore, else the starter island.
 * `player` = { name, image } of the child's Pokémon (always resident #1).
 */
export function createIsland({ random = Math.random, player = { name: 'Pikachu' }, saved = null } = {}) {
  const s = {
    random,
    grid: starterGrid(),
    undo: [],
    rev: 1,
    time: 0,
    night: false,
    done: [], // fulfilled wish ids (paid once)
    nextWish: 0, // index into WISHES of the next wish to hand out
    unlocked: new Set(STARTER_UNLOCKS),
    residents: [],
    events: [],
    stats: { placed: 0, removed: 0, painted: 0, decor: 0 },
    progress: {},
    dirty: false, // needs saving
  };
  let guests = [];
  if (saved) {
    const g = decodeGrid(saved.grid);
    if (g) {
      s.grid = g;
      s.done = (saved.done || []).filter((id) => WISH_BY_ID[id]);
      s.night = !!saved.night;
      for (const id of s.done) for (const u of WISH_BY_ID[id].unlocks) s.unlocked.add(u);
      guests = (saved.guests || []).slice(0, MAX_GUESTS);
    }
  }
  s.residents.push(makeResident(s, player, true));
  for (const gst of guests) s.residents.push(makeResident(s, gst));
  // Homes from finished house wishes are found again by the checkers on the next check
  for (const r of s.residents) assignWish(s, r);
  checkWishes(s);
  return s;
}

/** Give a resident the next wish nobody has yet (or none when all are taken / done). */
function assignWish(s, r) {
  const taken = new Set(s.residents.map((x) => x.wishId).filter(Boolean));
  const next = WISHES.find((w) => !s.done.includes(w.id) && !taken.has(w.id));
  r.wishId = next ? next.id : null;
  if (next) s.events.push({ type: 'newWish', resident: r.key, wishId: next.id });
}

/** Text of a resident's wish: "Pikachu muốn 5 bông hoa". */
export const wishText = (name, wishId) => (WISH_BY_ID[wishId] ? `${name} ${WISH_BY_ID[wishId].text}` : '');

function refreshProgress(s) {
  s.progress = {};
  for (const r of s.residents) if (r.wishId) s.progress[r.wishId] = checkWish(s.grid, r.wishId);
}

/** Fulfil the wishes that are now true: pay once, unlock, celebrate, move into the house. */
export function checkWishes(s) {
  refreshProgress(s);
  for (const r of s.residents) {
    const id = r.wishId;
    if (!id || s.done.includes(id)) continue;
    const res = s.progress[id];
    if (!res?.done) continue;
    const w = WISH_BY_ID[id];
    s.done.push(id);
    const newItems = w.unlocks.filter((u) => !s.unlocked.has(u));
    for (const u of w.unlocks) s.unlocked.add(u);
    if (w.home && res.room) {
      const [hx, hz] = res.room.cells[Math.floor(res.room.cells.length / 2)];
      r.home = [hx, res.room.y, hz];
      r.path = [];
    }
    r.celebrate = 2.2;
    r.emote = { kind: 'heart', t: 2.5 };
    s.events.push({ type: 'wish', resident: r.key, name: r.name, wishId: id, gold: w.reward, unlocks: newItems, at: [r.pos.x, r.pos.y, r.pos.z], home: r.home });
    assignWish(s, r);
    s.dirty = true;
  }
  refreshProgress(s);
}

// ---------------------------------------------------------------- tools

/**
 * Where a tap lands. `hit` = { cell: [x, y, z], normal: [nx, ny, nz] } on a block / decoration,
 * or { sea: [x, z] } on the water. Returns the cell to build in (place/decor) or to change (remove/paint).
 */
export function targetFor(s, hit, tool) {
  if (!hit) return null;
  if (hit.sea) {
    if (tool !== 'place') return null;
    const [x, z] = hit.sea;
    if (!inBounds(x, 0, z) || getCell(s.grid, x, 0, z) !== AIR) return null;
    return [x, 0, z];
  }
  const [x, y, z] = hit.cell;
  if (tool === 'remove' || tool === 'paint') return inBounds(x, y, z) && getCell(s.grid, x, y, z) !== AIR ? [x, y, z] : null;
  // A decoration is replaced-in-place? No: building on a decoration is not allowed
  if (isDecor(getCell(s.grid, x, y, z))) return null;
  const [nx, ny, nz] = hit.normal || [0, 1, 0];
  const t = [x + nx, y + ny, z + nz];
  if (!inBounds(...t) || getCell(s.grid, ...t) !== AIR) return null;
  if (tool === 'decor' && (ny !== 1 || !isSolid(getCell(s.grid, x, y, z)))) return null; // decorations stand on top of a block
  return t;
}

function commit(s, changes, kind) {
  if (!changes.length) return;
  s.undo.push({ kind, changes });
  if (s.undo.length > MAX_UNDO) s.undo.shift();
  gridChanged(s);
}

function gridChanged(s) {
  s.rev++;
  s.dirty = true;
  for (const r of s.residents) settleResident(s, r);
  checkWishes(s);
}

function change(s, x, y, z, v, p = 0) {
  const i = idx(x, y, z);
  const c = { i, cell: [x, y, z], before: s.grid.cells[i], beforePaint: s.grid.paint[i], after: v, afterPaint: isBlock(v) ? p : 0 };
  setCell(s.grid, x, y, z, v, p);
  return c;
}

/**
 * Use a tool: 'place' (block id), 'remove', 'paint' (colour 1..8, 0 clears), 'decor' (decor id).
 * Returns { ok, reason?, cell? } and pushes an event.
 */
export function applyTool(s, tool, hit, { block, decor, color } = {}) {
  const t = targetFor(s, hit, tool);
  const deny = (reason) => {
    s.events.push({ type: 'deny', reason, cell: t });
    return { ok: false, reason };
  };
  if (!t) return deny('nowhere');
  const [x, y, z] = t;
  const v = getCell(s.grid, x, y, z);
  if (tool === 'place') {
    if (!BLOCK_BY_ID[block]) return deny('bad');
    if (!s.unlocked.has(block)) return deny('locked');
    commit(s, [change(s, x, y, z, block)], 'place');
    s.stats.placed++;
    s.events.push({ type: 'place', cell: t, id: block });
    return { ok: true, cell: t };
  }
  if (tool === 'decor') {
    if (!DECOR_BY_ID[decor]) return deny('bad');
    if (!s.unlocked.has(decor)) return deny('locked');
    commit(s, [change(s, x, y, z, decor)], 'decor');
    s.stats.decor++;
    s.events.push({ type: 'decor', cell: t, id: decor });
    return { ok: true, cell: t };
  }
  if (tool === 'remove') {
    const changes = [change(s, x, y, z, AIR)];
    // A decoration standing on the removed block goes too
    if (isDecor(getCell(s.grid, x, y + 1, z))) changes.push(change(s, x, y + 1, z, AIR));
    const paint = changes[0].beforePaint;
    commit(s, changes, 'remove');
    s.stats.removed++;
    s.events.push({ type: 'remove', cell: t, id: v, paint });
    return { ok: true, cell: t };
  }
  if (tool === 'paint') {
    if (!isBlock(v) || v === WATER) return deny('cantPaint');
    const p = Math.max(0, Math.min(8, color | 0));
    if (s.grid.paint[idx(x, y, z)] === p) return deny('same');
    commit(s, [change(s, x, y, z, v, p)], 'paint');
    s.stats.painted++;
    s.events.push({ type: 'paint', cell: t, id: v, color: p });
    return { ok: true, cell: t };
  }
  return deny('bad');
}

/** Undo the last change (multi-step). Wishes already paid stay paid. */
export function undo(s) {
  const a = s.undo.pop();
  if (!a) return false;
  for (let k = a.changes.length - 1; k >= 0; k--) {
    const c = a.changes[k];
    setCell(s.grid, ...c.cell, c.before, c.beforePaint);
  }
  s.events.push({ type: 'undo', kind: a.kind, cell: a.changes[0].cell, id: a.changes[0].before || a.changes[0].after });
  gridChanged(s);
  return true;
}

/** "Đảo mới": back to the starter island. Wishes done, gold and unlocks are kept. */
export function resetIsland(s) {
  s.grid = starterGrid();
  s.undo = [];
  for (const r of s.residents) r.home = null;
  s.events.push({ type: 'reset' });
  gridChanged(s);
}

export function setNight(s, night) {
  s.night = !!night;
  s.dirty = true;
  for (const r of s.residents) {
    r.path = [];
    r.wait = 0.2 + s.random() * 0.6;
    r.emote = night ? { kind: 'zzz', t: 1.5 } : { kind: 'note', t: 1.5 };
  }
}

/** Invite a Pokémon from the collection (max MAX_GUESTS, no duplicates). */
export function inviteResident(s, pokemon) {
  if (!pokemon?.name) return false;
  if (s.residents.length - 1 >= MAX_GUESTS) return false;
  if (s.residents.some((r) => r.name === pokemon.name)) return false;
  const r = makeResident(s, pokemon);
  r.emote = { kind: 'heart', t: 2 };
  s.residents.push(r);
  s.events.push({ type: 'invite', resident: r.key, name: r.name });
  assignWish(s, r);
  s.dirty = true;
  checkWishes(s);
  return true;
}

// ---------------------------------------------------------------- residents moving

/** After the grid changed: a resident inside a block or over nothing hops to the nearest spot. */
function settleResident(s, r) {
  if (r.to && standable(s.grid, ...r.to) && standable(s.grid, ...r.cell)) {
    // keep walking, but re-check the rest of the path
    r.path = [];
    return;
  }
  const [x, y, z] = r.cell;
  if (!standable(s.grid, x, y, z)) {
    const spot = nearestStandable(s.grid, x, y, z);
    if (spot) {
      r.cell = spot;
      r.pos = { x: spot[0], y: spot[1], z: spot[2] };
    }
  }
  r.from = null;
  r.to = null;
  r.t = 0;
  r.path = [];
  r.pos = { x: r.cell[0], y: r.cell[1], z: r.cell[2] };
  if (r.home && !standable(s.grid, ...r.home)) r.home = null;
}

function chooseWalk(s, r) {
  const g = s.grid;
  if (s.night && r.home && standable(g, ...r.home)) {
    if (r.cell.join() === r.home.join()) return [];
    return findPath(g, r.cell, r.home, 60) || [];
  }
  const map = reachable(g, r.cell, 7);
  const options = [...map.values()].filter((n) => n.depth >= 2);
  if (!options.length) return [];
  const pick = options[Math.floor(s.random() * options.length)];
  const path = [];
  let k = idx(...pick.cell);
  while (map.get(k).parent !== -1) {
    path.push(map.get(k).cell);
    k = map.get(k).parent;
  }
  return path.reverse();
}

function stepResident(s, r, dt) {
  const g = s.grid;
  if (r.celebrate > 0) r.celebrate = Math.max(0, r.celebrate - dt);
  if (r.emote) {
    r.emote.t -= dt;
    if (r.emote.t <= 0) r.emote = null;
  }
  if (s.night && r.sleeping && !r.to) {
    r.emoteIn -= dt;
    if (r.emoteIn <= 0) {
      r.emote = { kind: 'zzz', t: 2.2 };
      r.emoteIn = 3 + s.random() * 2;
    }
    return;
  }
  r.emoteIn -= dt;
  if (r.emoteIn <= 0 && !r.emote) {
    r.emote = { kind: s.night ? 'zzz' : s.random() < 0.55 ? 'heart' : 'note', t: 2 };
    r.emoteIn = 4 + s.random() * 5;
  }
  if (r.to) {
    r.t += dt * WALK_SPEED;
    const a = r.from;
    const b = r.to;
    const k = Math.min(1, r.t);
    const lift = b[1] !== a[1] ? 0.55 : 0.12;
    r.pos = { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k + Math.sin(Math.PI * k) * lift, z: a[2] + (b[2] - a[2]) * k };
    if (r.t >= 1) {
      r.cell = b;
      r.pos = { x: b[0], y: b[1], z: b[2] };
      r.from = null;
      r.to = null;
      r.t = 0;
    }
    return;
  }
  if (r.path.length) {
    const next = r.path.shift();
    // The world may have changed: only walk to a cell that is still a valid step
    if (neighbours(g, ...r.cell).some((n) => n.join() === next.join())) {
      r.from = r.cell;
      r.to = next;
      r.t = 0;
      if (next[0] !== r.cell[0]) r.face = next[0] > r.cell[0] ? 1 : -1;
    } else r.path = [];
    return;
  }
  r.wait -= dt;
  if (r.wait > 0) return;
  if (s.night) {
    const atHome = !r.home || r.cell.join() === r.home.join();
    if (atHome) {
      r.sleeping = true;
      return;
    }
  }
  r.sleeping = false;
  r.path = chooseWalk(s, r);
  r.wait = (s.night ? 0.3 : 1.2) + s.random() * 2.5;
}

/** Advance time: residents walk, hop, emote. */
export function step(s, dt) {
  s.time += dt;
  for (const r of s.residents) {
    if (!s.night) r.sleeping = false;
    stepResident(s, r, dt);
  }
}

// ---------------------------------------------------------------- save / load

/** Plain object to store (grid as RLE). */
export function serialize(s) {
  const grid = encodeGrid(s.grid);
  if (!grid) return null;
  return {
    v: 1,
    grid,
    done: s.done.slice(),
    night: s.night,
    guests: s.residents.filter((r) => !r.isPlayer).map((r) => ({ name: r.name, image: r.image, dex: r.dex })),
  };
}

/** Parse a stored string; null if missing or broken. */
export function parseSave(text) {
  if (!text) return null;
  try {
    const o = JSON.parse(text);
    if (!o || o.v !== 1 || !decodeGrid(o.grid)) return null;
    return o;
  } catch {
    return null;
  }
}

export function loadSaved(storage = globalThis.localStorage) {
  try {
    return parseSave(storage?.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

export function saveIsland(s, storage = globalThis.localStorage) {
  const o = serialize(s);
  if (!o) return false;
  try {
    storage?.setItem(SAVE_KEY, JSON.stringify(o));
    s.dirty = false;
    return true;
  } catch {
    return false;
  }
}

/** Small copy for the HUD (React state). */
export function snap(s) {
  return {
    rev: s.rev,
    night: s.night,
    canUndo: s.undo.length > 0,
    undoCount: s.undo.length,
    done: s.done.slice(),
    unlocked: [...s.unlocked],
    residents: s.residents.map((r) => ({ key: r.key, name: r.name, image: r.image, dex: r.dex, isPlayer: r.isPlayer, wishId: r.wishId, hasHome: !!r.home })),
    progress: Object.fromEntries(Object.entries(s.progress).map(([k, v]) => [k, { done: v.done, have: v.have, need: v.need }])),
    stats: { ...s.stats },
    allDone: s.done.length === WISHES.length,
  };
}

export { cloneGrid };
