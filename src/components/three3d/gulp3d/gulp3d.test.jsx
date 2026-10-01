import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { sounds } from '../../../utils/soundEffects';
import { seeded } from '../../../test/seeded';

const scene = vi.hoisted(() => ({ fail: false, created: 0, disposed: 0, fx: [] }));
vi.mock('./Gulp3DScene', () => ({
  createGulp3DScene: vi.fn(() => {
    if (scene.fail) throw new Error('no WebGL');
    scene.created += 1;
    return {
      update: () => ({}),
      fx: (e) => scene.fx.push(e.type),
      project: () => ({ x: 50, y: 50, visible: true }),
      resize: () => {},
      dispose: () => {
        scene.disposed += 1;
      },
    };
  }),
}));

const { Gulp3DGame } = await import('./Gulp3DGame');

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Electric'] };
const PROGRESS = 'pokescan_progress_v1';
const BEST = 'pokescan_gulp3d_v1';

beforeEach(() => {
  localStorage.removeItem(PROGRESS);
  localStorage.removeItem(BEST);
  scene.fail = false;
  scene.created = 0;
  scene.disposed = 0;
  scene.fx = [];
  vi.useFakeTimers();
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playOops', 'playNote', 'playScanBeep', 'playMunch', 'playEnergySurge']) vi.spyOn(sounds, s).mockImplementation(() => {});
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

async function startRound() {
  fireEvent.click(screen.getByTestId('gulp3d-start'));
  expect(dialog().dataset.phase).toBe('countdown');
  fireEvent.click(screen.getByTestId('carnival-countdown'));
  await advance(100);
  expect(dialog().dataset.phase).toBe('play');
}

describe('Gulp3DGame', () => {
  it('GULP-UI-01 map 1 → autopilot eats the town for 2 minutes: Snorlax sleeps, 3 stars, gold once, saved, map 2 opens', async () => {
    const onGold = vi.fn();
    render(<Gulp3DGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} autopilot />);
    expect(dialog().dataset.phase).toBe('maps');
    expect(screen.getByLabelText('Thành phố Celadon (chưa mở)')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Thị trấn Pallet'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(scene.created).toBe(1);
    expect(screen.getByTestId('gulp3d-ready')).toHaveTextContent('Kéo ngón tay');
    await startRound();
    for (let t = 0; t < 200000 && dialog().dataset.phase === 'play'; t += 2000) await advance(2000, 50);
    expect(dialog().dataset.phase).toBe('sleep');
    expect(screen.getByTestId('gulp3d-sleep')).toHaveTextContent('Zzz');
    expect(onGold).toHaveBeenCalledTimes(1);
    await advance(2600);
    const res = screen.getByTestId('gulp3d-result');
    expect(res.dataset.stars).toBe('3');
    expect(res).toHaveTextContent('Nuốt cả thành phố!');
    expect(Number(dialog().dataset.percent)).toBeGreaterThan(70);
    expect(scene.fx).toEqual(expect.arrayContaining(['eat', 'levelup', 'finish']));
    expect(sounds.playMunch).toHaveBeenCalled();
    expect(onGold).toHaveBeenCalledWith(expect.any(Number));
    const gold = onGold.mock.calls[0][0];
    expect(gold).toBeGreaterThanOrEqual(5);
    expect(gold).toBeLessThanOrEqual(40);
    expect(screen.getByTestId('gold-reward')).toHaveTextContent(`+${gold}`);
    await advance(2000);
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(PROGRESS)).gulp3d).toEqual({ pallet: 3 });
    expect(JSON.parse(localStorage.getItem(BEST)).best.pallet).toBeGreaterThan(20000);
    // Next map straight from the result card
    fireEvent.click(screen.getByTestId('gulp3d-next'));
    expect(dialog().dataset.map).toBe('2');
    expect(scene.disposed).toBe(1);
    fireEvent.click(screen.getByLabelText('Về chọn bản đồ'));
    expect(screen.getByLabelText('Thành phố Celadon')).not.toBeDisabled();
    expect(screen.getByLabelText('Đảo nhiệt đới (chưa mở)')).toBeDisabled();
  }, 120000);

  it('GULP-UI-02 drag shows the joystick ring and walks Snorlax; a round with no snacks gives no gold', async () => {
    const onGold = vi.fn();
    render(<Gulp3DGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(4)} roundTime={6} />);
    fireEvent.click(screen.getByLabelText('Thị trấn Pallet'));
    await startRound();
    const touch = screen.getByTestId('gulp3d-touch');
    fireEvent.pointerDown(touch, { clientX: 100, clientY: 400, pointerId: 1 });
    expect(screen.getByTestId('gulp3d-joystick').style.opacity).toBe('1');
    fireEvent.pointerMove(touch, { clientX: 100, clientY: 460, pointerId: 1 });
    await advance(1500, 50);
    expect(Number(dialog().dataset.score)).toBeGreaterThan(0); // walked into the ring of snacks
    fireEvent.pointerUp(touch, { pointerId: 1 });
    expect(screen.getByTestId('gulp3d-joystick').style.opacity).toBe('0');
    for (let t = 0; t < 20000 && dialog().dataset.phase === 'play'; t += 500) await advance(500, 50);
    await advance(2600);
    expect(screen.getByTestId('gulp3d-result').dataset.stars).toBe('0');
    expect(screen.getByText('Snorlax vẫn còn đói!')).toBeInTheDocument();
    expect(onGold).not.toHaveBeenCalled();
    expect(localStorage.getItem(PROGRESS)).toBeNull();
    // Replay builds a fresh town
    fireEvent.click(screen.getByTestId('gulp3d-replay'));
    expect(dialog().dataset.phase).toBe('ready');
    expect(scene.created).toBe(2);
  }, 60000);

  it('GULP-UI-03 when WebGL is unavailable a friendly message shows with a close button', async () => {
    scene.fail = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onClose = vi.fn();
    render(<Gulp3DGame player={PLAYER} onClose={onClose} onGold={vi.fn()} random={seeded(1)} />);
    fireEvent.click(screen.getByLabelText('Thị trấn Pallet'));
    await advance(100);
    expect(dialog().dataset.phase).toBe('nogl');
    expect(screen.getByTestId('gulp3d-nogl')).toHaveTextContent('chưa vẽ được thế giới 3D');
    fireEvent.click(screen.getByText('Đóng'));
    expect(onClose).toHaveBeenCalled();
  });

  it('GULP-UI-04 keyboard arrows walk Snorlax and Escape closes', async () => {
    const onClose = vi.fn();
    render(<Gulp3DGame player={PLAYER} onClose={onClose} onGold={vi.fn()} random={seeded(2)} />);
    fireEvent.click(screen.getByLabelText('Thị trấn Pallet'));
    await startRound();
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    await advance(1500, 50);
    fireEvent.keyUp(window, { key: 'ArrowDown' });
    expect(Number(dialog().dataset.score)).toBeGreaterThan(0);
    expect(screen.getByTestId('gulp3d-size')).toHaveTextContent('Cỡ');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
