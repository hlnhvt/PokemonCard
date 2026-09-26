// Pokemon maths: counting, then adding and taking away with pictures (numbers up to 10).

export const MATH_PLAN = ['count', 'count', 'count', 'add', 'add', 'add', 'sub', 'sub', 'sub'];
export const THINGS = ['🍎', '🍓', '⭐', '🎈', '🍩', '🌸', '🐟', '🍪'];

const int = (random, lo, hi) => lo + Math.floor(random() * (hi - lo + 1));

/** Three different answers including the right one, all between 0 and 12, sorted. */
export function makeChoices(answer, random = Math.random) {
  const choices = new Set([answer]);
  const near = [answer - 1, answer + 1, answer - 2, answer + 2, answer + 3].filter((n) => n >= 0 && n <= 12);
  while (choices.size < 3 && near.length) choices.add(near.splice(Math.floor(random() * near.length), 1)[0]);
  for (let n = 0; choices.size < 3; n++) choices.add(n); // only for tiny answers
  return [...choices].sort((a, b) => a - b);
}

export function makeQuestion(kind, random = Math.random) {
  const thing = THINGS[Math.floor(random() * THINGS.length)];
  let a;
  let b = 0;
  let answer;
  if (kind === 'count') {
    a = int(random, 2, 7);
    answer = a;
  } else if (kind === 'add') {
    a = int(random, 1, 6);
    b = int(random, 1, Math.min(5, 10 - a));
    answer = a + b;
  } else {
    a = int(random, 3, 9);
    b = int(random, 1, a - 1);
    answer = a - b;
  }
  const text = kind === 'count' ? `Có mấy ${thing}?` : kind === 'add' ? `${a} + ${b} = ?` : `${a} − ${b} = ?`;
  return { kind, a, b, answer, thing, text, choices: makeChoices(answer, random) };
}

export const makeMathLesson = (random = Math.random) => MATH_PLAN.map((k) => makeQuestion(k, random));

/** Mistakes over the whole lesson: 0-1 -> 3 stars, 2-4 -> 2, more -> 1. */
export function mathStars(mistakes) {
  if (mistakes <= 1) return 3;
  if (mistakes <= 4) return 2;
  return 1;
}
