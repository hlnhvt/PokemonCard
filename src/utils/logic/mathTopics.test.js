import { describe, it, expect } from 'vitest';
import { MATH_TOPICS, MATH_LEVELS, QUESTIONS_PER_LESSON, makeTopicLesson, makeTopicQuestion, numberChoices } from './mathTopics';
import { seeded } from '../../test/seeded';

const evalSign = (a, b) => (a < b ? '<' : a > b ? '>' : '=');

describe('math topics', () => {
  it('MT-01 12 kinds x 3 difficulties; every question has the answer among different choices and a hint', () => {
    expect(MATH_TOPICS).toHaveLength(12);
    expect(MATH_LEVELS.map((l) => l.id)).toEqual(['easy', 'medium', 'hard']);
    for (const t of MATH_TOPICS) {
      for (const l of MATH_LEVELS) {
        for (let s = 1; s <= 25; s++) {
          const lesson = makeTopicLesson(t.id, l.id, seeded(s * 7 + t.id.length));
          expect(lesson).toHaveLength(QUESTIONS_PER_LESSON);
          for (const q of lesson) {
            expect(q.choices).toContain(q.answer);
            expect(new Set(q.choices).size).toBe(q.choices.length);
            expect(q.choices.length).toBeGreaterThanOrEqual(3);
            expect(q.hint.length).toBeGreaterThan(3);
            for (const c of q.choices) if (typeof c === 'number') expect(c).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('MT-02 answers are right: sums, signs, sequences, sharing, coins, clocks, shapes', () => {
    for (let s = 1; s <= 60; s++) {
      const r = seeded(s);
      const add = makeTopicQuestion('add', 'hard', r);
      expect(add.answer).toBe(add.a + add.b);
      expect(add.answer).toBeLessThanOrEqual(99);
      const sub = makeTopicQuestion('sub', 'medium', r);
      expect(sub.answer).toBe(sub.a - sub.b);
      expect(sub.answer).toBeGreaterThan(0);
      const cmp = makeTopicQuestion('compare', 'medium', r);
      const [left, right] = cmp.text.split('?').map((x) => Number(x.trim()));
      expect(cmp.answer).toBe(evalSign(left, right));
      const seq = makeTopicQuestion('sequence', 'hard', r);
      expect(seq.visual.seq[seq.visual.gap]).toBe(seq.answer);
      const share = makeTopicQuestion('div', 'hard', r);
      const [total, by] = share.text.split(/[÷=]/).map((x) => Number(x.trim()));
      expect(share.answer * by).toBe(total);
      const coins = makeTopicQuestion('money', 'medium', r);
      expect(coins.answer).toBe(coins.visual.coins.reduce((a, b) => a + b, 0));
      const change = makeTopicQuestion('money', 'hard', r);
      expect(change.answer).toBe(change.visual.paid - change.visual.price);
      const clk = makeTopicQuestion('clock', 'medium', r);
      expect(clk.answer).toBe(clk.visual.m === 0 ? `${clk.visual.h} giờ` : `${clk.visual.h} giờ rưỡi`);
      const shape = makeTopicQuestion('shapes', 'hard', r);
      expect(shape.answer).toBe(shape.visual.list.reduce((a, b) => a + b, 0));
    }
  });

  it('MT-03 harder levels use bigger numbers and more choices', () => {
    const max = (topic, level) => Math.max(...Array.from({ length: 40 }, (_, s) => makeTopicQuestion(topic, level, seeded(s + 1)).answer));
    expect(max('add', 'easy')).toBeLessThanOrEqual(10);
    expect(max('add', 'medium')).toBeLessThanOrEqual(20);
    expect(max('add', 'hard')).toBeGreaterThan(20);
    expect(max('count', 'hard')).toBeGreaterThan(max('count', 'easy'));
    expect(makeTopicQuestion('mul', 'hard', seeded(3)).choices).toHaveLength(4);
    expect(numberChoices(50, seeded(1), 4, 4)).toContain(50);
  });
});
