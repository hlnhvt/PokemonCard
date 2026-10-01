import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { sounds } from '../../../utils/soundEffects';
import { seeded } from '../../../test/seeded';
import { FLIPPER } from '../../../utils/three3d/pinball3d';

const scene = vi.hoisted(() => ({ fail: false, created: 0, disposed: 0, fx: [], last: null }));
vi.mock('./Pinball3DScene', () => ({
  createPinball3DScene: vi.fn(() => {
    if (scene.fail) throw new Error('no WebGL');
    scene.created += 1;
    return {
      update: (s) => {
        scene.last = s;
      },
      fx: (e) => scene.fx.push(e.type),
      resize: () => {},
      info: () => ({}),
      dispose: () => {
        scene.disposed += 1;
      },
    };
  }),
}));

const { Pinball3DGame } = await import('./Pinball3DGame');

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Electric'] };
const KEY = 'pokescan_pinball3d_v1';

beforeEach(() => {
  localStorage.removeItem(KEY);
  scene.fail = false;
  scene.created = 0;
  scene.disposed = 0;
  scene.fx = [];
  scene.last = null;
  vi.useFakeTimers();
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playOops', 'playNote', 'playScanBeep', 'playEnergySurge', 'playMunch']) vi.spyOn(sounds, s).mockImplementation(() => {});
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

describe('Pinball3DGame', () => {
  it('PIN-UI-01 menu → play → launch each ball with "Bắn!" and let it drain → result with 1 star, gold paid once, best score saved', async () => {
    const onGold = vi.fn();
    render(<Pinball3DGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} />);
    expect(dialog().dataset.phase).toBe('menu');
    expect(scene.created).toBe(1);
    expect(screen.getByTestId('pinball3d-menu')).toHaveTextContent('Pinball Pokémon');
    fireEvent.click(screen.getByTestId('pinball3d-start'));
    expect(dialog().dataset.phase).toBe('play');
    await advance(300);
    expect(scene.last?.status).toBe('play');
    expect(screen.getByTestId('pinball3d-balls')).toHaveAttribute('aria-label', 'Bóng 1/3');
    let shots = 0;
    for (let t = 0; t < 400000 && dialog().dataset.phase === 'play'; t += 500) {
      const btn = screen.queryByTestId('pinball3d-shoot');
      if (btn) {
        fireEvent.click(btn);
        shots += 1;
      }
      await advance(500, 50);
    }
    expect(shots).toBeGreaterThanOrEqual(3);
    expect(dialog().dataset.phase).toBe('over');
    expect(scene.fx).toContain('launch');
    expect(scene.fx).toContain('drain');
    await advance(1000);
    const res = screen.getByTestId('pinball3d-result');
    expect(res.dataset.stars).toBe('1');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(5);
    expect(screen.getByTestId('gold-reward')).toHaveTextContent('+5');
    expect(sounds.playSuccessFanfare).toHaveBeenCalled();
    const saved = JSON.parse(localStorage.getItem(KEY));
    expect(saved.best).toBeGreaterThan(0);
    expect(saved.games).toBe(1);
    expect(screen.getByText('🏆 Kỷ lục mới!')).toBeInTheDocument();
    await advance(2000);
    expect(onGold).toHaveBeenCalledTimes(1);
    // Replay starts a fresh game on the same table
    fireEvent.click(screen.getByTestId('pinball3d-replay'));
    expect(dialog().dataset.phase).toBe('play');
    await advance(200);
    expect(scene.last.score).toBe(0);
    expect(scene.created).toBe(1);
  }, 120000);

  it('PIN-UI-02 left / right halves hold the flippers; the plunger is pulled down and released', async () => {
    render(<Pinball3DGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(4)} />);
    fireEvent.click(screen.getByTestId('pinball3d-start'));
    await advance(200);
    const left = screen.getByTestId('pinball3d-zone-left');
    fireEvent.pointerDown(left, { pointerId: 1 });
    await advance(200);
    expect(scene.last.flippers[0].a).toBeCloseTo(FLIPPER.up, 3);
    expect(scene.last.flippers[1].a).toBeCloseTo(FLIPPER.rest, 3);
    expect(sounds.playNote).toHaveBeenCalled();
    // A second finger on the right half at the same time
    fireEvent.pointerDown(screen.getByTestId('pinball3d-zone-right'), { pointerId: 2 });
    await advance(200);
    expect(scene.last.flippers[1].a).toBeCloseTo(FLIPPER.up, 3);
    fireEvent.pointerUp(left, { pointerId: 1 });
    fireEvent.pointerUp(screen.getByTestId('pinball3d-zone-right'), { pointerId: 2 });
    await advance(300);
    expect(scene.last.flippers[0].a).toBeCloseTo(FLIPPER.rest, 3);
    // Plunger: drag down = more power, let go = shoot
    const pull = screen.getByTestId('pinball3d-pull');
    fireEvent.pointerDown(pull, { pointerId: 3, clientY: 100 });
    fireEvent.pointerMove(pull, { pointerId: 3, clientY: 145 });
    expect(scene.last.pull).toBeCloseTo(0.5, 1);
    fireEvent.pointerMove(pull, { pointerId: 3, clientY: 400 });
    expect(scene.last.pull).toBe(1);
    fireEvent.pointerUp(pull, { pointerId: 3, clientY: 400 });
    await advance(300);
    expect(scene.fx).toContain('launch');
    expect(sounds.playWhoosh).toHaveBeenCalled();
    expect(screen.queryByTestId('pinball3d-pull')).toBeNull();
    expect(scene.last.balls[0].y).toBeGreaterThan(3);
  });

  it('PIN-UI-03 keyboard: Z / M flip, Space held pulls the plunger and shoots on release, Escape closes', async () => {
    const onClose = vi.fn();
    render(<Pinball3DGame player={PLAYER} onClose={onClose} onGold={vi.fn()} random={seeded(5)} />);
    fireEvent.click(screen.getByTestId('pinball3d-start'));
    await advance(200);
    fireEvent.keyDown(window, { key: 'z' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await advance(200);
    expect(scene.last.flippers.map((f) => f.held)).toEqual([true, true]);
    fireEvent.keyUp(window, { key: 'z' });
    fireEvent.keyUp(window, { key: 'ArrowRight' });
    await advance(100);
    expect(scene.last.flippers.map((f) => f.held)).toEqual([false, false]);
    fireEvent.keyDown(window, { key: ' ' });
    await advance(500);
    expect(scene.last.pull).toBeGreaterThan(0.3);
    fireEvent.keyUp(window, { key: ' ' });
    await advance(400);
    expect(scene.fx).toContain('launch');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('PIN-UI-04 when WebGL is unavailable a friendly message shows with a close button', async () => {
    scene.fail = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onClose = vi.fn();
    render(<Pinball3DGame player={PLAYER} onClose={onClose} onGold={vi.fn()} random={seeded(1)} />);
    await advance(100);
    expect(dialog().dataset.phase).toBe('nogl');
    expect(screen.getByTestId('pinball3d-nogl')).toHaveTextContent('chưa vẽ được bàn pinball 3D');
    fireEvent.click(screen.getByText('Đóng'));
    expect(onClose).toHaveBeenCalled();
  });

  it('PIN-UI-05 the bot plays (autoplay): the score climbs and the HUD shows it', async () => {
    render(<Pinball3DGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(6)} autoplay />);
    fireEvent.click(screen.getByTestId('pinball3d-start'));
    await advance(20000, 100);
    expect(Number(dialog().dataset.score)).toBeGreaterThan(0);
    expect(screen.getByTestId('pinball3d-score')).toHaveTextContent(/\d/);
    expect(scene.fx).toContain('flip');
  }, 60000);
});
