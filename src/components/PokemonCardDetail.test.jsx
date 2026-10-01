import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PokemonCardDetail } from './PokemonCardDetail';
import { sounds } from '../utils/soundEffects';
import { makeCard } from '../test/fixtures';

beforeEach(() => {
  vi.spyOn(sounds, 'playSuccessFanfare').mockImplementation(() => {});
  vi.spyOn(sounds, 'playPokemonCry').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

function renderDetail(props = {}) {
  const handlers = { onScanNext: vi.fn(), onReplayVideo: vi.fn(), onViewCollection: vi.fn() };
  const card = props.pokemon || makeCard();
  render(
    <PokemonCardDetail
      pokemon={card}
      savedItem={'savedItem' in props ? props.savedItem : { ...card, scanCount: 3 }}
      {...handlers}
    />
  );
  return handlers;
}

describe('PokemonCardDetail', () => {
  it('DT-12 "Chơi cùng" opens the 5 games that suit this Pokemon, with the reason', () => {
    renderDetail();
    fireEvent.click(screen.getByText(/Chơi cùng Charizard/));
    const picker = screen.getByRole('dialog', { name: 'Chọn trò chơi' });
    const tiles = picker.querySelectorAll('li button');
    expect(tiles).toHaveLength(5);
    expect(tiles[0]).toHaveAccessibleName(/Cưỡi Charizard/);
    expect(picker).toHaveTextContent('Dành riêng cho Charizard');
    expect(picker).toHaveTextContent('Hợp hệ Lửa');
  });

  it('DT-13 artwork without a background sits in a scene of its type; a real card scan fills the card', () => {
    const { container, unmount } = render(<PokemonCardDetail pokemon={makeCard({ image: 'https://raw.githubusercontent.com/x/official-artwork/6.png' })} onScanNext={vi.fn()} />);
    expect(container.querySelector('svg[data-type="fire"]')).not.toBeNull();
    expect(screen.getAllByAltText('Charizard')[0].className).toContain('object-contain');
    unmount();
    const scan = render(<PokemonCardDetail pokemon={makeCard({ image: 'https://images.pokemontcg.io/base1/4_hires.png' })} onScanNext={vi.fn()} />);
    expect(scan.container.querySelector('svg[data-type]')).toBeNull();
    expect(screen.getAllByAltText('Charizard')[0].className).toContain('object-cover');
  });

  it('DT-01 renders the main card info', () => {
    renderDetail();
    expect(screen.getByRole('heading', { name: 'Charizard' })).toBeInTheDocument();
    expect(screen.getByText('FIRE')).toBeInTheDocument();
    expect(screen.getByText('Flamethrower')).toBeInTheDocument();
    expect(screen.getByText('Water ×2')).toBeInTheDocument();
    expect(screen.getByText(/It spits fire/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('LƯU DỮ LIỆU THÀNH CÔNG')).toBeInTheDocument();
  });

  it('DT-02 does not crash on a card with missing fields', () => {
    const legacy = { id: 'old', name: 'Oldmon', pokedexNumber: '999' };
    expect(() => renderDetail({ pokemon: legacy })).not.toThrow();
    expect(screen.getByRole('heading', { name: 'Oldmon' })).toBeInTheDocument();
  });

  it.each([-2, NaN, undefined, '3', 99])('DT-03 handles retreatCost %p', (retreatCost) => {
    expect(() => renderDetail({ pokemon: makeCard({ retreatCost }) })).not.toThrow();
  });

  it('DT-04 share without share or clipboard API does not crash', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: undefined });
    renderDetail();
    fireEvent.click(screen.getByText('Chia sẻ thẻ'));
    expect(await screen.findByText('Không thể chia sẻ')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('DT-05 copies to clipboard when available', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
    renderDetail();
    fireEvent.click(screen.getByText('Chia sẻ thẻ'));
    expect(await screen.findByText('Đã sao chép!')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Charizard'));
    vi.unstubAllGlobals();
  });

  it.each(['Dark', 'Grass', 'Ice', 'Ghost', 'Fairy'])('DT-06 type %s has its own badge color', (type) => {
    renderDetail({ pokemon: makeCard({ types: [type] }) });
    expect(screen.getByText(type.toUpperCase()).className).not.toContain('bg-slate-700');
  });

  it('DT-07 warns when the card could not be saved', () => {
    renderDetail({ savedItem: null });
    expect(screen.getByText('CHƯA LƯU ĐƯỢC VÀO BỘ SƯU TẬP')).toBeInTheDocument();
    expect(screen.queryByText('LƯU DỮ LIỆU THÀNH CÔNG')).toBeNull();
  });

  it('DT-08 swaps a broken card image for the artwork', () => {
    renderDetail();
    // First image with this alt text is the TCG card; the second is the buddy artwork
    const img = screen.getAllByAltText('Charizard')[0];
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', 'https://example.test/charizard-art.png');
  });

  it('DT-09 action buttons call their callbacks', async () => {
    const h = renderDetail();
    fireEvent.click(screen.getByText('Xem lại Video'));
    fireEvent.click(screen.getByText('Bộ sưu tập'));
    fireEvent.click(screen.getByText('Tiếp Tục Quét Thẻ Khác'));
    fireEvent.click(screen.getByText('Tiếng gầm'));
    await waitFor(() => expect(h.onScanNext).toHaveBeenCalledTimes(1));
    expect(h.onReplayVideo).toHaveBeenCalledTimes(1);
    expect(h.onViewCollection).toHaveBeenCalledTimes(1);
    expect(sounds.playPokemonCry).toHaveBeenCalledWith('Fire');
  });
});
