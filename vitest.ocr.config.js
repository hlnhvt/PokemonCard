import { defineConfig } from 'vitest/config'

// Slow real-OCR benchmark; run with `npm run eval:ocr`
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/ocr-eval/**/*.eval.test.js'],
    testTimeout: 3_600_000,
    pool: 'forks',
  },
})
