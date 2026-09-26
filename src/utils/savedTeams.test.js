import { describe, it, expect, beforeEach } from 'vitest';
import { getSavedTeams, saveTeam, deleteSavedTeam, teamFromSaved, savableCards, MAX_SAVED_TEAMS } from './savedTeams';

const card = (id, name) => ({ id, name, speciesName: id, pokedexNumber: '1', types: ['Normal'], fallbackImage: `${id}.png` });
const COLLECTION = ['pikachu', 'charmander', 'squirtle', 'bulbasaur', 'eevee', 'mew'].map((id) => card(id, id[0].toUpperCase() + id.slice(1)));
const member = (id) => ({ key: `card-${id}`, name: id[0].toUpperCase() + id.slice(1), species: id });
const lent = { key: 'pool-meowth', name: 'Meowth', species: 'meowth' };

beforeEach(() => localStorage.removeItem('pokescan_saved_teams_v1'));

describe('saved line-ups', () => {
  it('ST-01 only the child\'s own cards are saved, in team order; the same line-up is not saved twice', () => {
    const team = [member('squirtle'), lent, member('pikachu')];
    expect(savableCards(team)).toEqual(['squirtle', 'pikachu']);
    const out = saveTeam(team, 1);
    expect(out.saved).toMatchObject({ name: 'Đội Squirtle +1', cards: ['squirtle', 'pikachu'] });
    expect(getSavedTeams()).toHaveLength(1);
    expect(saveTeam(team, 2).reason).toBe('same');
    expect(saveTeam([lent], 3).reason).toBe('empty');
    expect(getSavedTeams()).toHaveLength(1);
  });

  it('ST-02 newest first, at most 6; delete; loading skips cards no longer in the collection', () => {
    const ids = COLLECTION.map((c) => c.id);
    for (let i = 0; i < MAX_SAVED_TEAMS + 2; i++) saveTeam([member(`mon${i}`), member(ids[i % ids.length])], i + 1);
    const list = getSavedTeams();
    expect(list).toHaveLength(MAX_SAVED_TEAMS);
    expect(list[0].createdAt).toBe(MAX_SAVED_TEAMS + 2);
    deleteSavedTeam(list[0].id);
    expect(getSavedTeams()).toHaveLength(MAX_SAVED_TEAMS - 1);
    const t = { id: 'x', name: 'Đội X', cards: ['eevee', 'gone', 'pikachu'] };
    const members = teamFromSaved(t, COLLECTION, 5);
    expect(members.map((m) => m.name)).toEqual(['Eevee', 'Pikachu']);
    expect(members[0].source).toBe('owned');
    expect(teamFromSaved({ cards: ['pikachu', 'charmander', 'squirtle'] }, COLLECTION, 1)).toHaveLength(1);
  });
});
