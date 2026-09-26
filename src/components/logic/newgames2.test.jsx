import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { OddOneGame } from './OddOneGame';
import { SpotGame } from './SpotGame';
import { LOGIC_GAMES } from './index';
import { QUESTIONS, oddStars } from '../../utils/logic/oddone';
import { LEVELS, createSpot, tapAt, nextLevel, spotStars } from '../../utils/logic/spot';
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

  it('NG2-02 spot the difference: a miss shows a cross, a hint lights one up, found ones are circled; 5 levels, gold once', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 320, height: 220, right: 320, bottom: 220, x: 0, y: 0 });
    const onGold = vi.fn();
    render(<SpotGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(4)} />);
    let mirror = createSpot({ random: seeded(4) });
    // A miss in the sky corner
    fireEvent.pointerDown(screen.getByTestId('spot-left'), { clientX: 2, clientY: 2 });
    mirror = tapAt(mirror, 2, 2).state;
    expect(screen.getByTestId('spot-left').querySelectorAll('.spot-miss')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Gợi ý' }));
    expect(screen.getByTestId('spot-right').querySelectorAll('.spot-hint')).toHaveLength(1);
    for (let lv = 0; lv < LEVELS.length; lv++) {
      for (const d of mirror.diffs) {
        fireEvent.pointerDown(screen.getByTestId(lv % 2 ? 'spot-left' : 'spot-right'), { clientX: d.x, clientY: d.y });
        mirror = tapAt(mirror, d.x, d.y).state;
      }
      if (lv < LEVELS.length - 1) {
        expect(screen.getByTestId('spot-level-done')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Màn tiếp theo ➜'));
        mirror = nextLevel(mirror);
        expect(dialog().dataset.level).toBe(String(lv + 2));
        expect(screen.getByTestId('spot-left').querySelectorAll('.spot-ring')).toHaveLength(0);
      }
    }
    expect(dialog().dataset.status).toBe('done');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(goldForStars(spotStars(mirror.stars)));
  });
});
