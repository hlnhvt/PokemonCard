// Penalty shoot-out: 5 kicks and 5 saves, alternating. The goal is x -1..1 (left..right),
// y 0..1 (ground..crossbar). Pure rules; the arena animates the outcomes.
export const ROUNDS = 5;
export const COLUMNS = ['left', 'center', 'right'];

export function columnOf(x) {
  if (x < -0.33) return 'left';
  if (x > 0.33) return 'right';
  return 'center';
}

export const onTarget = ({ x, y }) => Math.abs(x) <= 1 && y >= 0 && y <= 1;
const isCorner = ({ x, y }) => Math.abs(x) > 0.66 && y > 0.55;

// Tuned in sports.test.js: a child shooting anywhere on target scores about 3 in 4
export const KEEPER_WEIGHTS = { left: 0.36, center: 0.28, right: 0.36 };
export const SAVE_CHANCE = { corner: 0.4, center: 0.85, side: 0.72 };

function weightedColumn(random, weights = KEEPER_WEIGHTS) {
  const r = random();
  let acc = 0;
  for (const c of COLUMNS) {
    acc += weights[c];
    if (r < acc) return c;
  }
  return 'right';
}

/**
 * The child shoots at `target` ({x, y} in goal coordinates). The computer keeper dives.
 * Returns { goal, saved, wide, dive }.
 */
export function childKick(target, random = Math.random) {
  const dive = weightedColumn(random);
  if (!onTarget(target)) return { goal: false, saved: false, wide: true, dive };
  const column = columnOf(target.x);
  if (dive !== column) return { goal: true, saved: false, wide: false, dive };
  const chance = isCorner(target) ? SAVE_CHANCE.corner : column === 'center' ? SAVE_CHANCE.center : SAVE_CHANCE.side;
  const saved = random() < chance;
  return { goal: !saved, saved, wide: false, dive };
}

// How often the kicker's lean shows the real direction (a fair hint for children)
export const TELL_HONESTY = 0.7;
export const AI_ON_TARGET = 0.9;
export const CHILD_SAVE_CHANCE = 0.9;

/** The computer prepares a kick: where it will go and which way the kicker leans. */
export function planAiKick(random = Math.random) {
  const column = COLUMNS[Math.floor(random() * 3)];
  const baseX = { left: -0.7, center: 0, right: 0.7 }[column];
  const wide = random() > AI_ON_TARGET;
  const target = {
    x: wide ? Math.sign(baseX || 1) * (1.15 + random() * 0.2) : baseX + (random() - 0.5) * 0.4,
    y: wide ? 0.3 + random() * 0.5 : 0.15 + random() * 0.7,
  };
  const lean = random() < TELL_HONESTY ? column : COLUMNS.filter((c) => c !== column)[Math.floor(random() * 2)];
  return { column, target, lean, wide };
}

/** The child dives towards `dive`. Returns { goal, saved, wide }. */
export function childSave(kick, dive, random = Math.random) {
  if (kick.wide || !onTarget(kick.target)) return { goal: false, saved: false, wide: true };
  const saved = dive === columnOf(kick.target.x) && random() < CHILD_SAVE_CHANCE;
  return { goal: !saved, saved, wide: false };
}
