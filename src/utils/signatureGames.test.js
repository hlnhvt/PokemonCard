import { describe, it, expect } from 'vitest';
import { signatureGames, SPECIES_GAMES, TYPE_GAMES } from './signatureGames';
import { SPORTS } from '../components/sports';
import { LOGIC_GAMES } from '../components/logic';
import { CARNIVAL_GAMES } from '../components/carnival';
import { GAMES_3D } from '../components/three3d';
import { GAME_RANK } from './pokemonRank';

const ALL = [
  ...['catch', 'runner', 'battle', 'cooking', 'shop', 'moba'].map((id) => ({ id })),
  ...SPORTS,
  ...LOGIC_GAMES,
  ...CARNIVAL_GAMES,
  ...GAMES_3D,
].map((g) => ({ id: g.id, needRank: GAME_RANK[g.id] || 1 }));
const ids = (list) => list.map((g) => g.id);

describe('signature games', () => {
  it('SG-01 every id in the tables is a real game', () => {
    const known = new Set(ALL.map((g) => g.id));
    for (const list of [...Object.values(SPECIES_GAMES), ...Object.values(TYPE_GAMES)]) list.forEach((id) => expect(known.has(id), id).toBe(true));
  });

  it('SG-02 5 different games; species games come first, then the types take turns', () => {
    const snorlax = signatureGames({ name: 'Snorlax', types: ['Normal'] }, ALL);
    expect(snorlax).toHaveLength(5);
    expect(ids(snorlax).slice(0, 3)).toEqual(['gulp3d', 'cooking', 'pizza3d']);
    expect(snorlax[0].reason).toBe('Dành riêng cho Snorlax');
    const lapras = signatureGames({ name: 'Lapras', types: ['Water', 'Ice'] }, ALL);
    expect(ids(lapras).slice(0, 2)).toEqual(['fishing', 'skeeball']);
    expect(lapras.map((g) => g.reason).slice(0, 2)).toEqual(['Hợp hệ Nước', 'Hợp hệ Băng']);
    expect(new Set(ids(lapras)).size).toBe(5);
  });

  it('SG-03 different Pokemon get different lists', () => {
    const a = ids(signatureGames({ name: 'Charizard', types: ['Fire', 'Flying'] }, ALL));
    const b = ids(signatureGames({ name: 'Gengar', types: ['Ghost', 'Poison'] }, ALL));
    expect(a[0]).toBe('sky3d');
    expect(b[0]).toBe('ghosthouse');
    expect(a).not.toEqual(b);
  });

  it('SG-05 catching this very Pokemon is always the last of the 5', () => {
    for (const p of [{ name: 'Snorlax', types: ['Normal'] }, { name: 'Lapras', types: ['Water', 'Ice'] }, { name: 'Bug', types: ['Bug'] }]) {
      const list = signatureGames(p, ALL);
      expect(list).toHaveLength(5);
      expect(list[4]).toMatchObject({ id: 'catch', reason: 'Bắt chính bạn ấy' });
      expect(ids(list).filter((id) => id === 'catch')).toHaveLength(1);
    }
  });

  it('SG-04 games it can already play come before locked ones; unknown types still get 5', () => {
    const rank1 = signatureGames({ name: 'Pikachu', types: ['Electric'] }, ALL, { rankLevel: 1 });
    const open = rank1.filter((g) => g.needRank <= 1).length;
    rank1.forEach((g, i) => i < open && expect(g.needRank).toBe(1));
    expect(signatureGames({ name: 'Missingno', types: ['???'] }, ALL)).toHaveLength(5);
  });
});
