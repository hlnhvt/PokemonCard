import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GoldMinerGame } from './GoldMinerGame';
import { ArcheryGame } from './ArcheryGame';
import { RedLightGame } from './RedLightGame';
import { SPORTS } from './index';
import { GAME_RANK } from '../../utils/pokemonRank';
import { goldForMatch } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Charizard', image: 'charizard.png', types: ['Fire'] };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 560, right: 360, bottom: 560, x: 0, y: 0 });
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playScanBeep', 'playEnergySurge', 'playOops', 'playNote']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

async function advance(ms, step = 100) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}
const dialog = () => screen.getByRole('dialog');

describe('new games in the list', () => {
  it('NG3-00 the three games are in the sports list with a rank', () => {
    for (const id of ['goldminer', 'archery', 'redlight']) {
      expect(SPORTS.some((s) => s.id === id)).toBe(true);
      expect(GAME_RANK[id]).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('GoldMinerGame', () => {
  it('NG3-01 level intro, tapping shoots the claw, the level ends in a clear or the result; gold once', async () => {
    const onGold = vi.fn();
    render(<GoldMinerGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(1)} />);
    expect(screen.getByTestId('miner-intro')).toHaveTextContent('Mục tiêu');
    expect(dialog().dataset.phase).toBe('intro');
    await advance(2000);
    expect(dialog().dataset.phase).toBe('play');
    expect(screen.getByTestId('miner-dynamite')).toBeDisabled();
    // Tap now and then until the level is over
    for (let t = 0; t < 60000 && dialog().dataset.phase === 'play'; t += 1500) {
      fireEvent.pointerDown(screen.getByTestId('miner-stage'));
      await advance(1500, 100);
    }
    expect(Number(dialog().dataset.money)).toBeGreaterThan(0);
    const phase = dialog().dataset.phase;
    expect(['clear', 'done']).toContain(phase);
    if (phase === 'clear') {
      fireEvent.click(screen.getByText('Cửa tiếp theo ➜'));
      expect(dialog().dataset.level).toBe('2');
      expect(onGold).not.toHaveBeenCalled();
    } else {
      expect(screen.getByTestId('match-result')).toBeInTheDocument();
      expect(onGold).toHaveBeenCalledTimes(1);
    }
  }, 60000);
});

describe('ArcheryGame', () => {
  it('NG3-02 VS intro, hold and release to fire, the rival answers; 5 rounds then the result', async () => {
    const onGold = vi.fn();
    render(<ArcheryGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(2)} />);
    expect(dialog().dataset.phase).toBe('intro');
    await advance(2400);
    expect(dialog().dataset.phase).toBe('play');
    expect(screen.getByTestId('archery-hint')).toHaveTextContent('Lửa');
    const stage = screen.getByTestId('archery-stage');
    for (let round = 1; round <= 5; round++) {
      for (let t = 0; t < 10000 && dialog().dataset.turn !== 'player'; t += 100) await advance(100);
      expect(dialog().dataset.round).toBe(String(round));
      // Aim at the middle of the board (the crosshair sits above the finger)
      fireEvent.pointerDown(stage, { clientX: 180, clientY: 235 + 70, pointerId: 1 });
      await advance(300);
      fireEvent.pointerUp(stage, { clientX: 180, clientY: 235 + 70, pointerId: 1 });
      await advance(900);
      expect(dialog().dataset.turn).toBe('rival');
      await advance(2600); // the rival thinks, aims and fires
    }
    for (let t = 0; t < 5000 && dialog().dataset.phase !== 'done'; t += 100) await advance(100);
    const result = screen.getByTestId('match-result').dataset.result;
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(goldForMatch(result));
    expect(screen.getAllByTestId('score-left')[0].textContent).not.toBe('0');
  }, 60000);
});

describe('RedLightGame', () => {
  async function race(policy) {
    const onGold = vi.fn();
    render(<RedLightGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} />);
    expect(screen.getByTestId('countdown')).toHaveTextContent('3');
    await advance(3200);
    const btn = () => screen.queryByTestId('redlight-run');
    for (let t = 0; t < 90000 && dialog().dataset.phase !== 'done'; t += 50) {
      const want = policy(dialog().dataset.light);
      if (btn() && want && btn().getAttribute('aria-pressed') !== 'true') fireEvent.pointerDown(btn());
      if (btn() && !want && btn().getAttribute('aria-pressed') === 'true') fireEvent.pointerUp(btn());
      await advance(50, 50);
    }
    return onGold;
  }

  it('NG3-03 running only on green and stopping when the doll turns reaches the finish', async () => {
    const onGold = await race((light) => light === 'green');
    const r = screen.getByTestId('match-result').dataset.result;
    expect(['win', 'draw']).toContain(r);
    expect(onGold).toHaveBeenCalledWith(goldForMatch(r));
  }, 90000);

  it('NG3-04 running through a red light: caught, the match is lost', async () => {
    const onGold = await race(() => true);
    expect(screen.getByTestId('match-result').dataset.result).toBe('lose');
    expect(screen.getByText('Bị phát hiện cử động! 😵')).toBeInTheDocument();
    expect(onGold).toHaveBeenCalledWith(goldForMatch('lose'));
  }, 90000);
});
