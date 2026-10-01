import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { sounds } from '../../../utils/soundEffects';
import { seeded } from '../../../test/seeded';

const scene = vi.hoisted(() => ({ fail: false, created: 0, disposed: 0, fx: [] }));
vi.mock('./Sky3DScene', () => ({
  createSky3DScene: vi.fn(() => {
    if (scene.fail) throw new Error('no WebGL');
    scene.created += 1;
    return {
      update: () => ({ arrow: { x: 90, y: 50, angle: 0 }, glare: null }),
      fx: (e) => scene.fx.push(e.type),
      resize: () => {},
      dispose: () => {
        scene.disposed += 1;
      },
    };
  }),
}));

const { Sky3DGame } = await import('./Sky3DGame');

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Electric'] };
const KEY = 'pokescan_progress_v1';

beforeEach(() => {
  localStorage.removeItem(KEY);
  scene.fail = false;
  scene.created = 0;
  scene.disposed = 0;
  scene.fx = [];
  vi.useFakeTimers();
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playOops', 'playNote', 'playScanBeep', 'playEnergySurge']) vi.spyOn(sounds, s).mockImplementation(() => {});
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

async function takeOff() {
  fireEvent.click(screen.getByTestId('sky3d-start'));
  expect(dialog().dataset.phase).toBe('countdown');
  fireEvent.click(screen.getByTestId('carnival-countdown'));
  await advance(100);
  expect(dialog().dataset.phase).toBe('play');
}

describe('Sky3DGame', () => {
  it('SKY-UI-01 level map → level 1 → autopilot flies every ring: 3 stars, gold once, saved, level 2 opens', async () => {
    const onGold = vi.fn();
    render(<Sky3DGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} autopilot />);
    expect(dialog().dataset.phase).toBe('map');
    expect(screen.getByLabelText('Màn 2 (chưa mở)')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Màn 1'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(scene.created).toBe(1);
    expect(screen.getByTestId('sky3d-ready')).toHaveTextContent('Kéo ngón tay');
    await takeOff();
    for (let t = 0; t < 60000 && dialog().dataset.phase === 'play'; t += 500) await advance(500, 50);
    expect(dialog().dataset.phase).toBe('result');
    await advance(800);
    const res = screen.getByTestId('sky3d-result');
    expect(res.dataset.stars).toBe('3');
    expect(res).toHaveTextContent('8/8');
    expect(scene.fx).toContain('ring');
    expect(sounds.playNote).toHaveBeenCalled();
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(15);
    expect(screen.getByTestId('gold-reward')).toHaveTextContent('+15');
    await advance(2000);
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(KEY)).sky3d).toEqual({ 1: 3 });
    // Next level straight from the result card
    fireEvent.click(screen.getByTestId('sky3d-next'));
    expect(dialog().dataset.level).toBe('2');
    expect(scene.disposed).toBe(1);
    fireEvent.click(screen.getByLabelText('Về bản đồ màn'));
    expect(screen.getByLabelText('Màn 2')).not.toBeDisabled();
    expect(screen.getByLabelText('Màn 3 (chưa mở)')).toBeDisabled();
  }, 60000);

  it('SKY-UI-02 drag shows the joystick and steers; the boost button boosts; time runs out with no rings: no gold', async () => {
    const onGold = vi.fn();
    render(<Sky3DGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(4)} />);
    fireEvent.click(screen.getByLabelText('Màn 1'));
    await takeOff();
    const touch = screen.getByTestId('sky3d-touch');
    fireEvent.pointerDown(touch, { clientX: 100, clientY: 400, pointerId: 1 });
    expect(screen.getByTestId('sky3d-joystick').style.opacity).toBe('1');
    fireEvent.pointerMove(touch, { clientX: 160, clientY: 400, pointerId: 1 });
    fireEvent.pointerDown(screen.getByTestId('sky3d-boost'), { pointerId: 2 });
    await advance(600);
    expect(screen.queryByTestId('sky3d-speedlines')).toBeInTheDocument();
    expect(sounds.playEnergySurge).toHaveBeenCalled();
    fireEvent.pointerUp(screen.getByTestId('sky3d-boost'), { pointerId: 2 });
    // The off-screen arrow points to the next ring
    expect(screen.getByTestId('sky3d-arrow').style.display).toBe('block');
    // Keep circling: the first ring is missed
    for (let t = 0; t < 120000 && dialog().dataset.phase === 'play'; t += 1000) await advance(1000, 50);
    fireEvent.pointerUp(touch, { pointerId: 1 });
    expect(screen.getByTestId('sky3d-joystick').style.opacity).toBe('0');
    await advance(800);
    expect(screen.getByTestId('sky3d-result').dataset.stars).toBe('0');
    expect(screen.getByText('Hết giờ rồi!')).toBeInTheDocument();
    expect(onGold).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBeNull();
    // Replay builds a fresh world
    fireEvent.click(screen.getByTestId('sky3d-replay'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(scene.created).toBe(2);
  }, 60000);

  it('SKY-UI-03 when WebGL is unavailable a friendly message shows with a close button', async () => {
    scene.fail = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onClose = vi.fn();
    render(<Sky3DGame player={PLAYER} onClose={onClose} onGold={vi.fn()} random={seeded(1)} />);
    fireEvent.click(screen.getByLabelText('Màn 1'));
    await advance(100);
    expect(dialog().dataset.phase).toBe('nogl');
    expect(screen.getByTestId('sky3d-nogl')).toHaveTextContent('chưa vẽ được thế giới 3D');
    fireEvent.click(screen.getByText('Đóng'));
    expect(onClose).toHaveBeenCalled();
  });

  it('SKY-UI-04 keyboard arrows steer and Escape closes', async () => {
    const onClose = vi.fn();
    render(<Sky3DGame player={{ name: 'Charizard', image: 'charizard.png' }} onClose={onClose} onGold={vi.fn()} random={seeded(2)} />);
    fireEvent.click(screen.getByLabelText('Màn 1'));
    await takeOff();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: ' ' });
    await advance(500);
    expect(screen.queryByTestId('sky3d-speedlines')).toBeInTheDocument();
    fireEvent.keyUp(window, { key: ' ' });
    fireEvent.keyUp(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
