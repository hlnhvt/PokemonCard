import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { makeCard } from '../test/fixtures';

const mocks = vi.hoisted(() => ({ fetchEvolutionChain: vi.fn() }));
vi.mock('../services/pokemonOnlineService', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchEvolutionChain: mocks.fetchEvolutionChain,
}));

import { PokemonBuddy } from './PokemonBuddy';
import { EvolutionTree } from './EvolutionTree';
import { RunnerGame } from './RunnerGame';
import { sounds } from '../utils/soundEffects';

beforeEach(() => {
  vi.useFakeTimers();
  for (const s of ['playMunch', 'playSuccessFanfare', 'playPokemonCry', 'playJump', 'playPop', 'playScanBeep']) {
    vi.spyOn(sounds, s).mockImplementation(() => {});
  }
});
afterEach(() => vi.useRealTimers());

async function advance(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const care = (over = {}) => ({ enabled: true, friendship: 10, fedToday: 0, favoriteFound: false, berries: { oran: 2, razz: 0 }, ...over });

describe('PokemonBuddy care', () => {
  it('BU-04 feeding flies a berry in, then munches, shows the gain and celebrates a level up', async () => {
    const onFeed = vi.fn(() => ({ result: 'fed', gain: 20, favorite: true, levelUp: { label: 'Bạn bè', hearts: 1 } }));
    render(<PokemonBuddy pokemon={makeCard()} care={care()} onFeed={onFeed} />);
    fireEvent.click(screen.getByLabelText('Cho ăn quả Oran (còn 2)'));
    expect(onFeed).toHaveBeenCalledWith('oran');
    expect(screen.getByTestId('flying-berry')).toBeInTheDocument();
    await advance(500);
    expect(screen.queryByTestId('flying-berry')).toBeNull();
    expect(sounds.playMunch).toHaveBeenCalled();
    expect(screen.getByText('+20 Món yêu thích!')).toBeInTheDocument();
    expect(screen.getByText('🎉 Giờ là Bạn bè!')).toBeInTheDocument();
    expect(screen.getAllByText('❤️').length).toBeGreaterThanOrEqual(5);
  });

  it('BU-05 explains an empty bag and a full tummy', async () => {
    const onFeed = vi.fn().mockReturnValueOnce({ result: 'noBerry' }).mockReturnValueOnce({ result: 'full' });
    render(<PokemonBuddy pokemon={makeCard()} care={care()} onFeed={onFeed} />);
    fireEvent.click(screen.getByLabelText('Cho ăn quả Razz (còn 0)'));
    expect(screen.getByRole('alert')).toHaveTextContent('Chơi Chạy Nhảy để nhặt thêm');
    await advance(3000);
    fireEvent.click(screen.getByLabelText('Cho ăn quả Oran (còn 2)'));
    expect(screen.getByRole('alert')).toHaveTextContent('no căng bụng');
    expect(screen.queryByTestId('flying-berry')).toBeNull();
  });

  it('BU-06 shows level, hearts, today count and the discovered favourite', () => {
    render(<PokemonBuddy pokemon={makeCard()} care={care({ friendship: 55, fedToday: 3, favoriteFound: true })} />);
    expect(screen.getByText('Bạn thân')).toBeInTheDocument();
    expect(screen.getByLabelText('Thân thiết 55/100')).toBeInTheDocument();
    expect(screen.getByText('Hôm nay đã ăn 3/5')).toBeInTheDocument();
    expect(screen.getByText(/Thích nhất/)).toHaveTextContent('Oran');
  });

  it('BU-07 uncollected Pokemon cannot be fed; petting reports level ups', () => {
    const { unmount } = render(<PokemonBuddy pokemon={makeCard()} care={{ enabled: false }} />);
    expect(screen.getByText(/Quét thẻ Charizard để chăm sóc/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Cho ăn quả/)).toBeNull();
    unmount();
    const onPet = vi.fn(() => ({ gain: 1, levelUp: { label: 'Bạn bè', hearts: 1 } }));
    render(<PokemonBuddy pokemon={makeCard()} care={care({ friendship: 19 })} onPet={onPet} />);
    fireEvent.click(screen.getByLabelText('Chạm vào Charizard'));
    expect(onPet).toHaveBeenCalled();
    expect(screen.getByText('🎉 Giờ là Bạn bè!')).toBeInTheDocument();
  });
});

describe('friendship evolutions', () => {
  const PICHU_CHAIN = [
    { name: 'pichu', id: 172, image: 'p.png', stage: 0, from: null, how: null },
    { name: 'pikachu', id: 25, image: 'k.png', stage: 1, from: 'pichu', how: 'Rất thân thiết', needsFriendship: true },
  ];
  const pichu = makeCard({ id: 'pichu', name: 'Pichu', speciesName: 'pichu', pokedexNumber: '172' });

  it('EV-07 a friendship evolution waits for friendship, not scans', async () => {
    vi.useRealTimers();
    mocks.fetchEvolutionChain.mockResolvedValue(PICHU_CHAIN);
    const { rerender } = render(<EvolutionTree pokemon={pichu} scanCount={10} friendship={40} />);
    expect(await screen.findByText(/thân thiết đạt/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Tiến độ thân thiết' })).toHaveAttribute('aria-valuenow', '40');
    expect(screen.queryByText('Tiến hóa thành Pikachu!')).toBeNull();
    rerender(<EvolutionTree pokemon={pichu} scanCount={0} friendship={80} />);
    expect(screen.getByText('Tiến hóa thành Pikachu!')).toBeInTheDocument();
  });

  it('EV-08 Eevee: stone branches follow scans, friendship branches follow care', async () => {
    vi.useRealTimers();
    mocks.fetchEvolutionChain.mockResolvedValue([
      { name: 'eevee', id: 133, image: 'e.png', stage: 0, from: null, how: null },
      { name: 'vaporeon', id: 134, image: 'v.png', stage: 1, from: 'eevee', how: 'Dùng Đá Nước', needsFriendship: false },
      { name: 'umbreon', id: 197, image: 'u.png', stage: 1, from: 'eevee', how: 'Rất thân thiết (ban đêm)', needsFriendship: true },
    ]);
    const eevee = makeCard({ id: 'eevee', name: 'Eevee', speciesName: 'eevee', pokedexNumber: '133' });
    render(<EvolutionTree pokemon={eevee} scanCount={3} friendship={10} />);
    expect(await screen.findByText('Tiến hóa thành Vaporeon!')).toBeInTheDocument();
    expect(screen.queryByText('Tiến hóa thành Umbreon!')).toBeNull();
    expect(screen.getByText(/và tiến hóa thành/)).toHaveTextContent('Umbreon');
  });
});

describe('runner berries into the bag', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('RG-05 berries picked up mid-run are kept when the game is closed', async () => {
    const onBerries = vi.fn();
    const { unmount } = render(<RunnerGame pokemon={makeCard()} image="x.png" onClose={vi.fn()} onBerries={onBerries} random={() => 0.1} />);
    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyUp(window, { code: 'Space' });
    // random 0.1 spawns a berry after every obstacle; jumping often picks some up
    for (let i = 0; i < 60; i++) {
      await advance(250);
      fireEvent.keyDown(window, { code: 'Space' });
      fireEvent.keyUp(window, { code: 'Space' });
    }
    const shown = Number(screen.getByLabelText(/Nhặt được \d+ quả mọng/).textContent.replace(/\D/g, ''));
    expect(shown).toBeGreaterThan(0);
    // Awarded at game over, or when closing mid-run - never twice
    const status = screen.getByRole('dialog').dataset.status;
    expect(onBerries).toHaveBeenCalledTimes(status === 'over' ? 1 : 0);
    unmount();
    expect(onBerries).toHaveBeenCalledTimes(1);
    const total = Object.values(onBerries.mock.calls[0][0]).reduce((a, b) => a + b, 0);
    expect(total).toBe(shown);
  });
});
