import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TowerDefenseGame } from './TowerDefenseGame';
import { LEVELS } from '../../utils/towerdef/levels';
import { STORAGE_KEY } from '../../utils/towerdef/progress';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Eevee', image: 'eevee.png', types: ['normal'] };

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 600, right: 360, bottom: 600, x: 0, y: 0 });
  for (const s of ['playNote', 'playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playEnergySurge', 'playOops', 'playScanBeep']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

async function advance(ms, stepMs = 500) {
  for (let t = 0; t < ms; t += stepMs) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(stepMs);
    });
  }
}
const dialog = () => screen.getByRole('dialog');
const bestPads = () => [...LEVELS[0].pads].sort((a, b) => b.score - a.score);
const tapPad = (pad) => fireEvent.pointerDown(screen.getByTestId('td-stage'), { clientX: pad.x, clientY: pad.y - 8 });

describe('TowerDefenseGame', () => {
  it('TDUI-01 level select, build on a pad, start, x2 speed, play to the result; gold paid once', async () => {
    const onGold = vi.fn();
    render(<TowerDefenseGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(1)} />);
    expect(dialog().dataset.screen).toBe('map');
    expect(screen.getByTestId('td-level-2')).toBeDisabled();
    fireEvent.click(screen.getByTestId('td-level-1'));
    expect(dialog().dataset.screen).toBe('play');
    expect(dialog().dataset.status).toBe('build');
    expect(screen.getByTestId('td-intro')).toBeInTheDocument();
    const coins = Number(dialog().dataset.coins);
    const [p1, p2] = bestPads();
    tapPad(p1);
    expect(screen.getByTestId('td-build-menu')).toBeInTheDocument();
    expect(screen.getByTestId('td-build-psychic')).toBeDisabled(); // Abra opens on level 3
    fireEvent.click(screen.getByTestId('td-build-fire'));
    expect(Number(dialog().dataset.coins)).toBe(coins - 70);
    expect(screen.getByTestId('td-tower-panel').dataset.name).toBe('Charmander');
    // The child's own Pokemon, free
    tapPad(p2);
    fireEvent.click(screen.getByTestId('td-build-hero'));
    expect(screen.getByTestId('td-tower-panel').dataset.name).toBe('Eevee');
    expect(Number(dialog().dataset.coins)).toBe(coins - 70);
    fireEvent.click(screen.getByTestId('td-call-wave'));
    expect(dialog().dataset.status).toBe('play');
    expect(dialog().dataset.wave).toBe('1');
    fireEvent.click(screen.getByTestId('td-speed'));
    expect(dialog().dataset.speed).toBe('2');
    for (let t = 0; t < 400000 && dialog().dataset.screen !== 'result'; t += 5000) await advance(5000);
    expect(dialog().dataset.screen).toBe('result');
    expect(screen.getByTestId('td-result')).toBeInTheDocument();
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold.mock.calls[0][0]).toBeGreaterThan(0);
    // Nothing more is paid while the result is shown
    await advance(3000);
    expect(onGold).toHaveBeenCalledTimes(1);
    if (dialog().dataset.status === 'won') {
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).stars['0']).toBeGreaterThan(0);
    }
  }, 120000);

  it('TDUI-02 a tower fills its energy by fighting; "Tiến hóa!" evolves it with the big animation', async () => {
    render(<TowerDefenseGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(2)} />);
    fireEvent.click(screen.getByTestId('td-level-1'));
    const [p1, p2] = bestPads();
    tapPad(p2);
    fireEvent.click(screen.getByTestId('td-build-water'));
    tapPad(p1);
    fireEvent.click(screen.getByTestId('td-build-fire'));
    expect(screen.getByTestId('td-evolve')).toBeDisabled();
    fireEvent.click(screen.getByTestId('td-call-wave'));
    fireEvent.click(screen.getByTestId('td-speed'));
    for (let t = 0; t < 200000 && screen.getByTestId('td-evolve').disabled; t += 1000) await advance(1000);
    expect(screen.getByTestId('td-evolve')).toBeEnabled();
    expect(screen.getByTestId('td-tower-panel').dataset.name).toBe('Charmander');
    fireEvent.click(screen.getByTestId('td-evolve'));
    expect(screen.getByTestId('td-evolution')).toHaveTextContent('Charmander → Charmeleon');
    expect(screen.getByTestId('td-tower-panel').dataset.name).toBe('Charmeleon');
    expect(screen.getByTestId('td-tower-panel')).toHaveAttribute('aria-label', expect.stringContaining('Charmeleon'));
    // The battle pauses during the animation, then goes on
    const wave = dialog().dataset.wave;
    await advance(3000);
    expect(screen.queryByTestId('td-evolution')).toBeNull();
    expect(dialog().dataset.wave).toBe(wave);
    // Selling gives coins back and frees the pad
    const coins = Number(dialog().dataset.coins);
    fireEvent.click(screen.getByTestId('td-sell'));
    expect(Number(dialog().dataset.coins)).toBeGreaterThan(coins);
    tapPad(p1);
    expect(screen.getByTestId('td-build-menu')).toBeInTheDocument();
  }, 120000);
});
