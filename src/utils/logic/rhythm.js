// Pokemon dance (rhythm game): notes of a song fall in 4 lanes; tap the lane when the note
// reaches the ring. Each hit plays the song's own note, so a good run plays the melody.
import { songById, noteTimes } from './music';

export const LANES = 4;
export const LANE_INFO = [
  { arrow: '⬅️', color: '#f43f5e' },
  { arrow: '⬇️', color: '#38bdf8' },
  { arrow: '⬆️', color: '#34d399' },
  { arrow: '➡️', color: '#facc15' },
];
// Seconds a note takes to fall to the ring (slow enough for children)
export const FALL_TIME = 2.2;
export const WINDOWS = { perfect: 0.13, good: 0.28 };
export const POINTS = { perfect: 100, good: 60 };
// Songs used, slower than in the music game
export const RHYTHM_SONGS = [
  { id: 'hotcross', speed: 0.8 },
  { id: 'twinkle', speed: 0.8 },
  { id: 'mary', speed: 0.85 },
  { id: 'joy', speed: 0.85 },
];

/** Lane of a note: the melody's pitch folded onto 4 lanes (low left, high right). */
export const laneOf = (note) => Math.min(LANES - 1, Math.floor((note / 8) * LANES));

/** The chart: [{ id, time, lane, note }] starting after a short lead-in. */
export function makeChart(songId, lead = 2.5) {
  const cfg = RHYTHM_SONGS.find((s) => s.id === songId) || RHYTHM_SONGS[0];
  const song = songById(cfg.id);
  const times = noteTimes({ ...song, tempo: song.tempo * cfg.speed });
  return times.map((n, id) => ({ id, time: lead + n.start, lane: laneOf(n.note), note: n.note }));
}

export function createRun(songId) {
  const chart = makeChart(songId);
  return { songId, chart, judged: {}, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, good: 0, miss: 0 }, done: false, end: chart[chart.length - 1].time + 1.5 };
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
