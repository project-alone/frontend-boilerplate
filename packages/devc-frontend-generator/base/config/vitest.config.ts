import { join } from 'node:path'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// 이 설정은 config/에 있으므로 npm 스크립트가 --config로 넘긴다. 경로는 Starter 최상위(root)를 기준으로 적는다.
const root = join(import.meta.dirname, '..')

export default defineConfig({
  root,
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['config/vitest.setup.ts'],
        },
      },
      {
        // 스토리 하나하나를 브라우저(Chromium)에서 테스트로 실행하고, 실행할 때마다 axe 접근성 검사를 한다.
        extends: true,
        plugins: [storybookTest({ configDir: join(root, '.storybook') })],
        optimizeDeps: {
          // Storybook 런타임이 쓰는 react를 미리 묶어 둔다. 실행 도중에 묶으면 Vite가 테스트를 다시 불러오면서
          // 캐시가 없는 첫 실행(CI 등)이 실패한다.
          include: ['react'],
        },
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
