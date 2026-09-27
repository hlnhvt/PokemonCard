import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FerrisGame } from './FerrisGame';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Eevee', image: 'eevee.png', types: ['Normal'] };

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

async function advance(ms, step = 50) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}
const dialog = () => screen.getByRole('dialog');
const targets = () =>
  (screen.getByTestId('ferris-stage').dataset.targets || '')
    .split(';')
    .filter(Boolean)
    .map((p) => p.split(',').map(Number));

describe('FerrisGame', () => {
  it('FEU-01 ride three times, tap the Pokemon on the list (a hint, a wrong tap); the result pays once', async () => {
    const onGold = vi.fn();
    render(<FerrisGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(9)} />);
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    const stage = screen.getByTestId('ferris-stage');
    expect(screen.getAllByTestId('ferris-target')).toHaveLength(5);
    let wrongDone = false;
    let hinted = false;
    let lastTap = 0;
    for (let t = 0; t < 200000 && dialog().dataset.phase === 'play'; t += 100) {
      if (dialog().dataset.stage === 'ride') {
        if (!wrongDone) {
          wrongDone = true;
          fireEvent.pointerDown(stage, { clientX: 350, clientY: 10 });
          expect(Number(dialog().dataset.wrong)).toBe(1);
        }
        if (!hinted && Number(dialog().dataset.ride) === 2) {
          hinted = true;
          const before = Number(dialog().dataset.score);
          fireEvent.click(screen.getByTestId('ferris-hint'));
          expect(Number(dialog().dataset.score)).toBe(before - 20);
          expect(screen.getByTestId('ferris-hint')).toBeDisabled();
        }
        // Tap a visible target now and then (a child needs a moment to spot one)
        const vis = targets().filter(([, y]) => y > 30 && y < 530);
        if (vis.length && t - lastTap >= 1200) {
          lastTap = t;
          const found = Number(dialog().dataset.found);
          fireEvent.pointerDown(stage, { clientX: vis[0][0], clientY: vis[0][1] });
          expect(Number(dialog().dataset.found)).toBe(found + 1);
        }
      }
      await advance(100, 100);
    }
    expect(Number(dialog().dataset.found)).toBeGreaterThanOrEqual(13);
    expect(screen.getAllByTestId('ferris-target').filter((el) => el.dataset.found === 'yes').length).toBeGreaterThan(0);
    await advance(1000);
    expect(dialog().dataset.phase).toBe('done');
    const result = screen.getByTestId('carnival-result');
    expect(Number(result.dataset.stars)).toBeGreaterThanOrEqual(2);
    expect(onGold).toHaveBeenCalledTimes(1);
  }, 120000);
});
