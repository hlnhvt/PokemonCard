// Pokemon xylophone: 8 bars (C4..C5). In a song the next bar lights up and the child
// taps it; at the end the whole song plays back with the Pokemon dancing.

export const NOTES = [
  { id: 'C4', label: 'Đô', freq: 261.63, color: '#ef4444' },
  { id: 'D4', label: 'Rê', freq: 293.66, color: '#f97316' },
  { id: 'E4', label: 'Mi', freq: 329.63, color: '#facc15' },
  { id: 'F4', label: 'Fa', freq: 349.23, color: '#22c55e' },
  { id: 'G4', label: 'Sol', freq: 392.0, color: '#06b6d4' },
  { id: 'A4', label: 'La', freq: 440.0, color: '#3b82f6' },
  { id: 'B4', label: 'Si', freq: 493.88, color: '#8b5cf6' },
  { id: 'C5', label: 'Đố', freq: 523.25, color: '#ec4899' },
];

const IDX = Object.fromEntries(NOTES.map((n, i) => [n.id, i]));
/** "E4 D4 C4:2" -> [{ note: 2, beats: 1 }, { note: 1, beats: 1 }, { note: 0, beats: 2 }] */
export function parseMelody(text) {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [id, beats] = token.split(':');
      if (!(id in IDX)) throw new Error(`Unknown note ${id}`);
      return { note: IDX[id], beats: Number(beats) || 1 };
    });
}

export const SONGS = [
  {
    id: 'twinkle',
    title: 'Ngôi sao lấp lánh',
    subtitle: 'Twinkle Twinkle Little Star',
    tempo: 100,
    melody: parseMelody('C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2'),
  },
  {
    id: 'mary',
    title: 'Chú cừu nhỏ',
    subtitle: 'Mary Had a Little Lamb',
    tempo: 110,
    melody: parseMelody('E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4'),
  },
  {
    id: 'jingle',
    title: 'Chuông ngân vang',
    subtitle: 'Jingle Bells',
    tempo: 120,
    melody: parseMelody('E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4 D4 E4:4 F4 F4 F4 F4 F4 E4 E4 E4 E4 D4 D4 E4 D4:2 G4:2'),
  },
  {
    id: 'joy',
    title: 'Khúc hoan ca',
    subtitle: 'Ode to Joy',
    tempo: 110,
    melody: parseMelody('E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4:2'),
  },
];

export const songById = (id) => SONGS.find((s) => s.id === id) || null;

export const startSong = (song) => ({ song, index: 0, mistakes: 0, done: false, lastHit: null });

/** Returns { state, correct }. A wrong bar still plays its sound but does not advance. */
export function pressNote(state, note) {
  if (state.done) return { state, correct: false };
  const expected = state.song.melody[state.index].note;
  if (note !== expected) return { state: { ...state, mistakes: state.mistakes + 1, lastHit: note }, correct: false };
  const index = state.index + 1;
  return { state: { ...state, index, done: index >= state.song.melody.length, lastHit: note }, correct: true };
}

/** Seconds from the start of the song at which each note plays (for the playback). */
export function noteTimes(song) {
  const beat = 60 / song.tempo;
  let t = 0;
  return song.melody.map((n) => {
    const start = t;
    t += n.beats * beat;
    return { ...n, start, duration: n.beats * beat };
  });
}

export function musicStars(mistakes, length) {
  if (mistakes <= Math.max(1, Math.floor(length / 12))) return 3;
  if (mistakes <= Math.floor(length / 4)) return 2;
  return 1;
}
