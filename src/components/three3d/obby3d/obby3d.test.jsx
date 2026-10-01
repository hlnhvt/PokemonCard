import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { sounds } from '../../../utils/soundEffects';
import { seeded } from '../../../test/seeded';

const scene = vi.hoisted(() => ({ fail: false, created: 0, disposed: 0, fx: [], updates: 0 }));
vi.mock('./Obby3DScene', () => ({
  createObby3DScene: vi.fn(() => {
    if (scene.fail) throw new Error('no WebGL');
    scene.created += 1;
    return {
      update: () => {
        scene.updates += 1;
      },
      fx: (e) => scene.fx.push(e.type),
      resize: () => {},
      dispose: () => {
        scene.disposed += 1;
      },
    };
  }),
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const { Obby3DGame } = await import('./Obby3DGame');

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Electric'] };
const KEY = 'pokescan_progress_v1';

beforeEach(() => {
  localStorage.removeItem(KEY);
  Object.assign(scene, { fail: false, created: 0, disposed: 0, fx: [], updates: 0 });
  vi.useFakeTimers();
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playOops', 'playNote', 'playScanBeep', 'playEnergySurge']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function advance(ms, stepMs = 100) {
  for (let t = 0; t < ms; t += stepMs) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(stepMs);
    });
  }
}
const dialog = () => screen.getByRole('dialog');

async function go() {
  fireEvent.click(screen.getByTestId('obby3d-start'));
  expect(dialog().dataset.phase).toBe('countdown');
  fireEvent.click(screen.getByTestId('carnival-countdown'));
  await advance(100);
  expect(dialog().dataset.phase).toBe('play');
}

describe('Obby3DGame', () => {
  it('OBY-UI-01 course map → course 1 → autopilot races to the finish: medal, stars saved, gold once, course 2 opens', async () => {
    const onGold = vi.fn();
    render(<Obby3DGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} autopilot />);
    expect(dialog().dataset.phase).toBe('map');
    expect(screen.getByLabelText('Đường đua 2 (chưa mở)')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Đường đua 1: Đồi kẹo ngọt'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(scene.created).toBe(1);
    expect(screen.getByTestId('obby3d-ready')).toHaveTextContent('Kéo bên trái để chạy');
    // nine opponents are introduced
    expect(screen.getByLabelText('Các bạn đua').querySelectorAll('img')).toHaveLength(9);
    await go();
    for (let t = 0; t < 120000 && dialog().dataset.phase !== 'result'; t += 1000) await advance(1000, 50);
    expect(dialog().dataset.phase).toBe('result');
    const res = screen.getByTestId('obby3d-result');
    const place = Number(res.dataset.place);
    expect(place).toBeGreaterThanOrEqual(1);
    expect(place).toBeLessThanOrEqual(3);
    expect(res.dataset.stars).toBe('3');
    expect(screen.getByTestId('obby3d-podium')).toBeInTheDocument();
    expect(scene.fx).toContain('finish');
    expect(scene.fx).toContain('checkpoint');
    expect(sounds.playSuccessFanfare).toHaveBeenCalled();
    expect(onGold).toHaveBeenCalledTimes(1);
    const gold = onGold.mock.calls[0][0];
    expect(gold).toBeGreaterThanOrEqual(15);
    expect(screen.getByTestId('gold-reward')).toHaveTextContent(`+${gold}`);
    await advance(2000);
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(KEY)).obby3d).toEqual({ 1: 3 });
    // Next course straight from the result card
    fireEvent.click(screen.getByTestId('obby3d-next'));
    expect(dialog().dataset.course).toBe('2');
    expect(scene.disposed).toBe(1);
    fireEvent.click(screen.getByLabelText('Về bản đồ đường đua'));
    expect(screen.getByLabelText('Đường đua 2: Lâu đài Diglett')).not.toBeDisabled();
    expect(screen.getByLabelText('Đường đua 3 (chưa mở)')).toBeDisabled();
  }, 120000);

  it('OBY-UI-02 joystick on the left half runs, the jump and dive buttons work, the HUD shows place and flags', async () => {
    render(<Obby3DGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(4)} />);
    fireEvent.click(screen.getByTestId('obby3d-course-1'));
    await go();
    const touch = screen.getByTestId('obby3d-touch');
    fireEvent.pointerDown(touch, { clientX: 80, clientY: 600, pointerId: 1 });
    expect(screen.getByTestId('obby3d-joystick').style.opacity).toBe('1');
    fireEvent.pointerMove(touch, { clientX: 80, clientY: 520, pointerId: 1 }); // push up = run forward
    await advance(1500);
    fireEvent.pointerDown(screen.getByTestId('obby3d-jump'), { pointerId: 2 });
    await advance(100);
    fireEvent.pointerUp(screen.getByTestId('obby3d-jump'), { pointerId: 2 });
    expect(sounds.playNote).toHaveBeenCalled(); // the jump boop
    expect(scene.fx).toContain('jump');
    await advance(800);
    fireEvent.pointerDown(screen.getByTestId('obby3d-dive'), { pointerId: 3 });
    await advance(100);
    fireEvent.pointerUp(screen.getByTestId('obby3d-dive'), { pointerId: 3 });
    expect(scene.fx).toContain('dive');
    expect(sounds.playWhoosh).toHaveBeenCalled();
    fireEvent.pointerUp(touch, { pointerId: 1 });
    expect(screen.getByTestId('obby3d-joystick').style.opacity).toBe('0.35');
    expect(screen.getByTestId('obby3d-place')).toHaveTextContent(/Hạng \d+\/10/);
    expect(screen.getByTestId('obby3d-flags')).toHaveTextContent('/5');
    expect(screen.getByTestId('obby3d-time')).toHaveTextContent('0:0');
    expect(scene.updates).toBeGreaterThan(10);
  }, 30000);

  it('OBY-UI-03 when WebGL is unavailable a friendly message shows with a close button', async () => {
    scene.fail = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onClose = vi.fn();
    render(<Obby3DGame player={PLAYER} onClose={onClose} onGold={vi.fn()} random={seeded(1)} />);
    fireEvent.click(screen.getByTestId('obby3d-course-1'));
    await advance(100);
    expect(dialog().dataset.phase).toBe('nogl');
    expect(screen.getByTestId('obby3d-nogl')).toHaveTextContent('chưa vẽ được thế giới 3D');
    fireEvent.click(screen.getByText('Đóng'));
    expect(onClose).toHaveBeenCalled();
  });

  it('OBY-UI-04 keyboard: arrows run, Space jumps, Shift dives, Escape closes', async () => {
    const onClose = vi.fn();
    render(<Obby3DGame player={{ name: 'Mewtwo', image: 'mewtwo.png', types: ['Psychic'] }} onClose={onClose} onGold={vi.fn()} random={seeded(2)} />);
    fireEvent.click(screen.getByTestId('obby3d-course-1'));
    await go();
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    await advance(600);
    fireEvent.keyDown(window, { key: ' ' });
    await advance(100);
    fireEvent.keyUp(window, { key: ' ' });
    expect(scene.fx).toContain('jump');
    await advance(300);
    fireEvent.keyDown(window, { key: 'Shift' });
    await advance(100);
    fireEvent.keyUp(window, { key: 'Shift' });
    expect(scene.fx).toContain('dive');
    fireEvent.keyUp(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
