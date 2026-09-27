import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WaterGunGame } from './WaterGunGame';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Bulbasaur', image: 'bulbasaur.png', types: ['Grass'] };

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

async function advance(ms, step = 50) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}
const dialog = () => screen.getByRole('dialog');

describe('WaterGunGame', () => {
  it('WGU-01 hold to spray, the balloon grows, 3 races with medals, then the result pays gold once', async () => {
    const onGold = vi.fn();
    render(<WaterGunGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} />);
    expect(screen.getByTestId('carnival-countdown')).toBeInTheDocument();
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    expect(screen.getByTestId('watergun-intro')).toHaveTextContent('Vòng 1');
    await advance(1600);
    expect(dialog().dataset.status).toBe('race');
    expect(screen.getByTestId('watergun-hint')).toHaveTextContent('Giữ');
    const stage = screen.getByTestId('watergun-stage');
    // Not holding: nothing grows
    await advance(500);
    expect(dialog().dataset.fill).toBe('0');
    // Hold and sweep left and right: sometimes on the target
    fireEvent.pointerDown(stage, { clientX: 180, clientY: 400, pointerId: 1 });
    let sawHit = false;
    let x = 180;
    let dir = 1;
    for (let i = 0; i < 1200 && dialog().dataset.phase === 'play'; i++) {
      x += dir * 12;
      if (x > 320 || x < 40) dir = -dir;
      if (dialog().dataset.status === 'race') {
        fireEvent.pointerDown(stage, { clientX: x, clientY: 400, pointerId: 1 });
        fireEvent.pointerMove(stage, { clientX: x, clientY: 400, pointerId: 1 });
      }
      await advance(50);
      if (dialog().dataset.hitting === 'yes') sawHit = true;
    }
    expect(sawHit).toBe(true);
    await advance(800);
    expect(dialog().dataset.phase).toBe('done');
    expect(dialog().dataset.places.split(',')).toHaveLength(3);
    expect(screen.getByTestId('carnival-result')).toBeInTheDocument();
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(sounds.playPop).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(dialog().dataset.race).toBe('1');
  }, 90000);

  it('WGU-02 the keyboard aims and Space sprays', async () => {
    render(<WaterGunGame player={PLAYER} onClose={vi.fn()} random={seeded(4)} />);
    await advance(2600 + 1600);
    fireEvent.keyDown(window, { key: ' ' });
    await advance(3000);
    expect(Number(dialog().dataset.fill)).toBeGreaterThan(0);
    fireEvent.keyUp(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await advance(300);
    fireEvent.keyUp(window, { key: 'ArrowLeft' });
  }, 30000);
});
