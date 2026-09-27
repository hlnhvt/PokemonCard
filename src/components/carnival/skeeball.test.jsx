import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SkeeBallGame } from './SkeeBallGame';
import { BALLS } from '../../utils/carnival/skeeball';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Eevee', image: 'eevee.png', types: ['Colorless'] };

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

/** A flick up of `len` pixels over 120 ms (tilted by `dx`). */
async function flick(stage, len, dx = 0) {
  fireEvent.pointerDown(stage, { clientX: 180, clientY: 520, pointerId: 1 });
  await advance(60, 60);
  fireEvent.pointerMove(stage, { clientX: 180 + dx / 2, clientY: 520 - len / 2, pointerId: 1 });
  await advance(60, 60);
  fireEvent.pointerUp(stage, { clientX: 180 + dx, clientY: 520 - len, pointerId: 1 });
}

describe('SkeeBallGame', () => {
  it('SKU-01 a slow drag is too soft, a quick flick rolls into a hole; 9 balls then the result pays once', async () => {
    const onGold = vi.fn();
    render(<SkeeBallGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(2)} />);
    expect(screen.getByTestId('carnival-countdown')).toBeInTheDocument();
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    expect(screen.getByTestId('skeeball-hint')).toHaveTextContent('Vuốt lên');
    const stage = screen.getByTestId('skeeball-stage');
    // Too small: nothing
    fireEvent.pointerDown(stage, { clientX: 180, clientY: 520, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 181, clientY: 510, pointerId: 1 });
    expect(dialog().dataset.balls).toBe(String(BALLS));
    // A good flick straight up: the 50 hole
    await flick(stage, 190);
    expect(dialog().dataset.status).toBe('roll');
    expect(dialog().dataset.balls).toBe(String(BALLS - 1));
    await advance(3000);
    expect(dialog().dataset.status).toBe('aim');
    expect(Number(dialog().dataset.last)).toBeGreaterThanOrEqual(10);
    expect(Number(dialog().dataset.score)).toBeGreaterThan(0);
    // A very slow push never clears the ramp
    fireEvent.pointerDown(stage, { clientX: 180, clientY: 520, pointerId: 1 });
    await advance(500, 100);
    fireEvent.pointerMove(stage, { clientX: 180, clientY: 480, pointerId: 1 });
    await advance(200, 100);
    fireEvent.pointerUp(stage, { clientX: 180, clientY: 470, pointerId: 1 });
    await advance(3000);
    expect(dialog().dataset.last).toBe('0');
    // The rest of the balls
    for (let i = 0; i < 20 && !screen.queryByTestId('carnival-result'); i++) {
      if (dialog().dataset.status === 'aim') await flick(stage, 150 + (i % 3) * 25, (i % 2) * 10);
      await advance(2600);
    }
    await advance(1500);
    expect(screen.getByTestId('carnival-result')).toBeInTheDocument();
    expect(dialog().dataset.balls).toBe('0');
    expect(onGold).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(dialog().dataset.balls).toBe(String(BALLS));
  }, 90000);

  it('SKU-02 the keyboard can aim and roll', async () => {
    render(<SkeeBallGame player={PLAYER} onClose={vi.fn()} random={seeded(4)} />);
    await advance(2600);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: ' ' });
    expect(dialog().dataset.balls).toBe(String(BALLS - 1));
  });
});
