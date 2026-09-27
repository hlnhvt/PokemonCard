import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DartsGame } from './DartsGame';
import { BOARD, COLS, HAND, SWIPE_GAIN } from '../../utils/carnival/darts';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Lightning'] };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.removeItem('pokescan_tickets_v1');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  // Canvas at its logical size, so pointer coordinates map 1:1
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 560, right: 360, bottom: 560, x: 0, y: 0 });
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playScanBeep', 'playOops', 'playNote', 'playEnergySurge']) vi.spyOn(sounds, s).mockImplementation(() => {});
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

/** Swipe from below the hand so the dart flies to the point (x, y). */
function throwAt(stage, x, y) {
  const from = [180, 530];
  const to = [from[0] + (x - HAND.x) / SWIPE_GAIN, from[1] + (y - HAND.y) / SWIPE_GAIN];
  fireEvent.pointerDown(stage, { clientX: from[0], clientY: from[1], pointerId: 1 });
  fireEvent.pointerMove(stage, { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1 });
  fireEvent.pointerUp(stage, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

describe('DartsGame', () => {
  it('DRU-01 counts down, a tiny swipe does nothing, darts pop balloons, then the result pays gold once', async () => {
    const onGold = vi.fn();
    render(<DartsGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(5)} />);
    expect(screen.getByTestId('carnival-countdown')).toBeInTheDocument();
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    expect(screen.getByTestId('darts-hint')).toHaveTextContent('Vuốt lên');
    const stage = screen.getByTestId('darts-stage');
    fireEvent.pointerDown(stage, { clientX: 180, clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 182, clientY: 495, pointerId: 1 });
    expect(dialog().dataset.darts).toBe('10');
    // Aim at the bottom-middle balloon
    throwAt(stage, BOARD.x0 + 2 * BOARD.dx, BOARD.y0 + 3 * BOARD.dy);
    expect(dialog().dataset.status).toBe('fly');
    expect(dialog().dataset.darts).toBe('9');
    await advance(1200);
    expect(sounds.playWhoosh).toHaveBeenCalled();
    expect(dialog().dataset.pops).toBe('1');
    expect(sounds.playPop).toHaveBeenCalled();
    // Keep throwing at balloons, one after another
    let n = 1;
    for (let i = 0; i < 40 && !screen.queryByTestId('carnival-result'); i++) {
      if (dialog().dataset.status === 'aim') {
        const col = n % COLS;
        const row = 3 - (Math.floor(n / COLS) % 4);
        throwAt(stage, BOARD.x0 + col * BOARD.dx, BOARD.y0 + row * BOARD.dy);
        n++;
      }
      await advance(1100);
    }
    await advance(1500);
    expect(screen.getByTestId('carnival-result')).toBeInTheDocument();
    expect(dialog().dataset.darts).toBe('0');
    expect(Number(dialog().dataset.pops)).toBeGreaterThan(4);
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('tickets-earned')).toBeInTheDocument();
    // Play again resets
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(dialog().dataset.darts).toBe('10');
  }, 60000);

  it('DRU-02 the keyboard can aim and throw', async () => {
    render(<DartsGame player={PLAYER} onClose={vi.fn()} random={seeded(4)} />);
    await advance(2600);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: ' ' });
    expect(dialog().dataset.darts).toBe('9');
  });
});
