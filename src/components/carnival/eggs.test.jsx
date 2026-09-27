import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { EggLotteryGame } from './EggLotteryGame';
import { COLLECTION_KEY, GOLD, BABIES, loadCollection } from '../../utils/carnival/eggs';
import { addTickets, getTickets } from '../../utils/carnival/tickets';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png' };
const TICKETS_KEY = 'pokescan_tickets_v1';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.removeItem(TICKETS_KEY);
  localStorage.removeItem(COLLECTION_KEY);
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playEnergySurge', 'playOops', 'playNote']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.removeItem(TICKETS_KEY);
  localStorage.removeItem(COLLECTION_KEY);
});
const advance = async (ms, step = 50) => {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
};
const dialog = () => screen.getByRole('dialog', { name: 'Xổ số trứng Pokémon' });

/** Pick egg `i`, tap it until it hatches, wait for the prize card. Returns the card. */
async function hatchEgg(i) {
  fireEvent.click(screen.getByTestId(`eggs-egg-${i}`));
  expect(dialog().dataset.phase).toBe('hatch');
  const need = Number(dialog().dataset.need);
  expect(need).toBeGreaterThanOrEqual(6);
  const egg = screen.getByTestId('eggs-hatch-egg');
  for (let t = 1; t < need; t++) {
    fireEvent.click(egg);
    expect(Number(dialog().dataset.taps)).toBe(t);
    expect(Number(dialog().dataset.stage)).toBeGreaterThanOrEqual(1);
  }
  expect(dialog().dataset.stage).toBe('4');
  fireEvent.click(egg);
  expect(dialog().dataset.phase).toBe('burst');
  expect(screen.getByTestId('eggs-burst')).toBeInTheDocument();
  await advance(1300);
  expect(dialog().dataset.phase).toBe('reveal');
  return screen.getByTestId('eggs-reveal');
}

describe('EggLotteryGame', () => {
  it('CEU-01 no tickets: a friendly message, tapping an egg spends nothing', () => {
    const onGold = vi.fn();
    render(<EggLotteryGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(1)} />);
    expect(screen.getByTestId('eggs-empty')).toHaveTextContent('chơi các trò khác');
    expect(screen.getByTestId('eggs-tickets')).toHaveTextContent('0 vé');
    fireEvent.click(screen.getByTestId('eggs-egg-2'));
    expect(dialog().dataset.phase).toBe('shelf');
    expect(sounds.playOops).toHaveBeenCalled();
    expect(onGold).not.toHaveBeenCalled();
    expect(getTickets()).toBe(0);
  });

  it('CEU-02 hatch eggs: each costs a ticket, the album is saved, gold is paid once per egg', async () => {
    addTickets(3);
    const onGold = vi.fn();
    render(<EggLotteryGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(9)} />);
    expect(screen.getByTestId('eggs-tickets')).toHaveTextContent('3 vé');

    // 1st egg: always new
    const card = await hatchEgg(0);
    expect(getTickets()).toBe(2);
    expect(screen.getByTestId('eggs-tickets')).toHaveTextContent('2 vé');
    expect(card.dataset.new).toBe('true');
    expect(screen.getByTestId('eggs-new')).toBeInTheDocument();
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenLastCalledWith(GOLD.new);
    const dex = Number(card.dataset.dex);
    expect(BABIES.some((b) => b.dex === dex)).toBe(true);
    expect(loadCollection()[dex]).toMatchObject({ count: 1 });
    expect(JSON.parse(localStorage.getItem(COLLECTION_KEY))[dex].count).toBe(1);
    await advance(2000); // nothing is paid twice
    expect(onGold).toHaveBeenCalledTimes(1);

    // 2nd egg from the card
    fireEvent.click(screen.getByTestId('eggs-again'));
    expect(dialog().dataset.phase).toBe('shelf');
    const card2 = await hatchEgg(4);
    expect(getTickets()).toBe(1);
    expect(onGold).toHaveBeenCalledTimes(2);
    const dex2 = Number(card2.dataset.dex);
    const expected = card2.dataset.new === 'true' ? GOLD.new : card2.dataset.shiny === 'true' ? GOLD.shinyDuplicate : GOLD.duplicate;
    expect(onGold).toHaveBeenLastCalledWith(expected);
    expect(loadCollection()[dex2].count).toBe(dex2 === dex ? 2 : 1);
    expect(dialog().dataset.hatches).toBe('2');

    // The album shows owned stickers and silhouettes
    fireEvent.click(screen.getByText('Bộ sưu tập'));
    const album = screen.getByTestId('eggs-album');
    expect(album).toBeInTheDocument();
    expect(screen.getByTestId(`eggs-sticker-${dex}`).dataset.owned).toBe('true');
    const owned = BABIES.filter((b) => screen.getByTestId(`eggs-sticker-${b.dex}`).dataset.owned === 'true').length;
    expect(owned).toBe(Object.keys(loadCollection()).length);
    expect(screen.getAllByText('???')).toHaveLength(18 - owned);
    expect(screen.getByTestId('eggs-album-progress')).toHaveTextContent(`${owned}/18`);
    fireEvent.click(screen.getByLabelText('Đóng bộ sưu tập'));
    expect(screen.queryByTestId('eggs-album')).toBeNull();
  }, 60000);

  it('CEU-03 a duplicate pays 5 gold, the saved album survives a remount, Space taps the egg', async () => {
    // Every roll picks Pichu (random 0) and never shiny... except the shiny roll, which uses 0 too:
    // so use a sequence: species 0, shiny 0.5, taps 0 -> Pichu, not shiny, 6 taps
    const seq = () => {
      const v = [0, 0.5, 0];
      let i = 0;
      return () => v[i++ % v.length];
    };
    localStorage.setItem(COLLECTION_KEY, JSON.stringify({ 172: { count: 1, shiny: false } }));
    addTickets(1);
    const onGold = vi.fn();
    const { unmount } = render(<EggLotteryGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seq()} />);
    expect(screen.getByTestId('eggs-album-btn')).toHaveTextContent('1/18');
    fireEvent.click(screen.getByTestId('eggs-egg-1'));
    expect(dialog().dataset.need).toBe('6');
    for (let t = 0; t < 6; t++) fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(dialog().dataset.phase).toBe('burst');
    await advance(1300);
    const card = screen.getByTestId('eggs-reveal');
    expect(card.dataset.dex).toBe('172');
    expect(card.dataset.new).toBe('false');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(GOLD.duplicate);
    expect(loadCollection()).toEqual({ 172: { count: 2, shiny: false } });
    // Last ticket spent: the "again" button is off and a note says to play other games
    expect(getTickets()).toBe(0);
    expect(screen.getByTestId('eggs-again')).toBeDisabled();
    expect(card).toHaveTextContent('Hết vé');
    unmount();
    render(<EggLotteryGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seq()} />);
    fireEvent.click(screen.getByTestId('eggs-album-btn'));
    expect(screen.getByTestId('eggs-sticker-172').dataset.count).toBe('2');
  }, 60000);

  it('CEU-04 a shiny duplicate pays 20 gold and keeps the shiny flag', async () => {
    const seq = () => {
      const v = [0, 0.001, 0.99];
      let i = 0;
      return () => v[i++ % v.length];
    };
    localStorage.setItem(COLLECTION_KEY, JSON.stringify({ 172: { count: 3, shiny: false } }));
    addTickets(2);
    const onGold = vi.fn();
    render(<EggLotteryGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seq()} />);
    const card = await hatchEgg(3);
    expect(dialog().dataset.need).toBe('8');
    expect(card.dataset.shiny).toBe('true');
    expect(card).toHaveTextContent('Shiny');
    expect(onGold).toHaveBeenCalledWith(GOLD.shinyDuplicate);
    expect(loadCollection()[172]).toEqual({ count: 4, shiny: true });
    expect(getTickets()).toBe(1);
  }, 60000);
});
