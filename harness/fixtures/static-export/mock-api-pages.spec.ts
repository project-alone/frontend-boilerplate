import { expect, type Page, type Response as PageResponse, test } from '@playwright/test'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'

// 하네스(harness/static-export.test.ts)가 table, chart, infinite-list, optimistic-update Recipe를 넣은 static-export Starter에
// 넣어 실행하는 E2E(#53). 브라우저의 MSW(서비스 워커)는 페이지를 열거나 새로 고치는 요청까지 핸들러에 보이므로, 목 백엔드의
// 경로가 페이지 주소와 겹치면 페이지 대신 목 응답(JSON)이 열린다. 서비스 워커가 페이지를 맡은 뒤 페이지를 직접 열고 새로 고쳐도
// 페이지가 열리고, 데이터는 목 백엔드(MOCK_API_BASE_URL)에서 오는지 본다.

/** 페이지 주소, 그 페이지가 데이터를 가져오는 목 백엔드의 경로, 제목, 목 데이터로 그린 글자 */
const PAGES = [
  { path: '/products', api: '/products', heading: '상품', data: '기본 티셔츠' },
  { path: '/members', api: '/members', heading: '회원', data: '김하늘' },
  {
    path: '/charts',
    api: '/stats/channel-sales',
    heading: '차트',
    data: '이번 달 합계 120,200,000원, 지난달 합계 114,700,000원',
  },
  { path: '/articles', api: '/articles', heading: '게시글', data: '릴리스 노트 46호' },
  { path: '/todos', api: '/todos', heading: '할 일', data: '디자인 시안 검토하기' },
]

type Target = (typeof PAGES)[number]

/** open으로 페이지를 열고, HTML 문서가 열려 목 백엔드가 돌려준 데이터로 그려지는지 본다. */
async function expectPage(page: Page, open: () => Promise<PageResponse | null>, { api, heading, data }: Target) {
  const mocked = page.waitForResponse((response) => response.url().startsWith(`${MOCK_API_BASE_URL}${api}`))

  const document = await open()

  expect(document?.status()).toBe(200)
  expect(document?.headers()['content-type']).toContain('text/html')
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  expect((await mocked).ok()).toBe(true)
  await expect(page.getByText(data).first()).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  // 홈을 열어 서비스 워커가 페이지를 맡을 때까지 기다린다. 그 뒤의 페이지 탐색 요청은 서비스 워커를 거친다.
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
})

for (const target of PAGES) {
  test(`${target.path}를 직접 열고 새로 고쳐도 페이지가 열리고 데이터는 목 백엔드에서 온다`, async ({ page }) => {
    await expectPage(page, () => page.goto(target.path), target)
    await expectPage(page, () => page.reload(), target)
  })
}
