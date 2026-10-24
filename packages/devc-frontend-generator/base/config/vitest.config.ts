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
        resolve: {
          alias: {
            // 서버 전용 모듈(import 'server-only')은 Next.js 밖에서 불러오면 오류를 던진다. 단위 테스트는 서버 모듈도 직접 불러
            // 시험하므로 빈 모듈로 바꾼다.
            'server-only': join(root, 'node_modules/server-only/empty.js'),
            // apiFetch가 서버에서 불러오는 모듈(package.json의 imports). Next.js는 서버 컴포넌트 쪽(react-server 조건)에서
            // api-fetch.server.ts를 고르지만 Vitest에는 그 조건이 없으므로 직접 정한다. window가 없는 테스트
            // (`// @vitest-environment node`)가 서버의 요청을 시험한다.
            '#api-fetch.server': join(root, 'src/shared/api/api-fetch.server.ts'),
          },
        },
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
