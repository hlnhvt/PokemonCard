import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { sounds } from '../../../utils/soundEffects';
import { seeded } from '../../../test/seeded';

const scene = vi.hoisted(() => ({ fail: false, created: 0, disposed: 0, fx: [], shops: [] }));
vi.mock('./Pizza3DScene', () => ({
  createPizza3DScene: vi.fn(() => {
    if (scene.fail) throw new Error('no WebGL');
    scene.created += 1;
    return {
      update: () => {},
      fx: (e) => scene.fx.push(e.type),
      setShop: (s, o) => scene.shops.push({ s, o }),
      project: () => ({ x: 50, y: 50, visible: true }),
      resize: () => {},
      dispose: () => {
        scene.disposed += 1;
      },
    };
  }),
}));
vi.mock('canvas-confetti', () => ({ default: () => {} }));

const { Pizza3DGame } = await import('./Pizza3DGame');

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Lightning'] };
const KEY = 'pokescan_pizza3d_v1';

beforeEach(() => {
  localStorage.removeItem(KEY);
  Object.assign(scene, { fail: false, created: 0, disposed: 0, fx: [], shops: [] });
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
const tap = (id) => fireEvent.click(screen.getByTestId(id));

describe('Pizza3DGame', () => {
  it('PIZ-UI-01 a whole day by hand: take order → dough, sauce, cheese → oven → perfect → box → serve → collect; report pays gold once and saves', async () => {
    const onGold = vi.fn();
    render(<Pizza3DGame player={PLAYER} collection={[]} onClose={vi.fn()} onGold={onGold} random={seeded(2)} dayLength={40} />);
    expect(dialog().dataset.phase).toBe('menu');
    expect(screen.getByTestId('pizza3d-menu')).toHaveTextContent('Tiệm Pizza Pokémon');
    expect(scene.created).toBe(1);
    tap('pizza3d-start');
    expect(dialog().dataset.phase).toBe('play');
    // wait for the first customer at the register
    for (let t = 0; t < 30000 && !screen.queryByTestId('pizza3d-take-0'); t += 500) await advance(500, 50);
    expect(screen.getByTestId('pizza3d-help')).toHaveTextContent('Nhận order');
    tap('pizza3d-take-0');
    expect(screen.getAllByTestId('pizza3d-ticket').length).toBe(1);
    tap('pizza3d-add-cheese'); // dough first!
    expect(screen.getByTestId('pizza3d-banner')).toHaveTextContent('Đế bột trước');
    tap('pizza3d-add-dough');
    tap('pizza3d-add-sauce');
    tap('pizza3d-add-cheese');
    // a sausage pizza needs its topping too
    if (screen.getByTestId('pizza3d-steps').children.length > 3) tap('pizza3d-add-sausage');
    expect(screen.getByTestId('pizza3d-to-oven')).not.toBeDisabled();
    tap('pizza3d-to-oven');
    expect(screen.getByTestId('pizza3d-oven-0').dataset.zone).toBe('raw');
    for (let t = 0; t < 20000 && screen.getByTestId('pizza3d-oven-0').dataset.zone !== 'perfect'; t += 100) await advance(100, 50);
    expect(screen.getByTestId('pizza3d-oven-0').dataset.zone).toBe('perfect');
    tap('pizza3d-oven-0');
    expect(sounds.playEnergySurge).toHaveBeenCalled();
    tap('pizza3d-box');
    tap('pizza3d-serve');
    for (let t = 0; t < 10000 && screen.getByTestId('pizza3d-collect').disabled; t += 200) await advance(200, 50);
    const before = Number(dialog().dataset.money);
    tap('pizza3d-collect');
    expect(Number(dialog().dataset.money)).toBeGreaterThan(before);
    expect(sounds.playCoin).toHaveBeenCalled();
    expect(scene.fx).toEqual(expect.arrayContaining(['order', 'add', 'oven', 'take', 'box', 'serve', 'pay', 'collect']));
    expect(dialog().dataset.served).toBe('1');
    // let the day run out
    for (let t = 0; t < 120000 && dialog().dataset.phase === 'play'; t += 1000) await advance(1000, 100);
    expect(dialog().dataset.phase).toBe('report');
    const rep = screen.getByTestId('pizza3d-report');
    expect(rep).toHaveTextContent('Hết ngày 1');
    expect(rep).toHaveTextContent('Phục vụ: 1');
    expect(onGold).toHaveBeenCalledTimes(1);
    const gold = onGold.mock.calls[0][0];
    expect(gold).toBeGreaterThanOrEqual(5);
    expect(gold).toBeLessThanOrEqual(30);
    expect(screen.getByTestId('gold-reward')).toHaveTextContent(`+${gold}`);
    const saved = JSON.parse(localStorage.getItem(KEY));
    expect(saved.day).toBe(2);
    expect(saved.money).toBeGreaterThan(60);
    await advance(2000);
    expect(onGold).toHaveBeenCalledTimes(1);
  }, 120000);

  it('PIZ-UI-02 autopilot day → shop: buy an upgrade (3D poof) and hire staff, next day opens; save continues after reopening; "Tiệm mới" resets', async () => {
    const onGold = vi.fn();
    const { unmount } = render(<Pizza3DGame player={PLAYER} collection={[{ name: 'Mewtwo', types: ['Psychic'], image: 'm.png' }]} onClose={vi.fn()} onGold={onGold} random={seeded(5)} autopilot dayLength={90} />);
    tap('pizza3d-start');
    for (let t = 0; t < 200000 && dialog().dataset.phase === 'play'; t += 2000) await advance(2000, 100);
    expect(dialog().dataset.phase).toBe('report');
    expect(onGold).toHaveBeenCalledTimes(1);
    tap('pizza3d-to-shop');
    expect(dialog().dataset.phase).toBe('shop');
    const money = Number(dialog().dataset.money);
    expect(money).toBeGreaterThan(160);
    fireEvent.click(screen.getByTestId('pizza3d-buy-up:oven'));
    expect(Number(dialog().dataset.money)).toBe(money - 160);
    expect(scene.shops.at(-1).o).toEqual({ animate: true });
    expect(scene.shops.at(-1).s.up.oven).toBe(1);
    expect(screen.getByTestId('pizza3d-banner')).toHaveTextContent('Xây xong');
    tap('pizza3d-tab-staff');
    expect(screen.getByTestId('pizza3d-buy-hire:chef')).toBeDisabled(); // not enough xu yet
    expect(screen.getByTestId('pizza3d-item-hire:cashier')).toHaveTextContent('Thuê thu ngân');
    tap('pizza3d-tab-menu');
    expect(screen.getByTestId('pizza3d-item-menu:mushroom')).toHaveTextContent('Pizza nấm');
    expect(JSON.parse(localStorage.getItem(KEY)).up.oven).toBe(1);
    tap('pizza3d-next-day');
    expect(dialog().dataset.phase).toBe('play');
    expect(dialog().dataset.day).toBe('2');
    unmount();
    expect(scene.disposed).toBeGreaterThanOrEqual(1);
    // reopen: the saved shop continues
    render(<Pizza3DGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(6)} />);
    expect(screen.getByTestId('pizza3d-save')).toHaveTextContent('ngày 2');
    expect(screen.getByTestId('pizza3d-start')).toHaveTextContent('Mở cửa ngày 2');
    tap('pizza3d-reset');
    expect(screen.getByTestId('pizza3d-confirm')).toHaveTextContent('Mở tiệm mới?');
    tap('pizza3d-reset-yes');
    expect(localStorage.getItem(KEY)).toBe(null);
    expect(dialog().dataset.day).toBe('1');
    expect(screen.queryByTestId('pizza3d-save')).toBeNull();
  }, 120000);

  it('PIZ-UI-03 when WebGL is unavailable a friendly message shows with a close button', async () => {
    scene.fail = true;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onClose = vi.fn();
    render(<Pizza3DGame player={PLAYER} onClose={onClose} onGold={vi.fn()} random={seeded(1)} />);
    await advance(100);
    expect(dialog().dataset.phase).toBe('nogl');
    expect(screen.getByTestId('pizza3d-nogl')).toHaveTextContent('chưa vẽ được tiệm pizza 3D');
    fireEvent.click(screen.getByText('Đóng'));
    expect(onClose).toHaveBeenCalled();
  });

  it('PIZ-UI-04 Escape closes the game', () => {
    const onClose = vi.fn();
    render(<Pizza3DGame player={PLAYER} onClose={onClose} onGold={vi.fn()} random={seeded(1)} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
