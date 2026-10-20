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
  // 빌드된 Starter(`npm run build`의 결과)를 띄워 검사한다. 서버가 보내는 API 요청은 MSW가 받는다.
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { API_MOCKING: 'enabled' },
  },
})
