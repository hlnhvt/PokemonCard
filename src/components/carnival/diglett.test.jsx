import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { DiglettGame } from './DiglettGame';
import { CARNIVAL_GAMES } from './index';
import { GAME_RANK } from '../../utils/pokemonRank';
import { getTickets } from '../../utils/carnival/tickets';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png' };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.removeItem('pokescan_tickets_v1');
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playOops', 'playScanBeep']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const advance = async (ms, step = 50) => {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
};

describe('carnival', () => {
  it('CVU-00 carnival games are listed and open to every Pokemon', () => {
    for (const g of CARNIVAL_GAMES) expect(GAME_RANK[g.id]).toBe(1);
  });

  it('CVU-01 whack a Diglett: countdown, tap the ones that pop up, the result pays tickets and gold once', async () => {
    const onGold = vi.fn();
    render(<DiglettGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} />);
    expect(screen.getByTestId('carnival-countdown')).toBeInTheDocument();
    await advance(2600);
    const dialog = () => screen.getByRole('dialog', { name: 'Đập Diglett' });
    expect(dialog().dataset.phase).toBe('play');
    const holes = () => within(screen.getByTestId('whack-board')).getAllByRole('button');
    let hits = 0;
    for (let t = 0; t < 45000 && dialog().dataset.phase === 'play'; t += 100) {
      holes().forEach((h) => {
        if (h.dataset.kind === 'diglett' || h.dataset.kind === 'golden') {
          fireEvent.pointerDown(h);
          hits++;
        }
      });
      await advance(100);
    }
    await advance(800);
    expect(hits).toBeGreaterThan(10);
    expect(Number(dialog().dataset.score)).toBeGreaterThan(100);
    const result = screen.getByTestId('carnival-result');
    expect(Number(result.dataset.stars)).toBeGreaterThanOrEqual(2);
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(getTickets()).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.phase).toBe('ready');
  }, 60000);
});
