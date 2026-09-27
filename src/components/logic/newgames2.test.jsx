import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { OddOneGame } from './OddOneGame';
import { SpotGame } from './SpotGame';
import { LOGIC_GAMES } from './index';
import { QUESTIONS, oddStars } from '../../utils/logic/oddone';
import { createSpot, levelStars } from '../../utils/logic/spot';
import { RhythmGame } from './RhythmGame';
import { getProgress } from '../../utils/progress';
import { goldForStars } from '../../utils/gold';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png' };

beforeEach(() => {
  vi.useFakeTimers();
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playEnergySurge', 'playOops']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const dialog = () => screen.getByRole('dialog');

describe('new thinking games', () => {
  it('NG2-00 both games are in the thinking games list', () => {
    expect(LOGIC_GAMES.map((g) => g.id)).toEqual(expect.arrayContaining(['oddone', 'spot']));
  });

  it('NG2-01 odd one out: a wrong tap is marked, the right one explains the rule; 12 questions, gold once', async () => {
    const onGold = vi.fn();
    render(<OddOneGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(1)} />);
    const cards = () => within(screen.getByRole('group', { name: 'Chọn cái khác loại' })).getAllByRole('button');
    // First question: one wrong tap first
    const wrong = cards().find((b) => b.dataset.odd === 'false');
    fireEvent.click(wrong);
    expect(dialog().dataset.mistakes).toBe('1');
    expect(screen.getByTestId('odd-bubble')).toHaveTextContent('Chưa đúng');
    for (let i = 0; i < QUESTIONS; i++) {
      fireEvent.click(cards().find((b) => b.dataset.odd === 'true'));
      expect(dialog().dataset.status).toBe('right');
      expect(screen.getByTestId('odd-bubble')).toHaveTextContent('Đúng rồi');
      expect(screen.getByText('Khác loại!')).toBeInTheDocument();
      fireEvent.click(screen.getByText(i === QUESTIONS - 1 ? 'Xem kết quả 🏆' : 'Câu tiếp theo ➜'));
      if (i === 2) expect(screen.getByTestId('odd-level')).toHaveTextContent('Màn 2');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
    }
    expect(dialog().dataset.status).toBe('done');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(goldForStars(oddStars(1)));
  });

  it('NG2-02 spot the difference: a map of 35 levels; a level with a miss, a hint and all found; stars saved, the next level opens', async () => {
    localStorage.removeItem('pokescan_progress_v1');
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 320, height: 220, right: 320, bottom: 220, x: 0, y: 0 });
    const onGold = vi.fn();
    render(<SpotGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(4)} />);
    const map = screen.getByTestId('spot-map');
    expect(within(map).getAllByRole('button')).toHaveLength(35);
    expect(within(map).getByRole('button', { name: 'Màn 2 (chưa mở)' })).toBeDisabled();
    expect(within(map).getByRole('button', { name: 'Màn 13' })).toBeEnabled(); // each tier starts open
    fireEvent.click(within(map).getByRole('button', { name: 'Màn 1' }));
    const mirror = createSpot({ random: seeded(4), level: 0 });
    fireEvent.pointerDown(screen.getByTestId('spot-left'), { clientX: 2, clientY: 2 });
    expect(screen.getByTestId('spot-left').querySelectorAll('.spot-miss')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Gợi ý' }));
    expect(screen.getByTestId('spot-right').querySelectorAll('.spot-hint')).toHaveLength(1);
    for (const d of mirror.diffs) fireEvent.pointerDown(screen.getByTestId('spot-right'), { clientX: d.x, clientY: d.y });
    expect(screen.getByTestId('spot-level-done')).toBeInTheDocument();
    expect(getProgress('spot').s1).toBe(levelStars(1, 1));
    expect(onGold).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Màn tiếp theo ➜'));
    expect(dialog().dataset.level).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Về bản đồ màn' }));
    expect(within(screen.getByTestId('spot-map')).getByRole('button', { name: 'Màn 2' })).toBeEnabled();
    localStorage.removeItem('pokescan_progress_v1');
  });

  it('NG2-03 rhythm: 34 levels on the map, 4 speeds; a faster speed is used in the run and remembered; stars saved', async () => {
    localStorage.removeItem('pokescan_progress_v1');
    localStorage.removeItem('pokescan_rhythm_speed');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.spyOn(sounds, 'playNote').mockImplementation(() => {});
    const onGold = vi.fn();
    render(<RhythmGame player={PLAYER} onClose={vi.fn()} onGold={onGold} />);
    const map = screen.getByTestId('rhythm-map');
    const levels = within(map).getAllByRole('button').filter((b) => b.closest('section'));
    expect(levels).toHaveLength(34);
    const speeds = screen.getByRole('radiogroup', { name: 'Tốc độ' });
    expect(within(speeds).getByRole('radio', { name: 'Vừa' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(speeds).getByRole('radio', { name: 'Siêu tốc' }));
    expect(localStorage.getItem('pokescan_rhythm_speed')).toBe('turbo');
    expect(within(map).getByRole('button', { name: 'Màn 2 (chưa mở)' })).toBeDisabled();
    fireEvent.click(within(map).getByRole('button', { name: 'Nhảy bài Bánh nóng giòn' }));
    // Nobody taps: the whole song passes much faster than at normal speed
    for (let t = 0; t < 30000 && dialog().dataset.screen !== 'done'; t += 250) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
    }
    expect(dialog().dataset.screen).toBe('done');
    expect(screen.getByText(/tốc độ ×1.5/)).toBeInTheDocument();
    expect(getProgress('rhythm').hotcross).toBe(1);
    expect(onGold).toHaveBeenCalledTimes(1);
    localStorage.removeItem('pokescan_progress_v1');
    localStorage.removeItem('pokescan_rhythm_speed');
  });
});
