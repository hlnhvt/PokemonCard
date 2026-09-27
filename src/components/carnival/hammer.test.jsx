import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { HammerGame } from './HammerGame';
import { getTickets } from '../../utils/carnival/tickets';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png' };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.removeItem('pokescan_tickets_v1');
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playOops', 'playScanBeep', 'playNote']) vi.spyOn(sounds, s).mockImplementation(() => {});
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
const dialog = () => screen.getByRole('dialog', { name: 'Búa sức mạnh Machop' });
const meter = () => Number(screen.getByTestId('hammer-meter').dataset.value);

describe('HammerGame', () => {
  it('CHU-01 5 swings: stop the meter at the top, the puck rings the bell, the result pays once', async () => {
    const onGold = vi.fn();
    render(<HammerGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(2)} />);
    expect(screen.getByTestId('carnival-countdown')).toBeInTheDocument();
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    const button = screen.getByTestId('hammer-hit');
    for (let swing = 1; swing <= 5; swing++) {
      for (let t = 0; t < 5000 && dialog().dataset.stage !== 'aim'; t += 20) await advance(20, 20);
      expect(dialog().dataset.swing).toBe(String(swing));
      expect(button).not.toBeDisabled();
      // Wait for the meter to be near the top, then tap
      for (let t = 0; t < 5000 && meter() < 0.97; t += 16) await advance(16, 16);
      fireEvent.pointerDown(button);
      expect(dialog().dataset.stage).toBe('strike');
      expect(button).toBeDisabled();
      await advance(1200, 20);
      if (swing === 1) {
        expect(screen.getByTestId('hammer-ding')).toHaveTextContent('DING!');
        expect(screen.getByTestId('hammer-best')).toBeInTheDocument();
      }
    }
    for (let t = 0; t < 5000 && dialog().dataset.phase !== 'done'; t += 100) await advance(100);
    expect(dialog().dataset.bells).toBe('5');
    expect(Number(dialog().dataset.score)).toBeGreaterThan(700);
    const result = screen.getByTestId('carnival-result');
    expect(result.dataset.stars).toBe('3');
    expect(result).toHaveTextContent('rung chuông 5 lần');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(getTickets()).toBe(4);
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.phase).toBe('ready');
  }, 60000);

  it('CHU-02 tapping straight away gives little power: 1 star', async () => {
    const onGold = vi.fn();
    render(<HammerGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} />);
    await advance(2600);
    for (let t = 0; t < 30000 && dialog().dataset.phase === 'play'; t += 50) {
      if (dialog().dataset.stage === 'aim') fireEvent.keyDown(window, { key: ' ', code: 'Space' });
      await advance(50);
    }
    await advance(800);
    expect(Number(dialog().dataset.score)).toBeLessThan(100);
    expect(screen.getByTestId('carnival-result').dataset.stars).toBe('1');
    expect(onGold).toHaveBeenCalledTimes(1);
  }, 60000);
});
