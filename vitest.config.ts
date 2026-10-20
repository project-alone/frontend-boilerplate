import { configDefaults, defineConfig } from 'vitest/config'

const TEN_MINUTES = 10 * 60_000

export default defineConfig({
  test: {
    include: ['harness/**/*.test.ts'],
    // 시험용 Recipe(harness/fixtures)의 테스트는 Starter의 테스트다. 그 Recipe를 넣은 Starter가 실행한다.
    exclude: [...configDefaults.exclude, 'harness/fixtures/**'],
    globalSetup: ['harness/global-setup.ts'],
    testTimeout: TEN_MINUTES,
    hookTimeout: TEN_MINUTES,
  },
})
