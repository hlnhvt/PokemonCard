import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TrampolineGame } from './TrampolineGame';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Electric'] };

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

describe('TrampolineGame', () => {
  it('TRU-01 tap on the mat to bounce higher, swipe for tricks in the air; after 60 s the result pays once', async () => {
    const onGold = vi.fn();
    render(<TrampolineGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} />);
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    const stage = screen.getByTestId('trampoline-stage');
    let tapped = false;
    let sawPerfect = false;
    let sawHint = false;
    const dirs = [
      [70, 0],
      [-70, 0],
      [0, -70],
    ];
    let k = 0;
    for (let i = 0; i < 2400 && dialog().dataset.phase === 'play'; i++) {
      const d = dialog().dataset;
      if (d.air === 'contact') {
        if (!tapped && Number(d.contact) >= 0.12) {
          tapped = true;
          fireEvent.pointerDown(stage, { pointerId: 1, clientX: 170, clientY: 400 });
          fireEvent.pointerUp(stage, { pointerId: 1 });
          const b = screen.queryByTestId('trampoline-banner');
          if (b?.dataset.quality === 'perfect') sawPerfect = true;
        }
      } else {
        tapped = false;
        if (screen.queryByTestId('trampoline-swipe-hint')) sawHint = true;
        // Swipe when there is time for the trick before landing
        if (d.trick === '' && Number(d.ttl) > 0.9 && Number(d.apex) > 8) {
          const [dx, dy] = dirs[k++ % 3];
          fireEvent.pointerDown(stage, { pointerId: 2, clientX: 180, clientY: 300 });
          fireEvent.pointerMove(stage, { pointerId: 2, clientX: 180 + dx / 2, clientY: 300 + dy / 2 });
          fireEvent.pointerMove(stage, { pointerId: 2, clientX: 180 + dx, clientY: 300 + dy });
          fireEvent.pointerUp(stage, { pointerId: 2 });
          expect(dialog().dataset.trick).not.toBe('');
        }
      }
      await advance(32, 32);
    }
    const d = dialog().dataset;
    expect(sawHint).toBe(true);
    expect(Number(d.perfects)).toBeGreaterThan(5);
    expect(sawPerfect || Number(d.perfects) > 5).toBe(true);
    expect(Number(d.tricks)).toBeGreaterThan(5);
    expect(Number(d.best)).toBeGreaterThan(20);
    await advance(1500);
    expect(dialog().dataset.phase).toBe('done');
    const result = screen.getByTestId('carnival-result');
    expect(Number(result.dataset.stars)).toBeGreaterThanOrEqual(2);
    expect(onGold).toHaveBeenCalledTimes(1);
  }, 120000);
});
