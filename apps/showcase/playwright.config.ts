// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/playwright.config.ts

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
  // 빌드된 Starter(`npm run build`의 결과)를 `npm run start`로 띄워 검사한다.
  // Next.js 서버가 뜨면(server Rendering Mode) 그 서버가 보내는 API 요청은 MSW가 받는다. 빌드할 때 데이터를 가져오는
  // 페이지(SSG·ISR)도 목 응답을 담도록, 목으로 빌드한 결과(`API_MOCKING=enabled npm run build`)를 띄운다(README의 "실행과 배포").
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: { API_MOCKING: 'enabled' },
  },
})
