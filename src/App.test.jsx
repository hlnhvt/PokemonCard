import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { makeCard } from './test/fixtures';

const mocks = vi.hoisted(() => ({ fetchPokemonOnline: vi.fn(), fetchEvolutionChain: vi.fn() }));

vi.mock('./utils/cardRecognizer', () => ({ recognizeCardWithOCR: vi.fn() }));
vi.mock('./services/pokemonOnlineService', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchPokemonOnline: mocks.fetchPokemonOnline,
  fetchEvolutionChain: mocks.fetchEvolutionChain,
}));

import App from './App';
import { sounds } from './utils/soundEffects';
import { getSavedCollection, saveCardToPokedex } from './utils/storage';

beforeEach(() => {
  // No shiny unless a test asks for one; evolution data is mocked per test
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  mocks.fetchEvolutionChain.mockReset();
  mocks.fetchEvolutionChain.mockResolvedValue([]);
  mocks.fetchPokemonOnline.mockReset();
  mocks.fetchPokemonOnline.mockImplementation(async (name) =>
    makeCard({ id: name.toLowerCase(), name: name.charAt(0).toUpperCase() + name.slice(1) })
  );
  for (const s of ['playShutter', 'playScanBeep', 'playEnergySurge', 'playPokemonCry', 'playSuccessFanfare']) {
    vi.spyOn(sounds, s).mockImplementation(() => {});
  }
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

async function scan(name) {
  fireEvent.click(screen.getByText('Quét Thẻ'));
  fireEvent.change(screen.getByLabelText('Tìm Pokémon theo tên'), { target: { value: name } });
  fireEvent.click(screen.getByText('Tải'));
  fireEvent.click(await screen.findByText('Bỏ qua'));
  await screen.findByText('Tiếp Tục Quét Thẻ Khác');
}

const scanCountOf = (id) => getSavedCollection().find((c) => c.id === id)?.scanCount;
const collectionTab = () => screen.getByText('Bộ Sưu Tập').closest('button');

describe('App flows', () => {
  it('AP-01 scan -> video -> skip saves once and shows details', async () => {
    render(<App />);
    await scan('charizard');
    expect(screen.getByRole('heading', { name: 'Charizard' })).toBeInTheDocument();
    expect(scanCountOf('charizard')).toBe(1);
    expect(getSavedCollection()).toHaveLength(1);
    expect(within(collectionTab()).getByText('1')).toBeInTheDocument();
  });

  it('AP-02 replaying the video from details does not count as a scan', async () => {
    render(<App />);
    await scan('charizard');
    fireEvent.click(screen.getByText('Xem lại Video'));
    fireEvent.click(await screen.findByText('Bỏ qua'));
    await screen.findByText('Tiếp Tục Quét Thẻ Khác');
    expect(scanCountOf('charizard')).toBe(1);
  });

  it('AP-03 replaying from the collection does not count and opens details', async () => {
    saveCardToPokedex(makeCard());
    render(<App />);
    fireEvent.click(collectionTab());
    fireEvent.click(screen.getByText('Video'));
    fireEvent.click(await screen.findByText('Bỏ qua'));
    await screen.findByText('Tiếp Tục Quét Thẻ Khác');
    expect(scanCountOf('charizard')).toBe(1);
    expect(screen.getByRole('heading', { name: 'Charizard' })).toBeInTheDocument();
  });

  it('AP-04 scanning the same Pokemon again increments the count', async () => {
    render(<App />);
    await scan('charizard');
    await scan('charizard');
    expect(scanCountOf('charizard')).toBe(2);
    expect(getSavedCollection()).toHaveLength(1);
  });

  it('AP-05 tab navigation', async () => {
    render(<App />);
    expect(screen.getByText('QUÉT THẺ & ĐỒNG BỘ DỮ LIỆU ONLINE')).toBeInTheDocument();
    fireEvent.click(collectionTab());
    expect(screen.getByText('BỘ SƯU TẬP POKÉDEX')).toBeInTheDocument();
    await scan('pikachu');
    fireEvent.click(screen.getByText('Bộ sưu tập'));
    fireEvent.click(screen.getByText('Pikachu'));
    expect(screen.getByRole('heading', { name: 'Pikachu' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tiếp Tục Quét Thẻ Khác'));
    expect(screen.getByText('QUÉT THẺ & ĐỒNG BỘ DỮ LIỆU ONLINE')).toBeInTheDocument();
  });

  it('AP-06 mute toggle keeps the sound manager in sync', () => {
    render(<App />);
    const before = sounds.isMuted();
    fireEvent.click(screen.getByLabelText('Toggle Sound'));
    expect(sounds.isMuted()).toBe(!before);
    fireEvent.click(screen.getByLabelText('Toggle Sound'));
    expect(sounds.isMuted()).toBe(before);
  });

  it('AP-07 shows the saved collection count on start', () => {
    saveCardToPokedex(makeCard());
    saveCardToPokedex(makeCard({ id: 'mew', name: 'Mew' }));
    render(<App />);
    expect(within(collectionTab()).getByText('2')).toBeInTheDocument();
  });

  it('AP-08 a lucky scan is shiny: banner, shiny toggle and unlocked in the collection', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<App />);
    await scan('charizard');
    expect(screen.getByText(/SHINY siêu hiếm/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shiny/ })).toHaveAttribute('aria-pressed', 'true');
    expect(getSavedCollection()[0].shinyUnlocked).toBe(true);
  });

  it('AP-09 evolving after enough scans adds the evolved form and opens it', async () => {
    mocks.fetchEvolutionChain.mockResolvedValue([
      { name: 'charmander', id: 4, image: 'a.png', stage: 0, from: null, how: null },
      { name: 'charmeleon', id: 5, image: 'b.png', stage: 1, from: 'charmander', how: 'Đạt cấp 16' },
    ]);
    const charmander = makeCard({ id: 'charmander', name: 'Charmander', speciesName: 'charmander', pokedexNumber: '004' });
    for (let i = 0; i < 3; i++) saveCardToPokedex(charmander);
    mocks.fetchPokemonOnline.mockResolvedValue(makeCard({ id: 'charmeleon', name: 'Charmeleon', speciesName: 'charmeleon', pokedexNumber: '005' }));
    render(<App />);
    fireEvent.click(collectionTab());
    fireEvent.click(screen.getByRole('heading', { name: 'Charmander' }));
    fireEvent.click(await screen.findByText('Tiến hóa thành Charmeleon!'));
    fireEvent.click(await screen.findByText('Xem Charmeleon', {}, { timeout: 4000 }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Charmeleon' })).toBeInTheDocument();
    expect(getSavedCollection().map((c) => c.id)).toEqual(['charmeleon', 'charmander']);
  });

  it('AP-10 tapping an uncollected form opens a preview that is not saved', async () => {
    mocks.fetchEvolutionChain.mockResolvedValue([
      { name: 'charmander', id: 4, image: 'a.png', stage: 0, from: null, how: null },
      { name: 'charmeleon', id: 5, image: 'b.png', stage: 1, from: 'charmander', how: 'Đạt cấp 16' },
    ]);
    saveCardToPokedex(makeCard({ id: 'charmander', name: 'Charmander', speciesName: 'charmander', pokedexNumber: '004' }));
    mocks.fetchPokemonOnline.mockResolvedValue(makeCard({ id: 'charmeleon', name: 'Charmeleon', speciesName: 'charmeleon', pokedexNumber: '005' }));
    render(<App />);
    fireEvent.click(collectionTab());
    fireEvent.click(screen.getByRole('heading', { name: 'Charmander' }));
    fireEvent.click(await screen.findByText('Charmeleon'));
    expect(await screen.findByText('BÉ CHƯA CÓ POKÉMON NÀY')).toBeInTheDocument();
    expect(screen.queryByText('Xem lại Video')).toBeNull();
    expect(getSavedCollection()).toHaveLength(1);
  });

  it('AP-11 games tab shows the silhouette quiz', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Trò Chơi').closest('button'));
    expect(screen.getByText('Ai là Pokémon này?')).toBeInTheDocument();
    expect(screen.getByText('Câu 1/10')).toBeInTheDocument();
  });

  it('AP-12 theme button cycles dark, light and ocean', () => {
    render(<App />);
    const button = () => screen.getByLabelText(/Đổi giao diện/);
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(button());
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(button()).toHaveAccessibleName(/Sáng/);
    fireEvent.click(button());
    expect(document.documentElement.dataset.theme).toBe('ocean');
    fireEvent.click(button());
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('AP-13 a catch in the minigame is recorded on the saved card', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      saveCardToPokedex(makeCard());
      vi.spyOn(Math, 'random').mockReturnValue(0);
      vi.spyOn(performance, 'now').mockReturnValue(0);
      render(<App />);
      fireEvent.click(collectionTab());
      fireEvent.click(screen.getByRole('heading', { name: 'Charizard' }));
      fireEvent.click(screen.getByText(/Chơi Ném Bóng/));
      fireEvent.click(screen.getByText('NÉM!'));
      // flight + absorb + drop + 3 shakes
      for (let i = 0; i < 40; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(100);
        });
      }
      expect(getSavedCollection()[0].catchCount).toBe(1);
      expect(screen.getByText('Đã bắt 1 lần')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('AP-01b warns in details when LocalStorage refuses the save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    render(<App />);
    await scan('charizard');
    await waitFor(() => expect(screen.getByText('CHƯA LƯU ĐƯỢC VÀO BỘ SƯU TẬP')).toBeInTheDocument());
  });
});
