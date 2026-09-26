import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MobaGame, MobaDashboard } from './MobaGame';
import { GamesHub } from '../GamesHub';
import { goldForMoba } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const card = (id, name, num, types, stats) => ({ id, name, speciesName: id, pokedexNumber: String(num), types, fallbackImage: `${id}.png`, ...stats });
const COLLECTION = [
  card('pikachu', 'Pikachu', 25, ['Electric'], { baseHp: 35, attack: 55, defense: 40, speed: 90 }),
  card('charizard', 'Charizard', 6, ['Fire', 'Flying'], { baseHp: 78, attack: 84, defense: 78, speed: 100 }),
  card('lapras', 'Lapras', 131, ['Water', 'Ice'], { baseHp: 130, attack: 85, defense: 80, speed: 60 }),
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playEnergySurge', 'playNote', 'playScanBeep', 'playOops']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

async function advance(ms, step = 100) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}

async function toSetup() {
  for (const c of COLLECTION) fireEvent.click(screen.getByLabelText(`Thêm ${c.name} vào đội`));
  fireEvent.click(screen.getByText(/Cho mượn ngẫu nhiên 2 Pokémon/));
  await advance(5000);
  fireEvent.click(screen.getByRole('button', { name: 'Chọn sàn đấu' }));
}

describe('MobaGame', () => {
  it('MG-01 setup: 5 Pokemon, match length and who to control; an opposing team of 5', async () => {
    render(<MobaGame collection={COLLECTION} allowScanned onClose={vi.fn()} random={seeded(1)} />);
    await toSetup();
    const setup = screen.getByTestId('moba-setup');
    const minutes = within(setup).getByRole('radiogroup', { name: 'Thời gian trận đấu' });
    expect(within(minutes).getAllByRole('radio')).toHaveLength(4);
    expect(within(minutes).getByRole('radio', { name: '3 phút' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(minutes).getByRole('radio', { name: '1 phút' }));
    const control = within(setup).getByRole('radiogroup', { name: 'Pokémon điều khiển' });
    expect(within(control).getAllByRole('radio')).toHaveLength(5);
    fireEvent.click(within(control).getByRole('radio', { name: 'Charizard' }));
    expect(setup).toHaveTextContent('Hỏa Long Liên Hoàn');
    expect(within(setup).getByText('🔴 Đội đối thủ').parentElement.querySelectorAll('img')).toHaveLength(5);
  });

  it('MG-02 a full 1-minute match: countdown, switching, skills, then the dashboard and gold once', async () => {
    const onGold = vi.fn();
    render(<MobaGame collection={COLLECTION} allowScanned onGold={onGold} onClose={vi.fn()} random={seeded(2)} />);
    await toSetup();
    fireEvent.click(screen.getByRole('radio', { name: '1 phút' }));
    fireEvent.click(screen.getByText('Vào trận!'));
    const arena = () => screen.getByRole('dialog', { name: 'Đấu trường Pokémon' });
    expect(screen.getByTestId('moba-countdown')).toHaveTextContent('3');
    expect(arena().dataset.control).toBe('blue0');
    await advance(3200);
    expect(screen.queryByTestId('moba-countdown')).toBeNull();
    expect(screen.getByTestId('moba-banner')).toHaveTextContent('BẮT ĐẦU');
    // Switch to the second Pokemon and use a skill
    fireEvent.pointerDown(screen.getByLabelText(/Điều khiển Charizard/));
    expect(arena().dataset.control).toBe('blue1');
    fireEvent.pointerDown(screen.getByTestId('skill-s2'));
    await advance(300);
    // Keyboard works too
    fireEvent.keyDown(window, { code: 'KeyD' });
    await advance(500);
    fireEvent.keyUp(window, { code: 'KeyD' });
    // Slow motion during ultimates makes a 1-minute match take a little longer in real time
    for (let t = 0; t < 120000 && !screen.queryByTestId('moba-dashboard'); t += 1000) await advance(1000, 250);
    const dash = screen.getByTestId('moba-dashboard');
    expect(within(dash).getAllByTestId('dash-row')).toHaveLength(10);
    expect(dash).toHaveTextContent('MVP');
    const [blue, red] = [Number(dash.dataset.blue), Number(dash.dataset.red)];
    const result = blue > red ? 'win' : blue < red ? 'lose' : 'draw';
    expect(dash.dataset.winner).toBe({ win: 'blue', lose: 'red', draw: 'draw' }[result]);
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(goldForMoba(result, blue));
    fireEvent.click(screen.getByText('Đấu lại'));
    expect(screen.getByTestId('moba-setup')).toBeInTheDocument();
  }, 120000);

  it('MG-03 the dashboard lists both teams with K/D/A and the MVP', () => {
    const rows = ['blue0', 'blue1', 'red0'].map((id, i) => ({ id, team: id.startsWith('blue') ? 'blue' : 'red', name: `P${i}`, image: '', types: ['fire'], kills: 3 - i, deaths: i, assists: 1, dealt: 1000 - i * 200, taken: 500, healed: 0, rating: 1 }));
    render(<MobaDashboard result={{ winner: 'blue', score: { blue: 5, red: 2 }, duration: 180, rows, mvp: 'blue0' }} gold={45} onReplay={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('CHIẾN THẮNG!')).toBeInTheDocument();
    expect(within(screen.getByTestId('dash-blue')).getAllByTestId('dash-row')).toHaveLength(2);
    expect(within(screen.getByTestId('dash-blue')).getByText('MVP')).toBeInTheDocument();
    expect(screen.getByTestId('gold-reward')).toHaveTextContent('+45 vàng');
  });

  it('MG-04 the Games tab has the arena banner (works before the first scan too)', () => {
    render(<GamesHub collection={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đấu trường Pokémon' }));
    expect(screen.getByRole('dialog', { name: 'Đấu trường Pokémon' })).toBeInTheDocument();
    expect(screen.getByTestId('team-builder')).toBeInTheDocument();
  });
});
