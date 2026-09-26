import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { makeCard } from '../test/fixtures';

const mocks = vi.hoisted(() => ({ fetchBattlePokemon: vi.fn() }));
vi.mock('../services/battleData', () => ({ fetchBattlePokemon: mocks.fetchBattlePokemon }));

import { BattleArena } from './BattleArena';
import { sounds } from '../utils/soundEffects';

const mv = (name, type, power, extra = {}) => ({ name, type, power, accuracy: 100, damageClass: 'special', priority: 0, minHits: 1, maxHits: 1, ...extra });
const data = (name, id, types, stats, moves) => ({ key: name.toLowerCase(), name, id, types, stats, moves, image: `${name}.png` });

const CHARIZARD = data('Charizard', 6, ['fire', 'flying'], { hp: 78, attack: 84, defense: 78, spAttack: 109, spDefense: 85, speed: 100 }, [
  mv('Ember', 'fire', 40), mv('Wing Attack', 'flying', 60, { damageClass: 'physical' }), mv('Dragon Claw', 'dragon', 80, { damageClass: 'physical' }), mv('Flamethrower', 'fire', 90),
]);
const WEAK_FOE = data('Caterpie', 10, ['bug'], { hp: 1, attack: 10, defense: 10, spAttack: 10, spDefense: 10, speed: 10 }, [mv('Tackle', 'normal', 40, { damageClass: 'physical' })].concat([mv('Bug Bite', 'bug', 60), mv('Tackle 2', 'normal', 40), mv('Tackle 3', 'normal', 40)]));
const STRONG_FOE = data('Mewtwo', 150, ['psychic'], { hp: 255, attack: 200, defense: 255, spAttack: 255, spDefense: 255, speed: 255 }, [
  mv('Psychic', 'psychic', 90), mv('Psystrike', 'psychic', 100), mv('Aura Sphere', 'fighting', 80), mv('Shadow Ball', 'ghost', 80),
]);
const TANK = (name, id) => data(name, id, ['normal'], { hp: 255, attack: 20, defense: 255, spAttack: 20, spDefense: 255, speed: 50 }, [
  mv('Pound', 'normal', 40, { damageClass: 'physical' }), mv('Swift', 'normal', 60), mv('Headbutt', 'normal', 70, { damageClass: 'physical' }), mv('Hyper Voice', 'normal', 90),
]);

function setupFetch(player, opponent) {
  // The child's Pokemon is looked up with its card, the opponent with a name
  mocks.fetchBattlePokemon.mockImplementation(async (q) => (typeof q === 'object' || String(q).toLowerCase() === player.key || q === player.id ? player : opponent));
}

async function advance(ms) {
  for (let t = 0; t < ms; t += 100) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
  }
}

const phase = () => screen.getByRole('dialog').dataset.phase;
const moveButtons = () => screen.getAllByRole('button').filter((b) => b.textContent.includes('Sức mạnh'));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  for (const s of ['playWhoosh', 'playEnergySurge', 'playPop', 'playSuccessFanfare', 'playPokemonCry']) vi.spyOn(sounds, s).mockImplementation(() => {});
  mocks.fetchBattlePokemon.mockReset();
});
afterEach(() => vi.useRealTimers());

const card = (over = {}) => makeCard({ speciesName: 'charizard', friendship: 60, ...over });

describe('BattleArena', () => {
  it('BA-01 loads, introduces both Pokemon and offers 4 moves with hints', async () => {
    setupFetch(CHARIZARD, WEAK_FOE);
    render(<BattleArena card={card()} onClose={vi.fn()} random={() => 0.3} tempo={1} />);
    expect(screen.getByText('Đang chuẩn bị trận đấu...')).toBeInTheDocument();
    await advance(100);
    expect(screen.getByRole('log')).toHaveTextContent('Một Caterpie hoang dã xuất hiện!');
    await advance(1400);
    expect(screen.getByRole('log')).toHaveTextContent('Tiến lên, Charizard!');
    await advance(1100);
    expect(phase()).toBe('choose');
    expect(moveButtons()).toHaveLength(4);
    // Fire and flying are super effective against bug
    expect(screen.getAllByText('Siêu hiệu quả!').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Tình bạn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tuyệt Kỹ Liên Hoàn/ })).toBeDisabled();
  });

  it('BA-02 a winning move animates, shows the win screen and reports once', async () => {
    setupFetch(CHARIZARD, WEAK_FOE);
    const onResult = vi.fn();
    render(<BattleArena card={card()} onClose={vi.fn()} onResult={onResult} random={() => 0.3} tempo={1} />);
    await advance(2600);
    fireEvent.click(screen.getByText('Flamethrower'));
    expect(phase()).toBe('animating');
    moveButtons().forEach((b) => expect(b).toBeDisabled());
    await advance(200);
    expect(screen.getByRole('log')).toHaveTextContent('Charizard dùng Flamethrower!');
    await advance(4000);
    expect(phase()).toBe('won');
    expect(screen.getByText('Chiến thắng! 🎉')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Máu Caterpie' })).toHaveAttribute('aria-valuenow', '0');
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith({ won: true, opponent: 'Caterpie' });
  });

  it('BA-03 losing shows encouragement and reports the loss', async () => {
    setupFetch(data('Magikarp', 129, ['water'], { hp: 20, attack: 10, defense: 55, spAttack: 15, spDefense: 20, speed: 80 }, [mv('Splash Hit', 'water', 20), mv('Tackle', 'normal', 40), mv('Flail', 'normal', 30), mv('Bounce', 'flying', 85)]), STRONG_FOE);
    const onResult = vi.fn();
    render(<BattleArena card={card({ speciesName: 'magikarp', name: 'Magikarp', friendship: 0 })} onClose={vi.fn()} onResult={onResult} random={() => 0.3} tempo={1} />);
    await advance(2600);
    for (let turn = 0; turn < 6 && phase() !== 'lost'; turn++) {
      if (phase() === 'choose') fireEvent.click(moveButtons()[0]);
      await advance(4000);
    }
    expect(phase()).toBe('lost');
    expect(screen.getByText('Thua mất rồi!')).toBeInTheDocument();
    expect(onResult).toHaveBeenCalledWith({ won: false, opponent: 'Mewtwo' });
  });

  it('BA-04 combo energy fills up and the finisher chains all four moves', async () => {
    const hero = TANK('Snorlax', 143);
    setupFetch({ ...hero, key: 'snorlax' }, TANK('Chansey', 113));
    render(<BattleArena card={card({ speciesName: 'snorlax', name: 'Snorlax' })} onClose={vi.fn()} random={() => 0.3} tempo={1} />);
    await advance(2600);
    const comboButton = () => screen.getByRole('button', { name: /Tuyệt Kỹ Liên Hoàn/ });
    let turns = 0;
    while (comboButton().disabled && turns < 8) {
      fireEvent.click(moveButtons()[3]);
      await advance(4000);
      turns++;
    }
    expect(comboButton()).not.toBeDisabled();
    expect(Number(screen.getByRole('progressbar', { name: 'Năng lượng liên hoàn' }).getAttribute('aria-valuenow'))).toBe(100);

    fireEvent.click(comboButton());
    await advance(300);
    expect(screen.getByTestId('combo-vignette')).toBeInTheDocument();
    expect(screen.getByText('TUYỆT KỸ LIÊN HOÀN!')).toBeInTheDocument();
    const seen = new Set();
    for (let t = 0; t < 60; t++) {
      await advance(100);
      const counter = screen.queryByTestId('chain-counter');
      if (counter) seen.add(counter.textContent);
    }
    expect([...seen]).toEqual(['x1', 'x2', 'x3', 'x4']);
    await advance(3000);
    expect(screen.queryByTestId('combo-vignette')).toBeNull();
    expect(Number(screen.getByRole('progressbar', { name: 'Năng lượng liên hoàn' }).getAttribute('aria-valuenow'))).toBeLessThan(100);
  });

  it('BA-05 network failure shows a retry button', async () => {
    mocks.fetchBattlePokemon.mockRejectedValueOnce(new Error('Không tải được dữ liệu trận đấu.')).mockResolvedValue(CHARIZARD);
    render(<BattleArena card={card()} onClose={vi.fn()} random={() => 0.3} tempo={1} />);
    await advance(200);
    expect(phase()).toBe('error');
    expect(screen.getByText('Không tải được dữ liệu trận đấu.')).toBeInTheDocument();
    setupFetch(CHARIZARD, WEAK_FOE);
    fireEvent.click(screen.getByText('Thử lại'));
    await advance(2800);
    expect(phase()).toBe('choose');
  });

  // Regression: the parent re-renders with a new card object when rewards are saved; that
  // restarted the battle and hid the result screen
  it('BA-07 parent re-renders do not restart the battle', async () => {
    setupFetch(CHARIZARD, WEAK_FOE);
    const onResult = vi.fn();
    const { rerender } = render(<BattleArena card={card()} onClose={vi.fn()} onResult={onResult} random={() => 0.3} tempo={1} />);
    await advance(2600);
    rerender(<BattleArena card={card()} onClose={vi.fn()} onResult={onResult} random={() => 0.3} tempo={1} />);
    await advance(500);
    expect(phase()).toBe('choose');
    fireEvent.click(screen.getByText('Flamethrower'));
    await advance(4200);
    expect(phase()).toBe('won');
    rerender(<BattleArena card={card({ battleWins: 1 })} onClose={vi.fn()} onResult={onResult} random={() => 0.3} tempo={1} />);
    await advance(3000);
    expect(phase()).toBe('won');
    expect(mocks.fetchBattlePokemon).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('BA-08 battles are slower by default (x1.5) and the 🐢/🐇 button switches speed', async () => {
    setupFetch(CHARIZARD, WEAK_FOE);
    render(<BattleArena card={card()} onClose={vi.fn()} random={() => 0.3} />);
    expect(screen.getByRole('dialog').dataset.speed).toBe('slow');
    expect(screen.getByRole('dialog').style.getPropertyValue('--battle-tempo')).toBe('1.5');
    await advance(1500);
    // At normal speed the second intro line shows after 1.3s; slowed it waits ~1.95s
    expect(screen.getByRole('log')).toHaveTextContent('hoang dã xuất hiện');
    await advance(700);
    expect(screen.getByRole('log')).toHaveTextContent('Tiến lên, Charizard!');

    fireEvent.click(screen.getByRole('button', { name: /Tốc độ: chậm/ }));
    expect(screen.getByRole('dialog').dataset.speed).toBe('normal');
    expect(localStorage.getItem('pokescan_battle_speed')).toBe('normal');
    expect(screen.getByText('🐇 Nhanh')).toBeInTheDocument();
  });

  it('BA-06 close button and "Đấu tiếp" for a new opponent', async () => {
    setupFetch(CHARIZARD, WEAK_FOE);
    const onClose = vi.fn();
    render(<BattleArena card={card()} onClose={onClose} random={() => 0.3} tempo={1} />);
    await advance(2600);
    fireEvent.click(screen.getByText('Flamethrower'));
    await advance(4200);
    fireEvent.click(screen.getByText('Đấu tiếp'));
    expect(phase()).toBe('loading');
    await advance(2800);
    expect(phase()).toBe('choose');
    fireEvent.click(screen.getByLabelText('Đóng trận đấu'));
    expect(onClose).toHaveBeenCalled();
  });
});
