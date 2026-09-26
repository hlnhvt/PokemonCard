import { TEAM_DIFFICULTY } from '../../utils/team/teamBattle';

// The last difficulty chosen for the team battles (remembered in this browser)
const KEY = 'pokescan_team_difficulty';
export const readTeamDifficulty = () => {
  try {
    const id = localStorage.getItem(KEY);
    return TEAM_DIFFICULTY[id] ? id : 'normal';
  } catch {
    return 'normal';
  }
};
export const saveTeamDifficulty = (id) => {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // ignore
  }
};
