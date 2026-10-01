// The 3D playground activities as small pure state machines (no three.js, no React):
// each one takes inputs (rub, drop, swipe, tap, pick…) and time (tick), returns events for
// sounds/FX, and a `view()` with world positions for the scene. Short (10–30 s), kind,
// never a sad fail: every finished activity gives at least one star.
// World: island top at y = 0, the Pokémon stands at the origin facing the camera (+Z).

export const ISLAND_RADIUS = 1.75;
export const HOME = { x: 0, z: 0 };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

export function mulberry(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ACTIVITIES = [
  { id: 'pet', title: 'Vuốt ve', icon: '🤚', color: 'from-pink-400 to-rose-500', hint: (n) => `Xoa nhẹ lên ${n} nào!` },
  { id: 'feed', title: 'Cho ăn', icon: '🍓', color: 'from-orange-400 to-red-500', hint: (n) => `Kéo quả mọng vào ${n}!` },
  { id: 'throw', title: 'Ném bóng', icon: '⚾', color: 'from-sky-400 to-blue-500', hint: () => 'Vuốt lên để ném bóng!' },
  { id: 'dance', title: 'Nhảy múa', icon: '💃', color: 'from-fuchsia-400 to-purple-500', hint: () => 'Chạm theo nhịp nhạc!' },
  { id: 'hide', title: 'Trốn tìm', icon: '🌳', color: 'from-emerald-400 to-green-600', hint: (n) => `Nhìn kỹ ${n} trốn ở đâu nhé!` },
  { id: 'bath', title: 'Tắm', icon: '🫧', color: 'from-cyan-300 to-sky-500', hint: () => 'Xoa để tạo bọt xà phòng!' },
  { id: 'sleep', title: 'Ngủ ngon', icon: '🌙', color: 'from-indigo-400 to-violet-600', hint: (n) => `Suỵt… ${n} đang ngủ` },
  { id: 'photo', title: 'Chụp ảnh', icon: '📸', color: 'from-amber-300 to-orange-500', hint: () => 'Kéo để xoay, chọn khung rồi chụp!' },
];
export const activityById = (id) => ACTIVITIES.find((a) => a.id === id) || null;

/** Stars from a score and two thresholds (always at least 1). */
export const starsFor = (score, two, three) => (score >= three ? 3 : score >= two ? 2 : 1);

/** Activities that give a little friendship (one onPet) when finished. */
export const PET_REWARD = new Set(['pet', 'throw', 'dance', 'hide', 'bath', 'sleep']);

function base(id) {
  return {
    id,
    t: 0,
    phase: 'play',
    progress: 0,
    done: false,
    result: null,
    finish(stars, extra = {}) {
      if (this.done) return [];
      this.done = true;
      this.phase = 'done';
      this.result = { stars, reward: PET_REWARD.has(id) ? 'pet' : null, ...extra };
      return [{ type: 'finish', stars }];
    },
  };
}

// ------------------------------------------------------------------ Vuốt ve (rub)
/** Progress per stage-width of rubbing (≈ 15–20 strokes to finish). */
export const RUB_RATE = 0.24;
export function createPet({ limit = 20 } = {}) {
  const a = base('pet');
  let nextHeart = 0.12;
  a.wiggle = 0;
  a.input = (evt) => {
    if (a.done || evt.type !== 'rub' || !evt.onPokemon) return [];
    const amount = clamp(Number(evt.amount) || 0, 0, 0.2);
    a.progress = clamp(a.progress + amount * RUB_RATE, 0, 1);
    a.wiggle = 1;
    const out = [];
    while (a.progress >= nextHeart && nextHeart <= 1.0001) {
      out.push({ type: 'heart', pitch: 330 + 440 * nextHeart });
      nextHeart += 0.12;
    }
    if (a.progress >= 1) out.push(...a.finish(3));
    return out;
  };
  a.tick = (dt) => {
    if (a.done) return [];
    a.t += dt;
    a.wiggle = Math.max(0, a.wiggle - dt * 2.5);
    if (a.t >= limit) return a.finish(starsFor(a.progress, 0.4, 0.8));
    return [];
  };
  a.view = () => ({ poke: { anim: a.wiggle > 0.2 ? 'happy' : 'idle', wiggle: a.wiggle } });
  return a;
}

// ------------------------------------------------------------------ Cho ăn (drag a berry)
export function createFeed({ limit = 30 } = {}) {
  const a = base('feed');
  a.phase = 'pick';
  a.eatT = 0;
  a.berry = null;
  a.eaten = 0;
  a.input = (evt) => {
    if (a.done) return [];
    if (evt.type === 'drop' && a.phase === 'pick') {
      if (!evt.onPokemon) return [{ type: 'miss' }];
      a.phase = 'wait';
      a.berry = evt.berry;
      return [{ type: 'feedRequest', berry: evt.berry }];
    }
    return [];
  };
  /** The storage outcome of onFeed: { result: 'fed' | 'full' | 'noBerry' | 'max', favorite, gain }. */
  a.resolve = (outcome) => {
    if (a.phase !== 'wait') return [];
    if (outcome?.result === 'fed') {
      a.phase = 'eat';
      a.eatT = 0;
      a.outcome = outcome;
      return [{ type: 'eatStart', favorite: !!outcome.favorite }];
    }
    a.phase = 'pick';
    a.berry = null;
    return [{ type: 'refuse', result: outcome?.result || 'error' }];
  };
  a.tick = (dt) => {
    if (a.done) return [];
    a.t += dt;
    const out = [];
    if (a.phase === 'eat') {
      const before = a.eatT;
      a.eatT += dt;
      for (const at of [0.25, 0.6, 0.95]) if (before < at && a.eatT >= at) out.push({ type: 'munch' });
      if (a.eatT >= 1.5) {
        a.eaten += 1;
        a.phase = 'pick';
        a.berry = null;
        out.push({ type: 'ate', favorite: !!a.outcome?.favorite, gain: a.outcome?.gain || 0 });
        out.push(...a.finish(a.outcome?.favorite ? 3 : 2, { favorite: !!a.outcome?.favorite }));
      }
    } else if (a.t >= limit) out.push(...a.finish(1));
    return out;
  };
  a.view = () => ({ poke: { anim: a.phase === 'eat' ? 'eat' : 'idle', eat: a.phase === 'eat' ? a.eatT : 0, lean: a.phase === 'eat' ? Math.sin(Math.min(1, a.eatT / 0.3) * Math.PI * 0.5) : 0 } });
  return a;
}

// ------------------------------------------------------------------ Ném bóng (fetch)
export const THROW_ROUNDS = 3;
export const BALL_START = { x: 0, y: 0.7, z: 2.6 };
const RUN_SPEED = 2.6;

/** Swipe (dx, dy in stage fractions, up = negative dy) → landing point on the island. */
export function throwTarget(dx, dy) {
  const power = clamp(-dy, 0.05, 1);
  let x = clamp(dx * 2.6, -1.5, 1.5);
  let z = clamp(0.9 - power * 3.2, -1.5, 0.9);
  const r = Math.hypot(x, z);
  if (r > ISLAND_RADIUS - 0.2) {
    const k = (ISLAND_RADIUS - 0.2) / r;
    x *= k;
    z *= k;
  }
  // Never right on the Pokémon's feet: it should run for it
  if (Math.hypot(x, z) < 0.6) z = -0.75;
  return { x, z };
}

export function createThrow({ rounds = THROW_ROUNDS, flight = 0.85, limit = 30 } = {}) {
  const a = base('throw');
  a.phase = 'aim';
  a.round = 0;
  a.ball = { ...BALL_START, visible: true };
  a.poke = { x: HOME.x, z: HOME.z, rotY: 0, hop: 0 };
  a.flyT = 0;
  a.target = null;
  a.catches = 0;
  a.input = (evt) => {
    if (a.done || a.phase !== 'aim') return [];
    if (evt.type !== 'swipe' && evt.type !== 'tap') return [];
    a.target = evt.type === 'swipe' ? throwTarget(evt.dx, evt.dy) : throwTarget((a.round % 3) * 0.25 - 0.25, -0.55);
    a.phase = 'fly';
    a.flyT = 0;
    return [{ type: 'throw', target: a.target }];
  };
  const faceTo = (x, z) => Math.atan2(x - a.poke.x, z - a.poke.z);
  const moveTo = (x, z, dt) => {
    const dx = x - a.poke.x;
    const dz = z - a.poke.z;
    const d = Math.hypot(dx, dz);
    const step = RUN_SPEED * dt;
    if (d <= step) {
      a.poke.x = x;
      a.poke.z = z;
      return true;
    }
    a.poke.rotY = Math.atan2(dx, dz);
    a.poke.x += (dx / d) * step;
    a.poke.z += (dz / d) * step;
    return false;
  };
  a.tick = (dt) => {
    if (a.done) return [];
    a.t += dt;
    a.poke.hop = Math.max(0, a.poke.hop - dt * 2);
    const out = [];
    if (a.phase === 'fly') {
      a.flyT += dt;
      const k = clamp(a.flyT / flight, 0, 1);
      a.ball.x = lerp(BALL_START.x, a.target.x, k);
      a.ball.z = lerp(BALL_START.z, a.target.z, k);
      a.ball.y = lerp(BALL_START.y, 0.14, k) + 4 * 1.6 * k * (1 - k);
      a.poke.rotY = faceTo(a.ball.x, a.ball.z);
      if (k >= 1) {
        a.phase = 'run';
        out.push({ type: 'bounce' });
      }
    } else if (a.phase === 'run') {
      if (moveTo(a.target.x, a.target.z, dt)) {
        a.phase = 'catch';
        a.catchT = 0;
        a.poke.hop = 1;
        a.catches += 1;
        out.push({ type: 'catch' });
      }
    } else if (a.phase === 'catch') {
      a.catchT += dt;
      a.ball.x = a.poke.x;
      a.ball.z = a.poke.z;
      a.ball.y = 1.25 + a.poke.hop * 0.3;
      if (a.catchT > 0.45) a.phase = 'back';
    } else if (a.phase === 'back') {
      const home = moveTo(HOME.x, 0.55, dt);
      a.ball.x = a.poke.x;
      a.ball.z = a.poke.z;
      a.ball.y = 1.25;
      if (home) {
        a.poke.rotY = 0;
        a.round += 1;
        a.poke.hop = 1;
        out.push({ type: 'bring', round: a.round });
        if (a.round >= rounds) {
          out.push(...a.finish(3, { catches: a.catches }));
        } else {
          a.phase = 'aim';
          Object.assign(a.ball, BALL_START);
        }
      }
    } else if (a.phase === 'aim' && a.t > limit) out.push(...a.finish(starsFor(a.round, 1, 2)));
    if (a.phase === 'aim' && !a.done) {
      // drift back home while waiting
      const dx = HOME.x - a.poke.x;
      const dz = 0.55 - a.poke.z;
      a.poke.x += dx * Math.min(1, dt * 3);
      a.poke.z += dz * Math.min(1, dt * 3);
      a.poke.rotY *= 1 - Math.min(1, dt * 6);
    }
    a.progress = a.round / rounds;
    return out;
  };
  a.view = () => ({
    poke: { x: a.poke.x, z: a.poke.z, rotY: a.poke.rotY, hop: a.poke.hop, anim: a.phase === 'run' || a.phase === 'back' ? 'run' : a.phase === 'catch' ? 'celebrate' : 'idle' },
    ball: { ...a.ball, visible: !a.done },
  });
  return a;
}

// ------------------------------------------------------------------ Nhảy múa (rhythm)
export const DANCE_BPM = 108;
export const DANCE_BEATS = 16;
export const DANCE_INTRO = 2; // beats before the first one to tap
// A happy pentatonic tune (Hz), one note per beat
export const DANCE_TUNE = [523, 587, 659, 784, 659, 587, 523, 440, 523, 659, 784, 880, 784, 659, 587, 523, 659, 523];

export function createDance({ bpm = DANCE_BPM, beats = DANCE_BEATS } = {}) {
  const a = base('dance');
  const beatLen = 60 / bpm;
  a.beatLen = beatLen;
  a.hits = 0;
  a.perfect = 0;
  a.combo = 0;
  a.bestCombo = 0;
  a.beat = -1;
  a.judged = new Set();
  const total = (DANCE_INTRO + beats) * beatLen;
  a.input = (evt) => {
    if (a.done || evt.type !== 'tap') return [];
    const n = Math.round(a.t / beatLen) - DANCE_INTRO;
    if (n < 0 || n >= beats || a.judged.has(n)) return [{ type: 'offbeat' }];
    const err = Math.abs(a.t - (n + DANCE_INTRO) * beatLen);
    if (err > 0.17) {
      a.combo = 0;
      return [{ type: 'offbeat' }];
    }
    a.judged.add(n);
    a.hits += 1;
    a.combo += 1;
    a.bestCombo = Math.max(a.bestCombo, a.combo);
    const perfect = err <= 0.08;
    if (perfect) a.perfect += 1;
    return [{ type: 'hit', perfect, combo: a.combo }];
  };
  a.tick = (dt) => {
    if (a.done) return [];
    a.t += dt;
    const out = [];
    const b = Math.floor(a.t / beatLen);
    while (a.beat < b) {
      a.beat += 1;
      if (a.beat < DANCE_INTRO + beats) out.push({ type: 'beat', index: a.beat, freq: DANCE_TUNE[a.beat % DANCE_TUNE.length], cue: a.beat >= DANCE_INTRO });
      // a beat that passed un-tapped only breaks the combo
      const missed = a.beat - DANCE_INTRO - 1;
      if (missed >= 0 && missed < beats && !a.judged.has(missed)) a.combo = 0;
    }
    a.progress = clamp(a.t / total, 0, 1);
    if (a.t >= total + beatLen * 0.5) out.push(...a.finish(starsFor(a.hits, Math.ceil(beats * 0.3), Math.ceil(beats * 0.6)), { hits: a.hits, bestCombo: a.bestCombo }));
    return out;
  };
  /** 0..1 pulse that peaks on every beat (for the spotlights and the hop). */
  a.pulse = () => {
    const ph = (a.t / beatLen) % 1;
    return Math.max(0, 1 - ph * 3);
  };
  a.view = () => {
    const ph = a.t / beatLen;
    return {
      party: a.done ? 0 : 1,
      beat: a.pulse(),
      poke: { anim: 'dance', hop: a.pulse(), sway: Math.sin(ph * Math.PI), rotY: Math.sin(ph * Math.PI * 0.5) * 0.6 },
    };
  };
  return a;
}

// ------------------------------------------------------------------ Trốn tìm (shell game)
export const HIDE_ROUNDS = 3;
export const BUSH_SLOTS = [-1.3, 0, 1.3];
const SWAPS = [3, 4, 5];
const SWAP_TIME = [0.62, 0.5, 0.42];

export function createHide({ random = Math.random, rounds = HIDE_ROUNDS } = {}) {
  const a = base('hide');
  a.round = 0;
  a.slotOf = [0, 1, 2]; // bush i stands at slot slotOf[i]
  a.hideIn = Math.floor(random() * 3);
  a.phase = 'show';
  a.phaseT = 0;
  a.swaps = [];
  a.swapIndex = 0;
  a.wrongs = 0;
  a.roundWrongs = 0;
  a.shake = [0, 0, 0];
  a.hint = 0;
  const planSwaps = () => {
    const n = SWAPS[Math.min(a.round, SWAPS.length - 1)];
    const list = [];
    for (let i = 0; i < n; i++) {
      const p = Math.floor(random() * 3);
      const q = (p + 1 + Math.floor(random() * 2)) % 3;
      list.push([p, q]); // slots to swap
    }
    return list;
  };
  a.input = (evt) => {
    if (a.done || a.phase !== 'guess' || evt.type !== 'pick') return [];
    const bush = evt.bush;
    if (bush === a.hideIn) {
      a.phase = 'found';
      a.phaseT = 0;
      return [{ type: 'found', bush }];
    }
    a.wrongs += 1;
    a.roundWrongs += 1;
    a.shake[bush] = 1;
    // after a wrong guess the right bush rustles a little (a gentle hint)
    a.hint = 1;
    return [{ type: 'empty', bush }];
  };
  a.tick = (dt) => {
    if (a.done) return [];
    a.t += dt;
    a.phaseT += dt;
    a.shake = a.shake.map((s) => Math.max(0, s - dt * 2.5));
    a.hint = a.phase === 'guess' && a.roundWrongs > 0 ? 0.6 + 0.4 * Math.sin(a.t * 12) : 0;
    const out = [];
    if (a.phase === 'show' && a.phaseT > 1.1) {
      a.phase = 'hide';
      a.phaseT = 0;
      out.push({ type: 'hide' });
    } else if (a.phase === 'hide' && a.phaseT > 0.6) {
      a.phase = 'shuffle';
      a.phaseT = 0;
      a.swaps = planSwaps();
      a.swapIndex = 0;
      out.push({ type: 'swap' });
    } else if (a.phase === 'shuffle') {
      const len = SWAP_TIME[Math.min(a.round, SWAP_TIME.length - 1)];
      if (a.phaseT >= len) {
        const [p, q] = a.swaps[a.swapIndex];
        a.slotOf = a.slotOf.map((s) => (s === p ? q : s === q ? p : s));
        a.swapIndex += 1;
        a.phaseT = 0;
        if (a.swapIndex >= a.swaps.length) {
          a.phase = 'guess';
          a.roundWrongs = 0;
          out.push({ type: 'guess' });
        } else out.push({ type: 'swap' });
      }
    } else if (a.phase === 'found' && a.phaseT > 1.5) {
      a.round += 1;
      if (a.round >= rounds) out.push(...a.finish(a.wrongs <= 1 ? 3 : a.wrongs <= 3 ? 2 : 1, { wrongs: a.wrongs }));
      else {
        a.phase = 'show';
        a.phaseT = 0;
        a.hideIn = Math.floor(random() * 3);
      }
    }
    a.progress = a.round / rounds;
    return out;
  };
  /** Bush i position now (x, z), with the swap arc while shuffling. */
  a.bushPos = (i) => {
    let x = BUSH_SLOTS[a.slotOf[i]];
    let z = 0.15;
    if (a.phase === 'shuffle' && a.swaps[a.swapIndex]) {
      const [p, q] = a.swaps[a.swapIndex];
      const len = SWAP_TIME[Math.min(a.round, SWAP_TIME.length - 1)];
      const k = ease(clamp(a.phaseT / len, 0, 1));
      const s = a.slotOf[i];
      if (s === p || s === q) {
        const to = s === p ? q : p;
        x = lerp(BUSH_SLOTS[s], BUSH_SLOTS[to], k);
        z = 0.15 + Math.sin(k * Math.PI) * (s === p ? 0.55 : -0.55);
      }
    }
    return { x, z };
  };
  a.view = () => {
    const bushes = [0, 1, 2].map((i) => ({ ...a.bushPos(i), shake: Math.max(a.shake[i], i === a.hideIn ? a.hint * 0.5 : 0) }));
    const home = bushes[a.hideIn];
    const hidden = a.phase === 'shuffle' || a.phase === 'guess' || (a.phase === 'hide' && a.phaseT > 0.35);
    let y = 0;
    let scale = 1;
    if (a.phase === 'show') y = 0;
    if (a.phase === 'hide') {
      const k = clamp(a.phaseT / 0.35, 0, 1);
      y = Math.sin(k * Math.PI) * 0.6;
      scale = 1 - k * 0.45;
    }
    if (a.phase === 'found') {
      const k = clamp(a.phaseT / 0.4, 0, 1);
      y = Math.sin(k * Math.PI) * 0.9 + (k >= 1 ? Math.abs(Math.sin(a.phaseT * 9)) * 0.12 : 0);
      scale = 0.55 + 0.45 * k;
    }
    return {
      bushes,
      poke: {
        x: home.x,
        z: a.phase === 'show' ? home.z + 0.75 : home.z - 0.05,
        y,
        scale,
        visible: !hidden,
        anim: a.phase === 'found' ? 'celebrate' : 'idle',
      },
    };
  };
  return a;
}

// ------------------------------------------------------------------ Tắm bong bóng (bath)
export function createBath({ assistAfter = 12 } = {}) {
  const a = base('bath');
  a.phase = 'soap';
  a.soap = 0;
  a.water = 0;
  a.phaseT = 0;
  a.input = (evt) => {
    if (a.done || evt.type !== 'rub') return [];
    const amount = clamp(Number(evt.amount) || 0, 0, 0.2);
    if (a.phase === 'soap' && evt.onPokemon) {
      a.soap = clamp(a.soap + amount * RUB_RATE * 1.3, 0, 1);
      const out = [{ type: 'bubble', count: 1 + Math.floor(amount * 20) }];
      if (a.soap >= 1) out.push(...toRinse());
      return out;
    }
    if (a.phase === 'rinse') {
      a.water = clamp(a.water + amount * RUB_RATE * 1.5, 0, 1);
      a.soap = 1 - a.water;
      const out = [{ type: 'spray' }];
      if (a.water >= 1) out.push(...toShine());
      return out;
    }
    return [];
  };
  function toRinse() {
    a.phase = 'rinse';
    a.phaseT = 0;
    a.soap = 1;
    return [{ type: 'rinse' }];
  }
  function toShine() {
    a.phase = 'shine';
    a.phaseT = 0;
    a.soap = 0;
    a.water = 1;
    return [{ type: 'shine' }];
  }
  a.tick = (dt) => {
    if (a.done) return [];
    a.t += dt;
    a.phaseT += dt;
    // little helper so a tired arm still gets there
    if (a.phase === 'soap' && a.phaseT > assistAfter) return toRinse();
    if (a.phase === 'rinse' && a.phaseT > assistAfter) return toShine();
    if (a.phase === 'shine' && a.phaseT > 1.6) return a.finish(3);
    a.progress = a.phase === 'soap' ? a.soap / 2 : a.phase === 'rinse' ? 0.5 + a.water / 2 : 1;
    return [];
  };
  a.view = () => ({ soap: a.soap, water: a.phase === 'rinse' ? 1 : 0, shine: a.phase === 'shine' ? 1 : 0, poke: { anim: a.phase === 'shine' ? 'celebrate' : 'idle', wiggle: a.phase === 'rinse' ? 0.6 : 0 } });
  return a;
}

// ------------------------------------------------------------------ Ngủ ngon (sleep)
export const LULLABY = [392, 330, 349, 294, 330, 262, 294, 330, 262, 196];
export function createSleep({ dusk = 2, sleep = 9, dawn = 2.2 } = {}) {
  const a = base('sleep');
  a.phase = 'dusk';
  a.phaseT = 0;
  a.note = 0;
  a.zzz = 0;
  a.night = 0;
  a.input = (evt) => {
    if (a.done) return [];
    if (evt.type === 'wake' && (a.phase === 'sleep' || a.phase === 'dusk')) {
      a.phase = 'dawn';
      a.phaseT = 0;
      return [{ type: 'dawn' }];
    }
    if (evt.type === 'tap' && a.phase === 'sleep') return [{ type: 'snuggle' }];
    return [];
  };
  a.tick = (dt) => {
    if (a.done) return [];
    a.t += dt;
    a.phaseT += dt;
    const out = [];
    if (a.phase === 'dusk') {
      a.night = clamp(a.phaseT / dusk, 0, 1);
      if (a.phaseT >= dusk) {
        a.phase = 'sleep';
        a.phaseT = 0;
        out.push({ type: 'asleep' });
      }
    } else if (a.phase === 'sleep') {
      a.night = 1;
      const n = Math.floor(a.phaseT / 0.85);
      while (a.note <= n && a.note < LULLABY.length) {
        out.push({ type: 'note', freq: LULLABY[a.note] });
        a.note += 1;
      }
      const z = Math.floor(a.phaseT / 1.3);
      while (a.zzz <= z) {
        out.push({ type: 'zzz' });
        a.zzz += 1;
      }
      if (a.phaseT >= sleep) {
        a.phase = 'dawn';
        a.phaseT = 0;
        out.push({ type: 'dawn' });
      }
    } else if (a.phase === 'dawn') {
      a.night = 1 - clamp(a.phaseT / dawn, 0, 1);
      if (a.phaseT >= dawn) {
        out.push({ type: 'wake' });
        out.push(...a.finish(3));
      }
    }
    a.progress = clamp(a.t / (dusk + sleep + dawn), 0, 1);
    return out;
  };
  a.view = () => ({ night: a.night, poke: { anim: a.phase === 'sleep' ? 'sleep' : a.phase === 'dawn' && a.phaseT > dawn * 0.6 ? 'celebrate' : 'idle', sleep: a.phase === 'sleep' ? 1 : a.phase === 'dusk' ? a.night : 1 - clamp(a.phaseT / (dawn * 0.6), 0, 1) } });
  return a;
}

// ------------------------------------------------------------------ Chụp ảnh (photo mode)
export const PHOTO_FRAMES = [
  { id: 'rainbow', name: 'Cầu vồng', emoji: '🌈', colors: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'] },
  { id: 'stars', name: 'Ngôi sao', emoji: '⭐', colors: ['#ffd60a', '#ffc300', '#ffffff'] },
  { id: 'hearts', name: 'Trái tim', emoji: '💖', colors: ['#ff70a6', '#ff9770', '#ffd6e0'] },
  { id: 'pokeball', name: 'Poké Ball', emoji: '🔴', colors: ['#ef4444', '#ffffff', '#1e293b'] },
];

export function createPhoto() {
  const a = base('photo');
  a.frame = PHOTO_FRAMES[0].id;
  a.yaw = 0;
  a.pitch = 0;
  a.shots = 0;
  a.input = (evt) => {
    if (a.done) return [];
    if (evt.type === 'frame' && PHOTO_FRAMES.some((f) => f.id === evt.id)) {
      a.frame = evt.id;
      return [{ type: 'frame', id: evt.id }];
    }
    if (evt.type === 'orbit') {
      a.yaw = clamp(a.yaw + (Number(evt.dx) || 0) * 3, -2.4, 2.4);
      a.pitch = clamp(a.pitch + (Number(evt.dy) || 0) * 1.5, -0.25, 0.5);
      return [];
    }
    if (evt.type === 'snap') {
      a.shots += 1;
      return [{ type: 'snap', frame: a.frame }];
    }
    return [];
  };
  a.tick = (dt) => {
    a.t += dt;
    return [];
  };
  a.view = () => ({ camera: { yaw: a.yaw, pitch: a.pitch }, poke: { anim: 'idle' } });
  return a;
}

/** File name for a photo: pokemon-<name>-<yyyymmdd-hhmmss>.png (ASCII only). */
export function photoFileName(name, date = new Date()) {
  const slug = String(name || 'pokemon')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'pokemon';
  const p = (n) => String(n).padStart(2, '0');
  return `pokemon-${slug}-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}.png`;
}

const FACTORIES = { pet: createPet, feed: createFeed, throw: createThrow, dance: createDance, hide: createHide, bath: createBath, sleep: createSleep, photo: createPhoto };

export function createActivity(id, opts = {}) {
  const f = FACTORIES[id];
  if (!f) throw new Error(`Unknown activity ${id}`);
  return f(opts);
}

// ------------------------------------------------------------------ idle life
/**
 * Procedural idle motion for the Pokémon: breathing, a soft sway, turning toward the finger
 * (look = -1..1), and decaying happy hops (hop 0..1 → height).
 */
export function idlePose(t, { look = 0, hop = 0, excited = 0 } = {}) {
  const breathe = Math.sin(t * 2.4) * 0.025;
  const sway = Math.sin(t * 1.1) * 0.05;
  const h = Math.sin(Math.min(1, hop) * Math.PI) * 0.45;
  return {
    y: h,
    sx: 1 - breathe * 0.5 + (hop > 0.85 ? 0.08 : 0),
    sy: 1 + breathe - (hop > 0.85 ? 0.1 : 0),
    rotY: clamp(look, -1, 1) * 0.55 + Math.sin(t * 0.7) * 0.08,
    rotZ: sway + excited * Math.sin(t * 14) * 0.08,
  };
}
