import { defineConfig, devices } from '@playwright/test'

// `next dev`의 기본 포트(3000)와 겹치지 않게 E2E 전용 포트를 쓴다. E2E_PORT로 바꿀 수 있다.
const PORT = process.env.E2E_PORT ?? '3100'
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Rendering Mode static-export: 브라우저의 MSW를 켜고(NEXT_PUBLIC_API_MOCKING=enabled) 빌드한 out/을 정적 파일 서버
  // (`npm run start`)로 띄워 검사한다. 브라우저가 백엔드로 보내는 API 요청은 MSW 서비스 워커가 받는다.
  // NEXT_PUBLIC_ 값은 빌드할 때 코드에 박히므로 E2E가 직접 다시 빌드한다. 이렇게 만든 out/은 배포하지 않는다.
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_API_MOCKING: 'enabled' },
    // 빌드가 끝날 때까지 기다린다.
    timeout: 5 * 60_000,
  },
})
