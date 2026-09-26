// Text-to-speech through the browser (Web Speech API). Free, and works offline with the
// voices installed on the device. Silently does nothing where it is not supported.
import { sounds } from './soundEffects';

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

function pickVoice(lang) {
  const voices = window.speechSynthesis.getVoices?.() || [];
  const base = lang.split('-')[0];
  return voices.find((v) => v.lang === lang) || voices.find((v) => v.lang?.startsWith(base)) || null;
}

/**
 * Say `text` in `lang` ('en-US' for English words, 'vi-VN' for meanings).
 * Returns true when speech was started.
 */
export function speak(text, { lang = 'en-US', rate = 0.8, pitch = 1.1, interrupt = true } = {}) {
  if (!canSpeak() || sounds.isMuted() || !text) return false;
  try {
    if (interrupt) window.speechSynthesis.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate; // a little slower for children
    u.pitch = pitch;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  try {
    if (canSpeak()) window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}
