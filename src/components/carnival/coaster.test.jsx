import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CoasterGame } from './CoasterGame';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Charmander', image: 'charmander.png', types: ['Fire'] };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
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

describe('CoasterGame', () => {
  it('COU-01 hold to climb, let go at the warning signs, collect stars; the ride ends with a result paid once', async () => {
    const onGold = vi.fn();
    render(<CoasterGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} />);
    const stage = screen.getByTestId('coaster-stage');
    // Holding before the start does nothing
    fireEvent.pointerDown(stage, { pointerId: 1 });
    expect(dialog().dataset.holding).toBe('no');
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    let sawCurve = false;
    let sawGauge = false;
    let t = 0;
    for (; t < 70000 && dialog().dataset.phase === 'play'; t += 100) {
      const d = dialog().dataset;
      if (d.warn === 'yes') {
        sawCurve = true;
        if (d.holding === 'yes') fireEvent.pointerUp(stage, { pointerId: 1 });
      } else if (d.holding === 'no') {
        fireEvent.pointerDown(stage, { pointerId: 1 });
      }
      if (screen.getByTestId('coaster-gauge')) sawGauge = true;
      await advance(100);
    }
    expect(sawCurve).toBe(true);
    expect(sawGauge).toBe(true);
    expect(t).toBeGreaterThan(35000);
    expect(t).toBeLessThan(60000);
    expect(Number(dialog().dataset.starsGot)).toBeGreaterThan(20);
    await advance(1500);
    expect(dialog().dataset.phase).toBe('done');
    expect(screen.getByTestId('carnival-result')).toBeInTheDocument();
    expect(Number(screen.getByTestId('carnival-result').dataset.stars)).toBeGreaterThanOrEqual(2);
    expect(onGold).toHaveBeenCalledTimes(1);
  }, 90000);
});
