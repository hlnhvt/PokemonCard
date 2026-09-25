import { describe, it, expect, vi } from 'vitest';
import {
  applyFeed,
  applyPet,
  levelFor,
  levelProgress,
  favoriteBerry,
  fedToday,
  dayKey,
  FEED_GAIN,
  DAILY_FEED_LIMIT,
  DAILY_PET_LIMIT,
  MAX_FRIENDSHIP,
  LEVELS,
} from './friendship';
import { getBerries, addBerries, spendBerry, totalBerries, STARTER_BERRIES } from './berries';
import { saveCardToPokedex, feedCard, petCard, getSavedCollection } from './storage';
import { createRunner, start, step, PLAYER } from './runnerGame';
import { makeCard } from '../test/fixtures';

const DAY1 = new Date(2026, 8, 26, 9, 0);
const DAY1_LATE = new Date(2026, 8, 26, 22, 0);
const DAY2 = new Date(2026, 8, 27, 7, 0);

// Charizard is #006 -> favourite is oran (even), Pikachu #025 -> razz (odd)
const charizard = () => makeCard();
const notFavorite = (card) => (favoriteBerry(card) === 'oran' ? 'razz' : 'oran');

describe('friendship rules', () => {
  it('CARE-01 levels from "Mới quen" to "Bạn thân nhất"', () => {
    expect(levelFor(0).label).toBe('Mới quen');
    expect(levelFor(20).label).toBe('Bạn bè');
    expect(levelFor(79).label).toBe('Bạn thân');
    expect(levelFor(80).label).toBe('Tri kỷ');
    expect(levelFor(100).label).toBe('Bạn thân nhất');
    expect(levelFor(-5)).toBe(LEVELS[0]);
    expect(levelFor(500)).toBe(LEVELS[LEVELS.length - 1]);
    expect(levelProgress(35)).toBeCloseTo(0.5, 5);
    expect(levelProgress(100)).toBe(1);
  });

  it('CARE-02 feeding adds friendship; the favourite berry counts double and is remembered', () => {
    const card = charizard();
    expect(favoriteBerry(card)).toBe('oran');
    expect(favoriteBerry({ pokedexNumber: '025' })).toBe('razz');

    const plain = applyFeed(card, notFavorite(card), DAY1);
    expect(plain).toMatchObject({ result: 'fed', gain: FEED_GAIN, favorite: false });
    expect(plain.card.favoriteFound).toBeUndefined();

    const fav = applyFeed(plain.card, 'oran', DAY1);
    expect(fav).toMatchObject({ result: 'fed', gain: FEED_GAIN * 2, favorite: true });
    expect(fav.card).toMatchObject({ friendship: 30, favoriteFound: true });
    expect(fav.levelUp.label).toBe('Bạn bè');
    expect(card.friendship).toBeUndefined(); // input not mutated
  });

  it('CARE-03 a Pokemon eats at most 5 berries a day, again the next day', () => {
    let card = charizard();
    for (let i = 0; i < DAILY_FEED_LIMIT; i++) card = applyFeed(card, 'razz', DAY1).card;
    expect(fedToday(card, DAY1)).toBe(DAILY_FEED_LIMIT);
    expect(applyFeed(card, 'razz', DAY1_LATE)).toMatchObject({ result: 'full', gain: 0 });
    expect(fedToday(card, DAY2)).toBe(0);
    expect(applyFeed(card, 'razz', DAY2).result).toBe('fed');
    expect(dayKey(DAY1)).toBe('2026-09-26');
  });

  it('CARE-04 friendship stops at 100', () => {
    const almost = { ...charizard(), friendship: 95 };
    const out = applyFeed(almost, 'oran', DAY1);
    expect(out.card.friendship).toBe(MAX_FRIENDSHIP);
    expect(out.gain).toBe(5);
    expect(applyFeed(out.card, 'oran', DAY1).result).toBe('max');
  });

  it('CARE-05 petting adds a little friendship up to a daily limit', () => {
    let card = { ...charizard(), friendship: 19 };
    const first = applyPet(card, DAY1);
    expect(first.gain).toBe(1);
    expect(first.levelUp.label).toBe('Bạn bè');
    card = first.card;
    for (let i = 1; i < DAILY_PET_LIMIT; i++) card = applyPet(card, DAY1).card;
    expect(applyPet(card, DAY1).gain).toBe(0);
    expect(applyPet(card, DAY2).gain).toBe(1);
  });
});

describe('berry bag', () => {
  it('BAG-01 starts with a welcome gift and survives corrupt data', () => {
    expect(getBerries()).toEqual({ oran: STARTER_BERRIES.oran, razz: STARTER_BERRIES.razz });
    localStorage.setItem('pokescan_berries_v1', '{broken');
    expect(getBerries().oran).toBe(STARTER_BERRIES.oran);
    localStorage.setItem('pokescan_berries_v1', JSON.stringify({ oran: -4, razz: 2.7, junk: 9 }));
    expect(getBerries()).toEqual({ oran: 0, razz: 2 });
  });

  it('BAG-02 adds and spends berries', () => {
    expect(addBerries({ oran: 2, razz: 1 })).toEqual({ oran: 5, razz: 1 });
    expect(spendBerry('razz')).toEqual({ oran: 5, razz: 0 });
    expect(spendBerry('razz')).toBeNull();
    expect(spendBerry('banana')).toBeNull();
    expect(totalBerries(getBerries())).toBe(5);
  });
});

describe('feeding a saved Pokemon', () => {
  it('CARE-06 feeding spends one berry and saves friendship; re-scans keep it', () => {
    saveCardToPokedex(charizard());
    const out = feedCard('charizard', 'oran', DAY1);
    expect(out.result).toBe('fed');
    expect(out.berries.oran).toBe(STARTER_BERRIES.oran - 1);
    expect(getSavedCollection()[0].friendship).toBe(20);
    saveCardToPokedex(charizard());
    expect(getSavedCollection()[0]).toMatchObject({ friendship: 20, favoriteFound: true, scanCount: 2 });
  });

  it('CARE-07 no berry, unknown card and a full Pokemon keep the bag unchanged', () => {
    saveCardToPokedex(charizard());
    expect(feedCard('charizard', 'razz', DAY1).result).toBe('noBerry');
    expect(feedCard('missing', 'oran', DAY1).result).toBe('notFound');
    // Razz is not Charizard's favourite: 5 x 10 = 50, so the daily limit is hit before 100
    addBerries({ razz: 10 });
    for (let i = 0; i < DAILY_FEED_LIMIT; i++) feedCard('charizard', 'razz', DAY1);
    const before = getBerries().razz;
    expect(feedCard('charizard', 'razz', DAY1).result).toBe('full');
    expect(getBerries().razz).toBe(before);
  });

  it('CARE-08 gives the berry back when the card cannot be saved', () => {
    saveCardToPokedex(charizard());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'pokescan_saved_cards_v1') throw new Error('QuotaExceededError');
      return realSet.call(this, key, value);
    });
    expect(feedCard('charizard', 'oran', DAY1).result).toBe('error');
    expect(getBerries().oran).toBe(STARTER_BERRIES.oran);
  });

  it('CARE-09 petting a saved card; nothing for unsaved ones', () => {
    saveCardToPokedex(charizard());
    expect(petCard('charizard', DAY1).gain).toBe(1);
    expect(getSavedCollection()[0].friendship).toBe(1);
    expect(petCard('missing', DAY1)).toBeNull();
  });
});

describe('runner berries', () => {
  it('RU-18 berries picked up are counted by type', () => {
    const s = start(createRunner());
    s.nextSpawnIn = 1e9;
    s.obstacles.push({ id: 1, kind: 'berry', berry: 'razz', x: PLAYER.x, w: 22, h: 22, bottom: 10 });
    s.obstacles.push({ id: 2, kind: 'berry', berry: 'oran', x: PLAYER.x + 4, w: 22, h: 22, bottom: 10 });
    step(s, 16);
    expect(s.collected).toEqual({ oran: 1, razz: 1 });
  });
});
