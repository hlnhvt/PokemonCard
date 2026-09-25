import { defineConfig } from 'vitest/config'

// Hits the real PokeAPI; run manually with `npm run test:live` (needs internet)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/live/**/*.test.js'],
    testTimeout: 30000,
  },
})
