import { defineConfig } from 'vitest/config'

const TEN_MINUTES = 10 * 60_000

export default defineConfig({
  test: {
    include: ['harness/**/*.test.ts'],
    globalSetup: ['harness/global-setup.ts'],
    testTimeout: TEN_MINUTES,
    hookTimeout: TEN_MINUTES,
  },
})
