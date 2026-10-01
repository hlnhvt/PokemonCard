// Saved pizzeria of "Tiệm Pizza Pokémon" (day, money, upgrades, staff, menu), kept on this device.
import { cleanShop, newShop } from './pizza3d/shop';

export const PIZZA3D_KEY = 'pokescan_pizza3d_v1';

export function loadPizza3d() {
  try {
    const raw = localStorage.getItem(PIZZA3D_KEY);
    if (!raw) return null;
    return cleanShop(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function savePizza3d(shop) {
  try {
    localStorage.setItem(PIZZA3D_KEY, JSON.stringify(shop));
    return true;
  } catch {
    return false; // storage full or blocked: the day still counts on screen
  }
}

/** "Tiệm mới": forget the saved shop and start again. */
export function resetPizza3d() {
  try {
    localStorage.removeItem(PIZZA3D_KEY);
  } catch {
    // ignore
  }
  return newShop();
}
