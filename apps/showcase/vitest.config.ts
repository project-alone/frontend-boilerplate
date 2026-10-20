// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/vitest.config.ts, recipes/dark-mode/vitest.config.ts.patch

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
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
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      {
        // 스토리 하나하나를 브라우저(Chromium)에서 테스트로 실행하고, 실행할 때마다 axe 접근성 검사를 한다.
        extends: true,
        plugins: [storybookTest({ configDir: '.storybook' })],
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
            instances: [
              { browser: 'chromium' },
              // dark-mode Recipe: 운영체제가 다크 모드인 브라우저에서도 모든 스토리를 검사한다(.storybook/preview.tsx의 테마).
              {
                browser: 'chromium',
                name: 'storybook (chromium, dark)',
                provider: playwright({ contextOptions: { colorScheme: 'dark' } }),
              },
            ],
          },
        },
      },
    ],
  },
})
