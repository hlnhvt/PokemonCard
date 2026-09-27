import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GhostHouseGame } from './GhostHouseGame';
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

async function advance(ms, step = 100) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}
const dialog = () => screen.getByRole('dialog');

describe('GhostHouseGame', () => {
  it('GHU-01 shine the light on the eyes, tap the ghosts, a friend costs points; after 45 s the result pays once', async () => {
    const onGold = vi.fn();
    render(<GhostHouseGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(5)} />);
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    const stage = screen.getByTestId('ghost-stage');
    let darkTap = false;
    let friendTapped = false;
    for (let t = 0; t < 50000 && dialog().dataset.phase === 'play'; t += 100) {
      const targets = JSON.parse(stage.dataset.targets).filter((g) => g.k > 0.5);
      const lit = targets.find((g) => g.lit && !g.friend);
      const friend = targets.find((g) => g.lit && g.friend);
      const dark = targets.find((g) => !g.lit);
      if (friend && !friendTapped) {
        // Tap a friend once: it costs points
        const before = Number(dialog().dataset.score);
        fireEvent.pointerDown(stage, { clientX: friend.x, clientY: friend.y });
        friendTapped = true;
        expect(Number(dialog().dataset.friends)).toBe(1);
        expect(Number(dialog().dataset.score)).toBeLessThanOrEqual(before);
      } else if (lit) {
        fireEvent.pointerDown(stage, { clientX: lit.x, clientY: lit.y });
      } else if (dark) {
        if (!darkTap) {
          // Tapping in the dark only points the light
          const before = Number(dialog().dataset.catches);
          fireEvent.pointerDown(stage, { clientX: dark.x, clientY: dark.y });
          expect(Number(dialog().dataset.catches)).toBe(before);
          darkTap = true;
        } else fireEvent.pointerMove(stage, { clientX: dark.x, clientY: dark.y });
      }
      await advance(100);
    }
    expect(darkTap).toBe(true);
    expect(friendTapped).toBe(true);
    expect(Number(dialog().dataset.catches)).toBeGreaterThan(15);
    await advance(1200);
    expect(dialog().dataset.phase).toBe('done');
    expect(screen.getByTestId('carnival-result')).toBeInTheDocument();
    expect(Number(screen.getByTestId('carnival-result').dataset.stars)).toBeGreaterThanOrEqual(2);
    expect(onGold).toHaveBeenCalledTimes(1);
  }, 90000);
});
