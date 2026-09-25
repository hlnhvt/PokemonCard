import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const isDom = typeof window !== 'undefined' && typeof HTMLMediaElement !== 'undefined';

// jsdom has no media playback, Web Audio or canvas; stub what the app touches
if (isDom) {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: vi.fn(() => Promise.resolve()),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

afterEach(() => {
  // Files opting into the Node environment (real canvas tests) have no DOM to clean
  if (!isDom) return;
  cleanup();
  localStorage.clear();
});
