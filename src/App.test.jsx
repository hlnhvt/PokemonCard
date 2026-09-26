import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { makeCard } from './test/fixtures';

const mocks = vi.hoisted(() => ({ fetchPokemonOnline: vi.fn(), fetchEvolutionChain: vi.fn() }));

const ocr = vi.hoisted(() => ({ recognizeCardWithOCR: vi.fn() }));
vi.mock('./utils/cardRecognizer', () => ocr);
vi.mock('./services/pokemonOnlineService', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchPokemonOnline: mocks.fetchPokemonOnline,
  fetchEvolutionChain: mocks.fetchEvolutionChain,
}));

import App from './App';
import { sounds } from './utils/soundEffects';
import { getSavedCollection, saveCardToPokedex } from './utils/storage';

// jsdom never decodes images: pretend every photo loads
class FakeImage {
  constructor() {
    this.naturalWidth = 630;
    this.naturalHeight = 880;
  }
  set src(value) {
    this._src = value;
    setTimeout(() => this.onload?.(), 0);
  }
  get src() {
    return this._src;
  }
}

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage);
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

// New Pokemon come only from a card photo (the search box opens scanned ones only)
async function scan(name) {
  fireEvent.click(screen.getByText('Quét Thẻ'));
  ocr.recognizeCardWithOCR.mockResolvedValue({ success: true, rawText: name, bestMatch: name, confidence: 100, candidates: [{ name, displayName: name, score: 100 }] });
  const input = document.querySelectorAll('input[type="file"]')[1];
  fireEvent.change(input, { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } });
  fireEvent.click(await screen.findByText('Đúng rồi! Tải Pokémon'));
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
    expect(screen.getByText('Quét thẻ Pokémon')).toBeInTheDocument();
    fireEvent.click(collectionTab());
    expect(screen.getByText('BỘ SƯU TẬP POKÉDEX')).toBeInTheDocument();
    await scan('pikachu');
    fireEvent.click(screen.getByText('Bộ sưu tập'));
    fireEvent.click(screen.getByText('Pikachu'));
    expect(screen.getByRole('heading', { name: 'Pikachu' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tiếp Tục Quét Thẻ Khác'));
    expect(screen.getByText('Quét thẻ Pokémon')).toBeInTheDocument();
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

  it('AP-10 an unscanned form is locked: a message, no details, nothing downloaded or saved', async () => {
    mocks.fetchEvolutionChain.mockResolvedValue([
      { name: 'charmander', id: 4, image: 'a.png', stage: 0, from: null, how: null },
      { name: 'charmeleon', id: 5, image: 'b.png', stage: 1, from: 'charmander', how: 'Đạt cấp 16' },
    ]);
    saveCardToPokedex(makeCard({ id: 'charmander', name: 'Charmander', speciesName: 'charmander', pokedexNumber: '004' }));
    mocks.fetchPokemonOnline.mockResolvedValue(makeCard({ id: 'charmeleon', name: 'Charmeleon', speciesName: 'charmeleon', pokedexNumber: '005' }));
    render(<App />);
    fireEvent.click(collectionTab());
    fireEvent.click(screen.getByRole('heading', { name: 'Charmander' }));
    fireEvent.click(await screen.findByLabelText('Charmeleon (chưa mở khóa)'));
    expect(screen.getByRole('status')).toHaveTextContent('Bé chưa có thẻ Charmeleon');
    expect(mocks.fetchPokemonOnline).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Charmander' })).toBeInTheDocument();
    expect(getSavedCollection()).toHaveLength(1);
  });

  it('AP-11 games tab shows the silhouette quiz', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Trò Chơi').closest('button'));
    expect(screen.getByText('Ai là Pokémon này?')).toBeInTheDocument();
    expect(screen.getByText('Câu 1/10')).toBeInTheDocument();
  });

  it('AP-12 the theme menu offers dark, light, ocean and Pokédex', () => {
    render(<App />);
    const button = () => screen.getByLabelText(/Đổi giao diện/);
    const choose = (label) => {
      fireEvent.click(button());
      const menu = screen.getByRole('menu', { name: 'Chọn giao diện' });
      expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(4);
      fireEvent.click(within(menu).getByRole('menuitemradio', { name: new RegExp(label) }));
      expect(screen.queryByRole('menu')).toBeNull();
    };
    expect(document.documentElement.dataset.theme).toBe('dark');
    choose('Pokédex');
    expect(document.documentElement.dataset.theme).toBe('pokedex');
    expect(button()).toHaveAccessibleName(/Pokédex/);
    choose('Sáng');
    expect(document.documentElement.dataset.theme).toBe('light');
    choose('Xanh biển');
    expect(document.documentElement.dataset.theme).toBe('ocean');
    // Tapping outside closes the menu without changing the theme
    fireEvent.click(button());
    fireEvent.click(screen.getByLabelText('Đóng menu giao diện'));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('ocean');
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
      fireEvent.click(screen.getByText(/Chơi cùng Charizard/));
      fireEvent.click(screen.getByText('Ném bóng bắt Pokémon'));
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

  it('AP-14 feeding from the detail page spends a berry and raises friendship', async () => {
    saveCardToPokedex(makeCard());
    render(<App />);
    fireEvent.click(collectionTab());
    fireEvent.click(screen.getByRole('heading', { name: 'Charizard' }));
    fireEvent.click(screen.getByLabelText('Cho ăn quả Oran (còn 3)'));
    expect(await screen.findByLabelText('Cho ăn quả Oran (còn 2)')).toBeInTheDocument();
    expect(getSavedCollection()[0].friendship).toBe(20); // oran is Charizard's favourite
    expect(screen.getByLabelText('Thân thiết 20/100')).toBeInTheDocument();
    fireEvent.click(collectionTab());
    expect(screen.getByText('❤ Bạn bè')).toBeInTheDocument();
  });

  it('AP-15 gold in the header opens the gift shop; a bought treat is given from the Pokemon page', async () => {
    for (const s of ['playCoin', 'playMunch', 'playPop']) vi.spyOn(sounds, s).mockImplementation(() => {});
    saveCardToPokedex(makeCard({ id: 'pikachu', name: 'Pikachu', friendship: 10 }));
    render(<App />);
    expect(screen.getByTestId('header-gold')).toHaveTextContent('20');
    fireEvent.click(screen.getByLabelText('Tiệm quà, đang có 20 vàng'));
    const shop = screen.getByRole('dialog', { name: 'Tiệm quà Pokémon' });
    fireEvent.click(within(shop).getByLabelText('Mua Bánh quy Poké giá 10 vàng'));
    expect(screen.getByTestId('header-gold')).toHaveTextContent('10');
    fireEvent.click(within(shop).getByLabelText('Mua Bánh quy Poké giá 10 vàng'));
    fireEvent.click(within(shop).getByLabelText('Mua Bánh kem giá 25 vàng'));
    expect(within(shop).getByRole('status')).toHaveTextContent('cần thêm 25 vàng');
    fireEvent.click(within(shop).getByLabelText('Đóng tiệm quà'));

    fireEvent.click(collectionTab());
    fireEvent.click(screen.getByRole('heading', { name: 'Pikachu' }));
    fireEvent.click(screen.getByLabelText('Tặng Bánh quy Poké'));
    expect(getSavedCollection()[0].friendship).toBe(14);
    expect(screen.getByLabelText('Tặng Bánh quy Poké')).toHaveTextContent('1');
  });

  it('AP-16 finishing a game pays gold: a toast and the header go up', async () => {
    vi.useFakeTimers();
    vi.spyOn(sounds, 'playNote').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    saveCardToPokedex(makeCard({ id: 'pikachu', name: 'Pikachu' }));
    render(<App />);
    fireEvent.click(screen.getByText('Trò Chơi').closest('button'));
    fireEvent.click(screen.getByLabelText('Chơi nhạc'));
    fireEvent.click(screen.getByLabelText('Bánh nóng giòn'));
    const { songById, NOTES } = await import('./utils/logic/music');
    for (const n of songById('hotcross').melody) fireEvent.pointerDown(screen.getByLabelText('Phím ' + NOTES[n.note].label));
    try {
      for (let t = 0; t < 16000 && screen.getByTestId('header-gold').textContent !== '35'; t += 250) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(250);
        });
      }
      expect(screen.getByTestId('header-gold')).toHaveTextContent('35');
      expect(screen.getByTestId('gold-toast')).toHaveTextContent('+15 vàng');
    } finally {
      vi.useRealTimers();
    }
  });

  it('AP-17 settings: using scanned Pokemon in the team battle is off by default and can be turned on', () => {
    saveCardToPokedex(makeCard({ id: 'pikachu', name: 'Pikachu' }));
    render(<App />);
    fireEvent.click(screen.getByText('Trò Chơi').closest('button'));
    fireEvent.click(screen.getByLabelText('Đấu đội 5 vs 5'));
    expect(screen.queryByLabelText('Thêm Pikachu vào đội')).toBeNull();
    fireEvent.click(screen.getByLabelText('Đóng đấu đội'));
    fireEvent.click(screen.getByLabelText('Cài đặt'));
    const toggle = screen.getByRole('switch', { name: 'Cho phép chọn Pokémon đã quét' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(JSON.parse(localStorage.getItem('pokescan_settings_v1')).teamUseScanned).toBe(true);
    fireEvent.click(screen.getByLabelText('Đóng'));
    fireEvent.click(screen.getByLabelText('Đấu đội 5 vs 5'));
    expect(screen.getByLabelText('Thêm Pikachu vào đội')).toBeInTheDocument();
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
