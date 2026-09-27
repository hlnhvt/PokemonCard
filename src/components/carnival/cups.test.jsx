import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CupsGame } from './CupsGame';
import { createCups, stepCups, pickCup } from '../../utils/carnival/cups';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Eevee', image: 'eevee.png', types: ['Normal'] };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playScanBeep', 'playOops', 'playNote']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function advance(ms, step = 100) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}
const dialog = () => screen.getByRole('dialog');
const cup = (id) => document.querySelector(`[data-cup="${id}"]`);

describe('CupsGame', () => {
  it('CUU-01 six rounds: watch, the cups shuffle, tap a cup; right ones score with a streak, a wrong one shows the ball; result pays once', async () => {
    const onGold = vi.fn();
    render(<CupsGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} />);
    // The same seed tells the test where the ball is
    const mirror = createCups({ random: seeded(3) });
    expect(dialog().dataset.phase).toBe('ready');
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    expect(screen.getByTestId('cups-ball')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-cup]')).toHaveLength(3);
    // All cups look the same (no colour to follow)
    expect(new Set([...document.querySelectorAll('[data-cup] svg path')].slice(0, 1).map((p) => p.getAttribute('fill'))).size).toBe(1);
    for (let round = 1; round <= 10; round++) {
      for (let t = 0; t < 20000 && dialog().dataset.step !== 'pick'; t += 100) await advance(100);
      expect(dialog().dataset.step).toBe('pick');
      expect(dialog().dataset.round).toBe(String(round));
      expect(screen.getByTestId('cups-hint')).toHaveTextContent('Bóng ở cốc nào');
      expect(screen.queryByTestId('cups-ball')).toBeNull(); // hidden while picking
      for (let t = 0; t < 60 && mirror.phase !== 'pick'; t += 1 / 60) stepCups(mirror, 1 / 60);
      const choice = round < 10 ? mirror.ball : (mirror.ball + 1) % mirror.n;
      fireEvent.pointerDown(cup(choice));
      pickCup(mirror, choice);
      for (let t = 0; t < 10 && mirror.phase !== 'show' && mirror.status === 'play'; t += 1 / 60) stepCups(mirror, 1 / 60);
      expect(dialog().dataset.step).toBe('reveal');
      expect(screen.getByTestId('cups-ball')).toBeInTheDocument();
      if (round < 10) {
        expect(screen.getByTestId('cups-banner')).toHaveTextContent('Đúng rồi');
        expect(dialog().dataset.streak).toBe(String(round));
      } else {
        expect(screen.getByTestId('cups-banner')).toHaveTextContent('Sai rồi');
        expect(dialog().dataset.streak).toBe('0');
      }
      if (round === 4) expect(document.querySelectorAll('[data-cup]')).toHaveLength(4);
      if (round === 8) expect(document.querySelectorAll('[data-cup]')).toHaveLength(5);
    }
    expect(dialog().dataset.score).toBe(String(10 + 15 + 20 + 25 + 30 * 5));
    await advance(3500);
    expect(dialog().dataset.phase).toBe('done');
    expect(screen.getByTestId('carnival-result').dataset.stars).toBe('3');
    expect(onGold).toHaveBeenCalledTimes(1);
  }, 120000);
});
