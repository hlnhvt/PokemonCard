// Thủ thành Pokémon: simple players for the balance tests.
//  smart     – builds on the best pads with types that suit the level, evolves when it can, uses Rare Candy
//  noevolve  – builds basic towers on every pad but never evolves
//  none      – builds nothing
import { LEVELS, ENEMIES } from './levels';
import { LINES, LINE_IDS, typeMult, lineUnlocked } from './towers';
import { createGame, step, build, evolve, callWave, collectCandy, feedCandy, energyFull, energyNeed, evolveCost, isOver, starsFor } from './engine';

/** How well a line does against the enemy mix of a level. */
function lineScore(level, line) {
  let sum = 0;
  let n = 0;
  for (const wave of LEVELS[level].waves) {
    for (const [kind, count] of wave) {
      const e = ENEMIES[kind];
      const hp = e.hp * count;
      sum += hp * typeMult(LINES[line].type, e.type) * (e.fly && !LINES[line].antiAir ? 0.8 : 1);
      n += hp;
    }
  }
  return sum / n;
}

function chooseLine(s) {
  const counts = {};
  for (const t of s.towers) counts[t.line] = (counts[t.line] || 0) + 1;
  let best = null;
  let bestScore = -Infinity;
  for (const line of LINE_IDS) {
    if (!lineUnlocked(line, s.level)) continue;
    const score = lineScore(s.level, line) - 0.22 * (counts[line] || 0) - LINES[line].cost / 1000;
    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  }
  return best;
}

const padsByScore = (s) => [...s.lv.pads].sort((a, b) => b.score - a.score);

function think(s, strategy) {
  if (strategy === 'none') return;
  const evolving = strategy === 'smart';
  if (evolving) {
    for (const d of [...s.drops]) collectCandy(s, d.id);
    while (s.candies > 0) {
      const t = [...s.towers].filter((q) => q.stage < 2 && !energyFull(s, q)).sort((a, b) => b.stage - a.stage || b.energy / energyNeed(s, b) - a.energy / energyNeed(s, a))[0];
      if (!t || !feedCandy(s, t.id)) break;
    }
    for (const t of [...s.towers].sort((a, b) => b.stage - a.stage)) evolve(s, t.id);
  }
  const pads = padsByScore(s).filter((p) => !s.towers.some((t) => t.pad === p.id));
  if (pads.length && s.hero && !s.heroUsed) build(s, pads.shift().id, 'hero');
  // Save up for an evolution that is nearly ready
  if (evolving) {
    const soon = s.towers.find((t) => t.stage < 2 && t.energy >= energyNeed(s, t) * 0.75);
    if (soon && s.towers.length >= 3) {
      const line = chooseLine(s);
      if (s.coins - LINES[line].cost < evolveCost(soon)) return;
    }
  }
  for (const pad of pads) {
    const line = chooseLine(s);
    if (!line || !build(s, pad.id, line)) break;
  }
}

/** Play a level to the end. Returns { won, stars, lives, waves, evolutions, time }. */
export function runBot(level, strategy = 'smart', { player = { name: 'Eevee', types: ['normal'] }, random = Math.random, dt = 0.05, maxTime = 4000 } = {}) {
  const s = createGame({ level, player: strategy === 'none' ? null : player, random });
  let think_t = 0;
  const trace = [];
  let lastWave = 0;
  think(s, strategy);
  callWave(s);
  while (!isOver(s) && s.time < maxTime) {
    step(s, dt);
    s.events.length = 0;
    if (s.wave !== lastWave) {
      lastWave = s.wave;
      trace.push(`${s.wave}:${s.lives}/${s.coins}/${s.towers.map((t) => t.stage).join("")}`);
    }
    think_t += dt;
    if (think_t >= 0.25) {
      think_t = 0;
      think(s, strategy);
    }
  }
  const won = s.status === 'won';
  return { won, stars: starsFor(s.lives, s.maxLives, won), lives: s.lives, wave: s.wave, waves: s.waves, evolutions: s.stats.evolutions, candy: s.stats.candyUsed, towers: s.towers.length, time: Math.round(s.time), trace };
}
