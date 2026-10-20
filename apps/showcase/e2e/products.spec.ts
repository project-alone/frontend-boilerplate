// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/e2e/products.spec.ts

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { BFF_PROXY_PATH } from '@/shared/api/base-url'

// 샘플 명세(openapi.yaml)의 listProducts example. E2E 대상 서버에서는 MSW가 이 값을 돌려준다.
const PRODUCT_NAMES = ['기본 티셔츠', '데님 재킷']

test('서버 컴포넌트가 prefetch한 상품 목록을 브라우저가 다시 요청하지 않고 hydration으로 이어받는다', async ({
  page,
}) => {
  const browserApiRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith(BFF_PROXY_PATH)) browserApiRequests.push(request.url())
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  const response = await page.goto('/products')

  // 서버가 보낸 HTML에 이미 데이터가 들어 있다.
  const html = (await response?.text()) ?? ''
  for (const name of PRODUCT_NAMES) expect(html).toContain(name)

  // hydration이 끝나도 브라우저는 같은 데이터를 다시 요청하지 않고, hydration 오류도 없다.
  await page.waitForLoadState('networkidle')
  for (const name of PRODUCT_NAMES) await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
  expect(browserApiRequests).toEqual([])
  expect(errors).toEqual([])
})

test('상품 페이지에 WCAG 2.2 AA 접근성 위반이 없다', async ({ page }) => {
  await page.goto('/products')

  await expect(page.getByRole('heading', { level: 1, name: '상품' })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
  expect(violations).toEqual([])
})
