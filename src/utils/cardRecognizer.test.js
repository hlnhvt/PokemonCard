import { describe, it, expect, vi, beforeEach } from 'vitest';
import { speciesNames, jsonResponse } from '../test/fixtures';

const tesseract = vi.hoisted(() => ({
  createWorker: vi.fn(),
  recognizedText: '',
}));

vi.mock('tesseract.js', () => ({ createWorker: tesseract.createWorker }));

// Fake worker: reports progress through the logger captured at creation time
function installFakeWorker() {
  tesseract.createWorker.mockImplementation(async (_lang, _oem, options) => ({
    setParameters: vi.fn(async () => {}),
    recognize: vi.fn(async () => {
      options.logger({ status: 'recognizing text', progress: 0.5 });
      return { data: { text: tesseract.recognizedText } };
    }),
  }));
}

function fakeCanvasContext() {
  return {
    drawImage: vi.fn(),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)).fill(200) }),
    putImageData: vi.fn(),
  };
}

let mod;

beforeEach(async () => {
  vi.resetModules();
  tesseract.createWorker.mockReset();
  tesseract.recognizedText = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ results: speciesNames.map((name) => ({ name })) })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(fakeCanvasContext);
  mod = await import('./cardRecognizer');
});

const image = { naturalWidth: 630, naturalHeight: 880 };

describe('stringSimilarity (OC-01)', () => {
  it('scores identical, different, short and missing input', () => {
    expect(mod.stringSimilarity('Pikachu', 'PIKACHU')).toBe(1);
    expect(mod.stringSimilarity('pikachu', 'zzzzzz')).toBe(0);
    expect(mod.stringSimilarity('a', 'b')).toBe(0);
    expect(mod.stringSimilarity(null, undefined)).toBe(1);
    expect(mod.stringSimilarity('charizard', 'charizapd')).toBeGreaterThan(0.7);
  });
});

describe('rankPokemonCandidates', () => {
  const rank = (text) => mod.rankPokemonCandidates(text, speciesNames);

  it('OC-02 exact name wins with 100', () => {
    const [best] = rank('Charizard HP 330');
    expect(best).toMatchObject({ name: 'charizard', score: 100, displayName: 'Charizard' });
  });

  it.each([
    ['PIKACHO', 'pikachu'],
    ['CHARIZAPD', 'charizard'],
    ['BASIC Bulbasaur 70 HP', 'bulbasaur'],
  ])('OC-03 tolerates OCR typos: %s -> %s', (text, expected) => {
    expect(rank(text)[0].name).toBe(expected);
  });

  it('OC-04 prefers the card name over the "Evolves from" name', () => {
    expect(rank('STAGE 1 Evolves from Charmander Charmeleon HP 90')[0].name).toBe('charmeleon');
    expect(rank('Charmeleon STAGE 1 Evolves from Charmander')[0].name).toBe('charmeleon');
  });

  it('OC-05 ignores stop words and numbers', () => {
    expect(rank('BASIC TRAINER ENERGY 120 330')).toEqual([]);
    expect(rank('')).toEqual([]);
    expect(rank(null)).toEqual([]);
  });

  it('OC-06 matches hyphenated names, even split in two words', () => {
    expect(rank('HO-OH 130 HP')[0].name).toBe('ho-oh');
    expect(rank('HO OH 130 HP')[0].name).toBe('ho-oh');
    expect(rank('MR MIME')[0].name).toBe('mr-mime');
  });

  it('OC-07 returns at most 4 candidates sorted by score', () => {
    const list = rank('Charizard Charmander Blastoise Venusaur Pikachu Mewtwo');
    expect(list.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
    }
  });
});

describe('recognizeCardWithOCR', () => {
  it('OC-02b returns candidates from recognised text', async () => {
    installFakeWorker();
    tesseract.recognizedText = 'Pikachu 60 HP';
    const res = await mod.recognizeCardWithOCR(image);
    expect(res.success).toBe(true);
    expect(res.bestMatch).toBe('pikachu');
    expect(res.candidates[0].score).toBe(100);
  });

  it('OC-08 never throws when Tesseract fails', async () => {
    tesseract.createWorker.mockRejectedValue(new Error('offline'));
    const res = await mod.recognizeCardWithOCR(image);
    expect(res).toEqual({ success: false, rawText: '', bestMatch: '', confidence: 0, candidates: [] });
    // a failed init is retried next time
    installFakeWorker();
    tesseract.recognizedText = 'Mewtwo';
    expect((await mod.recognizeCardWithOCR(image)).bestMatch).toBe('mewtwo');
  });

  it('OC-08b never throws when canvas is unavailable', async () => {
    installFakeWorker();
    HTMLCanvasElement.prototype.getContext.mockReturnValue(null);
    const res = await mod.recognizeCardWithOCR(image);
    expect(res.success).toBe(false);
  });

  it('OC-09 reports progress to the current scan, not the first one', async () => {
    installFakeWorker();
    tesseract.recognizedText = 'Pikachu';
    const first = vi.fn();
    const second = vi.fn();
    await mod.recognizeCardWithOCR(image, first);
    await mod.recognizeCardWithOCR(image, second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(50);
  });

  it('OC-10 creates a single worker for concurrent scans', async () => {
    installFakeWorker();
    tesseract.recognizedText = 'Pikachu';
    await Promise.all([mod.recognizeCardWithOCR(image), mod.recognizeCardWithOCR(image)]);
    expect(tesseract.createWorker).toHaveBeenCalledTimes(1);
  });

  it('falls back to the full header when the title zone is empty', async () => {
    installFakeWorker();
    const texts = ['', 'Gengar'];
    tesseract.createWorker.mockImplementation(async () => ({
      setParameters: vi.fn(async () => {}),
      recognize: vi.fn(async () => ({ data: { text: texts.shift() } })),
    }));
    const res = await mod.recognizeCardWithOCR(image);
    expect(res.bestMatch).toBe('gengar');
  });
});
