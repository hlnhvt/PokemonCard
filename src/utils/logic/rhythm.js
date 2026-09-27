// Pokemon dance (rhythm game): notes of a song fall in 4 lanes; tap the lane when the note
// reaches the ring. Each hit plays the song's own note, so a good run plays the melody.
import { songById, noteTimes } from './music';

export const LANES = 4;
export const LANE_INFO = [
  // rot: direction of the arrow in degrees (0 = pointing right)
  { arrow: '⬅️', name: 'Trái', rot: 180, color: '#f43f5e' },
  { arrow: '⬇️', name: 'Xuống', rot: 90, color: '#38bdf8' },
  { arrow: '⬆️', name: 'Lên', rot: -90, color: '#34d399' },
  { arrow: '➡️', name: 'Phải', rot: 0, color: '#facc15' },
];
// Seconds a note takes to fall to the ring (slow enough for children)
export const FALL_TIME = 2.2;
export const WINDOWS = { perfect: 0.13, good: 0.28 };
export const POINTS = { perfect: 100, good: 60 };
// Playing speed the child picks: the song and the falling notes both go faster or slower
export const SPEEDS = [
  { id: 'slow', label: 'Chậm', icon: '🐢', value: 0.75 },
  { id: 'normal', label: 'Vừa', icon: '🚶', value: 1 },
  { id: 'fast', label: 'Nhanh', icon: '🏃', value: 1.25 },
  { id: 'turbo', label: 'Siêu tốc', icon: '⚡', value: 1.5 },
];
export const speedValue = (id) => (SPEEDS.find((s) => s.id === id) || SPEEDS[1]).value;

export const TIERS = [
  { id: 'easy', label: 'Dễ', icon: '🌱' },
  { id: 'medium', label: 'Vừa', icon: '🔥' },
  { id: 'hard', label: 'Khó', icon: '👑' },
];
export const VARIANT_TEXT = { normal: '', mirror: 'đảo chiều', shift: 'đổi làn', dense: 'dồn nốt', chord: 'hợp âm' };

// 34 levels: the first four are the original dances (same ids), then 30 more from all the
// songs, with variants: mirror (lanes flipped), shift (lanes moved over), dense (long notes
// split in two), chord (every 4th note also lights a second lane at the same time).
const L = (songId, speed, variant, tier) => ({ id: variant === 'normal' ? songId : `${songId}-${variant}`, songId, speed, variant, tier });
export const RHYTHM_LEVELS = [
  L('hotcross', 0.8, 'normal', 'easy'), L('twinkle', 0.8, 'normal', 'easy'), L('clair', 0.8, 'normal', 'easy'), L('hotcross', 0.85, 'mirror', 'easy'),
  L('twinkle', 0.85, 'shift', 'easy'), L('clair', 0.85, 'mirror', 'easy'), L('oldmac', 0.8, 'normal', 'easy'), L('mary', 0.85, 'normal', 'easy'),
  L('london', 0.8, 'normal', 'easy'), L('oldmac', 0.85, 'shift', 'easy'), L('row', 0.8, 'normal', 'easy'), L('jingle', 0.8, 'normal', 'easy'),
  L('joy', 0.85, 'normal', 'medium'), L('mary', 0.95, 'mirror', 'medium'), L('london', 0.95, 'shift', 'medium'), L('row', 0.95, 'mirror', 'medium'),
  L('jingle', 0.95, 'shift', 'medium'), L('twinklefull', 0.9, 'normal', 'medium'), L('hotcross', 0.95, 'dense', 'medium'), L('clair', 0.95, 'dense', 'medium'),
  L('oldmac', 1, 'dense', 'medium'), L('joy', 1, 'mirror', 'medium'), L('twinkle', 1, 'dense', 'medium'),
  L('mary', 1.05, 'dense', 'hard'), L('london', 1.05, 'dense', 'hard'), L('row', 1.1, 'dense', 'hard'), L('jingle', 1.1, 'dense', 'hard'),
  L('joy', 1.1, 'dense', 'hard'), L('twinklefull', 1.1, 'shift', 'hard'), L('hotcross', 1.1, 'chord', 'hard'), L('twinkle', 1.15, 'chord', 'hard'),
  L('mary', 1.15, 'chord', 'hard'), L('jingle', 1.2, 'chord', 'hard'), L('twinklefull', 1.2, 'chord', 'hard'),
];
// The original four (kept for the tests and saved progress)
export const RHYTHM_SONGS = RHYTHM_LEVELS.filter((l) => ['hotcross', 'twinkle', 'mary', 'joy'].includes(l.id));
export const levelById = (id) => RHYTHM_LEVELS.find((l) => l.id === id) || RHYTHM_LEVELS[0];
/** Display name of a level: the song, plus its variant ("đảo chiều", "hợp âm"...). */
export const levelTitle = (lv) => `${songById(lv.songId).title}${VARIANT_TEXT[lv.variant] ? ` (${VARIANT_TEXT[lv.variant]})` : ''}`;

/** A level is open when it starts its tier or the level before has a star. */
export function levelOpen(progress, index) {
  const lv = RHYTHM_LEVELS[index];
  if (index === 0 || RHYTHM_LEVELS[index - 1].tier !== lv.tier) return true;
  return (Number(progress[RHYTHM_LEVELS[index - 1].id]) || 0) > 0;
}

/** Lane of a note: the melody's pitch folded onto 4 lanes (low left, high right). */
export const laneOf = (note) => Math.min(LANES - 1, Math.floor((note / 8) * LANES));

const moveLane = (lane, variant) => (variant === 'mirror' ? LANES - 1 - lane : variant === 'shift' ? (lane + 1) % LANES : lane);

/**
 * The chart of a level: [{ id, time, lane, note }] after a lead-in long enough to see the
 * first note fall. speed (0.75..1.5) makes the song faster or slower.
 */
export function makeChart(levelId, { speed = 1, lead } = {}) {
  const lv = levelById(levelId);
  const song = songById(lv.songId);
  let melody = song.melody;
  if (lv.variant === 'dense') melody = melody.flatMap((n) => (n.beats >= 2 ? [{ ...n, beats: n.beats / 2 }, { ...n, beats: n.beats / 2 }] : [n]));
  const times = noteTimes({ ...song, melody, tempo: song.tempo * lv.speed * speed });
  const start = lead ?? Math.max(2.5, FALL_TIME / speed + 0.4);
  const chart = [];
  times.forEach((n, i) => {
    const lane = moveLane(laneOf(n.note), lv.variant);
    chart.push({ id: chart.length, time: start + n.start, lane, note: n.note });
    if (lv.variant === 'chord' && i % 4 === 3) chart.push({ id: chart.length, time: start + n.start, lane: (lane + 2) % LANES, note: Math.min(7, n.note + 2) });
  });
  return chart;
}

export function createRun(levelId, { speed = 1 } = {}) {
  const chart = makeChart(levelId, { speed });
  return { songId: levelById(levelId).songId, levelId, speed, fall: FALL_TIME / speed, chart, judged: {}, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, good: 0, miss: 0 }, done: false, end: chart[chart.length - 1].time + 1.5 };
}

/**
 * The child tapped `lane` at song time `t`. Judges the nearest waiting note of that lane.
 * Returns { state, judgement: 'perfect' | 'good' | null, note }.
 */
export function tapLane(state, lane, t) {
  let best = null;
  for (const n of state.chart) {
    if (n.lane !== lane || state.judged[n.id]) continue;
    const d = Math.abs(n.time - t);
    if (d <= WINDOWS.good && (!best || d < Math.abs(best.time - t))) best = n;
  }
  if (!best) return { state, judgement: null, note: null };
  const judgement = Math.abs(best.time - t) <= WINDOWS.perfect ? 'perfect' : 'good';
  const combo = state.combo + 1;
  const next = {
    ...state,
    judged: { ...state.judged, [best.id]: judgement },
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    // A long combo is worth more: +10% per 10 in a row, up to +50%
    score: state.score + Math.round(POINTS[judgement] * (1 + Math.min(0.5, Math.floor(combo / 10) * 0.1))),
    counts: { ...state.counts, [judgement]: state.counts[judgement] + 1 },
  };
  return { state: next, judgement, note: best };
}

/** Notes that passed the ring unhit become misses. Returns { state, missed: [notes] }. */
export function sweepMisses(state, t) {
  const missed = state.chart.filter((n) => !state.judged[n.id] && t - n.time > WINDOWS.good);
  if (!missed.length) return { state: t >= state.end && !state.done ? { ...state, done: true } : state, missed };
  const judged = { ...state.judged };
  for (const n of missed) judged[n.id] = 'miss';
  return {
    state: { ...state, judged, combo: 0, counts: { ...state.counts, miss: state.counts.miss + missed.length }, done: t >= state.end },
    missed,
  };
}

/** Accuracy 0..1 (perfect counts 1, good 0.6). */
export function accuracy(state) {
  const total = state.chart.length;
  return total ? (state.counts.perfect + state.counts.good * 0.6) / total : 0;
}

export function rhythmStars(state) {
  const a = accuracy(state);
  if (a >= 0.85) return 3;
  if (a >= 0.6) return 2;
  return 1;
}
