import AxeBuilder from '@axe-core/playwright'
import { existsSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

// 하네스(harness/app-boundaries.test.ts)가 Starter에 둔 탐침으로, 라우트에 경계가 없는 페이지와 루트 레이아웃에서 난 오류를
// Base의 앱 수준 화면(src/app/error.tsx, global-error.tsx, not-found.tsx)이 받는지 빌드한 앱에서 본다. 서버에서 렌더링하는
// 탐침(서버 오류, notFound())은 요청을 받는 서버가 있는 server Starter에만 둔다.
const HAS_SERVER_PROBES = existsSync('src/app/harness-server-error/page.tsx')

const APP_ERROR_HEADING = '문제가 생겼습니다'
const APP_ERROR_MESSAGE = '페이지를 불러오지 못했습니다.'

async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
  expect(violations).toEqual([])
}

/** 앱 수준의 오류 화면. Next.js의 경로 안내(route announcer)도 role="alert"이므로 문구로 고른다. */
async function expectAppError(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: APP_ERROR_HEADING })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: APP_ERROR_MESSAGE })).toBeVisible()
}

test('페이지를 그리다 오류가 나면 루트 레이아웃은 그대로 둔 채 앱 수준의 오류 화면을 보이고, 다시 시도하면 페이지를 다시 그린다', async ({
  page,
}) => {
  await page.goto('/harness-page-error')
  await page.getByRole('button', { name: '페이지 오류 내기' }).click()

  await expectAppError(page)
  // 오류 화면은 루트 레이아웃 안에서 페이지 자리에만 그려지므로 레이아웃의 요소(탐침의 버튼)는 남는다.
  await expect(page.getByRole('button', { name: '레이아웃 오류 내기' })).toBeVisible()
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: '다시 시도' }).click()

  await expect(page.getByRole('heading', { level: 1, name: '페이지 오류 탐침' })).toBeVisible()
})

test('루트 레이아웃에서 오류가 나면 global-error가 문서 전체를 대신해 오류 화면을 그리고, 다시 시도하면 앱을 다시 그린다', async ({
  page,
}) => {
  await page.goto('/harness-page-error')
  await page.getByRole('button', { name: '레이아웃 오류 내기' }).click()

  await expectAppError(page)
  // 루트 레이아웃 대신 그리므로 레이아웃의 요소는 없고, 문서의 언어와 제목은 global-error가 정한다.
  await expect(page.getByRole('button', { name: '레이아웃 오류 내기' })).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  await expect(page).toHaveTitle(APP_ERROR_HEADING)
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: '다시 시도' }).click()

  await expect(page.getByRole('heading', { level: 1, name: '페이지 오류 탐침' })).toBeVisible()
  await expect(page.getByRole('button', { name: '레이아웃 오류 내기' })).toBeVisible()
})

// 응답의 상태 코드는 응답을 보내기 시작할 때 정해진다. 앱 수준의 loading.tsx가 있으면 모든 라우트가 그 로딩 상태를 먼저 보내므로
// 아래 오류와 notFound()가 200으로 나간다. Base가 앱 수준의 loading.tsx를 두지 않는 이유다(README의 "오류·404 화면").
test.describe('요청마다 서버에서 렌더링하는 페이지', () => {
  test.skip(!HAS_SERVER_PROBES, 'static-export Starter는 서버 컴포넌트를 빌드할 때만 렌더링한다')

  test('서버에서 렌더링하다 오류가 나면 상태 코드 500과 앱 수준의 오류 화면을 보내고, 다시 시도하면 서버에서 다시 렌더링한다', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: 'harness-fail', value: '1', url: baseURL ?? '' }])
    const response = await page.goto('/harness-server-error')

    expect(response?.status()).toBe(500)
    await expectAppError(page)
    await expectNoAxeViolations(page)

    await context.clearCookies()
    await page.getByRole('button', { name: '다시 시도' }).click()

    await expect(page.getByRole('heading', { level: 1, name: '서버 오류 탐침' })).toBeVisible()
  })

  test('페이지가 데이터를 기다린 뒤 notFound()를 부르면 상태 코드 404와 앱 수준의 404 화면을 보낸다', async ({
    page,
  }) => {
    const response = await page.goto('/harness-not-found')

    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1, name: '찾는 화면이 없습니다' })).toBeVisible()
    // 라우트 안에서 부른 notFound()의 문서 제목은 404 화면의 metadata가 아니라 그 라우트의 metadata를 따른다.
    await expectNoAxeViolations(page)
  })
})
