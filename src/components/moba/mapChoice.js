import { MAPS } from '../../utils/moba/map';

// The last map the child chose (remembered in this browser)
const MAP_KEY = 'pokescan_moba_map';
export const readMapId = () => {
  try {
    const id = localStorage.getItem(MAP_KEY);
    return MAPS.some((m) => m.id === id) ? id : MAPS[0].id;
  } catch {
    return MAPS[0].id;
  }
};
export const saveMapId = (id) => {
  try {
    localStorage.setItem(MAP_KEY, id);
  } catch {
    // ignore
  }
};
