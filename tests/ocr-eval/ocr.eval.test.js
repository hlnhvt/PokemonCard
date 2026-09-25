// Real OCR accuracy benchmark (Tesseract + canvas in Node).
// Run: npm run eval:ocr   (after `node tests/ocr-eval/build-dataset.mjs`)
// Env: OCR_LABEL=name for the result file, OCR_LIMIT=n cards, OCR_VARIANTS=scan,photo,camera
import { describe, it, vi, expect } from 'vitest';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import speciesNames from '../../src/test/fixtures/speciesNames.json';
import { makeVariants, mulberry32 } from './variants.js';

// Tesseract in Node cannot read canvas objects: hand it PNG buffers instead
vi.mock('tesseract.js', async (importOriginal) => {
  const real = await importOriginal();
  const toInput = (img) => (img && typeof img.toBuffer === 'function' ? img.toBuffer('image/png') : img);
  // Our fake `document` makes tesseract.js pick its browser code path; hide it during calls
  const withoutDocument = async (fn) => {
    const doc = globalThis.document;
    delete globalThis.document;
    try {
      return await fn();
    } finally {
      globalThis.document = doc;
    }
  };
  return {
    ...real,
    createWorker: async (...args) => {
      const worker = await withoutDocument(() => real.createWorker(...args));
      return new Proxy(worker, {
        get(target, prop) {
          if (prop === 'recognize') {
            return (img, ...rest) => withoutDocument(() => target.recognize(toInput(img), ...rest));
          }
          const value = target[prop];
          return typeof value === 'function' ? (...a) => withoutDocument(() => value.apply(target, a)) : value;
        },
      });
    },
  };
});

// Offline and deterministic: serve the species list from the fixture
globalThis.fetch = async () => ({ ok: true, json: async () => ({ results: speciesNames.map((name) => ({ name })) }) });

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

describe('OCR benchmark', () => {
  it('measures top-1 / top-4 accuracy', async () => {
    // Load tesseract.js first: it detects browser vs Node when the module is evaluated
    await import('tesseract.js');
    // The recognizer creates canvases through the DOM API
    globalThis.document = { createElement: () => createCanvas(1, 1) };
    // OCR_IMPL=baseline runs the pre-rewrite recognizer saved in .cache for comparison
    const { recognizeCardWithOCR } = process.env.OCR_IMPL === 'baseline'
      ? await import('./.cache/cardRecognizer.baseline.js')
      : await import('../../src/utils/cardRecognizer.js');
    const manifest = JSON.parse(await readFile(path.join(here, process.env.OCR_MANIFEST || 'manifest.json'), 'utf8'));
    const limit = Number(process.env.OCR_LIMIT) || manifest.length;
    const wanted = (process.env.OCR_VARIANTS || 'scan,photo,camera').split(',');
    const label = process.env.OCR_LABEL || 'current';
    console.log = () => {};
    console.error = (...a) => process.stdout.write('[error] ' + a.map((x) => (x && x.stack) || x).join(' ') + '\n');

    const rows = [];
    const cards = manifest.slice(0, limit);
    for (const [index, card] of cards.entries()) {
      const image = await loadImage(await readFile(path.join(here, '.cache', card.file)));
      const seed = Math.floor(mulberry32(index + 1)() * 1e9);
      for (const { variant, canvas, options } of makeVariants(image, seed)) {
        if (!wanted.includes(variant)) continue;
        // The camera screen crops the frame to the on-screen reticle before OCR
        // (OCR_NO_RETICLE=1 measures the old full-frame behaviour)
        let input = canvas;
        if (options.region && !process.env.OCR_NO_RETICLE) {
          const r = options.region;
          input = createCanvas(Math.round(r.width), Math.round(r.height));
          input.getContext('2d').drawImage(canvas, r.x, r.y, r.width, r.height, 0, 0, input.width, input.height);
        }
        const start = performance.now();
        const res = await recognizeCardWithOCR(input, null);
        const ms = Math.round(performance.now() - start);
        const names = res.candidates.map((c) => c.name);
        rows.push({
          id: card.id, set: card.set, cardName: card.cardName, expected: card.expected, variant, ms,
          top1: names[0] === card.expected,
          top4: names.includes(card.expected),
          got: names.slice(0, 4),
          raw: (res.rawText || '').replace(/\s+/g, ' ').slice(0, 120),
        });
      }
    }

    const summary = {};
    for (const v of wanted) {
      const r = rows.filter((x) => x.variant === v);
      if (!r.length) continue;
      summary[v] = {
        n: r.length,
        top1: `${Math.round((100 * r.filter((x) => x.top1).length) / r.length)}%`,
        top4: `${Math.round((100 * r.filter((x) => x.top4).length) / r.length)}%`,
        avgMs: Math.round(r.reduce((a, x) => a + x.ms, 0) / r.length),
      };
    }

    await mkdir(path.join(here, 'results'), { recursive: true });
    await writeFile(path.join(here, 'results', `${label}.json`), JSON.stringify({ summary, rows }, null, 2));
    process.stdout.write(`\n=== OCR benchmark [${label}] ===\n${JSON.stringify(summary, null, 2)}\n`);
    for (const r of rows.filter((x) => !x.top1)) {
      process.stdout.write(`MISS ${r.variant.padEnd(6)} ${r.id.padEnd(12)} want=${r.expected.padEnd(12)} got=${r.got.join(',') || '-'} | ${r.raw}\n`);
    }
    expect(rows.length).toBeGreaterThan(0);
  }, 3_600_000);
});
