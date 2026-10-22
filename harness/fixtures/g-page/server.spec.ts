import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { BFF_PROXY_PATH } from '@/shared/api/base-url'

// 하네스(harness/g-page.test.ts)가 query → mutation → form → page Schematic을 차례로 실행해 만든 화면을, 빌드한 server Starter
// (next start)에서 검사한다. 상품은 하네스가 바꾼 MSW 핸들러(src/shared/mocks/handlers.ts)가 Next.js 서버의 메모리에 둔다.
const PRODUCT_NAMES = ['기본 티셔츠', '데님 재킷']
const LOADING_MESSAGE = '불러오는 중입니다.'

// 서버가 상품 목록을 가져와 HTML에 담아 보내는 라우트. SSR·스트리밍은 요청할 때, SSG·ISR은 빌드할 때 가져왔다.
const REQUEST_TIME_ROUTES = ['/modes/ssr', '/modes/streaming']
const BUILD_TIME_ROUTES = ['/modes/ssg', '/modes/isr']

/** 브라우저가 BFF 프록시로 보내는 API 요청의 경로를 모은다. */
function collectBrowserApiRequests(page: Page): string[] {
  const requests: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith(BFF_PROXY_PATH)) requests.push(pathname)
  })
  return requests
}

/** 상품 등록 폼(createProduct)에 값을 넣어 제출하고 성공 알림을 기다린다. */
async function registerProduct(page: Page, name: string) {
  await page.getByRole('textbox', { name: 'name' }).fill(name)
  await page.getByRole('spinbutton', { name: 'price' }).fill('1000')
  await page.getByRole('button', { name: '상품 등록' }).click()
  await expect(page.getByText('상품 등록 완료')).toBeVisible()
}

test('목록과 폼을 함께 둔 페이지는 서버가 가져온 목록을 보여 주고, 폼을 제출하면 목록을 다시 가져와 새 상품을 보여 준다', async ({
  page,
}) => {
  const name = `새 상품 ${String(Date.now())}`

  const response = await page.goto('/catalog')
  const html = (await response?.text()) ?? ''
  for (const product of PRODUCT_NAMES) expect(html).toContain(product)
  // hydration이 끝난 뒤에 입력한다.
  await page.waitForLoadState('networkidle')
  await registerProduct(page, name)

  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
})

test('폼만 둔 페이지에서 등록한 상품은 목록 페이지에 보인다', async ({ page }) => {
  const name = `새 상품 ${String(Date.now())}`

  await page.goto('/products/new')
  await page.waitForLoadState('networkidle')
  await registerProduct(page, name)
  await page.goto('/modes/ssr')

  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
})

for (const path of REQUEST_TIME_ROUTES) {
  test(`${path}는 요청할 때 서버가 가져온 목록을 HTML에 담아 보내고, 브라우저는 다시 요청하지 않는다`, async ({
    page,
  }) => {
    const browserApiRequests = collectBrowserApiRequests(page)

    const response = await page.goto(path)

    const html = (await response?.text()) ?? ''
    for (const name of PRODUCT_NAMES) expect(html).toContain(name)
    await page.waitForLoadState('networkidle')
    for (const name of PRODUCT_NAMES) await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
    expect(browserApiRequests).toEqual([])
  })
}

for (const path of BUILD_TIME_ROUTES) {
  test(`${path}는 빌드할 때 서버가 가져온 목록을 HTML에 담아 보낸다`, async ({ page }) => {
    const response = await page.goto(path)

    const html = (await response?.text()) ?? ''
    for (const name of PRODUCT_NAMES) expect(html).toContain(name)
    for (const name of PRODUCT_NAMES) await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
  })
}

test('/modes/csr는 데이터 없는 HTML을 보내고, 브라우저가 BFF 프록시로 목록을 가져와 그린다', async ({ page }) => {
  const browserApiRequests = collectBrowserApiRequests(page)

  const response = await page.goto('/modes/csr')

  const html = (await response?.text()) ?? ''
  expect(html).toContain(LOADING_MESSAGE)
  for (const name of PRODUCT_NAMES) expect(html).not.toContain(name)
  for (const name of PRODUCT_NAMES) await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
  expect(new Set(browserApiRequests)).toEqual(new Set([`${BFF_PROXY_PATH}/products`]))
})

test('동적 세그먼트의 페이지는 경로의 상품을 보여 주고, 없는 상품이면 오류 상태를, 숫자가 아니면 없는 페이지를 보여 준다', async ({
  page,
}) => {
  for (const path of ['/products/1', '/products/1/cached']) {
    await page.goto(path)
    await expect(page.getByRole('definition').filter({ hasText: '기본 티셔츠' })).toBeVisible()
  }

  // 라우트의 오류 상태(Schematic이 만든 error.tsx, 제목은 라우트의 제목)가 앱 수준의 오류 화면(src/app/error.tsx)보다 먼저 받는다.
  await page.goto('/products/999')
  await expect(page.getByRole('heading', { level: 1, name: '상품 상세' })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: '페이지를 불러오지 못했습니다.' })).toBeVisible()
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible()

  // 라우트에 not-found.tsx가 없으므로 앱 수준의 404 화면(src/app/not-found.tsx)이 받는다.
  await page.goto('/products/abc')
  await expect(page.getByRole('heading', { level: 1, name: '찾는 화면이 없습니다' })).toBeVisible()
})

for (const path of [
  '/catalog',
  '/products/new',
  ...REQUEST_TIME_ROUTES,
  ...BUILD_TIME_ROUTES,
  '/modes/csr',
  '/products/1',
  '/products/999',
]) {
  test(`${path}에 WCAG 2.2 AA 접근성 위반이 없다`, async ({ page }) => {
    await page.goto(path)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // 데이터를 기다리는 화면은 데이터까지 그린 뒤에 검사한다.
    await expect(page.getByText(LOADING_MESSAGE)).toHaveCount(0)
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
    expect(violations).toEqual([])
  })
}
