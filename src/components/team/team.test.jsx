import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { fallbackMoves } from '../../utils/battle/moves';

const mocks = vi.hoisted(() => ({ fetchBattlePokemon: vi.fn(), strong: new Set() }));
vi.mock('../../services/battleData', () => ({ fetchBattlePokemon: mocks.fetchBattlePokemon }));
// The real scanner needs a camera; this stand-in "scans" a Mew card when tapped
vi.mock('../ScannerModal', () => ({
  ScannerModal: ({ onCardDetected, onOpenCard, recentCards }) => (
    <>
      <button onClick={() => onCardDetected({ id: 'mew', name: 'Mew', speciesName: 'mew', pokedexNumber: '151', types: ['Psychic'], fallbackImage: 'mew.png' })}>fake-scan</button>
      {recentCards?.[0] && <button onClick={() => onOpenCard(recentCards[0])}>fake-open-saved</button>}
    </>
  ),
}));

import { TeamBattle } from './TeamBattle';
import { GamesHub } from '../GamesHub';
import { goldForTeam } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const card = (id, name, num, types) => ({ id, name, speciesName: id, pokedexNumber: String(num), types, fallbackImage: `${id}.png` });
const COLLECTION = [
  card('pikachu', 'Pikachu', 25, ['Electric']),
  card('charmander', 'Charmander', 4, ['Fire']),
  card('squirtle', 'Squirtle', 7, ['Water']),
  card('bulbasaur', 'Bulbasaur', 1, ['Grass']),
  card('eevee', 'Eevee', 133, ['Normal']),
];

/** Battle data: Pokemon in `strong` are powerful, the others very weak. */
function battleData(query) {
  const name = String(query).toLowerCase();
  const s = mocks.strong.has(name) ? 160 : 12;
  const types = { pikachu: ['electric'], charmander: ['fire'], squirtle: ['water'], bulbasaur: ['grass'], mew: ['psychic'] }[name] || ['normal'];
  return Promise.resolve({ key: name, name: name.charAt(0).toUpperCase() + name.slice(1), id: 1, types, stats: { hp: s, attack: s, defense: s, spAttack: s, spDefense: s, speed: s }, moves: fallbackMoves(types), image: `${name}.png` });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem('pokescan_battle_speed', 'normal');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playEnergySurge', 'playNote', 'playPokemonCry', 'playOops', 'playScanBeep']) vi.spyOn(sounds, s).mockImplementation(() => {});
  mocks.strong = new Set();
  mocks.fetchBattlePokemon.mockReset();
  mocks.fetchBattlePokemon.mockImplementation(battleData);
});
afterEach(() => vi.useRealTimers());

async function advance(ms, step = 200) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}
const dialog = () => screen.getByRole('dialog', { name: 'Đấu đội 5 vs 5' });

async function buildFullTeam() {
  for (const c of COLLECTION) fireEvent.click(screen.getByLabelText(`Thêm ${c.name} vào đội`));
  fireEvent.click(screen.getByText('Chọn sàn đấu'));
}

/** Tap the first move every time it is possible; pick the first Pokemon when asked to switch. */
async function fight(maxMs = 400000) {
  for (let t = 0; t < maxMs && !screen.queryByTestId('trophy-ceremony'); t += 300) {
    const arena = screen.queryByTestId('team-arena');
    if (arena?.dataset.phase === 'choose') {
      const moves = within(arena).getAllByRole('button').filter((b) => b.textContent.includes('Sức mạnh'));
      fireEvent.click(moves[0]);
    } else if (arena?.dataset.phase === 'switch') {
      fireEvent.click(within(screen.getByTestId('switch-picker')).getAllByRole('button')[0]);
    }
    await advance(300, 300);
  }
}

describe('TeamBattle', () => {
  it('TT-01 team building: scanned Pokemon join; free places are lent with a slot-machine spin', async () => {
    render(<TeamBattle allowScanned collection={COLLECTION.slice(0, 2)} onClose={vi.fn()} random={seeded(1)} />);
    fireEvent.click(screen.getByLabelText('Thêm Pikachu vào đội'));
    fireEvent.click(screen.getByLabelText('Thêm Pikachu vào đội'));
    expect(within(screen.getByTestId('team-slots')).getAllByRole('img')).toHaveLength(1);
    fireEvent.click(screen.getByLabelText('Thêm Charmander vào đội'));
    fireEvent.click(screen.getByText(/Cho mượn ngẫu nhiên 3 Pokémon/));
    expect(screen.getAllByTestId('roulette-slot')).toHaveLength(3);
    expect(sounds.playNote).not.toHaveBeenCalled();
    await advance(600);
    expect(sounds.playNote).toHaveBeenCalled();
    await advance(4000);
    expect(screen.queryAllByTestId('roulette-slot')).toHaveLength(0);
    const slots = screen.getByTestId('team-slots');
    expect(within(slots).getAllByText('🎲 Mượn')).toHaveLength(3);
    expect(within(slots).getAllByText('⭐ Của bé')).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('Bỏ Pikachu khỏi đội'));
    expect(screen.getByText(/Cho mượn ngẫu nhiên 1 Pokémon/)).toBeInTheDocument();
  });

  it('TT-02 scanning a card inside the team builder: celebration, then it joins the team and the collection', async () => {
    const onScanned = vi.fn((p) => ({ ...p, friendship: 0 }));
    render(<TeamBattle collection={[]} onScanned={onScanned} onClose={vi.fn()} random={seeded(2)} />);
    fireEvent.click(screen.getByText('Quét thẻ thêm Pokémon'));
    expect(screen.getByRole('dialog', { name: 'Quét thẻ thêm vào đội' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('fake-scan'));
    expect(onScanned).toHaveBeenCalledWith(expect.objectContaining({ id: 'mew' }));
    expect(screen.getByTestId('scan-success')).toHaveTextContent('Mew gia nhập đội');
    await advance(2000);
    expect(screen.queryByTestId('scan-success')).toBeNull();
    expect(within(screen.getByTestId('team-slots')).getByText('📷 Vừa quét')).toBeInTheDocument();
  });

  it('TT-03 six battle grounds; choosing one shows which Pokemon it suits', async () => {
    render(<TeamBattle allowScanned collection={COLLECTION} onClose={vi.fn()} random={seeded(3)} />);
    await buildFullTeam();
    const grounds = screen.getByRole('radiogroup', { name: 'Sàn đấu' });
    expect(within(grounds).getAllByRole('radio')).toHaveLength(6);
    fireEvent.click(within(grounds).getByRole('radio', { name: 'Núi lửa rực cháy' }));
    expect(within(grounds).getByRole('radio', { name: 'Núi lửa rực cháy' })).toHaveAttribute('aria-checked', 'true');
    expect(within(grounds).getByRole('radio', { name: 'Núi lửa rực cháy' })).toHaveTextContent('Hợp với 1 Pokémon');
  });

  it('TT-04 a whole battle won: intro, Pokeball send-outs, switches of opponents, trophy ceremony and gold once', async () => {
    for (const c of COLLECTION) mocks.strong.add(c.id);
    const onGold = vi.fn();
    render(<TeamBattle allowScanned collection={COLLECTION} onGold={onGold} onClose={vi.fn()} random={seeded(4)} />);
    await buildFullTeam();
    fireEvent.click(screen.getByRole('radio', { name: 'Bãi biển nắng' }));
    fireEvent.click(screen.getByText('Bắt đầu trận đấu!'));
    await advance(400);
    expect(mocks.fetchBattlePokemon).toHaveBeenCalledTimes(10);
    expect(screen.getByTestId('team-intro')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-intro'));
    expect(screen.getByTestId('team-arena').dataset.phase).toBe('intro');
    await advance(400);
    expect(screen.getByTestId('thrown-ball')).toBeInTheDocument();
    await fight();
    const ceremony = screen.getByTestId('trophy-ceremony');
    expect(ceremony.dataset.won).toBe('true');
    expect(ceremony).toHaveTextContent('VÔ ĐỊCH!');
    expect(screen.getByTestId('podium')).toHaveTextContent('MVP');
    expect(screen.getByLabelText('Cúp vô địch')).toBeInTheDocument();
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(goldForTeam(true, 5));
    await advance(4000);
    expect(screen.getByTestId('team-gold')).toHaveTextContent(`+${goldForTeam(true, 5)} vàng`);
    fireEvent.click(screen.getByText('Đấu trận mới'));
    expect(screen.getByTestId('team-builder')).toBeInTheDocument();
  }, 120000);

  it('TT-05 a lost battle: the child picks who goes next; the end still pays consolation gold', async () => {
    const onGold = vi.fn();
    render(<TeamBattle allowScanned collection={COLLECTION} onGold={onGold} onClose={vi.fn()} random={seeded(5)} />);
    await buildFullTeam();
    mocks.fetchBattlePokemon.mockImplementation((q) => {
      const name = String(q).toLowerCase();
      if (!COLLECTION.some((c) => c.id === name)) mocks.strong.add(name);
      return battleData(q);
    });
    fireEvent.click(screen.getByText('Bắt đầu trận đấu!'));
    await advance(400);
    fireEvent.click(screen.getByTestId('team-intro'));
    let sawPicker = false;
    for (let t = 0; t < 400000 && !screen.queryByTestId('trophy-ceremony'); t += 300) {
      const arena = screen.queryByTestId('team-arena');
      if (arena?.dataset.phase === 'choose') fireEvent.click(within(arena).getAllByRole('button').find((b) => b.textContent.includes('Sức mạnh')));
      else if (arena?.dataset.phase === 'switch') {
        sawPicker = true;
        fireEvent.click(within(screen.getByTestId('switch-picker')).getAllByRole('button')[0]);
      }
      await advance(300, 300);
    }
    expect(sawPicker).toBe(true);
    expect(screen.getByTestId('trophy-ceremony').dataset.won).toBe('false');
    expect(onGold).toHaveBeenCalledWith(goldForTeam(false));
  }, 120000);

  it('TT-06 a download error can be retried', async () => {
    mocks.fetchBattlePokemon.mockRejectedValue(new Error('Không tải được dữ liệu trận đấu.'));
    render(<TeamBattle allowScanned collection={COLLECTION} onClose={vi.fn()} random={seeded(6)} />);
    await buildFullTeam();
    fireEvent.click(screen.getByText('Bắt đầu trận đấu!'));
    await advance(400);
    expect(dialog().dataset.phase).toBe('error');
    mocks.fetchBattlePokemon.mockImplementation(battleData);
    fireEvent.click(screen.getByText('Thử lại'));
    await advance(400);
    expect(dialog().dataset.phase).toBe('intro');
  });

  it('TT-08 setting off (default): saved Pokemon cannot be picked, scanning is required', async () => {
    const onScanned = vi.fn((p) => p);
    render(<TeamBattle collection={COLLECTION} onScanned={onScanned} onClose={vi.fn()} random={seeded(8)} />);
    expect(screen.queryByText('⭐ Pokémon bé đã quét')).toBeNull();
    expect(screen.queryByLabelText('Thêm Pikachu vào đội')).toBeNull();
    expect(screen.getByTestId('scan-required')).toHaveTextContent('Cài đặt');
    // The scanner's shortcut to a saved card is refused
    fireEvent.click(screen.getByText('Quét thẻ thêm Pokémon'));
    fireEvent.click(screen.getByText('fake-open-saved'));
    expect(screen.getByRole('alert')).toHaveTextContent('Hãy chụp thẻ Pikachu bằng camera');
    expect(within(screen.getByTestId('team-slots')).queryAllByRole('img')).toHaveLength(0);
    // A real scan works
    fireEvent.click(screen.getByText('Quét thẻ thêm Pokémon'));
    fireEvent.click(screen.getByText('fake-scan'));
    await advance(2000);
    expect(within(screen.getByTestId('team-slots')).getByText('📷 Vừa quét')).toBeInTheDocument();
  });

  it('TT-07 the Games tab offers the team battle even before the first scan', () => {
    render(<GamesHub collection={[]} />);
    fireEvent.click(screen.getByLabelText('Đấu đội 5 vs 5'));
    expect(dialog()).toBeInTheDocument();
    expect(screen.getByTestId('team-builder')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Đấu đội 5 vs 5' })).toBeNull();
  });
});
