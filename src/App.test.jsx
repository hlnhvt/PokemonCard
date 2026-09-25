import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { makeCard } from './test/fixtures';

const mocks = vi.hoisted(() => ({ fetchPokemonOnline: vi.fn() }));

vi.mock('./utils/cardRecognizer', () => ({ recognizeCardWithOCR: vi.fn() }));
vi.mock('./services/pokemonOnlineService', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchPokemonOnline: mocks.fetchPokemonOnline,
}));

import App from './App';
import { sounds } from './utils/soundEffects';
import { getSavedCollection, saveCardToPokedex } from './utils/storage';

beforeEach(() => {
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
