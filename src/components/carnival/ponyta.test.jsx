import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PonytaGame } from './PonytaGame';
import { getTickets } from '../../utils/carnival/tickets';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png' };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.removeItem('pokescan_tickets_v1');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playOops', 'playScanBeep', 'playEnergySurge', 'playNote']) vi.spyOn(sounds, s).mockImplementation(() => {});
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
const dialog = () => screen.getByRole('dialog', { name: 'Đua ngựa Ponyta' });

describe('PonytaGame', () => {
  it('CPU-01 countdown, tap on the green zone to gallop, finish first; the result pays once', async () => {
    const onGold = vi.fn();
    render(<PonytaGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(4)} />);
    expect(screen.getByTestId('carnival-countdown')).toBeInTheDocument();
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    const stage = screen.getByTestId('ponyta-stage');
    // A tap outside the green zone stumbles ("Ối!")
    for (let t = 0; t < 3000 && dialog().dataset.zone !== 'miss'; t += 20) await advance(20, 20);
    fireEvent.pointerDown(stage);
    expect(screen.getByText(/Ối!/)).toBeInTheDocument();
    await advance(300);
    for (let t = 0; t < 60000 && dialog().dataset.phase === 'play'; t += 20) {
      if (dialog().dataset.zone === 'green') fireEvent.pointerDown(stage);
      await advance(20, 20);
    }
    expect(Number(dialog().dataset.greens)).toBeGreaterThan(10);
    expect(dialog().dataset.phase).toBe('finish');
    expect(dialog().dataset.place).toBe('1');
    await advance(2200);
    const result = screen.getByTestId('carnival-result');
    expect(result.dataset.stars).toBe('3');
    expect(result).toHaveTextContent('Về nhất');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(getTickets()).toBe(4);
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.phase).toBe('ready');
  }, 90000);

  it('CPU-02 a child who never taps comes last and still gets a star', async () => {
    const onGold = vi.fn();
    render(<PonytaGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(5)} />);
    await advance(2600);
    for (let t = 0; t < 60000 && dialog().dataset.phase !== 'done'; t += 200) await advance(200);
    expect(screen.getByTestId('carnival-result').dataset.stars).toBe('1');
    expect(dialog().dataset.place).toBe('4');
    expect(onGold).toHaveBeenCalledTimes(1);
  }, 90000);
});
