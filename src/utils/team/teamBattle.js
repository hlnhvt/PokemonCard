// 5 vs 5 team battle built on the 1v1 engine: one pair fights at a time, HP carries
// over, and the Tuyệt Kỹ Liên Hoàn energy belongs to the whole team. When the child's
// Pokemon faints, the child chooses who goes next; opponents come in order.
import { createBattle, playTurn, playCombo, canUseCombo } from '../battle/engine';
import { pickOpponent, hasTypeAdvantage } from '../battle/matchmaking';

export const TEAM_SIZE = 5;

/** The team with the chosen first Pokemon moved to the front (the rest keep their order). */
export const withLead = (team, lead = 0) => (lead > 0 && lead < team.length ? [team[lead], ...team.filter((_, i) => i !== lead)] : team);

const speciesOf = (p) => String(p.name || p.speciesName || '').toLowerCase();

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Pokemon lent to the child to fill the team: random, never one already in the team. */
export function borrowPokemon(team, count, pool, random = Math.random) {
  const taken = new Set(team.map(speciesOf));
  return shuffle(pool.filter((p) => !taken.has(speciesOf(p))), random).slice(0, Math.max(0, count));
}

/**
 * The opposing team: for each of the child's Pokemon, a fair opponent (similar strength,
 * no type advantage when possible), all different and different from the child's team.
 */
export function pickOpponentTeam(playerTeam, pool, random = Math.random) {
  const used = new Set(playerTeam.map(speciesOf));
  return playerTeam.map((member) => {
    const free = pool.filter((p) => !used.has(speciesOf(p)));
    const foe = pickOpponent(member, free.length ? free : pool, random);
    used.add(speciesOf(foe));
    return foe;
  });
}

export function createTeamBattle({ players, opponents, random = Math.random }) {
  const state = {
    players,
    opponents,
    random,
    pi: 0,
    oi: 0,
    combo: 0,
    turn: 0,
    status: 'choosing', // choosing | switching | won | lost
    kos: players.map(() => 0),
    battle: null,
  };
  state.battle = createBattle({ player: players[0], opponent: opponents[0], random });
  return state;
}

export const alivePlayers = (state) => state.players.map((p, i) => (p.hp > 0 ? i : -1)).filter((i) => i >= 0);
export const current = (state) => ({ player: state.players[state.pi], opponent: state.opponents[state.oi] });

function nextPair(state) {
  state.battle = createBattle({ player: state.players[state.pi], opponent: state.opponents[state.oi], random: state.random });
  state.battle.combo = state.combo;
  state.status = 'choosing';
}

/** After a 1v1 exchange: count knock-outs, bring in the next opponent, or ask for a switch. */
function settle(state, events) {
  const b = state.battle;
  state.combo = b.combo;
  state.turn += 1;
  if (b.status === 'won') {
    state.kos[state.pi] += 1;
    state.oi += 1;
    if (state.oi >= state.opponents.length) {
      state.status = 'won';
      events.push({ kind: 'team-won' });
    } else {
      nextPair(state);
      events.push({ kind: 'switch', side: 'opponent', index: state.oi });
      events.push({ kind: 'turn-end' });
    }
  } else if (b.status === 'lost') {
    if (alivePlayers(state).length === 0) {
      state.status = 'lost';
      events.push({ kind: 'team-lost' });
    } else {
      state.status = 'switching';
      events.push({ kind: 'need-switch' });
    }
  }
  return events;
}

export function teamTurn(state, moveIndex) {
  if (state.status !== 'choosing') return [];
  return settle(state, playTurn(state.battle, moveIndex));
}

export const canUseTeamCombo = (state) => state.status === 'choosing' && canUseCombo(state.battle);

export function teamCombo(state) {
  if (!canUseTeamCombo(state)) return [];
  return settle(state, playCombo(state.battle));
}

/** The child sends in Pokemon `index` (must still be standing). */
export function sendIn(state, index) {
  if (state.status !== 'switching' || !(state.players[index]?.hp > 0)) return [];
  state.pi = index;
  nextPair(state);
  return [{ kind: 'switch', side: 'player', index }, { kind: 'turn-end' }];
}

/** Hint for the switch screen: does this Pokemon's type beat the current opponent? */
export const beatsCurrent = (state, index) => hasTypeAdvantage(state.players[index], state.opponents[state.oi]);

/** Most valuable Pokemon of the child's team: most knock-outs (first in the team wins ties). */
export function mvpIndex(state) {
  let best = 0;
  state.kos.forEach((k, i) => {
    if (k > state.kos[best]) best = i;
  });
  return best;
}

// The opposing team is stronger than a single wild Pokemon: the child has 5 Pokemon, HP
// bonuses and a shared combo. Tuned in team.test.js (TM-04).
export const TEAM_OPPONENT_LEVEL = 1.16;
export const teamOpponentLevel = (baseLevel) => Math.min(80, Math.round(baseLevel * TEAM_OPPONENT_LEVEL));
