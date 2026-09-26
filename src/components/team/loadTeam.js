// Loading a 5 vs 5 battle: battle data for the child's team and the opponents, then fighters.
// Used by the team battle (random fair opponents) and the Pokemon League (each gym's team).
import { fetchBattlePokemon } from '../../services/battleData';
import { createFighter, opponentLevel } from '../../utils/battle/engine';
import { OPPONENT_POOL } from '../../utils/battle/opponentPool';
import { createTeamBattle, pickOpponentTeam, teamOpponentLevel } from '../../utils/team/teamBattle';
import { applyArena } from '../../utils/team/arenas';

/**
 * team: members from the team builder. opponentNames: PokeAPI names (else fair random picks).
 * levelFactor makes the opponents stronger or weaker (League gyms). onProgress() after each Pokemon.
 * Returns the team battle state; throws with a child-friendly message.
 */
export async function loadTeamBattle({ team, opponentNames = null, arena, levelFactor = 1, random = Math.random, onProgress = () => {} }) {
  const playerData = await Promise.all(
    team.map((m) =>
      fetchBattlePokemon(m.query)
        .then((d) => {
          onProgress();
          return d;
        })
        .catch((err) => {
          throw new Error(`${m.name}: ${err.message}`);
        })
    )
  );
  const names = opponentNames || pickOpponentTeam(playerData, OPPONENT_POOL, random).map((p) => p.name.toLowerCase());
  // An opponent that cannot be downloaded is replaced by another one
  const used = new Set([...playerData.map((d) => d.name.toLowerCase()), ...names]);
  const opponentData = await Promise.all(
    names.map(async (name) => {
      try {
        return await fetchBattlePokemon(name);
      } catch {
        const spare = OPPONENT_POOL.find((o) => !used.has(o.name.toLowerCase()));
        if (!spare) throw new Error('Không tải được đội đối thủ.');
        used.add(spare.name.toLowerCase());
        return fetchBattlePokemon(spare.name.toLowerCase());
      } finally {
        onProgress();
      }
    })
  );
  const players = playerData.map((d, i) =>
    createFighter(applyArena({ ...d, name: team[i].name, image: team[i].image || d.image }, arena), { isPlayer: true, friendship: team[i].friendship || 0 })
  );
  const opponents = opponentData.map((d, i) =>
    createFighter(applyArena(d, arena), { level: Math.max(5, Math.round(teamOpponentLevel(opponentLevel(playerData[i % playerData.length].stats, d.stats)) * levelFactor)) })
  );
  return createTeamBattle({ players, opponents, random });
}
