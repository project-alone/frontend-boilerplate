// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/route-rendering/e2e/route-rendering.spec.ts

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext } from '@playwright/test'
import { RENDERING_DEMOS } from '@/features/rendering-demo/rendering-demos'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { BFF_PROXY_PATH } from '@/shared/api/base-url'

// route-rendering Recipe: 라우트마다 Rendering Mode가 다르게 동작하는지 빌드한 앱(next start)에서 확인한다.
// 각 데모 페이지는 서버가 그 HTML을 렌더링한 시각을 <time datetime>으로 보여 준다(RenderedAt).

// 샘플 명세(openapi.yaml)의 listProducts example. E2E 대상 서버에서는 MSW가 이 값을 돌려준다.
const PRODUCT_NAMES = ['기본 티셔츠', '데님 재킷']

// 스트리밍·CSR 라우트가 데이터를 받기 전에 보여 주는 대체 UI
const LOADING_MESSAGE = '상품을 불러오는 중입니다.'

/** 라우트의 HTML을 받아 서버가 그 HTML을 렌더링한 시각을 읽는다. */
async function renderedAt(request: APIRequestContext, path: string): Promise<number> {
  const response = await request.get(path)
  expect(response.status()).toBe(200)
  const time = /<time[^>]*datetime="([^"]+)"/i.exec(await response.text())?.[1]
  if (time === undefined) throw new Error(`${path}의 HTML에 렌더링한 시각이 없습니다.`)
  return Date.parse(time)
}

test('SSR 라우트는 요청마다 서버에서 다시 렌더링한다', async ({ request }) => {
  const testStartedAt = Date.now()

  const first = await renderedAt(request, '/rendering/ssr')

  expect(first).toBeGreaterThanOrEqual(testStartedAt)
  await expect.poll(() => renderedAt(request, '/rendering/ssr')).toBeGreaterThan(first)
})

test('SSG 라우트는 빌드할 때 렌더링한 HTML을 모든 요청에 그대로 보낸다', async ({ request }) => {
  const testStartedAt = Date.now()

  const first = await renderedAt(request, '/rendering/ssg')
  const second = await renderedAt(request, '/rendering/ssg')

  // 요청을 받았을 때가 아니라 이 테스트가 시작되기 전(빌드할 때)에 렌더링했다.
  expect(first).toBeLessThan(testStartedAt)
  expect(second).toBe(first)
})

test('ISR 라우트는 미리 렌더링한 HTML을 보내다가, 정한 시간이 지나면 다시 렌더링한 HTML로 바꾼다', async ({
  request,
}) => {
  test.setTimeout(60_000)
  const testStartedAt = Date.now()

  expect(await renderedAt(request, '/rendering/isr')).toBeLessThan(testStartedAt)

  // revalidate(10초)가 지난 뒤 들어온 요청이 다시 렌더링을 시작하고(그 요청은 이전 HTML을 받는다), 다시 렌더링이 끝나면
  // 다음 요청부터 새 HTML을 받는다.
  await expect
    .poll(() => renderedAt(request, '/rendering/isr'), { timeout: 30_000, intervals: [1_000] })
    .toBeGreaterThanOrEqual(testStartedAt)

  // 다시 렌더링한 HTML도 다음 revalidate까지는 요청마다 렌더링하지 않고 그대로 보낸다.
  const regenerated = await renderedAt(request, '/rendering/isr')
  expect(await renderedAt(request, '/rendering/isr')).toBe(regenerated)
})

test('스트리밍 라우트는 느린 데이터를 기다리지 않고 대체 UI를 먼저 보낸 뒤, 같은 응답에 이어서 데이터를 보낸다', async ({
  baseURL,
}) => {
  const response = await fetch(new URL('/rendering/streaming', baseURL))
  const reader = response.body?.getReader()
  if (reader === undefined) throw new Error('응답 본문이 없습니다.')

  // 응답을 조각(chunk)마다 읽으며, 대체 UI와 데이터가 각각 몇 번째 조각까지 받았을 때 처음 보였는지 기록한다.
  const decoder = new TextDecoder()
  let received = ''
  let chunkCount = 0
  let loadingSeenAt: number | undefined
  let productsSeenAt: number | undefined
  let chunk = await reader.read()
  while (!chunk.done) {
    received += decoder.decode(chunk.value, { stream: true })
    chunkCount += 1
    if (received.includes(LOADING_MESSAGE)) loadingSeenAt ??= chunkCount
    if (PRODUCT_NAMES.every((name) => received.includes(name))) productsSeenAt ??= chunkCount
    chunk = await reader.read()
  }

  expect(loadingSeenAt).toBeDefined()
  expect(productsSeenAt).toBeDefined()
  expect(loadingSeenAt).toBeLessThan(productsSeenAt ?? 0)
})

test('CSR 라우트는 데이터 없이 미리 렌더링한 HTML을 보내고, 브라우저가 BFF 프록시로 데이터를 가져와 그린다', async ({
  page,
}) => {
  const browserApiRequests: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith(BFF_PROXY_PATH)) browserApiRequests.push(pathname)
  })

  const response = await page.goto('/rendering/csr')

  const html = (await response?.text()) ?? ''
  expect(html).toContain(LOADING_MESSAGE)
  for (const name of PRODUCT_NAMES) expect(html).not.toContain(name)
  for (const name of PRODUCT_NAMES) await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
  expect(new Set(browserApiRequests)).toEqual(new Set([`${BFF_PROXY_PATH}/products`]))
})

test('목록 페이지는 라우트별 Rendering Mode 데모를 설명과 함께 잇는다', async ({ page }) => {
  await page.goto('/rendering')

  for (const demo of RENDERING_DEMOS) {
    await expect(page.getByRole('link', { name: demo.name, exact: true })).toHaveAttribute('href', demo.path)
    await expect(page.getByText(demo.summary)).toBeVisible()
  }
})

for (const path of ['/rendering', ...RENDERING_DEMOS.map((demo) => demo.path)]) {
  test(`${path}에 WCAG 2.2 AA 접근성 위반이 없다`, async ({ page }) => {
    const response = await page.goto(path)

    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // 데이터를 기다리는 라우트는 데이터까지 그린 화면을 검사한다.
    await expect(page.getByText(LOADING_MESSAGE)).toHaveCount(0)
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
    expect(violations).toEqual([])
  })
}
