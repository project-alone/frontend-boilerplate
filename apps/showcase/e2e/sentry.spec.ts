// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/sentry/e2e/sentry.spec.ts

import { expect, test } from '@playwright/test'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'

// E2E는 DSN 없이 빌드한 앱으로 돈다(config/playwright.config.ts). DSN이 없으면 Sentry SDK를 초기화하지 않으므로, 브라우저에서
// 처리하지 못한 오류가 나도 앱 밖으로 요청을 보내지 않는다. MSW가 받는 샘플 백엔드 주소(MOCK_API_BASE_URL)는 앱의 요청이다.
test('DSN 없이 빌드한 앱은 브라우저에서 처리하지 못한 오류가 나도 앱 밖으로 요청을 보내지 않는다', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const appOrigin = new URL(page.url()).origin

  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('처리하지 못한 오류')
    })
  })

  await expect.poll(() => errors).toEqual(['처리하지 못한 오류'])
  // SDK가 오류를 보낸다면 바로 보내므로, 잠시 기다린 뒤에도 앱 밖으로 나간 요청이 없는지 본다.
  await page.waitForTimeout(1000)
  const outside = requests.filter((url) => {
    const { origin, protocol } = new URL(url)
    return protocol.startsWith('http') && origin !== appOrigin && !url.startsWith(MOCK_API_BASE_URL)
  })
  expect(outside).toEqual([])
})
