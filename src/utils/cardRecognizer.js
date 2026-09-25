import { createWorker } from 'tesseract.js';
import { getAllPokemonNames } from '../services/pokemonOnlineService';

let workerPromise = null;
// The logger is bound once when the worker is created, so it forwards to whichever
// scan is currently running instead of the callback of the very first scan.
let activeProgressCallback = null;

// Initialize worker with optimized settings for card typography
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
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -',
          tessedit_pageseg_mode: '6', // Assume a single uniform block of text
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
 * Enhanced Image Preprocessor:
 * Creates 2 specialized passes like Google Lens:
 * 1. Title Zone Crop (Top 22% height, Left 80% width) - Where Pokemon Name ALWAYS lives!
 * 2. High-contrast Grayscale with sharp edges (preserves anti-aliased font strokes)
 */
function createTitleZoneCanvas(imageSource) {
  const canvas = document.createElement('canvas');
  const srcWidth = imageSource.videoWidth || imageSource.naturalWidth || imageSource.width;
  const srcHeight = imageSource.videoHeight || imageSource.naturalHeight || imageSource.height;

  if (!srcWidth || !srcHeight) return null;

  // Exact location of Pokemon Name on TCG cards:
  // Top 3% to 22% of height, Left 5% to 80% of width
  const cropX = Math.floor(srcWidth * 0.04);
  const cropY = Math.floor(srcHeight * 0.02);
  const cropW = Math.floor(srcWidth * 0.78);
  const cropH = Math.floor(srcHeight * 0.22);

  canvas.width = Math.min(900, cropW * 2); // Upscale 2x for sharp OCR
  canvas.height = Math.floor((canvas.width / cropW) * cropH);

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    imageSource,
    cropX, cropY, cropW, cropH,
    0, 0, canvas.width, canvas.height
  );

  // Apply Gentle Grayscale + Edge Enhancement (Avoid destructive hard thresholding)
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Compute average luminance to detect if background is dark or light
  let totalLum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    totalLum += lum;
  }
  const avgLum = totalLum / (data.length / 4);

  for (let i = 0; i < data.length; i += 4) {
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

    // Enhance contrast smoothly
    let enhanced = lum;
    if (avgLum < 128) {
      // Dark card theme: boost bright text
      enhanced = lum > 140 ? Math.min(255, lum * 1.3) : lum * 0.7;
    } else {
      // Light card theme: darken dark text
      enhanced = lum < 160 ? Math.max(0, lum * 0.6) : Math.min(255, lum * 1.2);
    }

    data[i] = enhanced;
    data[i + 1] = enhanced;
    data[i + 2] = enhanced;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Secondary Crop: Full Top Header (0% - 35% height) for verification
 */
function createFullHeaderCanvas(imageSource) {
  const canvas = document.createElement('canvas');
  const srcWidth = imageSource.videoWidth || imageSource.naturalWidth || imageSource.width;
  const srcHeight = imageSource.videoHeight || imageSource.naturalHeight || imageSource.height;

  if (!srcWidth || !srcHeight) return null;

  const cropH = Math.floor(srcHeight * 0.35);
  canvas.width = Math.min(800, srcWidth);
  canvas.height = Math.floor((canvas.width / srcWidth) * cropH);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    imageSource,
    0, 0, srcWidth, cropH,
    0, 0, canvas.width, canvas.height
  );

  return canvas;
}

/**
 * String similarity using Dice's Coefficient (Bigram Matching)
 * Way more accurate than simple Levenshtein for OCR typos!
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

/**
 * Main Google Lens-Grade Recognition:
 * Runs OCR specifically focused on the title zone, extracts words,
 * scores every official Pokemon name, and returns the top candidates with confidence percentages!
 */
// Common TCG card words that are NOT Pokemon names
const STOP_WORDS = new Set([
  'STAGE', 'BASIC', 'VMAX', 'VSTAR', 'LEVEL', 'TRAINER', 'ENERGY',
  'ITEM', 'SUPPORTER', 'POKEMON', 'CARD', 'ATTACK', 'WEAKNESS',
  'RESISTANCE', 'RETREAT', 'RULE', 'GAME', 'FREAK', 'NINTENDO',
  'EVOLVES', 'FROM', 'PUT', 'ONTO'
]);

// Stage 1/2 cards print "Evolves from <previous Pokemon>" next to the real name,
// so a name right after FROM gets this weight to let the actual card name win.
const EVOLVES_FROM_WEIGHT = 0.6;

/**
 * Score every official Pokemon name against OCR text and return up to 4 candidates,
 * best first: [{ name, displayName, score }].
 */
export function rankPokemonCandidates(rawText, allNames) {
  const rawTokens = (rawText || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const candidateTokens = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    const weight = rawTokens[i - 1] === 'FROM' ? EVOLVES_FROM_WEIGHT : 1;
    if (token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token)) {
      candidateTokens.push({ text: token, weight });
    }
    // Hyphenated names are often read as two words ("HO OH", "MR MIME")
    const next = rawTokens[i + 1];
    if (next && !/^\d+$/.test(token) && !/^\d+$/.test(next)) {
      candidateTokens.push({ text: `${token}-${next}`, weight, pairOnly: true });
    }
  }

  const scoredList = [];

  for (const name of allNames) {
    const upperName = name.toUpperCase();
    let bestScore = 0;

    for (const { text: token, weight, pairOnly } of candidateTokens) {
      let score = 0;

      if (token === upperName) {
        score = 100;
      } else if (!pairOnly) {
        // Substring match
        if (token.includes(upperName) || (upperName.length >= 5 && upperName.includes(token))) {
          const ratio = Math.min(token.length, upperName.length) / Math.max(token.length, upperName.length);
          score = Math.max(score, Math.round(ratio * 90));
        }

        // Bigram similarity
        const sim = stringSimilarity(token, upperName);
        if (sim >= 0.45) {
          score = Math.max(score, Math.round(sim * 95));
        }
      }

      bestScore = Math.max(bestScore, Math.round(score * weight));
    }

    if (bestScore >= 45) {
      scoredList.push({
        name: name,
        displayName: name.charAt(0).toUpperCase() + name.slice(1),
        score: bestScore,
      });
    }
  }

  // Sort by score descending
  scoredList.sort((a, b) => b.score - a.score);
  return scoredList.slice(0, 4);
}

export async function recognizeCardWithOCR(imageSource, onProgress) {
  activeProgressCallback = onProgress || null;
  try {
    const titleCanvas = createTitleZoneCanvas(imageSource);
    const worker = await getWorker();

    let rawText = '';

    // Pass 1: Title Zone
    if (titleCanvas) {
      const res1 = await worker.recognize(titleCanvas);
      rawText = (res1?.data?.text || '').trim();
    }

    // Pass 2: If title zone yielded less than 3 chars, try full header
    if (!rawText || rawText.length < 3) {
      const headerCanvas = createFullHeaderCanvas(imageSource);
      if (headerCanvas) {
        const res2 = await worker.recognize(headerCanvas);
        rawText += ' ' + (res2?.data?.text || '').trim();
      }
    }

    console.log('[PokeScan AI OCR Raw Output]:', rawText);

    const allNames = await getAllPokemonNames();
    const topCandidates = rankPokemonCandidates(rawText, allNames);
    const bestMatch = topCandidates[0] || null;

    return {
      success: !!bestMatch,
      rawText: rawText,
      bestMatch: bestMatch?.name || '',
      confidence: bestMatch?.score || 0,
      candidates: topCandidates,
    };
  } catch (err) {
    console.error('High-accuracy OCR failed:', err);
    return {
      success: false,
      rawText: '',
      bestMatch: '',
      confidence: 0,
      candidates: [],
    };
  } finally {
    activeProgressCallback = null;
  }
}
