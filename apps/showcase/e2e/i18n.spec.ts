// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/e2e/i18n.spec.ts

import AxeBuilder from '@axe-core/playwright'
import { existsSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

// i18n Recipe: 빌드한 앱에서 locale이 붙은 주소, locale 전환 UI, 번역하지 않은 페이지, 홈(/)에서 locale을 고르는 것을 확인한다.
// 홈(/)에서 locale을 고르는 proxy(src/proxy.ts)는 요청을 받는 서버가 있는 server Starter에만 있다.
const HAS_PROXY = existsSync('src/proxy.ts')

async function chooseLocale(page: Page, label: string, name: string) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name }).click()
}

// 페이지에서 난 오류(예: hydration 불일치)를 모은다.
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

test('locale이 붙은 주소는 그 locale로 번역한 페이지를 보여 주고, 문서의 언어를 그 locale로 알린다', async ({
  page,
}) => {
  await page.goto('/ko')
  await expect(page.getByRole('heading', { level: 1, name: 'Starter' })).toBeVisible()
  await expect(page.getByText('이 Starter는 한국어와 영어를 지원합니다.', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: '다국어 예시 보기' })).toHaveAttribute('href', '/ko/i18n')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')

  await page.goto('/en')
  await expect(page.getByText('This Starter supports Korean and English.', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: 'See the internationalization example' })).toHaveAttribute(
    'href',
    '/en/i18n',
  )
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('서버 컴포넌트는 같은 메시지를 locale마다 다른 문장과 날짜·통화 형식으로 빌드할 때 번역한다', async ({
  request,
}) => {
  const ko = await (await request.get('/ko/i18n')).text()
  // 루트 레이아웃이 제목 뒤에 사이트 이름을 붙이는 Recipe(seo의 `%s | Starter`)와 함께 넣어도 페이지의 제목으로 시작한다.
  expect(ko).toMatch(/<title>다국어 예시(?: \| [^<]+)?<\/title>/)
  expect(ko).toContain('<div lang="ko">')
  expect(ko).toContain('출시일: 2026년 3월 2일 월요일')
  expect(ko).toContain('가격: ₩19,000')

  const en = await (await request.get('/en/i18n')).text()
  expect(en).toMatch(/<title>Internationalization example(?: \| [^<]+)?<\/title>/)
  expect(en).toContain('<div lang="en">')
  expect(en).toContain('Released: Monday, March 2, 2026')
  expect(en).toContain('Price: ₩19,000')
})

test('locale 전환 UI로 영어를 고르면 같은 페이지의 영어 주소로 가고, 클라이언트 컴포넌트도 영어로 그린다', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await page.goto('/ko/i18n')
  await expect(page.getByRole('status')).toHaveText('장바구니에 담은 상품이 없습니다.')

  await chooseLocale(page, '언어', 'English')

  await expect(page).toHaveURL(/\/en\/i18n$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Internationalization example' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Language' })).toHaveText('English')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByRole('button', { name: 'Add item' }).click()
  await expect(page.getByRole('status')).toHaveText('1 item in your cart.')
  expect(errors).toEqual([])
})

test('번역한 페이지의 링크는 지금 locale의 주소로 간다', async ({ page }) => {
  await page.goto('/en/i18n')

  await page.getByRole('link', { name: 'Home' }).click()

  await expect(page).toHaveURL(/\/en$/)
  await expect(page.getByText('This Starter supports Korean and English.', { exact: false })).toBeVisible()
})

test('번역한 페이지는 자기 주소를 canonical로, 같은 페이지의 locale별 주소를 hreflang으로 검색 엔진에 알린다', async ({
  page,
}) => {
  // 주소는 사이트 주소(metadataBase)가 있으면 절대 주소, 없으면 경로다. 어느 쪽이든 경로만 비교한다.
  const pathOf = (href: string | null) => new URL(href ?? '', page.url()).pathname

  for (const [path, alternates] of [
    ['/en', { ko: '/ko', en: '/en' }],
    ['/ko/i18n', { ko: '/ko/i18n', en: '/en/i18n' }],
  ] as const) {
    await page.goto(path)

    expect(pathOf(await page.locator('link[rel="canonical"]').getAttribute('href'))).toBe(path)
    for (const [locale, alternate] of Object.entries(alternates)) {
      const link = page.locator(`link[rel="alternate"][hreflang="${locale}"]`)
      expect(pathOf(await link.getAttribute('href')), `${path}의 ${locale}`).toBe(alternate)
    }
  }
})

test('번역하지 않은 페이지는 주소 그대로 열리고, 거기서 다른 locale을 고르면 그 locale의 홈으로 간다', async ({
  page,
}) => {
  // Base의 상품 페이지는 [locale] 밖에 있어 번역하지 않았다. 기본 locale(ko)의 화면으로 보고 전환 UI도 한국어로 보인다.
  // static-export에서는 브라우저의 MSW가 뜬 뒤에 이 주소를 새로 열면 샘플 API의 목(*/products)이 페이지 요청까지 받으므로
  // MSW가 뜨기 전에 먼저 연다.
  await page.goto('/products')
  await expect(page.getByRole('heading', { level: 1, name: '상품' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  await chooseLocale(page, '언어', 'English')

  await expect(page).toHaveURL(/\/en$/)
  await expect(page.getByText('This Starter supports Korean and English.', { exact: false })).toBeVisible()
})

test('지원하지 않는 locale의 주소는 찾을 수 없다', async ({ request }) => {
  expect((await request.get('/fr')).status()).toBe(404)
  expect((await request.get('/fr/i18n')).status()).toBe(404)
})

test.describe('proxy가 있는 server Starter의 홈(/)', () => {
  test.skip(!HAS_PROXY, 'static-export Starter에는 요청을 받는 서버가 없어 홈(/)에서 locale을 고르지 않는다')

  test.describe('브라우저 언어가 영어이면', () => {
    test.use({ locale: 'en-US' })

    test('영어 홈으로 가고, 한국어를 고른 뒤에는 저장한 한국어 홈으로 간다', async ({ page }) => {
      await page.goto('/')
      await expect(page).toHaveURL(/\/en$/)

      await chooseLocale(page, 'Language', '한국어')
      await expect(page).toHaveURL(/\/ko$/)
      await page.goto('/')

      await expect(page).toHaveURL(/\/ko$/)
    })
  })

  test.describe('브라우저 언어를 지원하지 않으면', () => {
    test.use({ locale: 'ja-JP' })

    test('기본 locale(ko)의 홈으로 간다', async ({ page }) => {
      await page.goto('/')

      await expect(page).toHaveURL(/\/ko$/)
    })
  })
})

test.describe('proxy가 없는 static-export Starter의 홈(/)', () => {
  test.skip(HAS_PROXY, 'server Starter에서는 proxy가 홈(/)을 고른 locale의 홈으로 보낸다')

  test('기본 locale(ko)의 홈을 보여 준다', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('이 Starter는 한국어와 영어를 지원합니다.', { exact: false })).toBeVisible()
    await expect(page.getByRole('link', { name: '다국어 예시 보기' })).toHaveAttribute('href', '/ko/i18n')
  })
})

for (const path of ['/ko', '/en', '/ko/i18n', '/en/i18n']) {
  test(`${path}에 WCAG 2.2 AA 접근성 위반과 페이지 오류가 없다`, async ({ page }) => {
    const errors = collectErrors(page)
    const response = await page.goto(path)

    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', path.slice(1, 3))
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
    expect(violations).toEqual([])
    expect(errors).toEqual([])
  })
}

// 서버가 그린 HTML에서도 locale 전환 UI(머리글)의 선택 버튼이 이름(레이블)을 갖는지 본다. 앱의 스크립트를 막아 hydration 전의
// 화면, 곧 페이지를 연 직후에 보조 기술이 읽는 화면을 검사한다.
for (const { path, label } of [
  { path: '/ko', label: '언어' },
  { path: '/en', label: 'Language' },
]) {
  test(`${path}의 locale 전환 UI는 JavaScript가 실행되기 전에도 이름이 있고 머리글에 접근성 위반이 없다`, async ({
    page,
  }) => {
    await page.route('**/*', (route) =>
      route.request().resourceType() === 'script' ? route.abort() : route.continue(),
    )

    await page.goto(path)

    await expect(page.getByRole('combobox', { name: label })).toBeVisible()
    const { violations } = await new AxeBuilder({ page }).include('header').withTags(WCAG_22_AA_TAGS).analyze()
    expect(violations).toEqual([])
  })
}
