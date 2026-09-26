import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { MathGame } from './MathGame';
import { EnglishGame } from './EnglishGame';
import { MemoryGame } from './MemoryGame';
import { MusicGame } from './MusicGame';
import { MazeGame } from './MazeGame';
import { makeMathLesson } from '../../utils/logic/math';
import { makeEnglishLesson } from '../../utils/logic/english';
import { SONGS, NOTES, songById } from '../../utils/logic/music';
import { createMazeLevel, slide, shortestPath, DIRS, MAZE_LEVELS } from '../../utils/logic/maze';
import { getProgress } from '../../utils/progress';
import { sounds } from '../../utils/soundEffects';
import { seeded } from '../../test/seeded';

const PLAYER = { name: 'Pikachu', image: 'pikachu.png' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  for (const s of ['playPop', 'playWhoosh', 'playCoin', 'playSuccessFanfare', 'playScanBeep', 'playMunch', 'playNote', 'playOops', 'playJump']) vi.spyOn(sounds, s).mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

async function advance(ms, step = 100) {
  for (let t = 0; t < ms; t += step) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
}
const dialog = () => screen.getByRole('dialog');

describe('MathGame', () => {
  it('LG-01 wrong answers count aloud as a hint; 9 questions end with stars and gold once', async () => {
    const onGold = vi.fn();
    const lesson = makeMathLesson(seeded(1));
    render(<MathGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(1)} />);
    expect(screen.getByTestId('math-question')).toHaveTextContent(lesson[0].text);
    expect(screen.getAllByTestId('math-thing')).toHaveLength(lesson[0].a);

    // A wrong balloon: "let's count", numbers appear on the pictures
    const wrong = lesson[0].choices.find((n) => n !== lesson[0].answer);
    fireEvent.click(screen.getByLabelText(`Đáp án ${wrong}`));
    expect(screen.getByRole('status')).toHaveTextContent('mình cùng đếm');
    await advance(lesson[0].answer * 400 + 600);

    for (let i = 0; i < lesson.length; i++) {
      expect(dialog().dataset.question).toBe(String(i));
      if (lesson[i].kind === 'sub') await advance(1200); // the Pokemon eats some first
      fireEvent.click(screen.getByLabelText(`Đáp án ${lesson[i].answer}`));
      expect(screen.getByRole('status')).toHaveTextContent('Đúng rồi!');
      await advance(lesson[i].answer * 400 + 700);
    }
    expect(dialog().dataset.done).toBe('true');
    expect(screen.getByTestId('gold-reward')).toHaveTextContent('+15 vàng');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(15);
  });
});

describe('EnglishGame', () => {
  it('LG-02 listen/look questions; the flip card shows meaning and same-meaning words', async () => {
    const onGold = vi.fn();
    const lesson = makeEnglishLesson(seeded(2));
    render(<EnglishGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(2)} />);
    for (let i = 0; i < lesson.length; i++) {
      const q = lesson[i];
      expect(dialog().dataset.mode).toBe(q.mode);
      const group = screen.getByRole('group', { name: 'Chọn đáp án' });
      const pick = (w) => (q.mode === 'listen' ? within(group).getByLabelText(`Hình ${w.vi}`) : within(group).getByText(w.word));
      if (i === 0) {
        const wrong = q.choices.find((c) => c !== q.answer);
        fireEvent.click(pick(wrong));
        expect(pick(wrong).className).toContain('grayscale');
        expect(dialog().dataset.revealed).toBe('false');
      }
      fireEvent.click(pick(q.answer));
      const card = screen.getByTestId('word-card');
      expect(card).toHaveTextContent(q.answer.word);
      expect(card).toHaveTextContent(q.answer.vi);
      for (const s of q.answer.same) expect(card).toHaveTextContent(s);
      await advance(700);
      fireEvent.click(screen.getByText(i + 1 >= lesson.length ? 'Xong!' : 'Từ tiếp theo'));
    }
    expect(dialog().dataset.done).toBe('true');
    expect(onGold).toHaveBeenCalledWith(15);
  });
});

describe('MemoryGame', () => {
  const pool = Array.from({ length: 10 }, (_, i) => ({ key: `p${i}`, name: `Poke${i}`, image: `p${i}.png` }));

  /** Watch the spotlight and note the order the Pokemon appear. */
  async function watch() {
    const seen = [];
    for (let t = 0; t < 12000 && dialog().dataset.status === 'show'; t += 100) {
      const spot = screen.queryByTestId('memory-spotlight');
      const name = spot?.querySelector('img').getAttribute('alt');
      if (name && seen[seen.length - 1] !== name) seen.push(name);
      await advance(100);
    }
    return seen;
  }

  it('LG-03 taps in the order shown clear every round; stars and gold at the end', async () => {
    const onGold = vi.fn();
    render(<MemoryGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(3)} pool={pool} />);
    for (let round = 0; round < 10 && !screen.queryByTestId('gold-reward'); round++) {
      const order = await watch();
      expect(dialog().dataset.status).toBe('input');
      expect(order).toHaveLength(Number(dialog().dataset.length));
      const cards = screen.getByRole('group', { name: 'Chọn Pokémon' });
      for (const name of order) fireEvent.click(within(cards).getByLabelText(name));
      await advance(1700);
    }
    expect(screen.getByTestId('gold-reward')).toHaveTextContent('+15 vàng');
    expect(onGold).toHaveBeenCalledTimes(1);
  });

  it('LG-04 a wrong tap breaks a heart and replays the same length', async () => {
    render(<MemoryGame player={PLAYER} onClose={vi.fn()} random={seeded(4)} pool={pool} />);
    const order = await watch();
    const cards = screen.getByRole('group', { name: 'Chọn Pokémon' });
    const wrong = within(cards).getAllByRole('button').find((b) => b.getAttribute('aria-label') !== order[0]);
    fireEvent.click(wrong);
    expect(dialog().dataset.hearts).toBe('2');
    expect(screen.getByRole('status')).toHaveTextContent('chưa đúng');
    await advance(1700);
    expect(dialog().dataset.status).toBe('show');
    expect(dialog().dataset.length).toBe('2');
  });
});

describe('MusicGame', () => {
  it('LG-05 songs open one after another; follow the lit bars, hear it back, stars and gold', async () => {
    const onGold = vi.fn();
    render(<MusicGame player={PLAYER} onClose={vi.fn()} onGold={onGold} />);
    expect(screen.getByLabelText('Dưới ánh trăng (chưa mở)')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Bánh nóng giòn'));
    expect(dialog().dataset.mode).toBe('play');
    const song = songById('hotcross');
    // A wrong bar sounds but does not advance
    fireEvent.pointerDown(screen.getByLabelText('Phím Si'));
    expect(dialog().dataset.mistakes).toBe('1');
    expect(dialog().dataset.index).toBe('0');
    for (const n of song.melody) fireEvent.pointerDown(screen.getByLabelText(`Phím ${NOTES[n.note].label}`));
    expect(sounds.playNote).toHaveBeenCalledTimes(song.melody.length + 1);
    await advance(800);
    expect(dialog().dataset.mode).toBe('playback');
    await advance(15000, 250);
    expect(dialog().dataset.mode).toBe('done');
    expect(onGold).toHaveBeenCalledTimes(1);
    expect(onGold).toHaveBeenCalledWith(15);
    expect(getProgress('music').hotcross).toBe(3);
    // The next song is open now
    fireEvent.click(screen.getByText(/Bài tiếp theo: Dưới ánh trăng/));
    expect(dialog().dataset.mode).toBe('play');
  });

  it('LG-05b ten songs in three levels; a replay without more stars pays a little', async () => {
    localStorage.setItem('pokescan_progress_v1', JSON.stringify({ music: { hotcross: 3 } }));
    const onGold = vi.fn();
    render(<MusicGame player={PLAYER} onClose={vi.fn()} onGold={onGold} />);
    for (const t of ['Mức Dễ', 'Mức Vừa', 'Mức Khó']) expect(screen.getByRole('region', { name: t })).toBeInTheDocument();
    expect(SONGS).toHaveLength(10);
    expect(screen.getByLabelText('Dưới ánh trăng')).toBeEnabled();
    fireEvent.click(screen.getByLabelText('Bánh nóng giòn'));
    for (const n of songById('hotcross').melody) fireEvent.pointerDown(screen.getByLabelText(`Phím ${NOTES[n.note].label}`));
    await advance(16000, 250);
    expect(onGold).toHaveBeenCalledWith(2);
  });

  it('LG-06 free play has no guide and no reward', () => {
    const onGold = vi.fn();
    render(<MusicGame player={PLAYER} onClose={vi.fn()} onGold={onGold} />);
    fireEvent.click(screen.getByText('Chơi tự do'));
    fireEvent.pointerDown(screen.getByLabelText('Phím Đô'));
    expect(sounds.playNote).toHaveBeenCalledWith(NOTES[0].freq);
    expect(screen.queryByTestId('note-lane')).toBeNull();
    expect(onGold).not.toHaveBeenCalled();
  });
});

describe('MazeGame', () => {
  /** Walk a level with the keyboard, mirroring the engine (key first when there is one). */
  async function solve(st) {
    for (let guard = 0; !st.done && guard < 300; guard++) {
      const next = shortestPath(st.maze, st.pos, st.hasKey ? st.maze.goal : st.key)[1];
      const dir = Object.keys(DIRS).find((d) => st.pos.x + DIRS[d].dx === next.x && st.pos.y + DIRS[d].dy === next.y);
      const out = slide(st, dir);
      st = out.state;
      fireEvent.keyDown(window, { key: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[dir] });
      await advance(Math.ceil((out.path.length / 6) * 1000) + 100);
    }
    await advance(1400);
    return st;
  }

  it('LG-07 the map opens maze 1; each maze won gives stars and gold and opens the next', async () => {
    const onGold = vi.fn();
    const mirror = seeded(5);
    render(<MazeGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(5)} />);
    expect(screen.getByTestId('maze-map')).toBeInTheDocument();
    expect(screen.getByLabelText('Mê cung 2 (chưa mở)')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Mê cung 1'));
    for (let level = 0; level < 3; level++) {
      expect(dialog().dataset.level).toBe(String(level));
      await solve({ ...createMazeLevel(level, mirror) });
      expect(screen.getByTestId('maze-result')).toBeInTheDocument();
      expect(onGold).toHaveBeenCalledTimes(level + 1);
      expect(onGold).toHaveBeenLastCalledWith(15);
      fireEvent.click(screen.getByText('Màn tiếp theo ➜'));
    }
    expect(getProgress('maze')).toMatchObject({ g1: 3, g2: 3, g3: 3 });
    fireEvent.click(screen.getByLabelText('Bản đồ mê cung'));
    expect(screen.getByLabelText('Mê cung 4')).toBeEnabled();
    expect(screen.getByLabelText('Mê cung 5 (chưa mở)')).toBeDisabled();
  });

  it('LG-07b ice castle: the Pokeball stays locked until the key is picked up', async () => {
    const onGold = vi.fn();
    localStorage.setItem('pokescan_progress_v1', JSON.stringify({ maze: Object.fromEntries(MAZE_LEVELS.slice(0, 6).map((l) => [l.id, 1])) }));
    render(<MazeGame player={PLAYER} onClose={vi.fn()} onGold={onGold} random={seeded(9)} />);
    fireEvent.click(screen.getByLabelText('Mê cung 7'));
    expect(dialog().dataset.key).toBe('false');
    const st = await solve({ ...createMazeLevel(6, seeded(9)) });
    expect(st.done).toBe(true);
    expect(dialog().dataset.key).toBe('true');
    expect(screen.getByTestId('maze-result')).toBeInTheDocument();
    expect(onGold).toHaveBeenCalledTimes(1);
  });

  it('LG-08 walking into a hedge does nothing; the pad buttons move too', async () => {
    const level = createMazeLevel(0, seeded(6));
    render(<MazeGame player={PLAYER} onClose={vi.fn()} random={seeded(6)} />);
    fireEvent.click(screen.getByLabelText('Mê cung 1'));
    const blocked = Object.keys(DIRS).find((d) => level.maze.cells[0][DIRS[d].wall]);
    fireEvent.keyDown(window, { key: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[blocked] });
    expect(sounds.playOops).toHaveBeenCalled();
    const open = Object.keys(DIRS).find((d) => !level.maze.cells[0][DIRS[d].wall]);
    fireEvent.pointerDown(screen.getByLabelText({ up: 'Lên', down: 'Xuống', left: 'Trái', right: 'Phải' }[open]));
    expect(sounds.playWhoosh).toHaveBeenCalled();
  });
});
