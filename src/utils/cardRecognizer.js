import { createWorker } from 'tesseract.js';
import { POKEMON_CARDS, matchPokemonCard } from '../data/pokemonCards';

let tesseractWorker = null;

// Initialize or reuse Tesseract worker
async function getWorker(onProgress) {
  if (!tesseractWorker) {
    tesseractWorker = await createWorker('eng', 1, {
      logger: (m) => {
        if (onProgress && m.status === 'recognizing text') {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });
  }
  return tesseractWorker;
}

/**
 * Preprocess image on canvas:
 * Crops top 35% of the card where the Pokemon name and HP are located
 * Applies grayscale and high-contrast thresholding for clean OCR
 */
function createOptimizedCropCanvas(imageSource) {
  const canvas = document.createElement('canvas');
  const srcWidth = imageSource.videoWidth || imageSource.naturalWidth || imageSource.width;
  const srcHeight = imageSource.videoHeight || imageSource.naturalHeight || imageSource.height;

  if (!srcWidth || !srcHeight) return null;

  // We crop the top 35% of the card image (where Pokémon Name, Stage, and HP reside)
  const cropY = 0;
  const cropHeight = Math.floor(srcHeight * 0.38);

  canvas.width = Math.min(800, srcWidth);
  canvas.height = Math.floor((canvas.width / srcWidth) * cropHeight);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    imageSource,
    0, cropY, srcWidth, cropHeight,
    0, 0, canvas.width, canvas.height
  );

  // Grayscale & contrast enhancement
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Luminance
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    // High contrast stretch
    const contrast = 1.35;
    const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
    let color = factor * (avg - 128) + 128;
    color = Math.max(0, Math.min(255, color));

    data[i] = color;
    data[i + 1] = color;
    data[i + 2] = color;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * Main recognition function: Reads text on card with OCR and matches against Pokemon list
 */
export async function recognizeCardWithOCR(imageSource, onProgress) {
  try {
    const cropCanvas = createOptimizedCropCanvas(imageSource);
    if (!cropCanvas) {
      return {
        success: false,
        pokemon: POKEMON_CARDS[0],
        rawText: '',
        confidence: 0,
      };
    }

    const worker = await getWorker(onProgress);
    const result = await worker.recognize(cropCanvas);
    const rawText = (result?.data?.text || '').trim();
    const cleanText = rawText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

    console.log('[PokeScan OCR] Extracted text from card header:', rawText);

    // Score all available cards
    let bestMatch = null;
    let highestScore = 0;

    for (const card of POKEMON_CARDS) {
      let score = 0;
      const lowerName = card.name.toLowerCase();

      // Check if primary name is mentioned (e.g. "Charizard")
      const primaryName = lowerName.split(' ')[0];
      if (cleanText.includes(primaryName)) {
        score += 50;
      }
      if (cleanText.includes(lowerName)) {
        score += 30;
      }

      // Check keywords (vmax, vstar, ex, hp number)
      card.keywords.forEach((kw) => {
        if (cleanText.includes(kw.toLowerCase())) {
          score += 15;
        }
      });

      // Check HP number (e.g. "330", "310", "280")
      if (cleanText.includes(String(card.hp))) {
        score += 20;
      }

      // Check Pokedex number (e.g. "006", "025", "150")
      if (cleanText.includes(card.pokedexNumber)) {
        score += 25;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = card;
      }
    }

    if (bestMatch && highestScore >= 35) {
      return {
        success: true,
        pokemon: bestMatch,
        rawText,
        confidence: Math.min(99, Math.round(highestScore * 1.2)),
      };
    }

    // Fallback: search query matching on raw text
    const queryMatch = matchPokemonCard(cleanText);
    return {
      success: !!queryMatch,
      pokemon: queryMatch || POKEMON_CARDS[0],
      rawText,
      confidence: queryMatch ? 55 : 30,
    };
  } catch (err) {
    console.error('[PokeScan OCR] Error recognizing card:', err);
    return {
      success: false,
      pokemon: POKEMON_CARDS[0],
      rawText: '',
      confidence: 20,
    };
  }
}
