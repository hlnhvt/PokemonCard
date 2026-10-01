import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { sounds } from '../../../utils/soundEffects';
import { seeded } from '../../../test/seeded';
import { RUN3D_KEY } from '../../../utils/three3d/run3dStore';

const sceneMock = vi.hoisted(() => ({ update: vi.fn(), dispose: vi.fn(), resize: vi.fn() }));
vi.mock('./Run3DScene', () => ({
  createRun3DScene: vi.fn(() => sceneMock),
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { createRun3DScene } from './Run3DScene';
import { Run3DGame } from './Run3DGame';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Electric'] };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  createRun3DScene.mockImplementation(() => sceneMock);
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

async function startPlaying() {
  fireEvent.click(screen.getByTestId('run3d-start'));
  expect(dialog().dataset.phase).toBe('count');
  await advance(2800);
  expect(dialog().dataset.phase).toBe('play');
}

describe('Run3DGame', () => {
  it('RUN-U01 menu shows three missions, a 3-2-1 countdown, swipes and keys change lane / jump', async () => {
    render(<Run3DGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(4)} />);
    expect(dialog()).toHaveAttribute('aria-label', 'Pokémon Chạy 3 làn');
    expect(screen.getByText('Nhiệm vụ lần này')).toBeInTheDocument();
    expect(dialog().dataset.phase).toBe('menu');
    await startPlaying();
    expect(createRun3DScene).toHaveBeenCalledTimes(1);
    expect(sceneMock.update).toHaveBeenCalled();
    const stage = screen.getByTestId('run3d-stage');
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 200, clientY: 400 });
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 140, clientY: 404 });
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 140, clientY: 404 });
    await advance(100);
    expect(dialog().dataset.lane).toBe('-1');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'd' });
    await advance(100);
    expect(dialog().dataset.lane).toBe('1');
    fireEvent.pointerDown(stage, { pointerId: 2, clientX: 200, clientY: 400 });
    fireEvent.pointerMove(stage, { pointerId: 2, clientX: 202, clientY: 340 });
    expect(sounds.playNote).toHaveBeenCalled();
    await advance(1000);
    expect(Number(dialog().dataset.dist)).toBeGreaterThan(5);
  });

  it('RUN-U02 standing still: crash, one free "Tiếp tục!", crash again, result pays gold once and saves the best', async () => {
    const onGold = vi.fn();
    render(<Run3DGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(9)} />);
    await startPlaying();
    let t = 0;
    while (dialog().dataset.pending !== 'offer' && t < 40000) {
      await advance(200);
      t += 200;
    }
    expect(dialog().dataset.phase).toBe('crashed');
    expect(screen.getByTestId('run3d-offer')).toBeInTheDocument();
    const firstDist = Number(dialog().dataset.dist);
    fireEvent.click(screen.getByTestId('run3d-continue'));
    await advance(200);
    expect(dialog().dataset.phase).toBe('play');
    t = 0;
    while (!screen.queryByTestId('run3d-result') && t < 60000) {
      expect(screen.queryByTestId('run3d-offer')).toBeNull(); // only one continue per run
      await advance(200);
      t += 200;
    }
    const result = screen.getByTestId('run3d-result');
    expect(result).toBeInTheDocument();
    const dist = Number(screen.getByTestId('run3d-result-dist').textContent.replace(/\D/g, ''));
    expect(dist).toBeGreaterThan(firstDist);
    expect(onGold).toHaveBeenCalledTimes(1);
    const gold = onGold.mock.calls[0][0];
    expect(gold).toBeGreaterThanOrEqual(5);
    expect(gold).toBeLessThanOrEqual(40);
    expect(JSON.parse(localStorage.getItem(RUN3D_KEY)).best).toBe(dist);
    await advance(2000);
    expect(onGold).toHaveBeenCalledTimes(1);
    // Replay: back to the menu with fresh missions, the best is shown
    fireEvent.click(screen.getByTestId('run3d-replay'));
    expect(dialog().dataset.phase).toBe('menu');
    expect(screen.getByText(`Kỷ lục: ${dist} m`)).toBeInTheDocument();
  }, 60000);

  it('RUN-U03 the continue offer times out after 5 s', async () => {
    const onGold = vi.fn();
    render(<Run3DGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(2)} />);
    await startPlaying();
    let t = 0;
    while (dialog().dataset.pending !== 'offer' && t < 40000) {
      await advance(200);
      t += 200;
    }
    expect(screen.getByTestId('run3d-continue')).toHaveTextContent('5');
    await advance(3000);
    expect(screen.getByTestId('run3d-continue')).toHaveTextContent('2');
    await advance(4000);
    expect(screen.queryByTestId('run3d-offer')).toBeNull();
    expect(screen.getByTestId('run3d-result')).toBeInTheDocument();
    expect(onGold).toHaveBeenCalledTimes(1);
  }, 30000);

  it('RUN-U04 a friendly message (no crash) when WebGL is missing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createRun3DScene.mockImplementation(() => {
      throw new Error('WebGL not supported');
    });
    const onClose = vi.fn();
    render(<Run3DGame player={PLAYER} onClose={onClose} onGold={vi.fn()} random={seeded(1)} />);
    expect(screen.getByTestId('run3d-nowebgl')).toHaveTextContent('chưa chạy được thế giới 3D');
    expect(screen.queryByTestId('run3d-start')).toBeNull();
    fireEvent.click(screen.getByText('Đóng'));
    expect(onClose).toHaveBeenCalled();
  });

  it('RUN-U05 the scene is disposed on close / unmount', () => {
    const { unmount } = render(<Run3DGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(1)} />);
    unmount();
    expect(sceneMock.dispose).toHaveBeenCalled();
  });
});
