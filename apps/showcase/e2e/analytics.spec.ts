// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/analytics/e2e/analytics.spec.ts

import { expect, test } from '@playwright/test'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'

// E2E는 분석 공급자를 붙이지 않은 기본 구현으로 빌드한 앱으로 돈다(config/playwright.config.ts). 배포용 빌드의 기본 구현은 페이지뷰와
// 이벤트를 어디에도 보내거나 남기지 않는다. MSW가 받는 샘플 백엔드 주소(MOCK_API_BASE_URL)는 앱의 요청이다.

/** Link를 누른 것처럼 App Router로 페이지를 옮긴다. Base의 홈에는 링크가 없어 Next.js가 window.next.router에 둔 라우터를 부른다. */
function navigate(href: string) {
  ;(window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push(href)
}

test('분석 공급자를 붙이지 않은 앱은 페이지를 열고 옮겨도 앱 밖으로 요청을 보내지 않고 콘솔에도 남기지 않는다', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  const messages: string[] = []
  page.on('console', (message) => messages.push(message.text()))
  await page.goto('/')
  const appOrigin = new URL(page.url()).origin

  await page.evaluate(navigate, '/products')

  await expect(page).toHaveURL(/\/products$/)
  await expect(page.getByRole('heading', { level: 1, name: '상품' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  const outside = requests.filter((url) => {
    const { origin, protocol } = new URL(url)
    return protocol.startsWith('http') && origin !== appOrigin && !url.startsWith(MOCK_API_BASE_URL)
  })
  expect(outside).toEqual([])
  expect(messages.filter((text) => text.includes('[analytics]'))).toEqual([])
})
