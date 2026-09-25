// Real Pokemon cries from PokeAPI (.ogg), with the synthesized cry as fallback
import { sounds } from './soundEffects';
import { getCardMedia } from '../services/pokemonOnlineService';

let currentAudio = null;

export function canPlayOgg() {
  try {
    return typeof Audio !== 'undefined' && !!new Audio().canPlayType?.('audio/ogg; codecs="vorbis"');
  } catch {
    return false;
  }
}

/**
 * Play the Pokemon's real cry. Resolves to 'real', 'synth' (fallback used because the
 * browser cannot play Ogg, e.g. some iOS Safari versions, or loading failed) or 'muted'.
 */
export function playCry(pokemon, { legacy = false, type } = {}) {
  if (sounds.isMuted()) return Promise.resolve('muted');

  const fallback = () => {
    sounds.playPokemonCry(type || pokemon?.types?.[0]);
    return 'synth';
  };

  const { cryUrl } = getCardMedia(pokemon);
  const url = legacy ? pokemon?.cryLegacyUrl || cryUrl : cryUrl;
  if (!url || !canPlayOgg()) return Promise.resolve(fallback());

  try {
    currentAudio?.pause();
  } catch {
    // ignore
  }
  const audio = new Audio(url);
  audio.volume = 0.7;
  currentAudio = audio;
  return Promise.resolve(audio.play()).then(() => 'real', fallback);
}
