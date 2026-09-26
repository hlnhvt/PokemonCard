import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ fetchBattlePokemon: vi.fn(), strong: false }));
vi.mock('../../services/battleData', async (importOriginal) => ({ ...(await importOriginal()), fetchBattlePokemon: mocks.fetchBattlePokemon }));

import { PairsGame } from './PairsGame';
import { RhythmGame } from './RhythmGame';
import { LeagueGame } from '../league/LeagueGame';
import { createBoard, PAIR_LEVELS } from '../../utils/logic/pairs';
import { createRun } from '../../utils/logic/rhythm';
import { LEAGUE, goldForGym } from '../../utils/league';
import { fallbackMoves } from '../../utils/battle/moves';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png' };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem('pokescan_battle_speed', 'normal');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playEnergySurge', 'playNote', 'playOops', 'playPokemonCry', 'playMunch']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

async function advance(ms, step = 100) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}
const dialog = () => screen.getAllByRole('dialog').at(-1);

describe('PairsGame', () => {
  it('NG-01 a miss turns back over; matching every pair of the 3 levels pays gold once', async () => {
    const onGold = vi.fn();
    const mirror = seeded(1);
    render(<PairsGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(1)} />);
    for (let level = 0; level < PAIR_LEVELS.length; level++) {
      const board = createBoard(level, mirror);
      const cards = () => within(screen.getByTestId('pairs-board')).getAllByRole('button');
      if (level === 0) {
        const a = board.cards[0];
        const b = board.cards.find((c) => c.pair !== a.pair);
        fireEvent.click(cards()[a.uid]);
        fireEvent.click(cards()[b.uid]);
        expect(cards()[a.uid].getAttribute('aria-label')).not.toContain('(úp)');
        await advance(1000);
        expect(cards()[a.uid].getAttribute('aria-label')).toContain('(úp)');
      }
      for (let p = 0; p < PAIR_LEVELS[level].pairs; p++) {
        const [x, y] = board.cards.filter((c) => c.pair === p);
        fireEvent.click(cards()[x.uid]);
        fireEvent.click(cards()[y.uid]);
      }
      await advance(1000);
      if (level < PAIR_LEVELS.length - 1) {
        expect(screen.getByTestId('pairs-level-done')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Màn tiếp theo ➜'));
      }
    }
    expect(dialog().dataset.done).toBe('true');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(15);
  });
});

describe('RhythmGame', () => {
  it('NG-02 tapping each note on time: perfect judgements, combo, stars and gold', async () => {
    const onGold = vi.fn();
    render(<RhythmGame player={PLAYER} onClose={vi.fn()} onGold={onGold} />);
    fireEvent.click(screen.getByLabelText('Nhảy bài Bánh nóng giòn'));
    expect(dialog().dataset.screen).toBe('play');
    const chart = createRun('hotcross').chart;
    const pads = within(screen.getByTestId('rhythm-pads')).getAllByRole('button');
    let t = 0;
    for (const n of chart) {
      const wait = Math.round((n.time - t) * 1000);
      await advance(wait, Math.max(10, Math.min(50, wait)));
      t += wait / 1000;
      fireEvent.pointerDown(pads[n.lane]);
    }
    expect(Number(dialog().dataset.combo)).toBeGreaterThanOrEqual(chart.length - 1);
    expect(screen.getByTestId('judge')).toHaveTextContent(/PERFECT|GOOD/);
    await advance(3000);
    expect(dialog().dataset.screen).toBe('done');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(15);
  });

  it('NG-03 notes nobody taps are misses and the run still ends', async () => {
    const onGold = vi.fn();
    render(<RhythmGame player={PLAYER} onClose={vi.fn()} onGold={onGold} />);
    fireEvent.click(screen.getByLabelText('Nhảy bài Bánh nóng giòn'));
    await advance(4000);
    expect(screen.getByTestId('judge')).toHaveTextContent('MISS');
    await advance(20000, 250);
    expect(dialog().dataset.screen).toBe('done');
    expect(onGold).toHaveBeenCalledWith(5);
  });
});

describe('LeagueGame', () => {
  const data = (name, s) => ({ key: name, name: name[0].toUpperCase() + name.slice(1), id: 25, types: ['electric'], stats: { hp: s, attack: s, defense: s, spAttack: s, spDefense: s, speed: s }, moves: fallbackMoves(['electric']), image: `${name}.png` });

  async function fight() {
    for (let t = 0; t < 200000 && dialog().dataset.phase !== 'won' && dialog().dataset.phase !== 'lost'; t += 300) {
      const d = dialog();
      if (d.dataset.phase === 'choose') fireEvent.click(within(d).getAllByRole('button').find((b) => b.textContent.includes('Sức mạnh')));
      await advance(300, 300);
    }
    await advance(2200, 200);
  }

  it('NG-04 winning every gym collects 9 badges and gold, then the champion ceremony', async () => {
    mocks.fetchBattlePokemon.mockImplementation(async (q) => (typeof q === 'object' ? data('pikachu', 200) : data(String(q), 20)));
    const onGold = vi.fn();
    render(<LeagueGame card={{ id: 'pikachu', name: 'Pikachu', pokedexNumber: '025' }} player={PLAYER} onGold={onGold} onClose={vi.fn()} random={seeded(3)} />);
    expect(screen.getByTestId('league-road')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Thách đấu'));
    for (let i = 0; i < LEAGUE.length; i++) {
      await advance(3000);
      expect(mocks.fetchBattlePokemon).toHaveBeenLastCalledWith(LEAGUE[i].ace);
      await fight();
      if (i < LEAGUE.length - 1) {
        expect(screen.getByTestId('league-badge')).toBeInTheDocument();
        fireEvent.click(screen.getByText(/Tiếp: |Thách đấu Nhà Vô địch/));
      }
    }
    expect(screen.getByTestId('league-champion')).toHaveTextContent('NHÀ VÔ ĐỊCH');
    expect(onGold).toHaveBeenCalledTimes(LEAGUE.length);
    expect(onGold).toHaveBeenLastCalledWith(goldForGym(8));
    expect(screen.getByTestId('badge-case').getAttribute('aria-label')).toBe('Huy hiệu 9/9');
  }, 120000);

  it('NG-05 a lost gym can be tried again right away', async () => {
    mocks.fetchBattlePokemon.mockImplementation(async (q) => (typeof q === 'object' ? data('pikachu', 10) : data(String(q), 250)));
    const onGold = vi.fn();
    render(<LeagueGame card={{ id: 'pikachu', name: 'Pikachu', pokedexNumber: '025' }} player={PLAYER} onGold={onGold} onClose={vi.fn()} random={seeded(4)} />);
    fireEvent.click(screen.getByText('Thách đấu'));
    await advance(3000);
    await fight();
    expect(screen.getByTestId('league-lost')).toBeInTheDocument();
    expect(onGold).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Thử lại'));
    await advance(3000);
    expect(mocks.fetchBattlePokemon).toHaveBeenLastCalledWith(LEAGUE[0].ace);
  }, 60000);
});
