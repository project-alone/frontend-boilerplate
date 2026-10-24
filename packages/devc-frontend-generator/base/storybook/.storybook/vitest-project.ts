import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import type { TestProjectInlineConfiguration } from 'vitest/config'

/**
 * npm run test:storybook이 실행하는 Vitest 프로젝트(config/vitest.config.ts의 projects). 스토리 하나하나를 브라우저(Chromium)에서
 * 테스트로 실행하고, 실행할 때마다 axe 접근성 검사를 한다.
 */
export const storybookProject: TestProjectInlineConfiguration = {
  extends: true,
  // Storybook 설정은 이 파일이 있는 디렉터리(.storybook)다. Vitest를 어느 디렉터리에서 띄워도 같은 곳을 찾도록 이 파일을 기준으로 적는다.
  plugins: [storybookTest({ configDir: import.meta.dirname })],
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
}
