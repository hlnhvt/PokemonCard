import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FishingGame } from './FishingGame';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Psyduck', image: 'psyduck.png', types: ['Water'] };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
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

describe('FishingGame', () => {
  it('FIU-01 cast into the pond, tap on the bite, see the catch card; after 60 s the result pays once', async () => {
    const onGold = vi.fn();
    render(<FishingGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(6)} />);
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    const stage = screen.getByTestId('fishing-stage');
    // Tapping the grass does not cast
    fireEvent.pointerDown(stage, { clientX: 20, clientY: 540 });
    expect(dialog().dataset.bobber).toBe('none');
    let sawCard = false;
    let sawBite = false;
    for (let t = 0; t < 70000 && dialog().dataset.phase === 'play'; t += 100) {
      const d = dialog().dataset;
      if (d.bobber === 'none') fireEvent.pointerDown(stage, { clientX: 180, clientY: 262 });
      else if (d.biting === 'yes') {
        sawBite = true;
        expect(screen.getByTestId('fishing-bite')).toHaveTextContent('GIẬT NGAY');
        await advance(200);
        fireEvent.pointerDown(stage, { clientX: 180, clientY: 262 });
        expect(dialog().dataset.bobber).toBe('reel');
      }
      await advance(100);
      if (screen.queryByTestId('fishing-card')) sawCard = true;
    }
    expect(sawBite).toBe(true);
    expect(sawCard).toBe(true);
    expect(Number(dialog().dataset.catches)).toBeGreaterThan(3);
    await advance(1500);
    expect(dialog().dataset.phase).toBe('done');
    expect(screen.getByTestId('carnival-result')).toBeInTheDocument();
    expect(Number(screen.getByTestId('carnival-result').dataset.stars)).toBeGreaterThanOrEqual(2);
    expect(onGold).toHaveBeenCalledTimes(1);
  }, 90000);
});
