// Downloads real English Pokemon TCG card scans used to measure OCR accuracy.
// Usage: node tests/ocr-eval/build-dataset.mjs   (needs internet once; images are cached)
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(here, '.cache');
const speciesNames = JSON.parse(await readFile(path.join(here, '../../src/test/fixtures/speciesNames.json'), 'utf8'));

// One set per era, from Base Set (1999) to Scarlet & Violet (2023+)
const DEFAULT_SETS = ['base1', 'neo1', 'ex3', 'dp1', 'bw1', 'xy1', 'sm1', 'swsh1', 'swsh4', 'sv1', 'sv3pt5', 'sv4'];
// Held-out sets never used while tuning: OCR_SETS=holdout node tests/ocr-eval/build-dataset.mjs
const HOLDOUT_SETS = ['base2', 'gym1', 'ex8', 'pl1', 'bw5', 'xy7', 'sm7', 'swsh9', 'swsh12', 'sv2', 'sv5', 'sv6'];
// Any other comma-separated list builds a custom set: OCR_SETS=base3,neo4 OCR_OUT=manifest.x.json
const holdout = process.env.OCR_SETS === 'holdout';
const custom = process.env.OCR_SETS && !holdout ? process.env.OCR_SETS.split(',') : null;
const SETS = custom || (holdout ? HOLDOUT_SETS : DEFAULT_SETS);
const CARDS_PER_SET = 5;

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function download(url, file) {
  if (await exists(file)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

await mkdir(cacheDir, { recursive: true });
const manifest = [];

for (const set of SETS) {
  const res = await fetch(`https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/${set}.json`);
  if (!res.ok) throw new Error(`Set ${set}: ${res.status}`);
  const cards = (await res.json()).filter(
    (c) => c.supertype === 'Pokémon' && c.nationalPokedexNumbers?.length && c.images?.large
  );
  // Evenly spaced picks give a mix of basics, evolutions and rule-box (ex/V/GX) cards
  const step = Math.max(1, Math.floor(cards.length / CARDS_PER_SET));
  for (let i = 0; i < CARDS_PER_SET && i * step < cards.length; i++) {
    const card = cards[i * step];
    const file = `${card.id}.png`;
    await download(card.images.large, path.join(cacheDir, file));
    manifest.push({
      id: card.id,
      set,
      file,
      cardName: card.name,
      expected: speciesNames[card.nationalPokedexNumbers[0] - 1],
    });
    process.stdout.write(`${card.id} ${card.name}\n`);
  }
}

const outFile = process.env.OCR_OUT || (holdout ? 'manifest.holdout.json' : 'manifest.json');
await writeFile(path.join(here, outFile), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${manifest.length} cards written to ${outFile}`);
