import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { GiftShop } from './GiftShop';
import { PokemonBuddy } from './PokemonBuddy';
import { GoldReward } from './kidgames/Common';
import { sounds } from '../utils/soundEffects';
import { makeCard } from '../test/fixtures';

beforeEach(() => {
  for (const s of ['playPop', 'playCoin', 'playOops', 'playMunch', 'playJump', 'playSuccessFanfare', 'playPokemonCry']) vi.spyOn(sounds, s).mockImplementation(() => {});
});

describe('GiftShop', () => {
  it('GS-01 three tabs of items with prices; buying reports back; not enough gold explains why', () => {
    const onBuy = vi.fn((id) => (id === 'cake' ? { result: 'poor', gold: 12, bag: {} } : { result: 'ok', gold: 2, bag: { cookie: 1 } }));
    render(<GiftShop gold={12} bag={{}} onBuy={onBuy} onClose={vi.fn()} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['🍰 Đồ ăn', '🧸 Đồ chơi', '🎀 Vật dụng']);
    fireEvent.click(screen.getByLabelText('Mua Bánh quy Poké giá 10 vàng'));
    expect(onBuy).toHaveBeenCalledWith('cookie');
    expect(sounds.playCoin).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Bánh quy Poké đã vào túi');
    fireEvent.click(screen.getByLabelText('Mua Bánh kem giá 25 vàng'));
    expect(screen.getByRole('status')).toHaveTextContent('cần thêm 13 vàng');
    fireEvent.click(screen.getByRole('tab', { name: /Vật dụng/ }));
    expect(screen.getByLabelText('Mua Vương miện giá 60 vàng')).toBeInTheDocument();
  });

  it('GS-02 owned toys show "Đã có" and cannot be bought again; bag count; Esc closes', () => {
    const onClose = vi.fn();
    render(<GiftShop gold={100} bag={{ ball: 1, cake: 2 }} onBuy={vi.fn()} onClose={onClose} />);
    expect(screen.getByTestId('bag-count')).toHaveTextContent('3');
    expect(screen.getByLabelText('Mua Bánh kem giá 25 vàng')).toHaveTextContent('Có 2');
    fireEvent.click(screen.getByRole('tab', { name: /Đồ chơi/ }));
    const ball = screen.getByLabelText('Mua Quả bóng giá 20 vàng');
    expect(ball).toBeDisabled();
    expect(ball).toHaveTextContent('Đã có');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('GS-03 gold reward badge', () => {
    render(<GoldReward amount={15} />);
    expect(screen.getByTestId('gold-reward')).toHaveTextContent('+15 vàng');
  });
});

describe('PokemonBuddy gifts', () => {
  const pikachu = makeCard({ id: 'pikachu', name: 'Pikachu' });

  it('PB-01 giving a treat flies it to the Pokemon and shows the friendship gained', async () => {
    vi.useFakeTimers();
    const onGive = vi.fn(() => ({ result: 'ok', gain: 4, levelUp: null, card: pikachu, bag: {} }));
    render(<PokemonBuddy pokemon={pikachu} care={{ enabled: true }} gifts={{ enabled: true, bag: { cookie: 2 }, card: pikachu, onGive }} />);
    const give = screen.getByLabelText('Tặng Bánh quy Poké');
    expect(give).toHaveTextContent('2');
    fireEvent.click(give);
    expect(onGive).toHaveBeenCalledWith('cookie');
    expect(screen.getByTestId('flying-gift')).toHaveTextContent('🍪');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(sounds.playMunch).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('+4 ❤️');
    vi.useRealTimers();
  });

  it('PB-02 explains why a gift was not taken; worn and room items show on the Pokemon', () => {
    const card = { ...pikachu, decor: ['crown', 'bed'], wearing: 'crown' };
    const onGive = vi.fn(() => ({ result: 'played', gain: 0 }));
    render(<PokemonBuddy pokemon={pikachu} care={{ enabled: true }} gifts={{ enabled: true, bag: { ball: 1 }, card, onGive }} />);
    expect(screen.getByLabelText('Đang đội Vương miện')).toHaveTextContent('👑');
    expect(screen.getByLabelText('Giường êm')).toHaveTextContent('🛏️');
    fireEvent.click(screen.getByLabelText('Tặng Quả bóng'));
    expect(screen.getByRole('alert')).toHaveTextContent('đã chơi Quả bóng hôm nay rồi');
  });

  it('PB-03 an empty bag points to the gift shop', () => {
    const onOpenShop = vi.fn();
    render(<PokemonBuddy pokemon={pikachu} care={{ enabled: true }} gifts={{ enabled: true, bag: {}, card: pikachu, onOpenShop }} />);
    const section = screen.getByLabelText('Tặng quà');
    expect(section).toHaveTextContent('Túi quà đang trống');
    fireEvent.click(within(section).getByText('🪙 Tiệm quà'));
    expect(onOpenShop).toHaveBeenCalled();
  });
});
