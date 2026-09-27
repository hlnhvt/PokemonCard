// Pokemon maths, many kinds of sums in three difficulties. Every question:
// { kind, level, text, say, answer, choices, hint, visual } where `visual` tells the screen
// what to draw (pictures, groups, coins, a clock, a shape) and `choices` are the balloons.
// Pure; `random` is injectable for tests.
import { THINGS, makeChoices as smallChoices } from './math';

export const MATH_LEVELS = [
  { id: 'easy', label: 'Dễ', icon: '🌱' },
  { id: 'medium', label: 'Vừa', icon: '🔥' },
  { id: 'hard', label: 'Khó', icon: '👑' },
];

export const MATH_TOPICS = [
  { id: 'count', title: 'Đếm hình', icon: '🍎', color: 'from-rose-400 to-pink-500' },
  { id: 'add', title: 'Phép cộng', icon: '➕', color: 'from-sky-400 to-blue-500' },
  { id: 'sub', title: 'Phép trừ', icon: '➖', color: 'from-amber-400 to-orange-500' },
  { id: 'compare', title: 'So sánh', icon: '⚖️', color: 'from-lime-400 to-green-500' },
  { id: 'missing', title: 'Số còn thiếu', icon: '❓', color: 'from-violet-400 to-purple-500' },
  { id: 'sequence', title: 'Dãy số', icon: '🔢', color: 'from-teal-400 to-cyan-500' },
  { id: 'mul', title: 'Phép nhân', icon: '✖️', color: 'from-fuchsia-400 to-pink-600' },
  { id: 'div', title: 'Chia đều', icon: '➗', color: 'from-indigo-400 to-violet-600' },
  { id: 'money', title: 'Đếm tiền', icon: '🪙', color: 'from-yellow-400 to-amber-500' },
  { id: 'clock', title: 'Xem đồng hồ', icon: '🕒', color: 'from-emerald-400 to-teal-600' },
  { id: 'shapes', title: 'Hình học', icon: '🔷', color: 'from-blue-400 to-indigo-600' },
  { id: 'word', title: 'Toán đố', icon: '📖', color: 'from-orange-400 to-red-500' },
];
export const QUESTIONS_PER_LESSON = 8;

const int = (random, lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
const pick = (list, random) => list[Math.floor(random() * list.length)];
const lvl = (level) => MATH_LEVELS.findIndex((l) => l.id === level);

/** Three (or four when hard) different numbers around the answer, never negative. */
export function numberChoices(answer, random, spread = 3, count = 3) {
  if (answer <= 12 && count === 3 && spread <= 3) return smallChoices(answer, random);
  const set = new Set([answer]);
  const near = [];
  for (let d = 1; d <= spread; d++) near.push(answer - d, answer + d);
  if (answer >= 10) near.push(answer - 10, answer + 10);
  const pool = near.filter((n) => n >= 0);
  while (set.size < count && pool.length) set.add(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  for (let n = answer + 1; set.size < count; n++) set.add(n);
  return [...set].sort((a, b) => a - b);
}

const VI = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];
const say = (n) => (n <= 10 ? VI[n] : String(n));
const POKE = ['Pikachu', 'Bulbasaur', 'Squirtle', 'Charmander', 'Eevee', 'Jigglypuff', 'Snorlax', 'Psyduck'];
export const POKE_DEX = { Pikachu: 25, Bulbasaur: 1, Squirtle: 7, Charmander: 4, Eevee: 133, Jigglypuff: 39, Snorlax: 143, Psyduck: 54 };
const FOODS = ['quả mọng', 'bánh quy', 'kẹo', 'quả táo', 'ngôi sao'];

function count(level, random) {
  const [lo, hi] = [[2, 7], [6, 12], [11, 20]][lvl(level)];
  const n = int(random, lo, hi);
  const thing = pick(THINGS, random);
  return { text: `Có mấy ${thing}?`, say: 'Có bao nhiêu hình?', answer: n, visual: { type: 'things', thing, total: n }, hint: 'Chạm đếm từng hình nhé' };
}

function add(level, random) {
  const L = lvl(level);
  let a;
  let b;
  if (L === 0) {
    a = int(random, 1, 6);
    b = int(random, 1, Math.min(5, 10 - a));
  } else if (L === 1) {
    a = int(random, 5, 12);
    b = int(random, 2, 20 - a);
  } else {
    a = int(random, 12, 68);
    b = int(random, 8, 99 - a);
  }
  const thing = pick(THINGS, random);
  const pictures = a + b <= 20;
  return { text: `${a} + ${b} = ?`, say: `${say(a)} cộng ${say(b)} bằng mấy?`, answer: a + b, a, b, visual: pictures ? { type: 'add', thing, a, b } : { type: 'big', text: `${a} + ${b}` }, hint: pictures ? 'Đếm hết cả hai nhóm' : `Cộng hàng chục trước: ${Math.floor(a / 10) * 10} + ${Math.floor(b / 10) * 10}` };
}

function sub(level, random) {
  const L = lvl(level);
  const [lo, hi] = [[3, 9], [10, 20], [30, 99]][L];
  const a = int(random, lo, hi);
  const b = int(random, L === 2 ? 5 : 1, L === 2 ? a - 5 : a - 1);
  const thing = pick(THINGS, random);
  const pictures = a <= 20;
  return { text: `${a} − ${b} = ?`, say: `${say(a)} bớt ${say(b)} còn mấy?`, answer: a - b, a, b, visual: pictures ? { type: 'sub', thing, a, b } : { type: 'big', text: `${a} − ${b}` }, hint: pictures ? 'Pokémon ăn mất mấy hình rồi?' : 'Trừ hàng chục trước, rồi hàng đơn vị' };
}

const SIGNS = ['<', '=', '>'];
function compare(level, random) {
  const L = lvl(level);
  let left;
  let right;
  let lv;
  let rv;
  if (L < 2) {
    const max = L === 0 ? 10 : 50;
    lv = int(random, 0, max);
    rv = random() < 0.2 ? lv : int(random, 0, max);
    left = String(lv);
    right = String(rv);
  } else {
    const a = int(random, 1, 9);
    const b = int(random, 1, 9);
    lv = a + b;
    rv = random() < 0.25 ? lv : int(random, Math.max(2, lv - 3), lv + 3);
    left = `${a} + ${b}`;
    right = String(rv);
  }
  const sign = lv < rv ? '<' : lv > rv ? '>' : '=';
  return { text: `${left}  ?  ${right}`, say: 'Chọn dấu lớn hơn, bé hơn hay bằng', answer: sign, choices: SIGNS, visual: L === 0 ? { type: 'compare', thing: pick(THINGS, random), lv, rv } : { type: 'big', text: `${left}  ?  ${right}` }, hint: 'Miệng cá sấu há về phía số lớn hơn 🐊' };
}

function missing(level, random) {
  const L = lvl(level);
  if (L === 0) {
    const a = int(random, 1, 6);
    const c = int(random, a + 1, 10);
    return { text: `${a} + ? = ${c}`, say: `${say(a)} cộng mấy bằng ${say(c)}?`, answer: c - a, visual: { type: 'big', text: `${a} + ? = ${c}` }, hint: `Đếm tiếp từ ${a} lên ${c}` };
  }
  if (L === 1) {
    const b = int(random, 2, 9);
    const c = int(random, 3, 11);
    return { text: `? − ${b} = ${c}`, say: `Số nào bớt ${say(b)} còn ${say(c)}?`, answer: b + c, visual: { type: 'big', text: `? − ${b} = ${c}` }, hint: `Lấy ${c} + ${b}` };
  }
  const a = int(random, 2, 5);
  const b = int(random, 2, 9);
  return { text: `${a} × ? = ${a * b}`, say: `${say(a)} nhân mấy bằng ${a * b}?`, answer: b, visual: { type: 'big', text: `${a} × ? = ${a * b}` }, hint: `Đếm theo bước ${a}: ${a}, ${a * 2}, ${a * 3}…` };
}

function sequence(level, random) {
  const L = lvl(level);
  const steps = [[1, 2], [2, 5, 10, -1, -2], [3, 4, -5, -10, 'x2']][L];
  const step = pick(steps, random);
  let start;
  const seq = [];
  if (step === 'x2') {
    start = pick([1, 2, 3], random);
    for (let i = 0; i < 5; i++) seq.push(start * 2 ** i);
  } else {
    start = step > 0 ? int(random, 0, L === 0 ? 8 : 20) : int(random, Math.abs(step) * 5, Math.abs(step) * 5 + 20);
    for (let i = 0; i < 5; i++) seq.push(start + step * i);
  }
  const gap = L === 0 ? 4 : int(random, 1, 4);
  const answer = seq[gap];
  const shown = seq.map((n, i) => (i === gap ? '?' : n)).join(', ');
  const rule = step === 'x2' ? 'Mỗi số gấp đôi số trước' : step > 0 ? `Mỗi lần tăng ${step}` : `Mỗi lần giảm ${-step}`;
  return { text: shown, say: 'Số nào còn thiếu trong dãy?', answer, visual: { type: 'sequence', seq, gap }, hint: rule };
}

function mul(level, random) {
  const L = lvl(level);
  const a = L === 0 ? int(random, 2, 4) : L === 1 ? int(random, 2, 5) : int(random, 6, 9);
  const b = L === 0 ? pick([2, 5, 10].filter((x) => a * x <= 20 || x === 2), random) : int(random, 2, L === 1 ? 10 : 9);
  const thing = pick(THINGS, random);
  const pictures = a * b <= 20;
  return { text: `${a} × ${b} = ?`, say: `${say(a)} nhân ${say(b)} bằng mấy?`, answer: a * b, visual: pictures ? { type: 'groups', thing, groups: a, each: b } : { type: 'big', text: `${a} × ${b}` }, hint: pictures ? `${a} nhóm, mỗi nhóm ${b}` : `Cộng ${b} liên tiếp ${a} lần` };
}

function div(level, random) {
  const L = lvl(level);
  const by = L === 0 ? 2 : L === 1 ? int(random, 2, 5) : int(random, 3, 9);
  const each = L === 0 ? int(random, 1, 5) : L === 1 ? int(random, 2, 6) : int(random, 3, 9);
  const total = by * each;
  const thing = pick(['🍬', '🍪', '🍓', '⭐'], random);
  const pictures = total <= 20;
  return { text: `${total} ÷ ${by} = ?`, say: `Chia ${total} ${thing === '⭐' ? 'ngôi sao' : 'cái'} cho ${say(by)} bạn, mỗi bạn mấy?`, answer: each, visual: pictures ? { type: 'share', thing, total, by } : { type: 'big', text: `${total} ÷ ${by}` }, hint: `${by} × mấy = ${total}?` };
}

const COINS = [1, 2, 5, 10];
function money(level, random) {
  const L = lvl(level);
  if (L < 2) {
    const n = L === 0 ? int(random, 2, 3) : int(random, 3, 5);
    const coins = Array.from({ length: n }, () => pick(L === 0 ? [1, 2, 5] : COINS, random)).sort((a, b) => b - a);
    const sum = coins.reduce((a, b) => a + b, 0);
    return { text: 'Có tất cả bao nhiêu xu?', say: 'Đếm xem có bao nhiêu xu', answer: sum, visual: { type: 'coins', coins }, hint: 'Cộng xu lớn trước' };
  }
  const price = int(random, 3, 18);
  const paid = price <= 10 ? 10 : 20;
  return { text: `Kẹo giá ${price} xu, đưa ${paid} xu. Thối lại mấy xu?`, say: `Kẹo giá ${price} xu, bé đưa ${paid} xu, được thối lại mấy xu?`, answer: paid - price, visual: { type: 'shop', price, paid }, hint: `${paid} − ${price}` };
}

const clockText = (h, m) => (m === 0 ? `${h} giờ` : m === 30 ? `${h} giờ rưỡi` : `${h} giờ ${m}`);
function clock(level, random) {
  const L = lvl(level);
  const h = int(random, 1, 12);
  const m = L === 0 ? 0 : L === 1 ? pick([0, 30], random) : pick([15, 45, 5, 20, 25, 35, 40, 50, 10, 55], random);
  const answer = clockText(h, m);
  const others = new Set([answer]);
  const wrong = () => {
    if (L === 0) return clockText(((h + pick([1, 2, 11, 10], random) - 1) % 12) + 1, 0);
    if (L === 1) return random() < 0.5 ? clockText(h, m === 0 ? 30 : 0) : clockText((h % 12) + 1, m);
    return random() < 0.5 ? clockText(h, pick([5, 10, 15, 20, 25, 35, 40, 45, 50, 55].filter((x) => x !== m), random)) : clockText((h % 12) + 1, m);
  };
  while (others.size < 3) others.add(wrong());
  return { text: 'Đồng hồ chỉ mấy giờ?', say: 'Đồng hồ chỉ mấy giờ?', answer, choices: [...others].sort(() => random() - 0.5), visual: { type: 'clock', h, m }, hint: 'Kim ngắn chỉ giờ, kim dài chỉ phút' };
}

const SHAPE_NAMES = { 3: 'tam giác', 4: 'tứ giác', 5: 'ngũ giác', 6: 'lục giác', 7: 'thất giác', 8: 'bát giác' };
function shapes(level, random) {
  const L = lvl(level);
  const sides = L === 0 ? int(random, 3, 4) : L === 1 ? int(random, 3, 6) : int(random, 5, 8);
  if (L === 2 && random() < 0.5) {
    const s2 = int(random, 3, 6);
    return { text: 'Hai hình có tất cả mấy góc?', say: 'Đếm góc của cả hai hình', answer: sides + s2, visual: { type: 'shapes', list: [sides, s2] }, hint: 'Mỗi hình có số góc bằng số cạnh' };
  }
  return { text: 'Hình này có mấy cạnh?', say: 'Hình này có mấy cạnh?', answer: sides, visual: { type: 'shapes', list: [sides] }, hint: `Đây là hình ${SHAPE_NAMES[sides]}` };
}

function word(level, random) {
  const L = lvl(level);
  const who = pick(POKE, random);
  const friend = pick(POKE.filter((p) => p !== who), random);
  const food = pick(FOODS, random);
  if (L === 0) {
    const a = int(random, 2, 6);
    const b = int(random, 1, 10 - a);
    if (random() < 0.5) return { text: `${who} có ${a} ${food}, ${friend} cho thêm ${b}. ${who} có tất cả mấy ${food}?`, answer: a + b, visual: { type: 'story', who }, hint: `${a} + ${b}` };
    return { text: `${who} có ${a + b} ${food}, ăn mất ${b}. Còn lại mấy ${food}?`, answer: a, visual: { type: 'story', who }, hint: `${a + b} − ${b}` };
  }
  if (L === 1) {
    const a = int(random, 8, 15);
    const b = int(random, 2, 6);
    const c = int(random, 1, 5);
    return { text: `${who} hái ${a} ${food}, cho ${friend} ${b}, rồi hái thêm ${c}. ${who} có mấy ${food}?`, answer: a - b + c, visual: { type: 'story', who }, hint: `${a} − ${b} + ${c}` };
  }
  const groups = int(random, 3, 6);
  const each = int(random, 2, 6);
  if (random() < 0.5) return { text: `Có ${groups} túi, mỗi túi ${each} ${food}. Có tất cả mấy ${food}?`, answer: groups * each, visual: { type: 'story', who }, hint: `${groups} × ${each}` };
  return { text: `Chia đều ${groups * each} ${food} cho ${groups} bạn Pokémon. Mỗi bạn được mấy?`, answer: each, visual: { type: 'story', who }, hint: `${groups * each} ÷ ${groups}` };
}

const MAKERS = { count, add, sub, compare, missing, sequence, mul, div, money, clock, shapes, word };

export function makeTopicQuestion(topic, level, random = Math.random) {
  const q = MAKERS[topic](level, random);
  const L = lvl(level);
  const choices = q.choices || numberChoices(q.answer, random, L === 2 ? 4 : 3, L === 2 ? 4 : 3);
  return { kind: topic, level, say: q.say || q.text, ...q, choices };
}

/** A lesson: 8 questions of one kind and difficulty, no two the same in a row. */
export function makeTopicLesson(topic, level, random = Math.random) {
  const out = [];
  for (let guard = 0; out.length < QUESTIONS_PER_LESSON && guard < 200; guard++) {
    const q = makeTopicQuestion(topic, level, random);
    const key = (x) => JSON.stringify([x.text, x.visual, x.answer]);
    if (out.length && key(out[out.length - 1]) === key(q)) continue;
    out.push(q);
  }
  return out;
}

export const lessonId = (topic, level) => `${topic}-${level}`;
