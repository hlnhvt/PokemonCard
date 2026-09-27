import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CansGame } from './CansGame';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Machop', image: 'machop.png', types: ['Fighting'] };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.removeItem('pokescan_tickets_v1');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
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

function swipe(stage, from, to) {
  fireEvent.pointerDown(stage, { clientX: from[0], clientY: from[1], pointerId: 1 });
  fireEvent.pointerMove(stage, { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1 });
  fireEvent.pointerUp(stage, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

describe('CansGame', () => {
  it('CNU-01 swipes throw balls at 3 towers, cans fall and score, then the result pays gold once', async () => {
    const onGold = vi.fn();
    render(<CansGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(11)} />);
    expect(screen.getByTestId('carnival-countdown')).toBeInTheDocument();
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    expect(screen.getByTestId('cans-hint')).toBeInTheDocument();
    const stage = screen.getByTestId('cans-stage');
    // A tap (no swipe) throws nothing
    swipe(stage, [180, 500], [181, 496]);
    expect(dialog().dataset.balls).toBe('3');
    // Low, straight at the bottom of the tower
    swipe(stage, [180, 520], [180, 470]);
    expect(dialog().dataset.status).toBe('fly');
    expect(dialog().dataset.balls).toBe('2');
    const levels = new Set();
    for (let i = 0; i < 40 && !screen.queryByTestId('carnival-result'); i++) {
      await advance(1000);
      levels.add(dialog().dataset.level);
      if (dialog().dataset.status === 'aim') swipe(stage, [180, 520], [180 + ((i % 3) - 1) * 6, 470]);
    }
    await advance(2000);
    expect(screen.getByTestId('carnival-result')).toBeInTheDocument();
    expect([...levels].sort()).toEqual(['1', '2', '3']);
    expect(Number(dialog().dataset.score)).toBeGreaterThan(0);
    expect(onGold).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(dialog().dataset.level).toBe('1');
  }, 60000);

  it('CNU-02 the keyboard aims and throws', async () => {
    render(<CansGame player={PLAYER} onClose={vi.fn()} random={seeded(12)} />);
    await advance(2600);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: ' ' });
    expect(dialog().dataset.balls).toBe('2');
  });
});
