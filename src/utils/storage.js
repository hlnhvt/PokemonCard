// LocalStorage helper for Pokémon Card collection management
const STORAGE_KEY = 'pokescan_saved_cards_v1';

export function getSavedCollection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop malformed entries so views never crash on missing fields
    return parsed.filter(
      (item) => item && typeof item.id === 'string' && typeof item.name === 'string'
    );
  } catch (err) {
    console.error('Failed to read from localStorage:', err);
    return [];
  }
}

export function saveCardToPokedex(card) {
  if (!card || !card.id) return null;
  try {
    const list = getSavedCollection();
    const existingIndex = list.findIndex(item => item.id === card.id);
    const now = new Date().toISOString();

    let updatedList;
    let savedItem;

    if (existingIndex >= 0) {
      // Update scan count and last scanned
      const current = list[existingIndex];
      savedItem = {
        ...current,
        ...card,
        scanCount: (current.scanCount || 1) + 1,
        firstScannedAt: current.firstScannedAt || now,
        isFavorite: !!current.isFavorite,
        lastScannedAt: now,
      };
      updatedList = [...list];
      updatedList[existingIndex] = savedItem;
    } else {
      // First time catching this card!
      savedItem = {
        ...card,
        scanCount: 1,
        firstScannedAt: now,
        lastScannedAt: now,
        isFavorite: false,
      };
      updatedList = [savedItem, ...list];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    return savedItem;
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
    return null;
  }
}

export function toggleCardFavorite(cardId) {
  const list = getSavedCollection();
  try {
    const updated = list.map(item => {
      if (item.id === cardId) {
        return { ...item, isFavorite: !item.isFavorite };
      }
      return item;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Error toggling favorite:', err);
    // Keep showing what is actually persisted instead of wiping the UI
    return list;
  }
}

export function removeCardFromPokedex(cardId) {
  const list = getSavedCollection();
  try {
    const updated = list.filter(item => item.id !== cardId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Error removing card:', err);
    return list;
  }
}

export function clearPokedex() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  } catch (err) {
    console.error('Error clearing pokedex:', err);
    return [];
  }
}
