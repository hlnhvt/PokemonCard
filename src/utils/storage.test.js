import { describe, it, expect, vi } from 'vitest';
import {
  getSavedCollection,
  saveCardToPokedex,
  toggleCardFavorite,
  removeCardFromPokedex,
  clearPokedex,
} from './storage';
import { makeCard } from '../test/fixtures';

const KEY = 'pokescan_saved_cards_v1';

describe('storage', () => {
  it('ST-01 returns [] when storage is empty', () => {
    expect(getSavedCollection()).toEqual([]);
  });

  it('ST-02 saves a new card with initial metadata at the front', () => {
    saveCardToPokedex(makeCard({ id: 'pikachu', name: 'Pikachu' }));
    const saved = saveCardToPokedex(makeCard());
    expect(saved).toMatchObject({ id: 'charizard', scanCount: 1, isFavorite: false });
    expect(saved.firstScannedAt).toBeTruthy();
    expect(saved.lastScannedAt).toBe(saved.firstScannedAt);
    expect(getSavedCollection().map((c) => c.id)).toEqual(['charizard', 'pikachu']);
  });

  it('ST-03 re-saving increments scanCount and keeps first scan date and favorite', () => {
    const first = saveCardToPokedex(makeCard());
    toggleCardFavorite('charizard');
    const second = saveCardToPokedex(makeCard({ hp: 999 }));
    expect(second.scanCount).toBe(2);
    expect(second.firstScannedAt).toBe(first.firstScannedAt);
    expect(second.isFavorite).toBe(true);
    expect(second.hp).toBe(999);
    expect(getSavedCollection()).toHaveLength(1);
  });

  it('ST-04 ignores null or id-less cards', () => {
    expect(saveCardToPokedex(null)).toBeNull();
    expect(saveCardToPokedex({ name: 'x' })).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('ST-05 returns [] for corrupt JSON', () => {
    localStorage.setItem(KEY, '{not json');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(getSavedCollection()).toEqual([]);
  });

  it('ST-06 returns [] for non-array JSON and drops malformed entries', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    expect(getSavedCollection()).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify([null, { id: 'x' }, { name: 'y' }, 42, makeCard()]));
    expect(getSavedCollection().map((c) => c.id)).toEqual(['charizard']);
  });

  it('ST-07 toggles favorite for the right card only', () => {
    saveCardToPokedex(makeCard());
    saveCardToPokedex(makeCard({ id: 'pikachu', name: 'Pikachu' }));
    const updated = toggleCardFavorite('charizard');
    expect(updated.find((c) => c.id === 'charizard').isFavorite).toBe(true);
    expect(updated.find((c) => c.id === 'pikachu').isFavorite).toBe(false);
    expect(getSavedCollection().find((c) => c.id === 'charizard').isFavorite).toBe(true);
  });

  it('ST-08 keeps the current list when writing fails', () => {
    saveCardToPokedex(makeCard());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(toggleCardFavorite('charizard').map((c) => c.id)).toEqual(['charizard']);
    expect(removeCardFromPokedex('charizard').map((c) => c.id)).toEqual(['charizard']);
  });

  it('ST-09 removes only the given card', () => {
    saveCardToPokedex(makeCard());
    saveCardToPokedex(makeCard({ id: 'pikachu', name: 'Pikachu' }));
    expect(removeCardFromPokedex('charizard').map((c) => c.id)).toEqual(['pikachu']);
    expect(getSavedCollection().map((c) => c.id)).toEqual(['pikachu']);
  });

  it('ST-10 clears everything', () => {
    saveCardToPokedex(makeCard());
    expect(clearPokedex()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('ST-11 returns null when saving fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(saveCardToPokedex(makeCard())).toBeNull();
  });
});
