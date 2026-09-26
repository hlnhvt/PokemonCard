import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { fallbackMoves } from '../../utils/battle/moves';

const mocks = vi.hoisted(() => ({ fetchBattlePokemon: vi.fn(), strong: new Set() }));
vi.mock('../../services/battleData', async (importOriginal) => ({ ...(await importOriginal()), fetchBattlePokemon: mocks.fetchBattlePokemon }));
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
  // Cards are looked up with a list of ways (number, id, species): use the name-like one
  const q = Array.isArray(query) ? query.find((x) => typeof x === 'string') : query;
  const name = String(q).toLowerCase();
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
    } else if (arena?.dataset.phase === 'between') {
      fireEvent.click(within(screen.getByTestId('between-picker')).getAllByRole('button')[0]);
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

  it('TT-03 seven battle grounds (Pokemon stadium chosen by default); choosing one shows which Pokemon it suits', async () => {
    render(<TeamBattle allowScanned collection={COLLECTION} onClose={vi.fn()} random={seeded(3)} />);
    await buildFullTeam();
    const grounds = screen.getByRole('radiogroup', { name: 'Sàn đấu' });
    expect(within(grounds).getAllByRole('radio')).toHaveLength(7);
    expect(within(grounds).getByRole('radio', { name: 'Sân vận động Pokémon' })).toHaveAttribute('aria-checked', 'true');
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

  it('TT-09 after building the team the child picks who goes out first; that Pokemon leads the battle', async () => {
    render(<TeamBattle allowScanned collection={COLLECTION} onClose={vi.fn()} random={seeded(9)} />);
    await buildFullTeam();
    const lead = screen.getByRole('radiogroup', { name: 'Pokémon ra sân đầu tiên' });
    expect(within(lead).getAllByRole('radio')).toHaveLength(5);
    expect(within(lead).getByRole('radio', { name: 'Ra sân đầu: Pikachu' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(lead).getByRole('radio', { name: 'Ra sân đầu: Squirtle' }));
    expect(within(lead).getByRole('radio', { name: 'Ra sân đầu: Squirtle' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByText('Bắt đầu trận đấu!'));
    await advance(400);
    // The children's Pokemon are loaded in battle order: Squirtle first, then the others in team order
    const players = mocks.fetchBattlePokemon.mock.calls.map(([q]) => q).filter(Array.isArray).map((q) => q.find((x) => typeof x === 'string'));
    expect(players).toEqual(['squirtle', 'pikachu', 'charmander', 'bulbasaur', 'eevee']);
    fireEvent.click(screen.getByTestId('team-intro'));
    await advance(400);
    expect(screen.getByTestId('team-arena')).toHaveTextContent('Squirtle');
  });

  it('TT-10 difficulty picker; during the battle the child can switch (costs the turn); after a knock-out: keep or switch', async () => {
    for (const c2 of COLLECTION) mocks.strong.add(c2.id);
    localStorage.removeItem('pokescan_team_difficulty');
    render(<TeamBattle allowScanned collection={COLLECTION} onClose={vi.fn()} random={seeded(10)} />);
    await buildFullTeam();
    const diff = screen.getByRole('radiogroup', { name: 'Độ khó trận đấu' });
    expect(within(diff).getByRole('radio', { name: 'Trung bình' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(diff).getByRole('radio', { name: 'Dễ' }));
    expect(localStorage.getItem('pokescan_team_difficulty')).toBe('easy');
    fireEvent.click(screen.getByText('Bắt đầu trận đấu!'));
    await advance(400);
    fireEvent.click(screen.getByTestId('team-intro'));
    for (let t = 0; t < 20000 && screen.getByTestId('team-arena').dataset.phase !== 'choose'; t += 200) await advance(200);
    expect(screen.getByTestId('battle-difficulty')).toHaveTextContent('Dễ');
    // Switch in the middle of the duel
    fireEvent.click(screen.getByRole('button', { name: 'Đổi Pokémon' }));
    const swap = screen.getByTestId('swap-picker');
    expect(swap).toHaveTextContent('mất lượt');
    fireEvent.click(within(swap).getByRole('button', { name: 'Đổi sang Charmander' }));
    // The new Pokemon comes out with full HP (the opponent's free attack is shown afterwards)
    await advance(800);
    const bar = screen.getByRole('progressbar', { name: 'Máu Charmander' });
    expect(bar.getAttribute('aria-valuenow')).toBe(bar.getAttribute('aria-valuemax'));
    for (let t = 0; t < 20000 && screen.getByTestId('team-arena').dataset.phase !== 'choose' && screen.getByTestId('team-arena').dataset.phase !== 'between'; t += 200) await advance(200);
    expect(screen.getByTestId('team-arena').dataset.pi).toBe('1');
    // Fight until the first knock-out: the keep-or-switch choice appears
    for (let t = 0; t < 120000 && screen.getByTestId('team-arena').dataset.phase !== 'between'; t += 300) {
      const arena = screen.getByTestId('team-arena');
      if (arena.dataset.phase === 'choose') fireEvent.click(within(arena).getAllByRole('button').find((b) => b.textContent.includes('Sức mạnh')));
      else if (arena.dataset.phase === 'switch') fireEvent.click(within(screen.getByTestId('switch-picker')).getAllByRole('button')[0]);
      await advance(300, 300);
    }
    const picker = screen.getByTestId('between-picker');
    expect(picker).toHaveTextContent('Hạ gục');
    const keep = within(picker).getAllByRole('button')[0];
    expect(keep.getAttribute('aria-label')).toMatch(/^Giữ nguyên/);
    fireEvent.click(within(picker).getByRole('button', { name: 'Đổi sang Pikachu' }));
    for (let t = 0; t < 20000 && screen.getByTestId('team-arena').dataset.phase !== 'choose'; t += 200) await advance(200);
    expect(screen.getByTestId('team-arena').dataset.pi).toBe('0');
    expect(screen.getByTestId('team-arena').dataset.oi).toBe('1');
    localStorage.removeItem('pokescan_team_difficulty');
  }, 120000);

  it('TT-11 with scanned Pokemon allowed a line-up can be saved, used next time and deleted', async () => {
    localStorage.removeItem('pokescan_saved_teams_v1');
    const { unmount } = render(<TeamBattle allowScanned collection={COLLECTION} onClose={vi.fn()} random={seeded(11)} />);
    expect(screen.queryByTestId('saved-teams')).toBeNull();
    for (const name of ['Squirtle', 'Pikachu', 'Eevee']) fireEvent.click(screen.getByLabelText(`Thêm ${name} vào đội`));
    fireEvent.click(screen.getByTestId('save-team'));
    expect(screen.getByRole('alert')).toHaveTextContent('Đã lưu "Đội Squirtle +2"');
    expect(within(screen.getByTestId('saved-teams')).getAllByTestId('saved-team')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('save-team'));
    expect(screen.getByRole('alert')).toHaveTextContent('đã được lưu rồi');
    unmount();
    // Next time: the saved line-up fills the team in one tap
    render(<TeamBattle allowScanned collection={COLLECTION} onClose={vi.fn()} random={seeded(12)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dùng Đội Squirtle +2' }));
    const slots = within(screen.getByTestId('team-slots')).getAllByRole('img').map((img) => img.getAttribute('alt'));
    expect(slots).toEqual(['Squirtle', 'Pikachu', 'Eevee']);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa Đội Squirtle +2' }));
    expect(screen.queryByTestId('saved-teams')).toBeNull();
  });

  it('TT-12 saving line-ups is not offered when scanning is required', () => {
    localStorage.setItem('pokescan_saved_teams_v1', JSON.stringify([{ id: 't', name: 'Đội Pikachu', cards: ['pikachu'] }]));
    render(<TeamBattle collection={COLLECTION} onClose={vi.fn()} random={seeded(13)} />);
    expect(screen.queryByTestId('saved-teams')).toBeNull();
    expect(screen.queryByTestId('save-team')).toBeNull();
    localStorage.removeItem('pokescan_saved_teams_v1');
  });
});
