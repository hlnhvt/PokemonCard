import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ClawGame } from './ClawGame';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Electric'] };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
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

describe('ClawGame', () => {
  it('CLU-01 move the claw, press GẮP! six times, win plush onto the shelf, then the result pays once', async () => {
    const onGold = vi.fn();
    render(<ClawGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(4)} />);
    expect(dialog().dataset.phase).toBe('ready');
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    expect(dialog().dataset.tries).toBe('6');
    // Hold the right arrow a moment
    const right = screen.getByLabelText('Sang phải');
    fireEvent.pointerDown(right);
    await advance(600);
    fireEvent.pointerUp(right);
    // Drag the claw over the pile, then keep dropping it at different spots
    const stage = screen.getByTestId('claw-stage');
    const spots = [128, 174, 220, 266, 312, 197];
    for (let i = 0; i < 6; i++) {
      fireEvent.pointerDown(stage, { clientX: spots[i], clientY: 300 });
      fireEvent.pointerUp(stage);
      await advance(900);
      fireEvent.click(screen.getByTestId('claw-grab'));
      expect(dialog().dataset.tries).toBe(String(5 - i));
      expect(screen.getByTestId('claw-grab')).toBeDisabled();
      for (let t = 0; t < 15000 && dialog().dataset.claw !== 'idle'; t += 200) await advance(200);
      expect(dialog().dataset.claw).toBe('idle');
    }
    await advance(3000);
    expect(dialog().dataset.phase).toBe('done');
    expect(Number(dialog().dataset.prizes)).toBeGreaterThan(0);
    expect(Number(dialog().dataset.score)).toBeGreaterThan(0);
    expect(screen.getByTestId('claw-shelf').querySelectorAll('img').length).toBe(Number(dialog().dataset.prizes));
    expect(screen.getByTestId('carnival-result')).toBeInTheDocument();
    expect(onGold).toHaveBeenCalledTimes(1);
    // Replay starts a fresh machine
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(dialog().dataset.tries).toBe('6');
  }, 60000);
});
