import { createWorker } from 'tesseract.js';
import { getAllPokemonNames } from '../services/pokemonOnlineService';
import { extractCard, cropCardZone, cropCanvas, preprocess, getSourceSize } from './cardImage';

let workerPromise = null;
// The logger is bound once when the worker is created, so it forwards to whichever
// scan is currently running instead of the callback of the very first scan.
let activeProgressCallback = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (activeProgressCallback && m.status === 'recognizing text') {
            activeProgressCallback(Math.round(m.progress * 100));
          }
        },
      });

      try {
        await worker.setParameters({
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzé0123456789 -'.",
          preserve_interword_spaces: '1',
        });
      } catch (e) {
        console.warn('Could not set custom tesseract parameters:', e);
      }
      return worker;
    })();
    // Let a failed initialisation (e.g. offline language download) be retried next time
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

/**
 * String similarity using Dice's Coefficient (Bigram Matching)
 */
export function stringSimilarity(str1, str2) {
  const s1 = (str1 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = (str2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1.0 : 0.0;

  const bigrams1 = new Map();
  for (let i = 0; i < s1.length - 1; i++) {
    const bg = s1.slice(i, i + 2);
    bigrams1.set(bg, (bigrams1.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bg = s2.slice(i, i + 2);
    const count = bigrams1.get(bg) || 0;
    if (count > 0) {
      bigrams1.set(bg, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / (s1.length + s2.length - 2);
}

function levenshtein(a, b) {
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag : Math.min(diag, prev[j - 1], prev[j]) + 1;
      diag = tmp;
    }
  }
  return prev[b.length];
}

// Common TCG card words that are NOT Pokemon names (also regional/variant prefixes)
const STOP_WORDS = new Set([
  'STAGE', 'BASIC', 'VMAX', 'VSTAR', 'LEVEL', 'TRAINER', 'ENERGY',
  'ITEM', 'SUPPORTER', 'POKEMON', 'CARD', 'ATTACK', 'WEAKNESS',
  'RESISTANCE', 'RETREAT', 'RULE', 'GAME', 'FREAK', 'NINTENDO',
  'EVOLVES', 'FROM', 'PUT', 'ONTO', 'ALOLAN', 'GALARIAN', 'HISUIAN', 'PALDEAN',
  'RADIANT', 'SHINING', 'TERA', 'BREAK', 'PRISM', 'STAR', 'LEGEND', 'MEGA',
]);

// Stage 1/2 cards print "Evolves from <previous Pokemon>" next to the real name.
// That Pokemon is by definition not the card's own name, so its weight keeps it
// below the candidate threshold unless nothing else is readable at all.
const EVOLVES_FROM_WEIGHT = 0.4;

// Letters Tesseract commonly reads as digits in card titles
const DIGIT_TO_LETTER = { 0: 'O', 1: 'I', 2: 'Z', 4: 'A', 5: 'S', 6: 'G', 8: 'B' };

function alnum(text) {
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function fixDigits(token) {
  const letters = token.replace(/[^A-Z]/g, '').length;
  if (letters < token.length * 0.6) return token;
  return token.replace(/[0-9]/g, (d) => DIGIT_TO_LETTER[d] || d);
}

/** How well one OCR token matches one Pokemon name, 0..100. */
function matchScore(token, upperName) {
  if (token === upperName) return 100;
  if (token.length < 4 || upperName.length < 3) return 0;

  let score = 0;
  // A long name glued to a suffix ("PIKACHUV", "CHARIZARDVMAX")
  if (upperName.length >= 5 && token.startsWith(upperName)) {
    score = 92;
  } else if (upperName.length >= 5 && upperName.includes(token)) {
    // Partial read of a long name ("NINETALE" in "NINETALES")
    score = Math.round((token.length / upperName.length) * 88);
  }

  // Short names are easy to hit by chance in background noise ("NEEL" vs SEEL):
  // for them a fuzzy match must at least start with the same letter
  if (upperName.length <= 5 && token[0] !== upperName[0]) return score;

  const maxLen = Math.max(token.length, upperName.length);
  if (Math.abs(token.length - upperName.length) <= 3) {
    const lev = 1 - levenshtein(token, upperName) / maxLen;
    if (lev >= 0.6) score = Math.max(score, Math.round(lev * 95));
  }

  const sim = stringSimilarity(token, upperName);
  if (sim >= 0.55) score = Math.max(score, Math.round(sim * 92));
  return score;
}

/**
 * Turn OCR words into candidate tokens: single words plus adjacent pairs from the
 * same line (for "MR MIME", "IRON VALIANT", "HO OH"), each weighted by text height
 * (the name is the largest text in the title strip) and recognition confidence.
 */
function buildTokens(words) {
  const usable = words.filter((w) => w.text);
  // Reference height: tallest alphabetic word, ignoring a lone outlier (merged glyph blobs)
  const heights = usable
    .filter((w) => alnum(w.text).replace(/[0-9]/g, '').length >= 3)
    .map((w) => w.height)
    .sort((a, b) => b - a);
  const maxHeight = heights.length === 0 ? 1 : heights.length > 1 && heights[0] > heights[1] * 1.5 ? heights[1] : heights[0];

  const isUsablePart = (t) => t && !/^\d+$/.test(t) && !STOP_WORDS.has(t);
  const tokens = [];
  for (let i = 0; i < usable.length; i++) {
    const word = usable[i];
    const text = alnum(word.text);
    const afterFrom = i > 0 && alnum(usable[i - 1].text) === 'FROM';
    const heightWeight = Math.max(0.3, Math.min(1, word.height / maxHeight));
    // Tesseract often reports confidence 0 for correctly read stylised titles,
    // so confidence only nudges the score
    const weight =
      (0.55 + 0.45 * heightWeight) *
      (0.8 + 0.2 * Math.max(0, Math.min(100, word.conf)) / 100) *
      (afterFrom ? EVOLVES_FROM_WEIGHT : 1);

    if (text.length >= 3 && isUsablePart(text)) {
      tokens.push({ variants: tokenVariants(text), weight });
    }

    // Names split into pieces on one line ("MR MIME", "IRON VALIANT", "M AWI LE")
    let joined = text;
    for (let j = i + 1; j <= i + 2 && j < usable.length && usable[j].line === word.line; j++) {
      const part = alnum(usable[j].text);
      if (!isUsablePart(joined) || !isUsablePart(part)) break;
      joined += part;
      tokens.push({ variants: tokenVariants(joined), weight: weight * 0.95, joined: true });
    }
  }
  return tokens;
}

// Rule-box suffixes printed right after the name
const NAME_SUFFIX = /(VMAX|VSTAR|GX|EX|V)$/;

/** Raw token, digit-corrected copy ("P1KACHU") and copy without a rule-box suffix. */
function tokenVariants(text) {
  const variants = new Set([text]);
  const fixed = fixDigits(text);
  variants.add(fixed);
  for (const v of [text, fixed]) {
    const stripped = v.replace(NAME_SUFFIX, '');
    if (stripped.length >= 4) variants.add(stripped);
  }
  return [...variants];
}

/** Score names against weighted tokens; returns Map name -> score (0..100). */
function scoreTokens(tokens, allNames) {
  const scores = new Map();
  for (const name of allNames) {
    const upperName = alnum(name);
    let best = 0;
    for (const { variants, weight, joined } of tokens) {
      for (const text of variants) {
        // Joined pieces only count when they rebuild most of a longer name
        if (joined && text !== upperName && (text.length < 5 || upperName.length < 5)) continue;
        const base = matchScore(text, upperName);
        if (base > 0) best = Math.max(best, Math.round(base * weight));
      }
    }
    if (best > 0) scores.set(name, best);
  }
  return scores;
}

function topCandidates(scores, limit = 4, minScore = 45) {
  return [...scores.entries()]
    .filter(([, score]) => score >= minScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, score]) => ({
      name,
      displayName: name.charAt(0).toUpperCase() + name.slice(1),
      score,
    }));
}

/**
 * Score every official Pokemon name against plain OCR text (all words equally
 * weighted) and return up to 4 candidates, best first: [{ name, displayName, score }].
 */
export function rankPokemonCandidates(rawText, allNames) {
  const words = (rawText || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => ({ text, conf: 100, height: 1, line: 0 }));
  return topCandidates(scoreTokens(buildTokens(words), allNames));
}

function wordsFromResult(data) {
  const words = [];
  let line = 0;
  for (const block of data?.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const l of paragraph.lines || []) {
        for (const w of l.words || []) {
          words.push({
            text: w.text,
            conf: w.confidence,
            height: (w.bbox?.y1 ?? 0) - (w.bbox?.y0 ?? 0),
            line,
          });
        }
        line++;
      }
    }
  }
  if (words.length > 0) return words;
  // Older Tesseract builds or mocks may only return text
  return (data?.text || '').split('\n').flatMap((textLine, i) =>
    textLine.split(/\s+/).filter(Boolean).map((text) => ({ text, conf: 70, height: 1, line: i }))
  );
}

// Where the name sits on every card era, relative to the card (x, y, width, height)
const NAME_STRIP = { x: 0.02, y: 0.015, width: 0.8, height: 0.13 };
const HEADER_ZONE = { x: 0, y: 0, width: 1, height: 0.3 };
// A result this strong from an early pass is accepted without further passes
const CONFIDENT_SCORE = 80;

/**
 * Recognise the Pokemon name on a card photo.
 * Passes (stopping early once confident):
 *   1. name strip of the detected card, grayscale, sparse-text layout
 *   2. same strip, Otsu-binarised
 *   3. whole header zone (top 30% of the card)
 *   4. top half of the raw image when no card could be isolated
 */
export async function recognizeCardWithOCR(imageSource, onProgress) {
  activeProgressCallback = onProgress || null;
  const empty = { success: false, rawText: '', bestMatch: '', confidence: 0, candidates: [] };
  try {
    const { width, height } = getSourceSize(imageSource);
    if (!width || !height) return empty;

    const { card, found } = extractCard(imageSource);
    const strip = cropCardZone(card, NAME_STRIP);
    const passes = [
      () => preprocess(strip, 'gray'),
      () => preprocess(strip, 'max'),
      () => preprocess(strip, 'binary'),
      () => preprocess(cropCardZone(card, HEADER_ZONE, 1000), 'gray'),
    ];
    if (!found) {
      // Maybe a photo where the card blends into the background: search the upper image
      passes.push(() => {
        const scale = Math.min(2, 1400 / width);
        return preprocess(cropCanvas(imageSource, { x: 0, y: 0, width, height: height * 0.55 }, scale), 'gray');
      });
    }

    const [worker, allNames] = await Promise.all([getWorker(), getAllPokemonNames()]);
    await worker.setParameters({ tessedit_pageseg_mode: '11' }); // sparse text

    const combined = new Map();
    const texts = [];
    for (const makeImage of passes) {
      const res = await worker.recognize(makeImage(), {}, { text: true, blocks: true });
      texts.push((res?.data?.text || '').trim());
      const scores = scoreTokens(buildTokens(wordsFromResult(res?.data)), allNames);
      for (const [name, score] of scores) {
        combined.set(name, Math.max(combined.get(name) || 0, score));
      }
      const best = topCandidates(combined, 1)[0];
      if (best && best.score >= CONFIDENT_SCORE) break;
    }

    const rawText = texts.filter(Boolean).join(' | ');
    console.log('[PokeScan AI OCR Raw Output]:', rawText);

    const candidates = topCandidates(combined);
    const bestMatch = candidates[0] || null;

    return {
      success: !!bestMatch,
      rawText,
      bestMatch: bestMatch?.name || '',
      confidence: bestMatch?.score || 0,
      candidates,
    };
  } catch (err) {
    console.error('High-accuracy OCR failed:', err);
    return empty;
  } finally {
    activeProgressCallback = null;
  }
}
