import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PokedexCollection } from './PokedexCollection';
import { saveCardToPokedex, getSavedCollection } from '../utils/storage';
import { makeCard } from '../test/fixtures';

const CARDS = [
  makeCard(),
  makeCard({ id: 'umbreon', name: 'Umbreon', pokedexNumber: '197', types: ['Dark'], species: 'Moonlight Pokémon' }),
  makeCard({ id: 'bulbasaur', name: 'Bulbasaur', pokedexNumber: '001', types: ['Grass', 'Poison'], species: 'Seed Pokémon' }),
];

function seed(cards = CARDS) {
  [...cards].reverse().forEach((c) => saveCardToPokedex(c));
}

function Harness({ handlers }) {
  const [collection, setCollection] = useState(getSavedCollection);
  return <PokedexCollection collection={collection} setCollection={setCollection} {...handlers} />;
}

function renderCollection() {
  const handlers = { onSelectCard: vi.fn(), onReplayVideo: vi.fn(), onScanNew: vi.fn() };
  render(<Harness handlers={handlers} />);
  return handlers;
}

const visibleNames = () => screen.queryAllByRole('heading', { level: 4 }).map((h) => h.textContent);

describe('PokedexCollection', () => {
  it('CO-01 shows onboarding when empty', () => {
    renderCollection();
    expect(screen.getByText(/Hãy dùng Camera hoặc chọn Thẻ Mẫu/)).toBeInTheDocument();
  });

  it('CO-02 searches by name case-insensitively and by species', () => {
    seed();
    renderCollection();
    const input = screen.getByPlaceholderText(/Tìm theo tên Pokemon/);
    fireEvent.change(input, { target: { value: 'UMB' } });
    expect(visibleNames()).toEqual(['Umbreon']);
    fireEvent.change(input, { target: { value: 'seed' } });
    expect(visibleNames()).toEqual(['Bulbasaur']);
  });

  it.each(['#006', '006', ' #006 '])('CO-03 finds by Pokedex number %p', (q) => {
    seed();
    renderCollection();
    fireEvent.change(screen.getByPlaceholderText(/Tìm theo tên Pokemon/), { target: { value: q } });
    expect(visibleNames()).toEqual(['Charizard']);
  });

  it('CO-04 type filters come from the collection and filter correctly', () => {
    seed();
    renderCollection();
    for (const t of ['ALL', 'DARK', 'FIRE', 'FLYING', 'GRASS', 'POISON']) {
      expect(screen.getByRole('button', { name: t })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'DARKNESS' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'DARK' }));
    expect(visibleNames()).toEqual(['Umbreon']);
    fireEvent.click(screen.getByRole('button', { name: 'GRASS' }));
    expect(visibleNames()).toEqual(['Bulbasaur']);
  });

  it('CO-05 / CO-06 favorite toggle does not open details and filters', () => {
    seed();
    const h = renderCollection();
    const card = screen.getByText('Umbreon').closest('.group');
    fireEvent.click(within(card).getAllByRole('button')[0]);
    expect(h.onSelectCard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByPlaceholderText(/Tìm theo tên/).parentElement.nextElementSibling);
    expect(visibleNames()).toEqual(['Umbreon']);
  });

  it('CO-07 delete asks for confirmation and does not open details', () => {
    seed();
    const h = renderCollection();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const deleteBtn = () => within(screen.getByText('Umbreon').closest('.group')).getAllByRole('button')[1];
    fireEvent.click(deleteBtn());
    expect(visibleNames()).toContain('Umbreon');
    fireEvent.click(deleteBtn());
    expect(visibleNames()).not.toContain('Umbreon');
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(h.onSelectCard).not.toHaveBeenCalled();
    expect(getSavedCollection()).toHaveLength(2);
  });

  it('CO-08 clear all empties the collection', () => {
    seed();
    renderCollection();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByTitle('Xóa tất cả thẻ'));
    expect(visibleNames()).toEqual([]);
    expect(getSavedCollection()).toEqual([]);
  });

  it('CO-09 stats are computed correctly', () => {
    seed();
    saveCardToPokedex(makeCard()); // charizard scanned twice
    renderCollection();
    fireEvent.click(within(screen.getByText('Charizard').closest('.group')).getAllByRole('button')[0]);
    const stat = (label) => screen.getByText(label).parentElement.querySelector('span.text-xl').textContent;
    expect(stat('Thẻ Đã Có')).toBe('3');
    expect(stat('Tổng Lần Quét')).toBe('4');
    expect(stat('Yêu Thích')).toBe('1');
  });

  it('CO-10 video button replays without opening details; card click opens details', () => {
    seed();
    const h = renderCollection();
    const card = screen.getByText('Umbreon').closest('.group');
    fireEvent.click(within(card).getByText('Video'));
    expect(h.onReplayVideo).toHaveBeenCalledWith(expect.objectContaining({ id: 'umbreon' }));
    expect(h.onSelectCard).not.toHaveBeenCalled();
    fireEvent.click(card);
    expect(h.onSelectCard).toHaveBeenCalledWith(expect.objectContaining({ id: 'umbreon' }));
  });

  it('CO-11 shows a no-result message', () => {
    seed();
    renderCollection();
    fireEvent.change(screen.getByPlaceholderText(/Tìm theo tên Pokemon/), { target: { value: 'zzz' } });
    expect(screen.getByText('Không tìm thấy thẻ bài nào khớp với từ khóa tìm kiếm.')).toBeInTheDocument();
  });
});
