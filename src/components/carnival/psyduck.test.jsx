import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PsyduckGame } from './PsyduckGame';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Squirtle', image: 'squirtle.png', types: ['Water'] };

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

describe('PsyduckGame', () => {
  it('PDU-01 counts down, taps shoot water balls for 40 seconds, then the result pays gold once', async () => {
    const onGold = vi.fn();
    render(<PsyduckGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(8)} />);
    expect(screen.getByTestId('carnival-countdown')).toBeInTheDocument();
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    expect(screen.getByTestId('psyduck-hint')).toHaveTextContent('Chạm để bắn');
    const stage = screen.getByTestId('psyduck-stage');
    // Sweep taps across the three rows of targets
    const rows = [148, 262, 378];
    let i = 0;
    for (let t = 0; t < 44000 && !screen.queryByTestId('carnival-result'); t += 300) {
      fireEvent.pointerMove(stage, { clientX: 40 + ((i * 47) % 280), clientY: rows[i % 3], pointerType: 'mouse' });
      fireEvent.pointerDown(stage, { clientX: 40 + ((i * 47) % 280), clientY: rows[i % 3], pointerId: 1 });
      i++;
      await advance(300);
    }
    await advance(1200);
    expect(screen.getByTestId('carnival-result')).toBeInTheDocument();
    expect(Number(dialog().dataset.hits)).toBeGreaterThan(0);
    expect(Number(dialog().dataset.score)).toBeGreaterThan(0);
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(sounds.playWhoosh).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(dialog().dataset.score).toBe('0');
  }, 60000);
});
