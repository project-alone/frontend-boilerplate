// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/infinite-list/e2e/infinite-list.spec.ts

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

// infinite-list Recipe: 빌드한 앱의 /articles(무한 스크롤)와 /articles/pagination(번호형 페이지네이션)에서 같은 게시글을
// 넘겨 본다. 게시글은 브라우저가 요청하고(server는 BFF 프록시, static-export는 백엔드 주소로 직접), MSW의 게시글
// 핸들러(src/shared/mocks/articles.ts)가 고정된 게시글 46개를 페이지 번호대로 나눠 돌려준다. 한 페이지는 10개다.

/**
 * 브라우저가 게시글 목록(listArticles)을 요청할 때마다 보낸 페이지 번호를 모은다. 같은 경로의 페이지 요청(링크의 prefetch
 * 등)과 구별하려고 listArticles가 늘 보내는 pageSize가 있는 요청만 센다.
 */
function recordRequestedPages(page: Page): string[] {
  const pages: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.endsWith('/articles') && url.searchParams.has('pageSize')) {
      pages.push(url.searchParams.get('page') ?? '')
    }
  })
  return pages
}

/** 페이지에서 난 오류(예: hydration 불일치)를 모은다. */
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

/** Tab 키만 눌러 target까지 포커스를 옮긴다. 다른 Recipe가 머리글에 더한 요소가 있어도 된다. */
async function tabTo(page: Page, target: Locator) {
  for (let presses = 0; presses < 30; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

/** 사용자가 문서 끝까지 스크롤한다. */
async function scrollToBottom(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight)
  })
}

function articles(page: Page) {
  return page.getByRole('list', { name: '게시글 목록' }).getByRole('listitem')
}

/** 제목이 title인 게시글 항목 */
function articleItem(page: Page, title: string) {
  return articles(page).filter({ has: page.getByRole('heading', { name: title }) })
}

test('페이지 뼈대는 게시글 없이 오고, 첫 페이지를 보여 준 뒤 끝까지 스크롤할 때마다 다음 페이지를 불러와 마지막 페이지에서 멈춘다', async ({
  page,
}) => {
  const errors = collectErrors(page)
  const requested = recordRequestedPages(page)

  const response = await page.goto('/articles')

  const html = (await response?.text()) ?? ''
  expect(html).toContain('게시글 목록을 불러오는 중입니다.')
  expect(html).not.toContain('릴리스 노트 46호')
  const status = page.getByRole('status')
  await expect(status).toHaveText('게시글 10개를 불러왔습니다.')
  await expect(articles(page)).toHaveCount(10)
  await expect(articles(page).first()).toContainText('릴리스 노트 46호')

  for (const loaded of [20, 30, 40, 46]) {
    await scrollToBottom(page)
    await expect(status).toHaveText(`게시글 ${String(loaded)}개를 불러왔습니다.`)
    await expect(articles(page)).toHaveCount(loaded)
  }
  // 다섯째 페이지(6개)가 마지막이지만, 다음 페이지가 비어 있는 것을 받아 봐야 끝을 안다.
  await scrollToBottom(page)
  await expect(status).toHaveText('게시글 46개를 모두 불러왔습니다.')
  await expect(articles(page).last()).toContainText('릴리스 노트 1호')
  await expect(page.getByRole('button', { name: '더 보기' })).toHaveCount(0)

  // 끝에 닿은 뒤에는 더 스크롤해도 요청하지 않는다. 페이지마다 한 번씩만 요청했다.
  await scrollToBottom(page)
  await expect(articles(page)).toHaveCount(46)
  expect(requested).toEqual(['1', '2', '3', '4', '5', '6'])
  expect(errors).toEqual([])
})

test('스크롤하지 않는 키보드 사용자는 더 보기 버튼으로 다음 페이지를 불러오고, 새로 불러온 첫 게시글부터 이어서 읽는다', async ({
  page,
}) => {
  const requested = recordRequestedPages(page)
  await page.goto('/articles')
  const status = page.getByRole('status')
  await expect(status).toHaveText('게시글 10개를 불러왔습니다.')
  const loadMore = page.getByRole('button', { name: '더 보기' })

  // 버튼에 포커스가 가면 브라우저가 버튼을 화면에 보이도록 스크롤하지만, 버튼에 온 사용자가 직접 불러오도록 기다린다.
  await tabTo(page, loadMore)
  await expect(status).toHaveText('게시글 10개를 불러왔습니다.')
  await page.keyboard.press('Enter')

  await expect(status).toHaveText('게시글 20개를 불러왔습니다.')
  await expect(articleItem(page, '개발 블로그 36호')).toBeFocused()

  // 새 게시글을 읽은 뒤 Tab으로 다시 버튼에 가서 다음 페이지를 불러온다.
  await tabTo(page, loadMore)
  await page.keyboard.press('Enter')

  await expect(status).toHaveText('게시글 30개를 불러왔습니다.')
  await expect(articleItem(page, '운영 공지 26호')).toBeFocused()
  expect(requested).toEqual(['1', '2', '3'])
})

test('번호형 페이지네이션은 같은 게시글을 쪽 번호와 이전·다음으로 넘겨 보여 준다', async ({ page }) => {
  const errors = collectErrors(page)
  const requested = recordRequestedPages(page)

  const response = await page.goto('/articles/pagination')

  expect((await response?.text()) ?? '').toContain('게시글 목록을 불러오는 중입니다.')
  const status = page.getByRole('status')
  await expect(status).toHaveText('게시글 46개 중 1–10번째')
  await expect(articles(page).first()).toContainText('릴리스 노트 46호')
  const pages = page.getByRole('navigation', { name: '게시글 목록 페이지' })
  await expect(pages.getByRole('button', { name: '1 쪽' })).toHaveAttribute('aria-current', 'page')

  await pages.getByRole('button', { name: '3 쪽' }).click()

  // 무한 스크롤 목록의 21~30번째와 같은 게시글이다.
  await expect(status).toHaveText('게시글 46개 중 21–30번째')
  await expect(articles(page).first()).toContainText('운영 공지 26호')
  await expect(pages.getByRole('button', { name: '3 쪽' })).toHaveAttribute('aria-current', 'page')

  await pages.getByRole('button', { name: '다음' }).click()
  await expect(status).toHaveText('게시글 46개 중 31–40번째')
  await pages.getByRole('button', { name: '5 쪽' }).click()
  await expect(status).toHaveText('게시글 46개 중 41–46번째')
  await expect(articles(page)).toHaveCount(6)
  await expect(pages.getByRole('button', { name: '다음' })).toBeDisabled()
  expect(requested).toEqual(['1', '3', '4', '5'])

  // 보기 방식 링크로 같은 게시글의 무한 스크롤 목록으로 간다.
  await page.getByRole('navigation', { name: '게시글 보기 방식' }).getByRole('link', { name: '무한 스크롤' }).click()
  await expect(page).toHaveURL(/\/articles$/)
  await expect(status).toHaveText('게시글 10개를 불러왔습니다.')
  expect(errors).toEqual([])
})

// 운영체제가 다크 모드이면 다크 테마를 더하는 Recipe(dark-mode)와 함께 켠 Starter는 다크 테마로 연다. 그런 Recipe가 없으면
// 두 경우 모두 Base의 테마다.
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`운영체제가 ${colorScheme} 모드이면`, () => {
    test.use({ colorScheme })

    test('무한 스크롤과 번호형 페이지네이션 페이지에 WCAG 2.2 AA 접근성 위반이 없다', async ({ page }) => {
      await page.goto('/articles')
      await expect(page.getByRole('heading', { level: 1, name: '게시글' })).toBeVisible()
      await expect(page.getByRole('status')).toHaveText('게시글 10개를 불러왔습니다.')
      expect((await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()).violations).toEqual([])

      await page.goto('/articles/pagination')
      await expect(page.getByRole('status')).toHaveText('게시글 46개 중 1–10번째')
      expect((await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()).violations).toEqual([])
    })
  })
}
