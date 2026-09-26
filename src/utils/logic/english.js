// English with pictures: each word has a picture (emoji, works offline), its Vietnamese
// meaning and, when English has one, words with the same meaning.

export const WORDS = [
  { word: 'cat', emoji: '🐱', vi: 'con mèo', same: ['kitty'], topic: 'animal' },
  { word: 'dog', emoji: '🐶', vi: 'con chó', same: ['doggy'], topic: 'animal' },
  { word: 'rabbit', emoji: '🐰', vi: 'con thỏ', same: ['bunny'], topic: 'animal' },
  { word: 'bird', emoji: '🐦', vi: 'con chim', same: [], topic: 'animal' },
  { word: 'fish', emoji: '🐟', vi: 'con cá', same: [], topic: 'animal' },
  { word: 'duck', emoji: '🦆', vi: 'con vịt', same: [], topic: 'animal' },
  { word: 'elephant', emoji: '🐘', vi: 'con voi', same: [], topic: 'animal' },
  { word: 'lion', emoji: '🦁', vi: 'con sư tử', same: [], topic: 'animal' },
  { word: 'apple', emoji: '🍎', vi: 'quả táo', same: [], topic: 'food' },
  { word: 'banana', emoji: '🍌', vi: 'quả chuối', same: [], topic: 'food' },
  { word: 'grapes', emoji: '🍇', vi: 'quả nho', same: [], topic: 'food' },
  { word: 'watermelon', emoji: '🍉', vi: 'quả dưa hấu', same: [], topic: 'food' },
  { word: 'cake', emoji: '🎂', vi: 'bánh kem', same: [], topic: 'food' },
  { word: 'milk', emoji: '🥛', vi: 'sữa', same: [], topic: 'food' },
  { word: 'sun', emoji: '☀️', vi: 'mặt trời', same: [], topic: 'nature' },
  { word: 'moon', emoji: '🌙', vi: 'mặt trăng', same: [], topic: 'nature' },
  { word: 'star', emoji: '⭐', vi: 'ngôi sao', same: [], topic: 'nature' },
  { word: 'tree', emoji: '🌳', vi: 'cái cây', same: [], topic: 'nature' },
  { word: 'flower', emoji: '🌸', vi: 'bông hoa', same: ['blossom'], topic: 'nature' },
  { word: 'sea', emoji: '🌊', vi: 'biển', same: ['ocean'], topic: 'nature' },
  { word: 'rain', emoji: '🌧️', vi: 'cơn mưa', same: [], topic: 'nature' },
  { word: 'car', emoji: '🚗', vi: 'xe ô tô', same: ['automobile'], topic: 'thing' },
  { word: 'bike', emoji: '🚲', vi: 'xe đạp', same: ['bicycle'], topic: 'thing' },
  { word: 'house', emoji: '🏠', vi: 'ngôi nhà', same: ['home'], topic: 'thing' },
  { word: 'ball', emoji: '⚽', vi: 'quả bóng', same: [], topic: 'thing' },
  { word: 'book', emoji: '📖', vi: 'quyển sách', same: [], topic: 'thing' },
  { word: 'gift', emoji: '🎁', vi: 'món quà', same: ['present'], topic: 'thing' },
  { word: 'happy', emoji: '😄', vi: 'vui vẻ', same: ['glad', 'joyful'], topic: 'feeling' },
  { word: 'sad', emoji: '😢', vi: 'buồn', same: ['unhappy'], topic: 'feeling' },
  { word: 'angry', emoji: '😠', vi: 'tức giận', same: ['mad', 'cross'], topic: 'feeling' },
  { word: 'sleepy', emoji: '😴', vi: 'buồn ngủ', same: ['tired', 'drowsy'], topic: 'feeling' },
  { word: 'cold', emoji: '🥶', vi: 'lạnh', same: ['chilly', 'freezing'], topic: 'feeling' },
  { word: 'red', emoji: '🔴', vi: 'màu đỏ', same: [], topic: 'color' },
  { word: 'blue', emoji: '🔵', vi: 'màu xanh dương', same: [], topic: 'color' },
  { word: 'green', emoji: '🟢', vi: 'màu xanh lá', same: [], topic: 'color' },
  { word: 'yellow', emoji: '🟡', vi: 'màu vàng', same: [], topic: 'color' },
];

export const ENGLISH_ROUNDS = 8;
// 'listen': hear the word, pick its picture; 'look': see the picture, pick the word
export const MODES = ['listen', 'look'];

function shuffle(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * A lesson of `rounds` questions with different words. Each has 3 choices (the answer and
 * two other words, preferably from other topics so pictures are easy to tell apart).
 */
export function makeEnglishLesson(random = Math.random, rounds = ENGLISH_ROUNDS) {
  const picked = shuffle(WORDS, random).slice(0, rounds);
  return picked.map((answer, i) => {
    const others = shuffle(WORDS.filter((w) => w.word !== answer.word), random);
    const distractors = [...others.filter((w) => w.topic !== answer.topic), ...others.filter((w) => w.topic === answer.topic)].slice(0, 2);
    return { mode: MODES[i % 2], answer, choices: shuffle([answer, ...distractors], random) };
  });
}

export function englishStars(mistakes) {
  if (mistakes <= 1) return 3;
  if (mistakes <= 3) return 2;
  return 1;
}

/** What the speaker says after a right answer: the word, then its same-meaning words. */
export const sayWord = (w) => (w.same.length ? `${w.word}. ${w.same.join(', ')}` : w.word);
