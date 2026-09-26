// Maze escape: a perfect maze (one path between any two cells) carved with a
// randomized depth-first search. The Pokemon slides along corridors and stops at
// junctions, so children need few swipes.

export const MAZE_LEVELS = [
  { w: 5, h: 5, berries: 2 },
  { w: 6, h: 7, berries: 3 },
  { w: 7, h: 9, berries: 4 },
];

export const DIRS = {
  up: { dx: 0, dy: -1, wall: 'n', opposite: 's' },
  right: { dx: 1, dy: 0, wall: 'e', opposite: 'w' },
  down: { dx: 0, dy: 1, wall: 's', opposite: 'n' },
  left: { dx: -1, dy: 0, wall: 'w', opposite: 'e' },
};
const DIR_NAMES = Object.keys(DIRS);

export function generateMaze(w, h, random = Math.random) {
  const cells = Array.from({ length: w * h }, () => ({ n: true, e: true, s: true, w: true }));
  const visited = new Array(w * h).fill(false);
  const stack = [[0, 0]];
  visited[0] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = DIR_NAMES.filter((d) => {
      const nx = x + DIRS[d].dx;
      const ny = y + DIRS[d].dy;
      return nx >= 0 && ny >= 0 && nx < w && ny < h && !visited[ny * w + nx];
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const d = options[Math.floor(random() * options.length)];
    const nx = x + DIRS[d].dx;
    const ny = y + DIRS[d].dy;
    cells[y * w + x][DIRS[d].wall] = false;
    cells[ny * w + nx][DIRS[d].opposite] = false;
    visited[ny * w + nx] = true;
    stack.push([nx, ny]);
  }
  return { w, h, cells, start: { x: 0, y: 0 }, goal: { x: w - 1, y: h - 1 } };
}

export const cellAt = (maze, x, y) => maze.cells[y * maze.w + x];
export const canMove = (maze, x, y, dir) => !!cellAt(maze, x, y) && !cellAt(maze, x, y)[DIRS[dir].wall];
const openings = (maze, x, y) => DIR_NAMES.filter((d) => canMove(maze, x, y, d)).length;
const same = (a, b) => a.x === b.x && a.y === b.y;

/** Shortest path (list of cells, start and end included) by breadth-first search. */
export function shortestPath(maze, from = maze.start, to = maze.goal) {
  const key = (p) => p.y * maze.w + p.x;
  const prev = new Map([[key(from), null]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift();
    if (same(p, to)) break;
    for (const d of DIR_NAMES) {
      if (!canMove(maze, p.x, p.y, d)) continue;
      const n = { x: p.x + DIRS[d].dx, y: p.y + DIRS[d].dy };
      if (!prev.has(key(n))) {
        prev.set(key(n), p);
        queue.push(n);
      }
    }
  }
  const path = [];
  for (let p = to; p; p = prev.get(key(p))) path.unshift(p);
  return path;
}

/** Berries go on dead ends first (fun detours), never on the start or the goal. */
export function placeBerries(maze, count, random = Math.random) {
  const all = [];
  for (let y = 0; y < maze.h; y++) for (let x = 0; x < maze.w; x++) all.push({ x, y });
  const free = all.filter((p) => !same(p, maze.start) && !same(p, maze.goal));
  const deadEnds = free.filter((p) => openings(maze, p.x, p.y) === 1);
  const others = free.filter((p) => openings(maze, p.x, p.y) !== 1);
  const shuffle = (list) => list.map((p) => [random(), p]).sort((a, b) => a[0] - b[0]).map(([, p]) => p);
  return [...shuffle(deadEnds), ...shuffle(others)].slice(0, count);
}

export function createMazeLevel(level, random = Math.random) {
  const cfg = MAZE_LEVELS[level];
  const maze = generateMaze(cfg.w, cfg.h, random);
  return {
    level,
    maze,
    pos: { ...maze.start },
    berries: placeBerries(maze, cfg.berries, random),
    collected: 0,
    steps: 0,
    shortest: shortestPath(maze).length - 1,
    done: false,
  };
}

/**
 * Slide in a direction: keep walking until a wall, a junction, a berry or the goal.
 * Returns { state, path } where path lists the cells walked through (for animation).
 */
export function slide(state, dir) {
  if (state.done || !canMove(state.maze, state.pos.x, state.pos.y, dir)) return { state, path: [] };
  const { maze } = state;
  let pos = { ...state.pos };
  let current = dir;
  const path = [];
  let berries = state.berries;
  let collected = state.collected;
  for (let guard = 0; guard < maze.w * maze.h; guard++) {
    pos = { x: pos.x + DIRS[current].dx, y: pos.y + DIRS[current].dy };
    path.push(pos);
    const hit = berries.find((b) => same(b, pos));
    if (hit) {
      berries = berries.filter((b) => b !== hit);
      collected += 1;
      break;
    }
    if (same(pos, maze.goal) || openings(maze, pos.x, pos.y) !== 2) break;
    // Follow the corridor round bends
    const back = DIRS[current].opposite;
    current = DIR_NAMES.find((d) => DIRS[d].wall !== back && canMove(maze, pos.x, pos.y, d));
  }
  return {
    state: { ...state, pos, berries, collected, steps: state.steps + path.length, done: same(pos, maze.goal) },
    path,
  };
}

/** 3 stars close to the shortest route, 2 within double, else 1. Berries are a bonus, not required. */
export function mazeStars(steps, shortest) {
  if (steps <= Math.ceil(shortest * 1.4)) return 3;
  if (steps <= shortest * 2.2) return 2;
  return 1;
}

/** Direction of a swipe, or null when it was too short. */
export function swipeDirection(dx, dy, min = 24) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
