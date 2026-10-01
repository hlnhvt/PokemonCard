import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { sounds } from '../../../utils/soundEffects';
import { seeded } from '../../../test/seeded';
import { PLANE3D_KEY, loadProgress, starsOf, levelUnlocked } from '../../../utils/three3d/plane3d/store';

const sceneMock = vi.hoisted(() => ({ update: vi.fn(), dispose: vi.fn(), resize: vi.fn(), setLevel: vi.fn(), setLivery: vi.fn() }));
vi.mock('./Plane3DScene', () => ({
  createPlane3DScene: vi.fn(() => sceneMock),
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { createPlane3DScene } from './Plane3DScene';
import { Plane3DGame } from './Plane3DGame';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Electric'] };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  createPlane3DScene.mockImplementation(() => sceneMock);
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playScanBeep', 'playOops', 'playNote', 'playEnergySurge']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
});

async function advance(ms, stepMs = 100) {
  for (let t = 0; t < ms; t += stepMs) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(stepMs);
    });
  }
}
const dialog = () => screen.getByRole('dialog');
const swipe = (dx) => {
  const stage = screen.getByTestId('plane3d-stage');
  fireEvent.pointerDown(stage, { pointerId: 1, clientX: 200, clientY: 400 });
  fireEvent.pointerMove(stage, { pointerId: 1, clientX: 200 + dx, clientY: 404 });
  fireEvent.pointerUp(stage, { pointerId: 1, clientX: 200 + dx, clientY: 404 });
};

describe('Plane3DGame', () => {
  it('PLN-U01 menu (livery + difficulty saved) → map → level 1 → countdown → swipes change lane', async () => {
    render(<Plane3DGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(4)} />);
    expect(dialog()).toHaveAttribute('aria-label', 'Đua máy bay Pokémon');
    expect(dialog().dataset.phase).toBe('menu');
    fireEvent.click(screen.getByTestId('plane3d-livery-gengar'));
    fireEvent.click(screen.getByTestId('plane3d-diff-normal'));
    expect(JSON.parse(localStorage.getItem(PLANE3D_KEY))).toEqual({ livery: 'gengar', diff: 'normal' });
    expect(sceneMock.setLivery).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('plane3d-start'));
    expect(dialog().dataset.phase).toBe('map');
    expect(screen.getByTestId('plane3d-level-2')).toBeDisabled();
    fireEvent.click(screen.getByTestId('plane3d-level-1'));
    expect(dialog().dataset.phase).toBe('count');
    expect(sceneMock.setLevel).toHaveBeenCalledWith(0, expect.objectContaining({ level: 0, diff: 'normal' }));
    await advance(2800);
    expect(dialog().dataset.phase).toBe('play');
    swipe(-60);
    await advance(100);
    expect(dialog().dataset.lane).toBe('-1');
    swipe(70);
    swipe(70);
    await advance(100);
    expect(dialog().dataset.lane).toBe('1');
    // tap on the left half also moves left; keyboard works too
    const stage = screen.getByTestId('plane3d-stage');
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800 });
    fireEvent.pointerDown(stage, { pointerId: 3, clientX: 60, clientY: 300 });
    fireEvent.pointerUp(stage, { pointerId: 3, clientX: 60, clientY: 300 });
    await advance(100);
    expect(dialog().dataset.lane).toBe('0');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await advance(100);
    expect(dialog().dataset.lane).toBe('-1');
    fireEvent.keyDown(window, { key: 'd' });
    await advance(1000);
    expect(dialog().dataset.lane).toBe('0');
    expect(Number(dialog().dataset.progress)).toBeGreaterThan(0);
    expect(screen.getByTestId('plane3d-progress')).toBeInTheDocument();
    expect(sceneMock.update).toHaveBeenCalled();
  });

  it('PLN-U02 autopilot flies level 1 to the finish: result with stars, gold once, progress saved, level 2 unlocked', async () => {
    const onGold = vi.fn();
    render(<Plane3DGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} autopilot />);
    fireEvent.click(screen.getByTestId('plane3d-start'));
    fireEvent.click(screen.getByTestId('plane3d-level-1'));
    await advance(2800);
    expect(dialog().dataset.phase).toBe('play');
    let t = 0;
    while (!screen.queryByTestId('plane3d-result') && t < 60000) {
      await advance(500);
      t += 500;
    }
    const result = screen.getByTestId('plane3d-result');
    expect(t).toBeGreaterThanOrEqual(30000); // a level lasts at least 30 s
    const stars = Number(result.dataset.stars);
    expect(stars).toBeGreaterThanOrEqual(2);
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold.mock.calls[0][0]).toBeGreaterThan(0);
    const progress = loadProgress();
    expect(starsOf(progress, 'L1', 'easy')).toBe(stars);
    expect(levelUnlocked(progress, 1)).toBe(true);
    await advance(2000);
    expect(onGold).toHaveBeenCalledTimes(1);
    // next level button, then back to the map: level 2 is open
    expect(screen.getByTestId('plane3d-next')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('plane3d-map'));
    expect(dialog().dataset.phase).toBe('map');
    expect(screen.getByTestId('plane3d-level-2')).not.toBeDisabled();
  }, 60000);

  it('PLN-U03 never moving on Khó: hearts run out, "Hồi sinh" offer times out, failed result pays no gold', async () => {
    localStorage.setItem(PLANE3D_KEY, JSON.stringify({ livery: 'pika', diff: 'hard' }));
    const onGold = vi.fn();
    render(<Plane3DGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(9)} />);
    fireEvent.click(screen.getByTestId('plane3d-start'));
    fireEvent.click(screen.getByTestId('plane3d-level-1'));
    await advance(2800);
    let t = 0;
    while (dialog().dataset.pending !== 'offer' && t < 40000) {
      await advance(200);
      t += 200;
    }
    expect(screen.getByTestId('plane3d-offer')).toBeInTheDocument();
    expect(dialog().dataset.hearts).toBe('0');
    fireEvent.click(screen.getByTestId('plane3d-continue'));
    await advance(200);
    expect(dialog().dataset.hearts).toBe('1');
    t = 0;
    while (!screen.queryByTestId('plane3d-result') && t < 40000) {
      expect(screen.queryByTestId('plane3d-offer')).toBeNull(); // only one continue per level
      await advance(200);
      t += 200;
    }
    expect(screen.getByTestId('plane3d-result').dataset.stars).toBe('0');
    expect(screen.getByText('Thử lại nhé!')).toBeInTheDocument();
    expect(onGold).not.toHaveBeenCalled();
    expect(levelUnlocked(loadProgress(), 1)).toBe(false);
  }, 60000);

  it('PLN-U04 a friendly message (no crash) when WebGL is missing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createPlane3DScene.mockImplementation(() => {
      throw new Error('WebGL not supported');
    });
    const onClose = vi.fn();
    render(<Plane3DGame player={PLAYER} onClose={onClose} onGold={vi.fn()} random={seeded(1)} />);
    expect(screen.getByTestId('plane3d-nowebgl')).toHaveTextContent('chưa chạy được thế giới 3D');
    expect(screen.queryByTestId('plane3d-start')).toBeNull();
    fireEvent.click(screen.getByText('Đóng'));
    expect(onClose).toHaveBeenCalled();
  });

  it('PLN-U05 the scene is disposed on unmount', () => {
    const { unmount } = render(<Plane3DGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(1)} />);
    unmount();
    expect(sceneMock.dispose).toHaveBeenCalled();
  });
});
