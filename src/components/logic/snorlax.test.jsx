import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SnorlaxGame } from './SnorlaxGame';
import { LEVELS, replay } from '../../utils/logic/snorlax';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png', types: ['Electric'] };
const KEY = 'pokescan_progress_v1';

beforeEach(() => {
  localStorage.removeItem(KEY);
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 560, right: 360, bottom: 560, x: 0, y: 0 });
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playOops', 'playNote', 'playScanBeep', 'playMunch']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function advance(ms, step = 100) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}
const dialog = () => screen.getByRole('dialog');

/** Swipe straight across the canvas through the middle of a rope (from the level data). */
function swipeAcross(level, ropeIndex = 0) {
  const lv = LEVELS[level];
  const r = lv.ropes[ropeIndex];
  const midY = (r.y + lv.berry.y) / 2;
  const midX = (r.x + lv.berry.x) / 2;
  const stage = screen.getByTestId('snorlax-stage');
  fireEvent.pointerDown(stage, { clientX: Math.max(2, midX - 70), clientY: midY, pointerId: 1 });
  fireEvent.pointerMove(stage, { clientX: midX, clientY: midY + 2, pointerId: 1 });
  fireEvent.pointerMove(stage, { clientX: Math.min(358, midX + 70), clientY: midY + 4, pointerId: 1 });
  fireEvent.pointerUp(stage, { pointerId: 1 });
}

describe('SnorlaxGame', () => {
  it('SNX-UI-01 pick level 1 on the map, swipe the rope, the berry drops into Snorlax: stars, gold once, level 2 opens', async () => {
    const onGold = vi.fn();
    render(<SnorlaxGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} />);
    expect(dialog().dataset.phase).toBe('map');
    expect(screen.getByLabelText('Màn 2 (chưa mở)')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Màn 1'));
    expect(dialog().dataset.phase).toBe('play');
    expect(dialog().dataset.level).toBe('1');
    expect(screen.getByTestId('snorlax-tip')).toHaveTextContent('Vuốt');
    await advance(300);
    swipeAcross(0);
    expect(sounds.playWhoosh).toHaveBeenCalled();
    for (let t = 0; t < 4000 && dialog().dataset.phase !== 'won'; t += 100) await advance(100);
    expect(dialog().dataset.phase).toBe('won');
    expect(dialog().dataset.stars).toBe('3');
    expect(sounds.playMunch).toHaveBeenCalled();
    await advance(1500);
    const card = screen.getByTestId('snorlax-win');
    expect(card.querySelector('[aria-label="3 sao"]')).toBeTruthy();
    expect(screen.getByTestId('gold-reward')).toHaveTextContent('+15');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(15);
    await advance(2000);
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(KEY)).snorlax).toEqual({ 1: 3 });
    // Back on the map, level 2 is open now
    fireEvent.click(screen.getByText('Bản đồ'));
    expect(dialog().dataset.phase).toBe('map');
    expect(screen.getByLabelText('Màn 2')).not.toBeDisabled();
    expect(screen.getByLabelText('Màn 3 (chưa mở)')).toBeDisabled();
  }, 30000);

  it('SNX-UI-02 the hint button shows a pulsing arrow at the first cut of the solution, and says when to cut', async () => {
    render(<SnorlaxGame player={PLAYER} onClose={vi.fn()} onGold={vi.fn()} random={seeded(5)} />);
    fireEvent.click(screen.getByLabelText('Màn 1'));
    await advance(200);
    expect(screen.queryByTestId('snorlax-hint')).toBeNull();
    fireEvent.click(screen.getByTestId('snorlax-hint-btn'));
    const hint = screen.getByTestId('snorlax-hint');
    expect(hint.dataset.kind).toBe('cut');
    expect(hint.dataset.stage).toBe('ready');
    expect(hint).toHaveTextContent('Sẵn sàng');
    expect(parseFloat(hint.style.left)).toBeCloseTo(50, 0);
    const top = (parseFloat(hint.style.top) / 100) * 560;
    expect(top).toBeGreaterThan(LEVELS[0].ropes[0].y);
    expect(top).toBeLessThan(LEVELS[0].berry.y);
    await advance(200);
    expect(screen.getByTestId('snorlax-hint').dataset.stage).toBe('now');
    expect(screen.getByTestId('snorlax-hint')).toHaveTextContent('Cắt NGAY');
    await advance(600);
    expect(screen.getByTestId('snorlax-hint')).toHaveTextContent('Cắt ở đây');
    // Cutting the rope hides the hint
    swipeAcross(0);
    await advance(100);
    expect(screen.queryByTestId('snorlax-hint')).toBeNull();
  }, 30000);

  it('SNX-UI-03 a wrong move loses the berry, the child sees "Thử lại" and the level restarts by itself', async () => {
    // Level 7 (bubbles): cutting straight away misses
    expect(replay(LEVELS[6], [{ t: 0.25, cut: 0 }]).status).toBe('lost');
    localStorage.setItem(KEY, JSON.stringify({ snorlax: { 1: 3, 2: 3, 3: 2, 4: 1, 5: 3, 6: 3 } }));
    const onGold = vi.fn();
    render(<SnorlaxGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(7)} />);
    expect(screen.getByText(/⭐ 15\/90/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Màn 7'));
    expect(dialog().dataset.level).toBe('7');
    await advance(200);
    swipeAcross(6);
    for (let t = 0; t < 12000 && dialog().dataset.phase !== 'lost'; t += 100) await advance(100);
    expect(dialog().dataset.phase).toBe('lost');
    expect(screen.getByTestId('snorlax-lost')).toHaveTextContent('Thử lại');
    expect(sounds.playOops).toHaveBeenCalled();
    await advance(1600);
    expect(dialog().dataset.phase).toBe('play');
    expect(dialog().dataset.level).toBe('7');
    expect(onGold).not.toHaveBeenCalled();
    // Restart button and back to the map
    fireEvent.click(screen.getByTestId('snorlax-restart'));
    expect(dialog().dataset.phase).toBe('play');
    fireEvent.click(screen.getByLabelText('Về bản đồ màn'));
    expect(dialog().dataset.phase).toBe('map');
    expect(screen.getByLabelText('Màn 8 (chưa mở)')).toBeDisabled();
  }, 30000);
});
