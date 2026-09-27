import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WeighGame } from './WeighGame';
import { POKEMON_WEIGHTS, ROUNDS } from '../../utils/carnival/weigh';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Electric'] };
const KG = Object.fromEntries(POKEMON_WEIGHTS.map((p) => [p.dex, p.kg]));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playScanBeep', 'playOops', 'playNote']) vi.spyOn(sounds, s).mockImplementation(() => {});
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
const choices = () => screen.getAllByTestId(/^weigh-pick-/).map((b) => Number(b.dataset.dex));

describe('WeighGame', () => {
  it('WEU-01 ten rounds: pick heavier / lighter / order; the kg show on the scale; the result pays once', async () => {
    const onGold = vi.fn();
    render(<WeighGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(8)} />);
    await advance(2600);
    expect(dialog().dataset.phase).toBe('play');
    const modes = [];
    for (let round = 0; round < ROUNDS; round++) {
      expect(Number(dialog().dataset.round)).toBe(round);
      const mode = dialog().dataset.mode;
      modes.push(mode);
      const dex = choices();
      const sorted = [...dex].sort((a, b) => KG[a] - KG[b]);
      if (mode === 'heavy') expect(screen.getByTestId('weigh-question')).toHaveTextContent('nặng hơn');
      if (mode === 'light') expect(screen.getByTestId('weigh-question')).toHaveTextContent('nhẹ hơn');
      if (mode === 'order') {
        expect(screen.getByTestId('weigh-question')).toHaveTextContent('Xếp từ nhẹ đến nặng');
        fireEvent.click(screen.getByTestId(`weigh-pick-${sorted[0]}`));
        expect(dialog().dataset.step).toBe('ask');
        fireEvent.click(screen.getByTestId(`weigh-pick-${sorted[1]}`));
      } else {
        // Get round 3 wrong on purpose
        const right = mode === 'heavy' ? sorted[sorted.length - 1] : sorted[0];
        const wrong = dex.find((d) => d !== right);
        fireEvent.click(screen.getByTestId(`weigh-pick-${round === 3 ? wrong : right}`));
      }
      expect(dialog().dataset.step).toBe('reveal');
      await advance(1000);
      // Landed: the real weights are shown
      for (const d of dex) expect(screen.getByTestId(`weigh-kg-${d}`)).toHaveTextContent(`${String(KG[d]).replace('.', ',')} kg`);
      expect(screen.getByTestId('weigh-feedback').dataset.ok).toBe(round === 3 ? 'no' : 'yes');
      if (round % 2) fireEvent.click(screen.getByTestId('weigh-next'));
      else await advance(2600);
    }
    expect(modes.slice(0, 5).every((m) => m === 'heavy')).toBe(true);
    expect(modes.slice(8)).toEqual(['order', 'order']);
    await advance(800);
    expect(dialog().dataset.phase).toBe('done');
    expect(dialog().dataset.correct).toBe('9');
    expect(screen.getByTestId('carnival-result').dataset.stars).toBe('3');
    expect(onGold).toHaveBeenCalledTimes(1);
    // Play again starts over
    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.phase).toBe('ready');
  }, 60000);
});
