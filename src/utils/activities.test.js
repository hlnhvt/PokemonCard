import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  catchChance,
  throwQuality,
  pokemonX,
  ringScaleAt,
  movementSpeed,
  isHit,
  planThrow,
  flightPoint,
  BALLS_PER_ROUND,
  FLIGHT_MS,
  AIM_ASSIST,
} from './catchGame';
import { POPULAR_POKEMON, buildPool, makeQuestion, starsFor, ROUNDS } from './guessGame';
import { rollShiny, SHINY_CHANCE } from './shiny';
import { THEMES, getInitialTheme, nextTheme, applyTheme, isTheme } from './theme';
import { saveCardToPokedex, recordCatch, getSavedCollection } from './storage';
import { playCry, canPlayOgg } from './cries';
import { sounds } from './soundEffects';
import { speciesNames, makeCard } from '../test/fixtures';

describe('catch game rules', () => {
  it('CG-01 every Pokemon is catchable, easier ones more often', () => {
    const hardest = catchChance({ captureRate: 3, isLegendary: true });
    const easiest = catchChance({ captureRate: 255 });
    expect(hardest).toBeGreaterThanOrEqual(0.3);
    expect(easiest).toBeLessThanOrEqual(0.95);
    expect(easiest).toBeGreaterThan(catchChance({ captureRate: 45 }));
    expect(catchChance({ captureRate: 45 })).toBeGreaterThan(hardest);
  });

  it('CG-02 a smaller ring gives a better chance and more stars', () => {
    expect(catchChance({ captureRate: 45, ringScale: 0.4 })).toBeGreaterThan(catchChance({ captureRate: 45, ringScale: 1 }));
    expect(throwQuality(0.4).stars).toBe(3);
    expect(throwQuality(0.7).stars).toBe(2);
    expect(throwQuality(1).stars).toBe(1);
  });

  it('CG-03 handles missing or out-of-range input', () => {
    expect(catchChance()).toBeGreaterThan(0.3);
    expect(catchChance({ captureRate: 9999, ringScale: -5 })).toBeLessThanOrEqual(0.95);
    expect(Number.isFinite(movementSpeed())).toBe(true);
  });

  it('CG-04 movement, ring pulse and hit test', () => {
    expect(pokemonX(0, 1.2)).toBe(0);
    for (let t = 0; t < 10; t += 0.37) {
      expect(Math.abs(pokemonX(t, 1.5))).toBeLessThanOrEqual(1);
      expect(ringScaleAt(t)).toBeGreaterThanOrEqual(0.35 - 1e-9);
      expect(ringScaleAt(t)).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(isHit(0, 0.25)).toBe(true);
    expect(isHit(-0.9, 0.5)).toBe(false);
    expect(movementSpeed({ captureRate: 3, isLegendary: true })).toBeGreaterThan(movementSpeed({ captureRate: 255 }));
    expect(BALLS_PER_ROUND).toBe(5);
  });

  // Regression: throws always missed (0% when tapping as the Pokemon passed the centre),
  // because the ball flew to the centre while the Pokemon kept moving during the flight.
  function hitRate(pokemon, shouldTap = () => true) {
    const speed = movementSpeed(pokemon);
    let taps = 0;
    let hits = 0;
    for (let t = 0; t < 300; t += 0.01) {
      const now = pokemonX(t, speed);
      if (!shouldTap(now)) continue;
      taps++;
      // The NÉM button aims at where the Pokemon is when tapped
      if (planThrow(now, pokemonX(t + FLIGHT_MS / 1000, speed)).hit) hits++;
    }
    return hits / taps;
  }

  it('CG-05 tapping NÉM at any moment hits often enough for children', () => {
    expect(hitRate({ captureRate: 190 })).toBeGreaterThanOrEqual(0.9);
    expect(hitRate({ captureRate: 45 })).toBeGreaterThanOrEqual(0.65);
    expect(hitRate({ captureRate: 3, isLegendary: true })).toBeGreaterThanOrEqual(0.4);
    // ...but it is still a game, not an automatic hit
    expect(hitRate({ captureRate: 3, isLegendary: true })).toBeLessThan(0.8);
  });

  it('CG-06 tapping when the Pokemon passes the middle is no longer a guaranteed miss', () => {
    expect(hitRate({ captureRate: 45 }, (x) => Math.abs(x) < 0.15)).toBeGreaterThan(0.3);
    // Waiting until it slows down at the sides is the winning strategy
    expect(hitRate({ captureRate: 45 }, (x) => Math.abs(x) > 0.9)).toBe(1);
  });

  it('CG-07 the ball curves part of the way and a far throw still misses', () => {
    expect(planThrow(0, 1).landX).toBeCloseTo(AIM_ASSIST, 5);
    expect(planThrow(-1, 0.4).hit).toBe(false);
    expect(planThrow(0.2, 0.3).hit).toBe(true);
    expect(planThrow(5, 0).landX).toBeLessThanOrEqual(1.3);
  });

  it('CG-08 the flight arcs upwards, shrinks and spins from start to target', () => {
    const from = { x: 0, y: 270 };
    const to = { x: 60, y: 120 };
    const start = flightPoint(0, from, to);
    const middle = flightPoint(0.5, from, to);
    const end = flightPoint(1, from, to);
    expect(start).toMatchObject({ x: 0, y: 270, scale: 1, rotate: 0 });
    expect(end.x).toBeCloseTo(60, 5);
    expect(end.y).toBeCloseTo(120, 5);
    expect(end.scale).toBeCloseTo(0.6, 5);
    expect(end.rotate).toBeCloseTo(1080, 5);
    // Higher than the straight line between start and target
    expect(middle.y).toBeLessThan(from.y + (to.y - from.y) * 0.875 - 50);
  });
});

describe('guess game rules', () => {
  it('GG-01 popular Pokemon names match their Pokedex numbers', () => {
    for (const p of POPULAR_POKEMON) {
      expect(speciesNames[Number(p.pokedexNumber) - 1]).toBe(p.name.toLowerCase());
    }
  });

  it('GG-02 pool puts owned cards first and has no duplicates', () => {
    const pool = buildPool([makeCard(), makeCard({ id: 'dup', name: 'Charizard' }), makeCard({ id: 'x', name: '', pokedexNumber: '1' })]);
    expect(pool[0]).toMatchObject({ name: 'Charizard', owned: true });
    const keys = pool.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(pool.filter((p) => p.key === 'p-6')).toHaveLength(1);
  });

  it('GG-03 questions have 4 distinct options including the target, no repeats', () => {
    const pool = buildPool([]);
    const asked = new Set();
    for (let i = 0; i < ROUNDS; i++) {
      const { target, options } = makeQuestion(pool, asked);
      expect(options).toHaveLength(4);
      expect(new Set(options.map((o) => o.name)).size).toBe(4);
      expect(options.some((o) => o.key === target.key)).toBe(true);
      expect(asked.has(target.key)).toBe(false);
      asked.add(target.key);
    }
  });

  it('GG-04 stars by score', () => {
    expect([starsFor(10), starsFor(8), starsFor(5), starsFor(0)]).toEqual([3, 3, 2, 1]);
  });
});

describe('shiny roll', () => {
  it('SH-01 follows the configured chance', () => {
    expect(rollShiny(() => SHINY_CHANCE - 0.001)).toBe(true);
    expect(rollShiny(() => SHINY_CHANCE)).toBe(false);
  });

  it('SH-02 a shiny stays unlocked after later normal scans', () => {
    saveCardToPokedex(makeCard({ isShiny: true }));
    const again = saveCardToPokedex(makeCard({ isShiny: false }));
    expect(again.shinyUnlocked).toBe(true);
    expect(saveCardToPokedex(makeCard({ id: 'mew', name: 'Mew' })).shinyUnlocked).toBe(false);
  });
});

describe('catch records', () => {
  it('ST-12 recordCatch counts catches and survives re-scans', () => {
    saveCardToPokedex(makeCard());
    expect(recordCatch('charizard').catchCount).toBe(1);
    expect(recordCatch('charizard').catchCount).toBe(2);
    expect(saveCardToPokedex(makeCard()).catchCount).toBe(2);
    expect(recordCatch('missing')).toBeNull();
    expect(getSavedCollection()[0].catchCount).toBe(2);
  });
});

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    document.head.innerHTML = '<meta name="theme-color" content="#000">';
  });

  it('TH-01 defaults to dark and restores a saved theme', () => {
    expect(getInitialTheme()).toBe('dark');
    localStorage.setItem('pokescan_theme', 'ocean');
    expect(getInitialTheme()).toBe('ocean');
    localStorage.setItem('pokescan_theme', 'rainbow');
    expect(getInitialTheme()).toBe('dark');
  });

  it('TH-02 cycles dark -> light -> ocean -> dark', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('ocean');
    expect(nextTheme('ocean')).toBe('dark');
    expect(THEMES.map((t) => t.id).every(isTheme)).toBe(true);
  });

  it('TH-03 applies the theme to <html>, meta colour and storage', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#f8fbff');
    expect(localStorage.getItem('pokescan_theme')).toBe('light');
    applyTheme('ocean');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(applyTheme('nope')).toBe('dark');
  });

  it('TH-04 still applies when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(applyTheme('ocean')).toBe('ocean');
    expect(document.documentElement.dataset.theme).toBe('ocean');
  });
});

describe('real cries', () => {
  beforeEach(() => {
    vi.spyOn(sounds, 'playPokemonCry').mockImplementation(() => {});
    if (sounds.isMuted()) sounds.toggleMute();
  });

  it('CR-01 falls back to the synthesized cry when Ogg is unsupported (jsdom, some iOS)', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
    expect(canPlayOgg()).toBe(false);
    expect(await playCry(makeCard())).toBe('synth');
    expect(sounds.playPokemonCry).toHaveBeenCalledWith('Fire');
  });

  it('CR-02 plays the real cry when supported, derived from the Pokedex number for old cards', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    expect(await playCry(makeCard())).toBe('real');
    expect(play.mock.contexts[0].src).toContain('/cries/pokemon/latest/6.ogg');
    expect(sounds.playPokemonCry).not.toHaveBeenCalled();
  });

  it('CR-03 uses the legacy cry on request and falls back when loading fails', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('404'));
    expect(await playCry(makeCard({ cryLegacyUrl: 'https://c.test/legacy.ogg' }), { legacy: true })).toBe('synth');
    expect(play.mock.contexts[0].src).toBe('https://c.test/legacy.ogg');
  });

  it('CR-04 stays silent when muted', async () => {
    sounds.toggleMute();
    expect(await playCry(makeCard())).toBe('muted');
    expect(sounds.playPokemonCry).not.toHaveBeenCalled();
    sounds.toggleMute();
  });
});
