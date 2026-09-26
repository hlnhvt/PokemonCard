import { describe, it, expect } from 'vitest';
import { generateMaze, shortestPath, canMove, createMazeLevel, slide, mazeStars, swipeDirection, MAZE_LEVELS, MAZE_WORLDS, DIRS, cellAt } from './maze';
import { makeQuestion, makeMathLesson, makeChoices, mathStars, MATH_PLAN } from './math';
import { WORDS, makeEnglishLesson, englishStars, sayWord, ENGLISH_ROUNDS } from './english';
import { createMemoryGame, tapCard, nextRound, memoryStars, START_LENGTH, MAX_LENGTH, HEARTS } from './memory';
import { NOTES, SONGS, MUSIC_TIERS, songById, startSong, pressNote, noteTimes, musicStars, parseMelody } from './music';
import { seeded } from '../../test/seeded';

describe('maze', () => {
  it('MZ-01 perfect maze: walls match on both sides and every cell is reachable', () => {
    for (let s = 1; s <= 20; s++) {
      const m = generateMaze(7, 9, seeded(s));
      for (let y = 0; y < m.h; y++) {
        for (let x = 0; x < m.w; x++) {
          if (x < m.w - 1) expect(cellAt(m, x, y).e).toBe(cellAt(m, x + 1, y).w);
          if (y < m.h - 1) expect(cellAt(m, x, y).s).toBe(cellAt(m, x, y + 1).n);
          expect(shortestPath(m, m.start, { x, y }).length).toBeGreaterThan(0);
        }
      }
      // The outer border is closed
      for (let x = 0; x < m.w; x++) expect(cellAt(m, x, 0).n && cellAt(m, x, m.h - 1).s).toBe(true);
      // A perfect maze has exactly w*h - 1 openings
      let open = 0;
      m.cells.forEach((c) => (open += ['n', 'e', 's', 'w'].filter((k) => !c[k]).length));
      expect(open / 2).toBe(m.w * m.h - 1);
    }
  });

  it('MZ-02 sliding follows corridors, stops at junctions and berries; walls block', () => {
    const level = createMazeLevel(1, seeded(3));
    const blocked = Object.keys(DIRS).find((d) => !canMove(level.maze, 0, 0, d));
    expect(slide(level, blocked).path).toEqual([]);
    const open = Object.keys(DIRS).find((d) => canMove(level.maze, 0, 0, d));
    const { state, path } = slide(level, open);
    expect(path.length).toBeGreaterThan(0);
    expect(state.steps).toBe(path.length);
    expect(state.pos).toEqual(path[path.length - 1]);
  });

  it('MZ-03 a bot following the shortest route (key first in the castle) finishes every level with 3 stars', () => {
    for (let level = 0; level < MAZE_LEVELS.length; level++) {
      for (let s = 1; s <= 10; s++) {
        let st = createMazeLevel(level, seeded(s * 7 + level));
        st = { ...st, berries: [] }; // berries would stop slides early; tested separately
        for (let guard = 0; !st.done && guard < 300; guard++) {
          const route = shortestPath(st.maze, st.pos, st.hasKey ? st.maze.goal : st.key);
          const next = route[1];
          const dir = Object.keys(DIRS).find((d) => st.pos.x + DIRS[d].dx === next.x && st.pos.y + DIRS[d].dy === next.y);
          st = slide(st, dir).state;
        }
        expect(st.done).toBe(true);
        expect(mazeStars(st.steps, st.shortest)).toBe(3);
      }
    }
  });

  it('MZ-04 berries are collected once; stars and swipes', () => {
    const level = createMazeLevel(0, seeded(5));
    expect(level.berries).toHaveLength(MAZE_LEVELS[0].berries);
    // A berry whose route does not cross the goal (reaching the goal ends the level)
    const berry = level.berries.find((b) => !shortestPath(level.maze, level.maze.start, b).some((c) => c.x === level.maze.goal.x && c.y === level.maze.goal.y));
    let st = level;
    for (let guard = 0; guard < 60 && st.collected === 0; guard++) {
      const route = shortestPath(st.maze, st.pos, berry);
      const next = route[1];
      const dir = Object.keys(DIRS).find((d) => st.pos.x + DIRS[d].dx === next.x && st.pos.y + DIRS[d].dy === next.y);
      st = slide(st, dir).state;
    }
    expect(st.collected).toBe(1);
    expect(st.berries).toHaveLength(level.berries.length - 1);
    expect([mazeStars(10, 10), mazeStars(20, 10), mazeStars(40, 10)]).toEqual([3, 2, 1]);
    expect([swipeDirection(40, 5), swipeDirection(-40, 5), swipeDirection(3, 50), swipeDirection(3, -50), swipeDirection(5, 5)]).toEqual(['right', 'left', 'down', 'up', null]);
  });
});

describe('maze levels', () => {
  it('MZ-05 nine levels in three worlds, growing; the castle has a key on a far dead end', () => {
    expect(MAZE_LEVELS).toHaveLength(9);
    expect(new Set(MAZE_LEVELS.map((l) => l.id)).size).toBe(9);
    for (const w of MAZE_WORLDS) expect(MAZE_LEVELS.filter((l) => l.world === w.id)).toHaveLength(3);
    for (let i = 1; i < MAZE_LEVELS.length; i++) expect(MAZE_LEVELS[i].w * MAZE_LEVELS[i].h).toBeGreaterThanOrEqual(MAZE_LEVELS[i - 1].w * MAZE_LEVELS[i - 1].h);
    const castle = createMazeLevel(6, seeded(3));
    expect(castle.key).not.toBeNull();
    expect(castle.hasKey).toBe(false);
    expect(castle.berries.some((b) => b.x === castle.key.x && b.y === castle.key.y)).toBe(false);
    expect(createMazeLevel(0, seeded(3)).key).toBeNull();
  });

  it('MZ-06 reaching the Pokeball without the key keeps it locked; with the key it opens', () => {
    for (let s = 1; s <= 10; s++) {
      let st = { ...createMazeLevel(6, seeded(s)), berries: [] };
      let sawLocked = false;
      // Go straight to the goal first
      for (let guard = 0; guard < 100 && !(st.pos.x === st.maze.goal.x && st.pos.y === st.maze.goal.y); guard++) {
        const next = shortestPath(st.maze, st.pos, st.maze.goal)[1];
        const dir = Object.keys(DIRS).find((d) => st.pos.x + DIRS[d].dx === next.x && st.pos.y + DIRS[d].dy === next.y);
        st = slide(st, dir).state;
        if (st.locked) sawLocked = true;
        if (st.hasKey) break; // the key happened to be on the way
      }
      if (!st.hasKey) {
        expect(sawLocked).toBe(true);
        expect(st.done).toBe(false);
      }
    }
  });
});

describe('math', () => {
  it('MT-01 questions stay within 0..10 and the answer is always a choice', () => {
    const r = seeded(1);
    for (let i = 0; i < 300; i++) {
      for (const kind of ['count', 'add', 'sub']) {
        const q = makeQuestion(kind, r);
        expect(q.answer).toBeGreaterThanOrEqual(kind === 'sub' ? 1 : 2);
        expect(q.answer).toBeLessThanOrEqual(10);
        expect(q.choices).toContain(q.answer);
        expect(new Set(q.choices).size).toBe(3);
        if (kind === 'add') expect(q.a + q.b).toBe(q.answer);
        if (kind === 'sub') expect(q.a - q.b).toBe(q.answer);
      }
    }
  });

  it('MT-02 a lesson goes count -> add -> take away; stars by mistakes', () => {
    expect(makeMathLesson(seeded(2)).map((q) => q.kind)).toEqual(MATH_PLAN);
    expect(makeChoices(0, seeded(3))).toContain(0);
    expect([mathStars(0), mathStars(3), mathStars(6)]).toEqual([3, 2, 1]);
  });
});

describe('english', () => {
  it('EN-01 word bank: unique words, a picture and a Vietnamese meaning for each', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(WORDS.map((w) => w.word)).size).toBe(WORDS.length);
    expect(new Set(WORDS.map((w) => w.emoji)).size).toBe(WORDS.length);
    for (const w of WORDS) {
      expect(w.vi.length).toBeGreaterThan(1);
      expect(w.same).not.toContain(w.word);
    }
    expect(WORDS.filter((w) => w.same.length).length).toBeGreaterThanOrEqual(10);
  });

  it('EN-02 lessons: different words, alternating modes, 3 distinct choices with the answer', () => {
    for (let s = 1; s <= 30; s++) {
      const lesson = makeEnglishLesson(seeded(s));
      expect(lesson).toHaveLength(ENGLISH_ROUNDS);
      expect(new Set(lesson.map((q) => q.answer.word)).size).toBe(ENGLISH_ROUNDS);
      lesson.forEach((q, i) => {
        expect(q.mode).toBe(i % 2 ? 'look' : 'listen');
        expect(new Set(q.choices.map((c) => c.word)).size).toBe(3);
        expect(q.choices).toContain(q.answer);
      });
    }
  });

  it('EN-03 speech text includes same-meaning words; stars', () => {
    expect(sayWord(WORDS.find((w) => w.word === 'happy'))).toBe('happy. glad, joyful');
    expect(sayWord(WORDS.find((w) => w.word === 'apple'))).toBe('apple');
    expect([englishStars(1), englishStars(3), englishStars(5)]).toEqual([3, 2, 1]);
  });
});

describe('memory', () => {
  const pool = Array.from({ length: 12 }, (_, i) => ({ key: `p${i}`, name: `P${i}` }));

  it('MM-01 rounds show the sequence among 2 extra cards; perfect play reaches the end', () => {
    const r = seeded(4);
    let g = createMemoryGame(pool, r);
    expect(g.round.sequence).toHaveLength(START_LENGTH);
    expect(g.round.cards).toHaveLength(START_LENGTH + 2);
    for (let guard = 0; guard < 20 && g.status !== 'won'; guard++) {
      for (const p of g.round.sequence) g = tapCard(g, p.key);
      if (g.status === 'roundWon') g = nextRound(g, pool, r);
    }
    expect(g.status).toBe('won');
    expect(g.best).toBe(MAX_LENGTH);
    expect(memoryStars(g.best)).toBe(3);
  });

  it('MM-02 a wrong tap costs a heart and replays the same length; no hearts ends the game', () => {
    const r = seeded(5);
    let g = createMemoryGame(pool, r);
    const wrong = g.round.cards.find((c) => c.key !== g.round.sequence[0].key);
    g = tapCard(g, wrong.key);
    expect(g).toMatchObject({ status: 'wrong', hearts: HEARTS - 1 });
    g = nextRound(g, pool, r);
    expect(g.length).toBe(START_LENGTH);
    for (let i = 0; i < HEARTS - 1; i++) {
      const bad = g.round.cards.find((c) => c.key !== g.round.sequence[0].key);
      g = tapCard(g, bad.key);
      if (g.status === 'wrong') g = nextRound(g, pool, r);
    }
    expect(g.status).toBe('over');
    expect([memoryStars(0), memoryStars(4), memoryStars(6)]).toEqual([1, 2, 3]);
  });
});

describe('music', () => {
  it('MU-01 8 notes rising in pitch; songs parse and use only those notes', () => {
    expect(NOTES).toHaveLength(8);
    for (let i = 1; i < NOTES.length; i++) expect(NOTES[i].freq).toBeGreaterThan(NOTES[i - 1].freq);
    expect(SONGS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length);
    for (const t of MUSIC_TIERS) expect(SONGS.filter((s) => s.tier === t.id).length).toBeGreaterThanOrEqual(3);
    // Easy songs are short, hard ones long
    const avg = (tier) => SONGS.filter((s) => s.tier === tier).reduce((a, s) => a + s.melody.length, 0) / SONGS.filter((s) => s.tier === tier).length;
    expect(avg('hard')).toBeGreaterThan(avg('easy'));
    for (const s of SONGS) {
      expect(s.melody.length).toBeGreaterThanOrEqual(10);
      for (const n of s.melody) expect(n.note).toBeGreaterThanOrEqual(0);
    }
    expect(() => parseMelody('C4 X9')).toThrow();
    // Twinkle starts C C G G A A G
    expect(songById('twinkle').melody.slice(0, 7).map((n) => NOTES[n.note].id)).toEqual(['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4']);
  });

  it('MU-02 right bars advance, wrong bars count as mistakes; playback timing', () => {
    const song = songById('twinkle');
    let st = startSong(song);
    let out = pressNote(st, 5);
    expect(out).toMatchObject({ correct: false });
    st = out.state;
    expect(st.mistakes).toBe(1);
    for (const n of song.melody) {
      out = pressNote(st, n.note);
      expect(out.correct).toBe(true);
      st = out.state;
    }
    expect(st.done).toBe(true);
    const times = noteTimes(song);
    expect(times[0].start).toBe(0);
    expect(times[1].start).toBeCloseTo(60 / song.tempo, 5);
    expect([musicStars(1, 14), musicStars(3, 14), musicStars(9, 14)]).toEqual([3, 2, 1]);
  });
});
