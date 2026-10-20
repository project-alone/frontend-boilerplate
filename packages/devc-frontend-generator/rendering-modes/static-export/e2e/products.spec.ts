import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'

// 샘플 명세(openapi.yaml)의 listProducts example. E2E는 브라우저의 MSW를 켜고 빌드한 정적 파일로 돌므로
// (playwright.config.ts) MSW 서비스 워커가 이 값을 돌려준다.
const PRODUCT_NAMES = ['기본 티셔츠', '데님 재킷']

test('서버 없이 브라우저가 백엔드에서 직접 가져온 상품 목록을 보여 준다', async ({ page }) => {
  const backendRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith(MOCK_API_BASE_URL)) backendRequests.push(request.url())
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  const response = await page.goto('/products')

  // 빌드할 때 만든 HTML에는 상품 목록이 없다.
  const html = (await response?.text()) ?? ''
  for (const name of PRODUCT_NAMES) expect(html).not.toContain(name)

  // 브라우저가 BFF 프록시 없이 백엔드 주소로 바로 요청해 받은 목록을 그린다.
  // 개발 서버는 라우트를 처음 컴파일할 때 페이지를 다시 불러올 수 있어 요청 횟수는 보지 않는다.
  for (const name of PRODUCT_NAMES) await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
  expect(new Set(backendRequests)).toEqual(new Set([`${MOCK_API_BASE_URL}/products`]))
  expect(errors).toEqual([])
})

test('상품 페이지에 WCAG 2.2 AA 접근성 위반이 없다', async ({ page }) => {
  await page.goto('/products')

  await expect(page.getByRole('heading', { level: 1, name: '상품' })).toBeVisible()
  await expect(page.getByRole('listitem').first()).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
  expect(violations).toEqual([])
})
