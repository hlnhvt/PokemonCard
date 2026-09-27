import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CottonCandyGame } from './CottonCandyGame';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';
import { DRUM, CUSTOMERS } from '../../utils/carnival/candy';

const PLAYER = { name: 'Jigglypuff', image: 'jiggly.png', types: ['Fairy'] };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  // The stage is shown at its logical size (360 x 460)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 460, right: 360, bottom: 460, x: 0, y: 0 });
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playScanBeep', 'playOops', 'playNote', 'playMunch']) vi.spyOn(sounds, s).mockImplementation(() => {});
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

/** Draw circles round the drum until the candy reaches `stop`. */
async function drawCircles(stage, stop) {
  let a = 0;
  const at = () => ({ clientX: DRUM.x + Math.cos(a) * 90, clientY: DRUM.y + Math.sin(a) * 80 });
  fireEvent.pointerDown(stage, { pointerId: 1, ...at() });
  for (let i = 0; i < 400 && Number(dialog().dataset.fluff) < stop; i++) {
    a += 0.35;
    fireEvent.pointerMove(stage, { pointerId: 1, ...at() });
    if (i % 6 === 0) await advance(16, 16);
  }
  fireEvent.pointerUp(stage, { pointerId: 1 });
}

describe('CottonCandyGame', () => {
  it('CAU-01 serve six customers: pick their sugar, draw circles to the size ring, "Xong"; the result pays once', async () => {
    const onGold = vi.fn();
    render(<CottonCandyGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(4)} />);
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    const stage = screen.getByTestId('candy-stage');
    const serveBtn = screen.getByTestId('candy-serve');
    let happy = 0;
    for (let c = 0; c < CUSTOMERS; c++) {
      for (let i = 0; i < 60 && dialog().dataset.stage !== 'make'; i++) await advance(50);
      expect(dialog().dataset.stage).toBe('make');
      expect(Number(dialog().dataset.customer)).toBe(c);
      expect(serveBtn).toBeDisabled();
      if (c === 0) {
        // No sugar yet: circles do nothing
        await drawCircles(stage, 0.2);
        expect(Number(dialog().dataset.fluff)).toBe(0);
      }
      const colors = dialog().dataset.order.split('+');
      for (const col of colors) fireEvent.click(screen.getByTestId(`candy-jar-${col}`));
      expect(screen.getByTestId(`candy-jar-${colors[0]}`)).toHaveAttribute('aria-pressed', 'true');
      const target = Number(dialog().dataset.target);
      await drawCircles(stage, target - 0.02);
      expect(Number(dialog().dataset.fluff)).toBeGreaterThan(target - 0.05);
      expect(serveBtn).not.toBeDisabled();
      fireEvent.click(serveBtn);
      expect(dialog().dataset.stage).toBe('react');
      await advance(1000);
      const r = screen.getByTestId('candy-react');
      if (r.dataset.mood === 'happy') happy++;
      await advance(1600);
    }
    expect(happy).toBe(CUSTOMERS);
    await advance(1500);
    expect(dialog().dataset.phase).toBe('done');
    const result = screen.getByTestId('carnival-result');
    expect(result.dataset.stars).toBe('3');
    expect(result).toHaveTextContent('6/6 khách vui');
    expect(onGold).toHaveBeenCalledTimes(1);
    await advance(500);
    expect(onGold).toHaveBeenCalledTimes(1);
  }, 60000);
});
