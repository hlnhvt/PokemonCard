// Small UI helpers shared by the quest components.
const ICONS = { berry: '🫐', potion: '🧪', superPotion: '💛', revive: '💎', candy: '🍬', stone: '🔶', charmAtk: '💪', charmHp: '🛡️', charmSpeed: '🪶' };
export const itemIcon = (id) => ICONS[id] || '🎁';
