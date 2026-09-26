// Turn-based 1v1 battle engine. Pure and deterministic given `random`.
// A turn returns a list of events that the arena animates in order.
import { effectiveness, effectivenessLabel } from './typeChart';

export const LEVEL = 50;
export const COMBO_MAX = 100;
// Energy the child's Pokemon gains: landing hits builds the combo, taking hits too (comeback)
export const COMBO_GAIN = { hit: 22, superEffective: 15, crit: 10, tookHit: 12 };
// The combo finisher chains all four moves with growing power
export const CHAIN_MULTIPLIERS = [1, 1.2, 1.45, 1.8];

// Child-friendly tuning of the player's side
export const PLAYER_HP_BONUS = 1.15;
export const PLAYER_ACCURACY_BONUS = 10;
// Wild opponents are a few levels below a perfectly even match, more so for very weak Pokemon
// (Magikarp, baby Pokemon). Tuned with real PokeAPI data: tests/live/battleBalance.live.test.js
export const OPPONENT_LEVEL_FACTOR = 0.95;
export const WEAK_POKEMON_BST = 300;
export const WEAK_OPPONENT_LEVEL_FACTOR = 0.82;
const CRIT = { player: 1 / 10, playerBond: 1 / 6, opponent: 1 / 24 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function calcStat(base, level = LEVEL, isHp = false) {
  const core = Math.floor((2 * base * level) / 100);
  return isHp ? core + level + 10 : core + 5;
}

export function baseStatTotal(stats) {
  return stats.hp + stats.attack + stats.defense + stats.spAttack + stats.spDefense + stats.speed;
}

/** Level that makes a wild opponent a fair match for the child's Pokemon. */
export function opponentLevel(playerStats, opponentStats) {
  const playerTotal = baseStatTotal(playerStats);
  const ratio = playerTotal / Math.max(1, baseStatTotal(opponentStats));
  const factor = playerTotal < WEAK_POKEMON_BST ? WEAK_OPPONENT_LEVEL_FACTOR : OPPONENT_LEVEL_FACTOR;
  return clamp(Math.round(LEVEL * Math.sqrt(ratio) * factor), 30, 65);
}

/**
 * A fighter from battle data (see services/battleData.js).
 * friendship (0..100) gives the child's Pokemon up to +10% power: "Sức mạnh tình bạn".
 */
export function createFighter(data, { level = LEVEL, isPlayer = false, friendship = 0 } = {}) {
  const s = data.stats;
  const maxHp = Math.round(calcStat(s.hp, level, true) * (isPlayer ? PLAYER_HP_BONUS : 1));
  return {
    ...data,
    level,
    isPlayer,
    friendship: clamp(friendship, 0, 100),
    maxHp,
    hp: maxHp,
    attack: calcStat(s.attack, level),
    defense: calcStat(s.defense, level),
    spAttack: calcStat(s.spAttack, level),
    spDefense: calcStat(s.spDefense, level),
    speed: calcStat(s.speed, level),
  };
}

export function createBattle({ player, opponent, random = Math.random }) {
  return { player, opponent, random, combo: 0, turn: 0, status: 'choosing' };
}

/**
 * Damage of one hit. Standard formula: ((2L/5 + 2) * Power * A/D / 50 + 2) * modifiers,
 * modifiers = same-type bonus x1.5, type effectiveness, critical x1.5, random 0.85..1,
 * friendship boost and an optional chain multiplier.
 */
export function calcDamage(attacker, defender, move, random, { crit = false, multiplier = 1 } = {}) {
  const eff = effectiveness(move.type, defender.types);
  if (eff === 0) return { damage: 0, effectiveness: 0 };
  const physical = move.damageClass !== 'special';
  const a = physical ? attacker.attack : attacker.spAttack;
  const d = physical ? defender.defense : defender.spDefense;
  const base = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * a) / d) / 50) + 2;
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const bond = attacker.isPlayer ? 1 + (attacker.friendship / 100) * 0.1 : 1;
  const roll = 0.85 + random() * 0.15;
  const damage = Math.max(1, Math.floor(base * stab * eff * (crit ? 1.5 : 1) * roll * bond * multiplier));
  return { damage, effectiveness: eff };
}

export function critChance(attacker) {
  if (!attacker.isPlayer) return CRIT.opponent;
  return attacker.friendship >= 80 ? CRIT.playerBond : CRIT.player;
}

/** Opponent picks its best move most of the time, but not always (fair for children). */
export function chooseAiMove(opponent, player, random) {
  const scored = opponent.moves.map((m, index) => ({
    index,
    value: m.power * (opponent.types.includes(m.type) ? 1.5 : 1) * effectiveness(m.type, player.types) * (m.accuracy / 100),
  }));
  scored.sort((a, b) => b.value - a.value);
  if (random() < 0.6) return scored[0].index;
  return scored[Math.floor(random() * scored.length)].index;
}

function turnOrder(state, playerMove, opponentMove) {
  const { player, opponent, random } = state;
  const p = { side: 'player', fighter: player, move: playerMove };
  const o = { side: 'opponent', fighter: opponent, move: opponentMove };
  if (playerMove.priority !== opponentMove.priority) return playerMove.priority > opponentMove.priority ? [p, o] : [o, p];
  if (player.speed !== opponent.speed) return player.speed > opponent.speed ? [p, o] : [o, p];
  return random() < 0.5 ? [p, o] : [o, p];
}

const gainCombo = (state, amount) => {
  state.combo = clamp(state.combo + amount, 0, COMBO_MAX);
};

/** One attack; pushes events and applies damage. Returns true when the target fainted. */
function attack(state, actor, events, { chain = 0, multiplier = 1, sureHit = false } = {}) {
  const { random } = state;
  const attacker = actor.fighter;
  const targetSide = actor.side === 'player' ? 'opponent' : 'player';
  const target = state[targetSide];
  const move = actor.move;

  events.push({ kind: 'attack', side: actor.side, move, chain });

  const accuracy = move.accuracy + (actor.side === 'player' ? PLAYER_ACCURACY_BONUS : 0);
  if (!sureHit && random() * 100 >= accuracy) {
    events.push({ kind: 'miss', side: actor.side, move });
    return false;
  }

  const eff = effectiveness(move.type, target.types);
  if (eff === 0) {
    events.push({ kind: 'effect', side: targetSide, label: effectivenessLabel(0), effectiveness: 0 });
    return false;
  }

  const hits = move.minHits + Math.floor(random() * (move.maxHits - move.minHits + 1));
  let fainted = false;
  let anyCrit = false;
  for (let h = 0; h < hits && !fainted; h++) {
    const crit = random() < critChance(attacker);
    anyCrit = anyCrit || crit;
    const { damage } = calcDamage(attacker, target, move, random, { crit, multiplier });
    const dealt = Math.min(target.hp, damage);
    target.hp -= dealt;
    events.push({
      kind: 'hit', side: targetSide, attacker: actor.side, move, damage: dealt, hp: target.hp, maxHp: target.maxHp,
      crit, effectiveness: eff, hit: h + 1, hits, chain,
    });
    fainted = target.hp <= 0;
  }
  if (hits > 1) events.push({ kind: 'multi', side: targetSide, hits });
  const label = effectivenessLabel(eff);
  if (label) events.push({ kind: 'effect', side: targetSide, label, effectiveness: eff });

  if (actor.side === 'player' && !chain) {
    gainCombo(state, COMBO_GAIN.hit + (eff >= 2 ? COMBO_GAIN.superEffective : 0) + (anyCrit ? COMBO_GAIN.crit : 0));
  } else if (actor.side === 'opponent') {
    gainCombo(state, COMBO_GAIN.tookHit);
  }
  events.push({ kind: 'combo', value: state.combo });

  if (fainted) {
    events.push({ kind: 'faint', side: targetSide });
    state.status = targetSide === 'opponent' ? 'won' : 'lost';
  }
  return fainted;
}

function opponentAction(state) {
  const move = state.opponent.moves[chooseAiMove(state.opponent, state.player, state.random)];
  return { side: 'opponent', fighter: state.opponent, move };
}

/** The child picked move `moveIndex`. Returns the events of the whole turn. */
export function playTurn(state, moveIndex) {
  if (state.status !== 'choosing') return [];
  state.turn += 1;
  const events = [];
  const playerMove = state.player.moves[moveIndex];
  const opp = opponentAction(state);
  for (const actor of turnOrder(state, playerMove, opp.move)) {
    const fighter = actor.side === 'player' ? state.player : state.opponent;
    if (fighter.hp <= 0) continue;
    if (attack(state, { ...actor, fighter }, events)) break;
  }
  if (state.status === 'choosing') events.push({ kind: 'turn-end' });
  return events;
}

/** The child switched Pokemon: that costs the turn, so only the opponent attacks. */
export function playOpponentOnly(state) {
  if (state.status !== 'choosing') return [];
  state.turn += 1;
  const events = [];
  attack(state, opponentAction(state), events);
  if (state.status === 'choosing') events.push({ kind: 'turn-end' });
  return events;
}

export function canUseCombo(state) {
  return state.status === 'choosing' && state.combo >= COMBO_MAX;
}

/**
 * Combo finisher: all four moves in a row, always hitting, with growing multipliers.
 * The opponent strikes back afterwards if it is still standing.
 */
export function playCombo(state) {
  if (!canUseCombo(state)) return [];
  state.turn += 1;
  state.combo = 0;
  const events = [{ kind: 'combo-start' }];
  let total = 0;
  for (let i = 0; i < state.player.moves.length; i++) {
    const before = state.opponent.hp;
    const fainted = attack(
      state,
      { side: 'player', fighter: state.player, move: state.player.moves[i] },
      events,
      { chain: i + 1, multiplier: CHAIN_MULTIPLIERS[i] || 2, sureHit: true }
    );
    total += before - state.opponent.hp;
    if (fainted) break;
  }
  events.push({ kind: 'combo-end', total });
  if (state.status === 'choosing') {
    attack(state, opponentAction(state), events);
    if (state.status === 'choosing') events.push({ kind: 'turn-end' });
  }
  return events;
}
