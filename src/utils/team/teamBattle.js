// 5 vs 5 team battle built on the 1v1 engine: one pair fights at a time, HP carries
// over, and the Tuyệt Kỹ Liên Hoàn energy belongs to the whole team. The child can switch
// Pokemon during the battle (it costs the turn), chooses who goes next when one faints, and
// after knocking an opponent out may keep the same Pokemon or send in another.
import { createBattle, playTurn, playCombo, canUseCombo, playOpponentOnly } from '../battle/engine';
import { pickOpponent, hasTypeAdvantage } from '../battle/matchmaking';

export const TEAM_SIZE = 5;

/**
 * Difficulty: every Pokemon's HP is multiplied (so a duel lasts several turns instead of
 * one or two hits) and the opponents' level is scaled. Tuned in team.test.js (TM-06).
 */
export const TEAM_DIFFICULTY = {
  easy: { label: 'Dễ', icon: '🙂', hp: 3.2, level: 1.0 },
  normal: { label: 'Trung bình', icon: '😤', hp: 3.8, level: 1.08 },
  hard: { label: 'Khó', icon: '🔥', hp: 4.4, level: 1.15 },
};
export const difficultyOf = (id) => TEAM_DIFFICULTY[id] || TEAM_DIFFICULTY.normal;

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

export function createTeamBattle({ players, opponents, random = Math.random, difficulty = 'normal' }) {
  const hpScale = difficultyOf(difficulty).hp;
  for (const f of [...players, ...opponents]) {
    f.maxHp = Math.round(f.maxHp * hpScale);
    f.hp = f.maxHp;
  }
  const state = {
    difficulty,
    players,
    opponents,
    random,
    pi: 0,
    oi: 0,
    combo: 0,
    turn: 0,
    status: 'choosing', // choosing | switching | between | won | lost
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
      // The child decides: keep this Pokemon or send in another (see continueWith)
      state.status = 'between';
      events.push({ kind: 'duel-won', next: state.oi });
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

/**
 * After knocking an opponent out: the next opponent comes in, and the child's Pokemon
 * `index` fights it (the same one to keep it, another one to switch).
 */
export function continueWith(state, index = state.pi) {
  if (state.status !== 'between' || !(state.players[index]?.hp > 0)) return [];
  const changed = index !== state.pi;
  state.pi = index;
  nextPair(state);
  const events = [{ kind: 'switch', side: 'opponent', index: state.oi }];
  if (changed) events.push({ kind: 'switch', side: 'player', index });
  events.push({ kind: 'turn-end' });
  return events;
}

/** Switch during the battle: the new Pokemon comes in and the opponent gets a free attack. */
export function switchPlayer(state, index) {
  if (state.status !== 'choosing' || index === state.pi || !(state.players[index]?.hp > 0)) return [];
  state.pi = index;
  const combo = state.combo;
  nextPair(state);
  state.battle.combo = combo;
  return settle(state, [{ kind: 'switch', side: 'player', index }, ...playOpponentOnly(state.battle)]);
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
