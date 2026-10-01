import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { sounds } from '../../../utils/soundEffects';
import { seeded } from '../../../test/seeded';
import { SAVE_KEY, FLOWER, WATER, LAMP, getCell, starterGrid, encodeGrid } from '../../../utils/three3d/island3d';

const fake = vi.hoisted(() => ({ throws: false, hit: null, scenes: [] }));
vi.mock('./Island3DScene', () => ({
  createIsland3DScene: vi.fn(() => {
    if (fake.throws) throw new Error('WebGL unavailable');
    const scene = { update: vi.fn(), pick: vi.fn(() => fake.hit), effect: vi.fn(), orbit: vi.fn(), zoom: vi.fn(), pan: vi.fn(), rotate90: vi.fn(), resetView: vi.fn(), dispose: vi.fn() };
    fake.scenes.push(scene);
    return scene;
  }),
}));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { Island3DGame } from './Island3DGame';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png' };
const COLLECTION = [
  { name: 'Squirtle', pokedexNumber: '007', image: 'squirtle.png' },
  { name: 'Squirtle', pokedexNumber: '007', image: 'squirtle.png' },
  { name: 'Bulbasaur', pokedexNumber: '001' },
];

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  fake.throws = false;
  fake.hit = null;
  fake.scenes = [];
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playOops', 'playNote', 'playScanBeep']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

async function advance(ms, step = 50) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}

const dialog = () => screen.getByRole('dialog', { name: 'Đảo nhà Pokémon' });
const stage = () => screen.getByTestId('island3d-stage');

/** A finger tap on the stage, with the fake scene "seeing" `hit` under the finger. */
function tap(hit, x = 120, y = 300) {
  fake.hit = hit;
  fireEvent.pointerDown(stage(), { pointerId: 1, clientX: x, clientY: y, pointerType: 'touch', button: 0 });
  fireEvent.pointerUp(stage(), { pointerId: 1, clientX: x, clientY: y, pointerType: 'touch', button: 0 });
}
const top = (x, z, y = 1) => ({ cell: [x, y, z], normal: [0, 1, 0] });

describe('Island3DGame', () => {
  it('ISL-UI-01 plants 5 flowers through the toolbar: wish fulfilled, gold paid exactly once, autosaved', async () => {
    const onGold = vi.fn();
    render(<Island3DGame player={PLAYER} collection={COLLECTION} onClose={vi.fn()} onGold={onGold} random={seeded(1)} />);
    expect(dialog().dataset.tool).toBe('place');
    expect(screen.getByTestId('island3d-hero-wish')).toHaveTextContent('Pikachu muốn 5 bông hoa');
    await advance(200);
    expect(fake.scenes[0].update).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('island3d-tool-decor'));
    expect(dialog().dataset.tool).toBe('decor');
    fireEvent.click(screen.getByTestId(`island3d-item-${FLOWER}`));
    for (let k = 0; k < 5; k++) {
      tap(top(10 + k, 13));
      await advance(100);
    }
    expect(screen.getByTestId('island3d-celebrate').dataset.wish).toBe('garden');
    expect(screen.getByTestId('island3d-unlocks')).toHaveTextContent('Nước');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(10);
    expect(sounds.playSuccessFanfare).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('island3d-celebrate-ok'));
    expect(screen.queryByTestId('island3d-celebrate')).toBeNull();
    expect(screen.getByTestId('island3d-hero-wish')).toHaveTextContent('Pikachu muốn một cái hồ');
    expect(dialog().dataset.wishesDone).toBe('1');

    // Undo the last flower and plant it again: no second payment
    fireEvent.click(screen.getByTestId('island3d-tool-undo'));
    tap(top(14, 13));
    await advance(1500);
    expect(onGold).toHaveBeenCalledTimes(1);

    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    expect(saved.done).toEqual(['garden']);
    expect(saved.grid.length).toBeLessThan(3000);
  });

  it('ISL-UI-02 place, remove, paint and undo through taps; locked blocks say so', async () => {
    render(<Island3DGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(2)} />);
    await advance(100);
    const rev = () => Number(dialog().dataset.rev);
    const r0 = rev();
    tap(top(12, 12));
    await advance(100);
    expect(rev()).toBe(r0 + 1);
    expect(sounds.playPop).toHaveBeenCalled();
    expect(fake.scenes[0].effect).toHaveBeenCalledWith(expect.objectContaining({ type: 'place', cell: [12, 2, 12] }));
    // Dragging rotates instead of building
    fireEvent.pointerDown(stage(), { pointerId: 1, clientX: 100, clientY: 300, pointerType: 'touch' });
    fireEvent.pointerMove(stage(), { pointerId: 1, clientX: 160, clientY: 310, pointerType: 'touch' });
    fireEvent.pointerUp(stage(), { pointerId: 1, clientX: 160, clientY: 310, pointerType: 'touch' });
    expect(fake.scenes[0].orbit).toHaveBeenCalled();
    expect(rev()).toBe(r0 + 1);

    fireEvent.click(screen.getByTestId('island3d-tool-remove'));
    tap(top(12, 12, 2));
    await advance(100);
    expect(sounds.playWhoosh).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('island3d-tool-paint'));
    fireEvent.click(screen.getByTestId('island3d-color-5'));
    tap(top(11, 12));
    await advance(100);
    expect(rev()).toBe(r0 + 3);
    fireEvent.click(screen.getByTestId('island3d-tool-undo'));
    fireEvent.click(screen.getByTestId('island3d-tool-undo'));
    fireEvent.click(screen.getByTestId('island3d-tool-undo'));
    expect(screen.getByTestId('island3d-tool-undo')).toBeDisabled();

    fireEvent.click(screen.getByTestId('island3d-tool-place'));
    fireEvent.click(screen.getByTestId(`island3d-item-${LAMP}`));
    expect(sounds.playOops).toHaveBeenCalled();
    expect(screen.getByTestId('island3d-toast')).toHaveTextContent('mở khóa');
    fireEvent.click(screen.getByTestId(`island3d-item-${WATER}`));
    expect(screen.getByTestId(`island3d-item-${WATER}`)).toHaveAttribute('aria-pressed', 'false');

    // Camera buttons
    fireEvent.click(screen.getByTestId('island3d-rotate-right'));
    fireEvent.click(screen.getByTestId('island3d-reset-view'));
    expect(fake.scenes[0].rotate90).toHaveBeenCalledWith(1);
    expect(fake.scenes[0].resetView).toHaveBeenCalled();
  });

  it('ISL-UI-03 invite a friend, quests panel, night toggle, new island with confirm', async () => {
    render(<Island3DGame player={PLAYER} collection={COLLECTION} onClose={vi.fn()} onGold={vi.fn()} random={seeded(3)} />);
    await advance(100);
    fireEvent.click(screen.getByTestId('island3d-residents'));
    expect(screen.getAllByTestId(/island3d-invite-/)).toHaveLength(2); // duplicates merged
    fireEvent.click(screen.getByTestId('island3d-invite-Squirtle'));
    await advance(100);
    expect(dialog().dataset.residents).toBe('2');
    expect(screen.queryByTestId('island3d-invite-Squirtle')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('island3d-quests'));
    const panel = screen.getByTestId('island3d-quest-panel');
    expect(panel).toHaveTextContent('Pikachu muốn 5 bông hoa');
    expect(panel).toHaveTextContent('Squirtle muốn một cái hồ');
    expect(panel).toHaveTextContent('Cần mở khóa Nước');
    fireEvent.click(panel);
    expect(screen.queryByTestId('island3d-quest-panel')).toBeNull();

    fireEvent.click(screen.getByTestId('island3d-night'));
    expect(dialog().dataset.night).toBe('yes');

    tap(top(12, 12));
    await advance(100);
    fireEvent.click(screen.getByTestId('island3d-new'));
    fireEvent.click(screen.getByTestId('island3d-confirm-no'));
    expect(screen.queryByTestId('island3d-confirm')).toBeNull();
    fireEvent.click(screen.getByTestId('island3d-new'));
    fireEvent.click(screen.getByTestId('island3d-confirm-yes'));
    await advance(1200);
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    expect(saved.grid).toBe(encodeGrid(starterGrid()));
    expect(saved.guests.map((g) => g.name)).toEqual(['Squirtle']);
    expect(saved.night).toBe(true);
  });

  it('ISL-UI-04 opens the saved island', async () => {
    const g = starterGrid();
    g.cells[12 + 24 * (12 + 24 * 2)] = WATER;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, grid: encodeGrid(g), done: ['garden'], night: false, guests: [{ name: 'Eevee', dex: 133 }] }));
    render(<Island3DGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(4)} />);
    expect(dialog().dataset.wishesDone).toBe('1');
    expect(dialog().dataset.residents).toBe('2');
    await advance(100);
    const state = fake.scenes[0].update.mock.calls[0][0];
    expect(getCell(state.grid, 12, 2, 12)).toBe(WATER);
  });

  it('ISL-UI-05 shows a friendly message when WebGL is missing', async () => {
    fake.throws = true;
    const onClose = vi.fn();
    render(<Island3DGame player={PLAYER} onClose={onClose} onGold={vi.fn()} random={seeded(5)} />);
    await advance(100);
    const msg = screen.getByTestId('island3d-webgl-error');
    expect(msg).toHaveTextContent('chưa vẽ được thế giới 3D');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('ISL-UI-06 disposes the scene on close', async () => {
    const { unmount } = render(<Island3DGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(6)} />);
    await advance(100);
    unmount();
    expect(fake.scenes[0].dispose).toHaveBeenCalled();
  });
});
