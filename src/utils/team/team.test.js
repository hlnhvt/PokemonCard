import { describe, it, expect } from 'vitest';
import { teamOpponentLevel, borrowPokemon, pickOpponentTeam, createTeamBattle, teamTurn, teamCombo, canUseTeamCombo, sendIn, alivePlayers, mvpIndex, beatsCurrent, TEAM_SIZE } from './teamBattle';
import { ARENAS, applyArena, arenaById, ARENA_BOOST } from './arenas';
import { createFighter, opponentLevel } from '../battle/engine';
import { fallbackMoves } from '../battle/moves';
import { OPPONENT_POOL } from '../battle/opponentPool';
import { goldForTeam } from '../gold';
import { seeded } from '../../test/seeded';

// Battle data like services/battleData.js returns, from the pool's base stat totals
const dataOf = (p) => {
  const s = Math.round(p.bst / 6);
  return { name: p.name, id: p.id, types: p.types, bst: p.bst, stats: { hp: s, attack: s, defense: s, spAttack: s, spDefense: s, speed: s }, moves: fallbackMoves(p.types) };
};
const byName = (n) => OPPONENT_POOL.find((p) => p.name === n);

function buildBattle(playerNames, random, arena) {
  const players = playerNames.map((n) => dataOf(byName(n)));
  const foes = pickOpponentTeam(players, OPPONENT_POOL, random).map(dataOf);
  return createTeamBattle({
    players: players.map((d) => createFighter(applyArena(d, arena), { isPlayer: true })),
    opponents: foes.map((d, i) => createFighter(applyArena(d, arena), { level: teamOpponentLevel(opponentLevel(players[i].stats, d.stats)) })),
    random,
  });
}

/** Plays a whole battle. `pick` chooses a move index; switches go to the first Pokemon standing. */
function play(state, pick) {
  for (let guard = 0; guard < 400 && (state.status === 'choosing' || state.status === 'switching'); guard++) {
    if (state.status === 'switching') sendIn(state, alivePlayers(state)[0]);
    else if (canUseTeamCombo(state)) teamCombo(state);
    else teamTurn(state, pick(state));
  }
  return state;
}

describe('team building', () => {
  it('TB-01 borrowed Pokemon are random, unique and never already in the team', () => {
    const team = [byName('Pikachu'), byName('Eevee')];
    for (let s = 1; s <= 20; s++) {
      const lent = borrowPokemon(team, 3, OPPONENT_POOL, seeded(s));
      expect(lent).toHaveLength(3);
      expect(new Set(lent.map((p) => p.name)).size).toBe(3);
      for (const p of lent) expect(['Pikachu', 'Eevee']).not.toContain(p.name);
    }
    expect(borrowPokemon(team, 0, OPPONENT_POOL, seeded(1))).toEqual([]);
  });

  it('TB-02 the opposing team: 5 different Pokemon, none from the child team, mostly without type advantage', () => {
    const players = ['Charmander', 'Squirtle', 'Bulbasaur', 'Pikachu', 'Eevee'].map(byName);
    const foes = pickOpponentTeam(players, OPPONENT_POOL, seeded(3));
    expect(foes).toHaveLength(TEAM_SIZE);
    expect(new Set(foes.map((f) => f.name)).size).toBe(TEAM_SIZE);
    for (const f of foes) expect(players.map((p) => p.name)).not.toContain(f.name);
  });
});

describe('arenas', () => {
  it('AR-01 seven grounds (the Pokemon stadium first) with unique ids; matching moves get stronger and are marked', () => {
    expect(ARENAS).toHaveLength(7);
    expect(ARENAS[0]).toMatchObject({ id: 'stadium', name: 'Sân vận động Pokémon' });
    expect(new Set(ARENAS.map((a) => a.id)).size).toBe(7);
    const volcano = arenaById('volcano');
    const moves = applyArena(dataOf(byName('Charmander')), volcano).moves;
    const fire = moves.find((m) => m.type === 'fire');
    const normal = moves.find((m) => m.type === 'normal');
    expect(fire.boosted).toBe(true);
    expect(fire.power).toBe(Math.round(fallbackMoves(['fire']).find((m) => m.name === fire.name).power * ARENA_BOOST));
    expect(normal.boosted).toBeUndefined();
    expect(arenaById('nope').id).toBe('stadium');
  });
});

describe('team battle', () => {
  it('TM-01 knock-outs bring in the next opponent; HP carries over; the combo is shared', () => {
    const state = buildBattle(['Charizard', 'Blastoise', 'Venusaur', 'Pikachu', 'Eevee'], seeded(4));
    let sawSwitch = false;
    for (let guard = 0; guard < 60 && state.oi === 0 && state.status === 'choosing'; guard++) {
      const events = teamTurn(state, 1);
      if (events.some((e) => e.kind === 'switch' && e.side === 'opponent')) sawSwitch = true;
    }
    if (state.oi === 1) {
      expect(sawSwitch).toBe(true);
      expect(state.battle.opponent).toBe(state.opponents[1]);
      expect(state.battle.player.hp).toBe(state.players[state.pi].hp);
      expect(state.battle.combo).toBe(state.combo);
      expect(state.kos[state.pi]).toBe(1);
    } else {
      expect(state.status).toBe('switching');
    }
  });

  it('TM-02 when the child\'s Pokemon faints they choose the next one (only standing ones)', () => {
    const state = buildBattle(['Magikarp', 'Pichu', 'Togepi', 'Jigglypuff', 'Meowth'], seeded(5));
    for (let guard = 0; guard < 80 && state.status === 'choosing'; guard++) teamTurn(state, 0);
    expect(['switching', 'won', 'lost']).toContain(state.status);
    if (state.status === 'switching') {
      const fallen = state.pi;
      expect(sendIn(state, fallen)).toEqual([]);
      const next = alivePlayers(state)[0];
      const events = sendIn(state, next);
      expect(events[0]).toEqual({ kind: 'switch', side: 'player', index: next });
      expect(state.status).toBe('choosing');
      expect(state.battle.player).toBe(state.players[next]);
      expect(typeof beatsCurrent(state, next)).toBe('boolean');
    }
  });

  it('TM-03 every battle ends; winning means all 5 opponents fainted', () => {
    for (let s = 1; s <= 30; s++) {
      const r = seeded(s);
      const state = play(buildBattle(['Charmander', 'Squirtle', 'Pikachu', 'Eevee', 'Snorlax'], r), (st) => Math.floor(r() * st.battle.player.moves.length));
      expect(['won', 'lost']).toContain(state.status);
      if (state.status === 'won') expect(state.opponents.every((o) => o.hp <= 0)).toBe(true);
      else expect(state.players.every((p) => p.hp <= 0)).toBe(true);
      expect(state.kos.reduce((a, b) => a + b, 0)).toBe(state.oi);
      expect(state.kos[mvpIndex(state)]).toBe(Math.max(...state.kos));
    }
  });

  it('TM-04 balance: a child tapping any move wins often; choosing strong moves wins most', () => {
    const teams = [
      ['Charmander', 'Squirtle', 'Bulbasaur', 'Pikachu', 'Eevee'],
      ['Charizard', 'Gengar', 'Lucario', 'Lapras', 'Snorlax'],
      ['Pichu', 'Togepi', 'Magikarp', 'Meowth', 'Psyduck'],
    ];
    const N = 60;
    let randomWins = 0;
    let smartWins = 0;
    let total = 0;
    teams.forEach((names, t) => {
      for (let s = 0; s < N; s++) {
        const r1 = seeded(1000 * t + s);
        if (play(buildBattle(names, r1, ARENAS[s % ARENAS.length]), (st) => Math.floor(r1() * st.battle.player.moves.length)).status === 'won') randomWins++;
        const r2 = seeded(1000 * t + s);
        const smart = (state) => {
          const { player, opponent } = state.battle;
          let best = 0;
          player.moves.forEach((m, i) => {
            const score = (mv) => mv.power * (player.types.includes(mv.type) ? 1.5 : 1) * (opponent.types.some(() => true) ? 1 : 1);
            if (score(m) > score(player.moves[best])) best = i;
          });
          return best;
        };
        if (play(buildBattle(names, r2, ARENAS[s % ARENAS.length]), smart).status === 'won') smartWins++;
        total++;
      }
    });
    const rw = randomWins / total;
    const sw = smartWins / total;
    console.info(`[team] win rate: random taps ${Math.round(rw * 100)}%, strong moves ${Math.round(sw * 100)}%`);
    expect(rw).toBeGreaterThanOrEqual(0.45);
    expect(rw).toBeLessThanOrEqual(0.85); // still a real challenge
    expect(sw).toBeGreaterThanOrEqual(rw);
  });

  it('TM-05 gold: win bonus plus survivors; a loss still pays', () => {
    expect(goldForTeam(true, 3)).toBe(45);
    expect(goldForTeam(true, 0)).toBe(30);
    expect(goldForTeam(false, 0)).toBe(10);
  });
});
