import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RingTossGame } from './RingTossGame';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Lightning'] };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.removeItem('pokescan_tickets_v1');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 560, right: 360, bottom: 560, x: 0, y: 0 });
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

function swipe(stage, from, to) {
  fireEvent.pointerDown(stage, { clientX: from[0], clientY: from[1], pointerId: 1 });
  fireEvent.pointerMove(stage, { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1 });
  fireEvent.pointerUp(stage, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

describe('RingTossGame', () => {
  it('RTU-01 counts down, a tiny swipe does nothing, swipes throw 8 rings, then the result pays gold once', async () => {
    const onGold = vi.fn();
    render(<RingTossGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} />);
    expect(screen.getByTestId('carnival-countdown')).toBeInTheDocument();
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    expect(screen.getByTestId('ringtoss-hint')).toHaveTextContent('Vuốt lên');
    const stage = screen.getByTestId('ringtoss-stage');
    swipe(stage, [180, 500], [182, 490]);
    expect(dialog().dataset.rings).toBe('8');
    // Straight up with the length for the middle row
    swipe(stage, [180, 520], [180, 373]);
    expect(dialog().dataset.status).toBe('fly');
    expect(dialog().dataset.rings).toBe('7');
    for (let i = 0; i < 20 && !screen.queryByTestId('carnival-result'); i++) {
      await advance(1800);
      if (dialog().dataset.status === 'aim') swipe(stage, [180, 520], [180 + (i % 3) - 1, 373]);
    }
    await advance(1500);
    expect(screen.getByTestId('carnival-result')).toBeInTheDocument();
    expect(dialog().dataset.rings).toBe('0');
    expect(Number(dialog().dataset.score)).toBeGreaterThan(0);
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('tickets-earned')).toBeInTheDocument();
    // Play again resets
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(dialog().dataset.rings).toBe('8');
  }, 30000);

  it('RTU-02 the keyboard can aim and throw', async () => {
    render(<RingTossGame player={PLAYER} onClose={vi.fn()} random={seeded(4)} />);
    await advance(2600);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: ' ' });
    expect(dialog().dataset.rings).toBe('7');
  });
});
