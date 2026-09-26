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

describe('LeagueGame (5 vs 5)', () => {
  const COLLECTION = ['pikachu', 'charmander', 'squirtle', 'bulbasaur', 'eevee'].map((id, i) => ({ id, name: id[0].toUpperCase() + id.slice(1), speciesName: id, pokedexNumber: String(i + 1), types: ['Normal'], fallbackImage: `${id}.png` }));
  const data = (name, s) => ({ key: name, name: name[0].toUpperCase() + name.slice(1), id: 25, types: ['normal'], stats: { hp: s, attack: s, defense: s, spAttack: s, spDefense: s, speed: s }, moves: fallbackMoves(['normal']), image: `${name}.png` });
  const isPlayer = (q) => Array.isArray(q) || typeof q === 'object';

  async function buildTeam() {
    for (const c2 of COLLECTION) fireEvent.click(screen.getByLabelText(`Thêm ${c2.name} vào đội`));
    fireEvent.click(screen.getByRole('button', { name: 'Chọn sàn đấu' }));
  }

  /** Play a team battle: first move every time, first Pokemon when asked to switch. */
  async function fight() {
    for (let t = 0; t < 400000 && !screen.queryByTestId('league-badge') && !screen.queryByTestId('league-lost') && !screen.queryByTestId('league-champion'); t += 300) {
      const arena = screen.queryByTestId('team-arena');
      if (arena?.dataset.phase === 'choose') fireEvent.click(within(arena).getAllByRole('button').find((b) => b.textContent.includes('Sức mạnh')));
      else if (arena?.dataset.phase === 'switch') fireEvent.click(within(screen.getByTestId('switch-picker')).getAllByRole('button')[0]);
      await advance(300, 300);
    }
  }

  it('NG-04 a team of 5 beats every gym team of 5: 9 badges, gold each time, the champion ceremony', async () => {
    mocks.fetchBattlePokemon.mockImplementation(async (q) => (isPlayer(q) ? data('pikachu', 220) : data(String(q), 20)));
    const onGold = vi.fn();
    render(<LeagueGame collection={COLLECTION} allowScanned onGold={onGold} onClose={vi.fn()} random={seeded(3)} />);
    await buildTeam();
    expect(screen.getByTestId('league-road')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Đội của nhà thi đấu')).getAllByRole('img')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Thách đấu' }));
    for (let i = 0; i < LEAGUE.length; i++) {
      await advance(400);
      // The gym's own 5 Pokemon were loaded, the ace last
      const loaded = mocks.fetchBattlePokemon.mock.calls.map(([q]) => q).filter((q) => typeof q === 'string').slice(-5);
      expect(loaded).toEqual(LEAGUE[i].team);
      expect(screen.getByTestId('team-intro')).toHaveTextContent(LEAGUE[i].name);
      fireEvent.click(screen.getByTestId('team-intro'));
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
  }, 240000);

  it('NG-05 a lost gym can be tried again; scanned Pokemon need the parent setting', async () => {
    mocks.fetchBattlePokemon.mockImplementation(async (q) => (isPlayer(q) ? data('pikachu', 8) : data(String(q), 250)));
    const onGold = vi.fn();
    const { unmount } = render(<LeagueGame collection={COLLECTION} onGold={onGold} onClose={vi.fn()} random={seeded(4)} />);
    // Setting off: scanning is required, the saved Pokemon are not offered
    expect(screen.queryByLabelText('Thêm Pikachu vào đội')).toBeNull();
    expect(screen.getByTestId('scan-required')).toBeInTheDocument();
    unmount();
    render(<LeagueGame collection={COLLECTION} allowScanned onGold={onGold} onClose={vi.fn()} random={seeded(4)} />);
    await buildTeam();
    fireEvent.click(screen.getByRole('button', { name: 'Thách đấu' }));
    await advance(400);
    fireEvent.click(screen.getByTestId('team-intro'));
    await fight();
    expect(screen.getByTestId('league-lost')).toBeInTheDocument();
    expect(onGold).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Thử lại'));
    await advance(400);
    expect(screen.getByTestId('team-intro')).toHaveTextContent(LEAGUE[0].name);
  }, 120000);
});
