import { describe, it, expect } from 'vitest';
import { normalizeType, themeFor, realModelFor, DIORAMAS, AURAS, GAME_TYPES } from './themes';
import { buildStandee, buildMask, distanceField, dropSmallIslands, inflateProfile, makeImageData, opaqueBounds } from './standeeMesh';
import { revealPose, revealEvents, REVEAL, QUICK_START } from './reveal';
import {
  ACTIVITIES, createActivity, createPet, createFeed, createThrow, createDance, createHide, createBath, createSleep, createPhoto,
  throwTarget, photoFileName, idlePose, mulberry, ISLAND_RADIUS, DANCE_INTRO, DANCE_BEATS, PET_REWARD,
} from './activities';

const run = (a, seconds, dt = 1 / 30) => {
  const events = [];
  for (let t = 0; t < seconds && !a.done; t += dt) events.push(...a.tick(dt));
  return events;
};
const types = (events) => events.map((e) => e.type);

describe('themes', () => {
  it('PG-TH-01 TCG energy names map to game types; unknown → normal', () => {
    expect(normalizeType('Lightning')).toBe('electric');
    expect(normalizeType('Darkness')).toBe('dark');
    expect(normalizeType('Metal')).toBe('steel');
    expect(normalizeType('Colorless')).toBe('normal');
    expect(normalizeType('FIRE')).toBe('fire');
    expect(normalizeType('???')).toBe('normal');
  });
  it('PG-TH-02 every type has an aura and a diorama', () => {
    for (const t of GAME_TYPES) {
      const th = themeFor({ types: [t] });
      expect(AURAS[th.type]).toBeTruthy();
      expect(DIORAMAS[th.dioramaId]).toBe(th.diorama);
      expect(th.diorama.sky).toHaveLength(2);
    }
    expect(themeFor({ types: ['Fire', 'Flying'] }).dioramaId).toBe('volcano');
    expect(themeFor({ types: ['Water'] }).dioramaId).toBe('beach');
    expect(themeFor({ types: ['Ghost'] }).aura.kind).toBe('wisps');
    expect(themeFor({}).type).toBe('normal');
  });
  it('PG-TH-03 real models by Pokédex number or name; others use the standee', () => {
    expect(realModelFor({ pokedexNumber: '025' })).toEqual({ kind: 'racer', species: 'pikachu' });
    expect(realModelFor({ pokedexNumber: 6 }).kind).toBe('charizard');
    expect(realModelFor({ pokedexNumber: 143 }).kind).toBe('snorlax');
    expect(realModelFor({ name: 'Eevee V' }).species).toBe('eevee');
    expect(realModelFor({ pokedexNumber: 131, name: 'Lapras' })).toBeNull();
  });
});

describe('standee mesh', () => {
  const ellipse = (w = 100, h = 120) => makeImageData(w, h, (x, y) => ((x - w / 2) / (w * 0.4)) ** 2 + ((y - h / 2) / (h * 0.45)) ** 2 <= 1);

  it('PG-SM-01 empty image → null; bounds of the opaque pixels', () => {
    expect(buildStandee(makeImageData(20, 20, () => false))).toBeNull();
    expect(opaqueBounds(makeImageData(20, 20, (x, y) => x >= 5 && x < 9 && y >= 2 && y < 4))).toEqual({ x0: 5, y0: 2, x1: 9, y1: 4 });
  });

  it('PG-SM-02 mesh is 1 tall, feet on y = 0, centred, three material groups', () => {
    const m = buildStandee(ellipse(), { grid: 32 });
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < m.positions.length; i += 3) {
      minX = Math.min(minX, m.positions[i]);
      maxX = Math.max(maxX, m.positions[i]);
      minY = Math.min(minY, m.positions[i + 1]);
      maxY = Math.max(maxY, m.positions[i + 1]);
    }
    expect(minY).toBeGreaterThanOrEqual(0);
    expect(minY).toBeLessThan(0.05);
    expect(maxY).toBeGreaterThan(0.93);
    expect(maxY).toBeLessThanOrEqual(1.0001);
    expect(Math.abs(minX + maxX)).toBeLessThan(0.06);
    expect(m.groups.map((g) => g.materialIndex)).toEqual([0, 1, 2]);
    expect(m.groups.reduce((s, g) => s + g.count, 0)).toBe(m.indices.length);
    expect(m.indices.length % 3).toBe(0);
    expect(Math.max(...m.indices)).toBeLessThan(m.vertexCount);
    expect(m.uvs.length / 2).toBe(m.vertexCount);
    expect(m.edgeColor).toEqual([240, 120, 60]);
    expect(m.width).toBeGreaterThan(0.6);
    expect(m.width).toBeLessThan(0.8);
  });

  it('PG-SM-03 front faces +Z, back faces -Z, side walls face outward', () => {
    const m = buildStandee(ellipse(), { grid: 24 });
    const P = (i) => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]];
    const normal = (t) => {
      const [a, b, c] = [P(m.indices[t]), P(m.indices[t + 1]), P(m.indices[t + 2])];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      return { n: [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], at: a };
    };
    const [front, back, side] = m.groups;
    // a smoothed rim may leave a sliver triangle or two; nearly all must face the right way
    let bad = 0;
    for (let t = front.start; t < front.start + front.count; t += 3) if (normal(t).n[2] < -1e-9) bad++;
    for (let t = back.start; t < back.start + back.count; t += 3) if (normal(t).n[2] > 1e-9) bad++;
    expect(bad / ((front.count + back.count) / 3)).toBeLessThan(0.01);
    let outward = 0;
    let total = 0;
    for (let t = side.start; t < side.start + side.count; t += 3) {
      const { n, at } = normal(t);
      total++;
      if (n[0] * at[0] + n[1] * (at[1] - 0.5) > 0) outward++;
    }
    expect(outward / total).toBeGreaterThan(0.95);
  });

  it('PG-SM-04 inflated: the middle bulges more than the rim (puffy look)', () => {
    const m = buildStandee(ellipse(), { grid: 32, thickness: 0.03, inflate: 0.1 });
    let maxZ = 0;
    let centreZ = 0;
    let best = Infinity;
    for (let i = 0; i < m.groups[1].start; i++) {
      // front vertices come first
    }
    const nFront = m.vertexCount; // scan all, pick front (z > 0)
    for (let i = 0; i < nFront; i++) {
      const x = m.positions[i * 3];
      const y = m.positions[i * 3 + 1];
      const z = m.positions[i * 3 + 2];
      if (z <= 0) continue;
      maxZ = Math.max(maxZ, z);
      const d = Math.hypot(x, y - 0.5);
      if (d < best) {
        best = d;
        centreZ = z;
      }
    }
    expect(centreZ).toBeGreaterThan(0.12);
    expect(maxZ).toBeLessThanOrEqual(0.1301);
    expect(inflateProfile(0, 5)).toBe(0);
    expect(inflateProfile(5, 5)).toBe(1);
    expect(inflateProfile(2.5, 5)).toBeGreaterThan(0.8);
  });

  it('PG-SM-05 specks are dropped, holes are kept; distance field grows inwards', () => {
    const img = makeImageData(80, 80, (x, y) => (Math.hypot(x - 40, y - 40) < 30 && Math.hypot(x - 40, y - 40) > 8) || (x === 2 && y === 2));
    const mask = buildMask(img, { grid: 40 });
    expect(mask.inside.reduce((s, v) => s + v, 0)).toBeGreaterThan(300);
    // centre hole stays empty
    const cc = Math.floor((40 - mask.ox) / mask.cell);
    const cr = Math.floor((40 - mask.oy) / mask.cell);
    expect(mask.inside[cr * mask.cols + cc]).toBe(0);
    const ins = new Uint8Array([0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1]);
    dropSmallIslands(ins, 5, 5, 0.01);
    expect(ins[24]).toBe(0);
    const d = distanceField(ins, 5, 5);
    expect(d[12]).toBe(2);
    expect(d[6]).toBe(1);
    expect(d[0]).toBe(0);
  });

  it('PG-SM-06 head anchor at the top centre; footprint narrower than a wide head', () => {
    // a "T" shape: wide top bar, narrow leg
    const img = makeImageData(60, 60, (x, y) => (y < 20 && x > 5 && x < 55) || (y >= 20 && y < 58 && x > 25 && x < 35));
    const m = buildStandee(img, { grid: 30, smooth: 0 });
    expect(m.headTop[1]).toBe(1);
    expect(Math.abs(m.headTop[0])).toBeLessThan(0.05);
    expect(m.footprint).toBeLessThan(m.width * 0.4);
  });
});

describe('reveal', () => {
  it('PG-RV-01 drop, 3 wobbles, burst, land, cry, done in order', () => {
    const ev = revealEvents(-0.01, REVEAL.end + 0.1);
    expect(types(ev)).toEqual(['impact', 'impact', 'impact', 'wobble', 'wobble', 'wobble', 'burst', 'land', 'cry', 'done']);
    expect(ev.filter((e) => e.type === 'wobble').map((e) => e.index)).toEqual([0, 1, 2]);
  });
  it('PG-RV-02 poses: ball falls, opens at the burst, Pokémon white then coloured', () => {
    const p0 = revealPose(0);
    expect(p0.ball.y).toBeGreaterThan(3);
    expect(p0.poke.scale).toBe(0);
    expect(revealPose(1.2).ball.y).toBe(0);
    expect(Math.abs(revealPose(REVEAL.wobbleStart + 0.1).ball.tilt)).toBeGreaterThan(0.2);
    const burst = revealPose(REVEAL.burst + 0.1);
    expect(burst.ball.open).toBeGreaterThan(0.3);
    expect(burst.flash).toBeGreaterThan(0.5);
    expect(burst.rays).toBeGreaterThan(0.3);
    const mid = revealPose(REVEAL.burst + 0.5);
    expect(mid.poke.white).toBe(1);
    expect(mid.poke.scale).toBeGreaterThan(0.3);
    const end = revealPose(REVEAL.end);
    expect(end.poke.white).toBe(0);
    expect(end.poke.scale).toBeCloseTo(1, 2);
    expect(end.poke.y).toBe(0);
    expect(end.done).toBe(true);
    expect(revealPose(REVEAL.land + 0.15).poke.squash).toBeGreaterThan(0.3);
    expect(QUICK_START).toBeLessThan(REVEAL.burst);
  });
});

describe('activities', () => {
  it('PG-AC-01 eight activities, each creatable; pet-reward set', () => {
    expect(ACTIVITIES.map((a) => a.id)).toEqual(['pet', 'feed', 'throw', 'dance', 'hide', 'bath', 'sleep', 'photo']);
    for (const a of ACTIVITIES) expect(createActivity(a.id).id).toBe(a.id);
    expect(() => createActivity('nope')).toThrow();
    expect(PET_REWARD.has('feed')).toBe(false);
    expect(PET_REWARD.has('photo')).toBe(false);
  });

  it('PG-AC-02 pet: rubbing on the Pokémon gives rising hearts and finishes with 3 stars', () => {
    const a = createPet();
    expect(a.input({ type: 'rub', amount: 0.2, onPokemon: false })).toEqual([]);
    const ev = [];
    for (let i = 0; i < 80 && !a.done; i++) ev.push(...a.input({ type: 'rub', amount: 0.1, onPokemon: true }));
    const hearts = ev.filter((e) => e.type === 'heart');
    expect(hearts.length).toBeGreaterThanOrEqual(7);
    expect(hearts[1].pitch).toBeGreaterThan(hearts[0].pitch);
    expect(a.done).toBe(true);
    expect(a.result).toMatchObject({ stars: 3, reward: 'pet' });
  });
  it('PG-AC-03 pet: time out still gives a star (no fail)', () => {
    const a = createPet({ limit: 2 });
    run(a, 3);
    expect(a.result.stars).toBe(1);
  });

  it('PG-AC-04 feed: drop off target misses, on target asks storage; fed → munch ×3, ate, finish', () => {
    const a = createFeed();
    expect(types(a.input({ type: 'drop', berry: 'oran', onPokemon: false }))).toEqual(['miss']);
    expect(a.input({ type: 'drop', berry: 'oran', onPokemon: true })).toEqual([{ type: 'feedRequest', berry: 'oran' }]);
    expect(a.input({ type: 'drop', berry: 'razz', onPokemon: true })).toEqual([]); // waiting
    expect(types(a.resolve({ result: 'fed', favorite: true, gain: 20 }))).toEqual(['eatStart']);
    const ev = run(a, 3);
    expect(types(ev).filter((t) => t === 'munch')).toHaveLength(3);
    expect(ev.find((e) => e.type === 'ate')).toMatchObject({ favorite: true, gain: 20 });
    expect(a.result).toMatchObject({ stars: 3, reward: null, favorite: true });
  });
  it('PG-AC-05 feed: full/noBerry outcome → refuse, back to picking', () => {
    const a = createFeed();
    a.input({ type: 'drop', berry: 'razz', onPokemon: true });
    expect(a.resolve({ result: 'full' })).toEqual([{ type: 'refuse', result: 'full' }]);
    expect(a.phase).toBe('pick');
    expect(a.done).toBe(false);
  });

  it('PG-AC-06 throw target stays on the island and away from the feet', () => {
    for (const [dx, dy] of [[0, -1], [1, -1], [-1, -0.2], [0, 0], [0.05, -0.3]]) {
      const t = throwTarget(dx, dy);
      expect(Math.hypot(t.x, t.z)).toBeLessThanOrEqual(ISLAND_RADIUS);
      expect(Math.hypot(t.x, t.z)).toBeGreaterThanOrEqual(0.6);
    }
    expect(throwTarget(0.5, -0.5).x).toBeGreaterThan(0);
  });
  it('PG-AC-07 throw: 3 rounds of fly → run → catch → bring back, then 3 stars', () => {
    const a = createThrow();
    const ev = [];
    for (let r = 0; r < 3; r++) {
      expect(a.phase).toBe('aim');
      ev.push(...a.input({ type: 'swipe', dx: r * 0.3 - 0.3, dy: -0.6 }));
      expect(a.input({ type: 'swipe', dx: 0, dy: -0.6 })).toEqual([]); // ignored mid-flight
      ev.push(...run(a, 6));
      if (!a.done) {
        let guard = 0;
        while (a.phase !== 'aim' && !a.done && guard++ < 400) ev.push(...a.tick(1 / 30));
      }
    }
    expect(types(ev).filter((t) => t === 'throw')).toHaveLength(3);
    expect(types(ev).filter((t) => t === 'catch')).toHaveLength(3);
    expect(types(ev).filter((t) => t === 'bring')).toHaveLength(3);
    expect(a.result).toMatchObject({ stars: 3, reward: 'pet', catches: 3 });
  });
  it('PG-AC-08 throw: the Pokémon turns to run (shows its back) and the ball rides on its head', () => {
    const a = createThrow();
    a.input({ type: 'swipe', dx: 0, dy: -1 });
    let sawRun = false;
    let sawCarry = false;
    for (let i = 0; i < 200 && !a.done; i++) {
      a.tick(1 / 30);
      const v = a.view();
      if (v.poke.anim === 'run' && a.phase === 'run') {
        sawRun = true;
        expect(Math.abs(v.poke.rotY)).toBeGreaterThan(2); // facing away (-Z)
      }
      if (a.phase === 'back') {
        sawCarry = true;
        expect(v.ball.y).toBeGreaterThan(1);
        expect(v.ball.x).toBeCloseTo(v.poke.x, 5);
      }
    }
    expect(sawRun && sawCarry).toBe(true);
  });

  it('PG-AC-09 dance: taps on the beat score, off-beat taps only reset the combo', () => {
    const a = createDance();
    const L = a.beatLen;
    const ev = [];
    // tap the first 10 cued beats exactly
    for (let n = 0; n < DANCE_BEATS; n++) {
      const target = (n + DANCE_INTRO) * L;
      while (a.t < target - 1e-9) ev.push(...a.tick(Math.min(1 / 60, target - a.t)));
      if (n < 10) ev.push(...a.input({ type: 'tap' }));
    }
    ev.push(...run(a, 3));
    expect(types(ev).filter((t) => t === 'hit')).toHaveLength(10);
    expect(ev.find((e) => e.type === 'hit' && e.combo === 10)).toBeTruthy();
    expect(types(ev).filter((t) => t === 'beat').length).toBe(DANCE_INTRO + DANCE_BEATS);
    expect(a.result).toMatchObject({ stars: 3, hits: 10, bestCombo: 10, reward: 'pet' });
    const b = createDance();
    b.tick(L * (DANCE_INTRO + 0.5));
    expect(types(b.input({ type: 'tap' }))).toEqual(['offbeat']);
    run(b, 20);
    expect(b.result.stars).toBe(1); // no taps → still a star
  });

  it('PG-AC-10 hide: show → hide → shuffle → guess; wrong bush is gentle, right bush found', () => {
    const a = createHide({ random: mulberry(7) });
    let ev = [];
    let guard = 0;
    while (a.phase !== 'guess' && guard++ < 1000) ev.push(...a.tick(1 / 30));
    expect(types(ev)).toContain('hide');
    expect(types(ev).filter((t) => t === 'swap').length).toBe(3);
    expect(a.view().poke.visible).toBe(false);
    const wrong = [0, 1, 2].find((b) => b !== a.hideIn);
    expect(a.input({ type: 'pick', bush: wrong })).toEqual([{ type: 'empty', bush: wrong }]);
    a.tick(0.05);
    expect(a.view().bushes[a.hideIn].shake).toBeGreaterThan(0); // hint
    expect(a.input({ type: 'pick', bush: a.hideIn })).toEqual([{ type: 'found', bush: a.hideIn }]);
    // rounds 2 and 3
    for (let r = 0; r < 2; r++) {
      guard = 0;
      while (a.phase !== 'guess' && guard++ < 1000) a.tick(1 / 30);
      a.input({ type: 'pick', bush: a.hideIn });
    }
    run(a, 3);
    expect(a.result).toMatchObject({ stars: 3, wrongs: 1, reward: 'pet' });
  });
  it('PG-AC-11 hide: bushes stay a permutation of the slots and the Pokémon follows its bush', () => {
    const a = createHide({ random: mulberry(3) });
    for (let i = 0; i < 300; i++) {
      a.tick(1 / 30);
      expect([...a.slotOf].sort()).toEqual([0, 1, 2]);
      const v = a.view();
      expect(v.poke.x).toBeCloseTo(v.bushes[a.hideIn].x, 5);
    }
  });

  it('PG-AC-12 bath: soap by rubbing → rinse → shine → 3 stars; the helper finishes for tired arms', () => {
    const a = createBath();
    const ev = [];
    for (let i = 0; i < 80 && a.phase === 'soap'; i++) ev.push(...a.input({ type: 'rub', amount: 0.1, onPokemon: true }));
    expect(types(ev)).toContain('bubble');
    expect(a.phase).toBe('rinse');
    for (let i = 0; i < 80 && a.phase === 'rinse'; i++) ev.push(...a.input({ type: 'rub', amount: 0.1, onPokemon: false }));
    expect(a.phase).toBe('shine');
    ev.push(...run(a, 3));
    expect(a.result).toMatchObject({ stars: 3, reward: 'pet' });
    const lazy = createBath({ assistAfter: 1 });
    run(lazy, 6);
    expect(lazy.done).toBe(true);
  });

  it('PG-AC-13 sleep: night falls, lullaby notes and Zzz, dawn, wake; waking early is fine', () => {
    const a = createSleep();
    const ev = run(a, 20);
    expect(types(ev)).toContain('asleep');
    expect(types(ev).filter((t) => t === 'note').length).toBeGreaterThanOrEqual(8);
    expect(types(ev)).toContain('zzz');
    expect(types(ev).slice(-2)).toEqual(['wake', 'finish']);
    expect(a.night).toBe(0);
    const b = createSleep();
    run(b, 2.5);
    expect(b.view().night).toBe(1);
    expect(b.view().poke.anim).toBe('sleep');
    expect(types(b.input({ type: 'wake' }))).toEqual(['dawn']);
    run(b, 4);
    expect(b.done).toBe(true);
  });

  it('PG-AC-14 photo: frames, orbit is clamped, snap events; ASCII file name', () => {
    const a = createPhoto();
    expect(a.input({ type: 'frame', id: 'hearts' })).toEqual([{ type: 'frame', id: 'hearts' }]);
    expect(a.input({ type: 'frame', id: 'bogus' })).toEqual([]);
    a.input({ type: 'orbit', dx: 5, dy: 5 });
    expect(a.view().camera).toEqual({ yaw: 2.4, pitch: 0.5 });
    expect(a.input({ type: 'snap' })).toEqual([{ type: 'snap', frame: 'hearts' }]);
    expect(photoFileName('Mr. Mime Đỏ', new Date(2026, 0, 2, 3, 4, 5))).toBe('pokemon-mr-mime-do-20260102-030405.png');
    expect(photoFileName('')).toMatch(/^pokemon-pokemon-\d{8}-\d{6}\.png$/);
  });

  it('PG-AC-15 idle pose: breathes, looks toward the finger, hops', () => {
    expect(idlePose(0, { look: 1 }).rotY).toBeGreaterThan(0.5);
    expect(idlePose(0, { look: -1 }).rotY).toBeLessThan(-0.5);
    expect(idlePose(1, { hop: 0.5 }).y).toBeCloseTo(0.45, 5);
    expect(idlePose(1).y).toBe(0);
  });
});
