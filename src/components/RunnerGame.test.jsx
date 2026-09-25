import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RunnerGame } from './RunnerGame';
import { GamesHub } from './GamesHub';
import { sounds } from '../utils/soundEffects';
import { makeCard } from '../test/fixtures';

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no canvas: the game still runs, it just draws nothing
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  for (const s of ['playJump', 'playPop', 'playScanBeep', 'playPokemonCry']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

async function advance(ms) {
  for (let t = 0; t < ms; t += 100) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
  }
}

const dialog = () => screen.getByRole('dialog');

describe('RunnerGame', () => {
  it('RG-01 waits on a start screen, then a tap starts running and scoring', async () => {
    render(<RunnerGame pokemon={makeCard()} image="x.png" onClose={vi.fn()} random={() => 0.99} />);
    expect(screen.getByText('Chạy cùng Charizard!')).toBeInTheDocument();
    expect(dialog().dataset.status).toBe('ready');
    await advance(500);
    expect(dialog().dataset.score).toBe('0');

    fireEvent.pointerDown(screen.getByTestId('runner-canvas').parentElement);
    await advance(1500);
    expect(dialog().dataset.status).toBe('running');
    expect(Number(dialog().dataset.score)).toBeGreaterThan(20);
    expect(sounds.playJump).toHaveBeenCalled();
  });

  it('RG-02 keyboard: Space starts and jumps, Down ducks, Escape closes', async () => {
    const onClose = vi.fn();
    render(<RunnerGame pokemon={makeCard()} image="x.png" onClose={onClose} random={() => 0.99} />);
    fireEvent.keyDown(window, { code: 'Space' });
    await advance(200);
    expect(dialog().dataset.status).toBe('running');
    expect(sounds.playJump).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(window, { code: 'Space' });
    fireEvent.keyDown(window, { code: 'ArrowDown' });
    fireEvent.keyUp(window, { code: 'ArrowDown' });
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('RG-03 standing still loses the 3 lives, shows the result and saves the record', async () => {
    render(<RunnerGame pokemon={makeCard()} image="x.png" onClose={vi.fn()} random={() => 0.5} />);
    fireEvent.pointerDown(dialog(), { pointerId: 1, clientY: 300 });
    fireEvent.pointerUp(dialog(), { pointerId: 1, clientY: 300 });
    await advance(40000);
    expect(dialog().dataset.status).toBe('over');
    expect(dialog().dataset.lives).toBe('0');
    expect(screen.getByText('Kết thúc!')).toBeInTheDocument();
    expect(screen.getByText(/Kỷ lục mới/)).toBeInTheDocument();
    expect(Number(localStorage.getItem('pokescan_runner_best'))).toBe(Number(dialog().dataset.score));
    expect(sounds.playPop).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByText('Chơi lại'));
    expect(dialog().dataset.status).toBe('ready');
    expect(dialog().dataset.lives).toBe('3');
  });

  it('RG-04 shows hearts and gesture hints (no jump/duck buttons); close button', () => {
    const onClose = vi.fn();
    render(<RunnerGame pokemon={makeCard()} image="x.png" onClose={onClose} />);
    expect(screen.getByLabelText('Còn 3 mạng')).toBeInTheDocument();
    expect(screen.getByText(/Chạm màn hình để nhảy/)).toBeInTheDocument();
    expect(screen.getByText(/Vuốt xuống để cúi/)).toBeInTheDocument();
    expect(screen.queryByText('NHẢY')).toBeNull();
    // Tapping the close button must not start the game
    fireEvent.pointerDown(screen.getByLabelText('Đóng trò chơi'), { pointerId: 1 });
    fireEvent.click(screen.getByLabelText('Đóng trò chơi'));
    expect(onClose).toHaveBeenCalled();
    expect(dialog().dataset.status).toBe('ready');
  });

  it('RG-06 tap anywhere jumps; swiping down ducks right away and stands up on release', async () => {
    render(<RunnerGame pokemon={makeCard()} image="x.png" onClose={vi.fn()} random={() => 0.99} />);
    // Tap starts the game and jumps
    fireEvent.pointerDown(dialog(), { pointerId: 1, clientY: 400 });
    await advance(100);
    expect(dialog().dataset.status).toBe('running');
    expect(dialog().dataset.pose).toBe('jump');
    fireEvent.pointerUp(dialog(), { pointerId: 1, clientY: 400 });
    await advance(1200);
    expect(dialog().dataset.pose).toBe('run');

    // Swipe down: the touch jumps for an instant, the swipe cancels it and ducks
    fireEvent.pointerDown(dialog(), { pointerId: 2, clientY: 300 });
    fireEvent.pointerMove(dialog(), { pointerId: 2, clientY: 360 });
    await advance(200);
    expect(dialog().dataset.pose).toBe('duck');
    fireEvent.pointerUp(dialog(), { pointerId: 2, clientY: 360 });
    await advance(200);
    expect(dialog().dataset.pose).toBe('run');
  });
});

describe('GamesHub', () => {
  it('GH-01 without cards the runner is Pikachu', () => {
    render(<GamesHub collection={[]} onOpenCollection={vi.fn()} />);
    expect(screen.getByText('Chạy cùng Pikachu!')).toBeInTheDocument();
    expect(screen.getByText(/Quét thẻ để chạy bằng Pokémon của chính bé/)).toBeInTheDocument();
  });

  it('GH-02 the child picks one of their Pokemon and starts the runner', () => {
    render(<GamesHub collection={[makeCard(), makeCard({ id: 'mew', name: 'Mew', pokedexNumber: '151' })]} onOpenCollection={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /Mew/ }));
    expect(screen.getByRole('radio', { name: /Mew/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByText('Chạy cùng Mew!'));
    expect(screen.getByRole('dialog', { name: 'Trò chơi Pokémon chạy nhảy' })).toBeInTheDocument();
    expect(screen.getByText('Chạy cùng Mew!', { selector: 'p' })).toBeInTheDocument();
  });

  it('GH-03 still offers the quiz and the way to the catch game', () => {
    const onOpenCollection = vi.fn();
    render(<GamesHub collection={[]} onOpenCollection={onOpenCollection} />);
    expect(screen.getByText('Ai là Pokémon này?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Mở bộ sưu tập'));
    expect(onOpenCollection).toHaveBeenCalled();
  });
});
