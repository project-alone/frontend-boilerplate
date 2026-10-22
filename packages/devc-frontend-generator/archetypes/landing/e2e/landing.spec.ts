import AxeBuilder from '@axe-core/playwright'
import { type APIRequestContext, expect, type Page, test } from '@playwright/test'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { MOCK_LANDING_PAGES } from '@/shared/mocks/landing'

// 랜딩 Archetype: 빌드할 때 locale마다 미리 렌더링한 랜딩 페이지(/ko/landing, /en/landing)의 주요 섹션, 언어 전환, 언어별
// 메타데이터와 공유 이미지, sitemap을 빌드한 앱에서 확인한다. E2E는 목 빌드(API_MOCKING=enabled)로 돌므로 콘텐츠는 목 백엔드
// (src/shared/mocks/landing.ts)의 값이다. Rendering Mode server와 static-export에서 같은 spec이 돈다.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const LOCALES = [
  { locale: 'ko', path: '/ko/landing', ogLocale: 'ko_KR', language: '언어', otherLanguage: 'English' },
  { locale: 'en', path: '/en/landing', ogLocale: 'en_US', language: 'Language', otherLanguage: '한국어' },
] as const

// 같은 랜딩 페이지의 locale별 주소. x-default는 기본 locale(ko)의 주소다.
const ALTERNATES = { ko: '/ko/landing', en: '/en/landing', 'x-default': '/ko/landing' }

/**
 * 메타데이터와 sitemap이 알린 절대 주소의 경로(쿼리 포함). 목 빌드의 사이트 주소는 개발 서버의 주소(seo Recipe의
 * LOCAL_SITE_URL)라 경로만 비교한다. 절대 주소가 아니면 실패한다.
 */
function pathOf(url: string | null | undefined): string {
  expect(url, '알린 주소는 사이트 주소로 시작하는 절대 주소여야 한다').toMatch(/^https?:\/\//)
  const { pathname, search } = new URL(url ?? '')
  return `${pathname}${search}`
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

/** 띄운 앱에서 이미지를 받아 1200×630 PNG인지 본다. */
async function expectPngImage(request: APIRequestContext, path: string) {
  const response = await request.get(path)
  expect(response.status(), path).toBe(200)
  expect(response.headers()['content-type'], path).toBe('image/png')
  const body = await response.body()
  expect([...body.subarray(0, 8)]).toEqual(PNG_SIGNATURE)
  expect({ width: body.readUInt32BE(16), height: body.readUInt32BE(20) }).toEqual({ width: 1200, height: 630 })
}

for (const { locale, path, ogLocale } of LOCALES) {
  const content = MOCK_LANDING_PAGES[locale]

  test(`${path}는 콘텐츠 API의 ${locale} 문구로 히어로, 주요 기능, 고객 후기, 자주 묻는 질문을 보여 준다`, async ({
    page,
  }) => {
    // 콘텐츠는 빌드할 때 HTML에 담겼으므로 브라우저는 콘텐츠 API를 부르지 않는다.
    const contentRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/landing-pages/')) contentRequests.push(request.url())
    })
    await page.goto(path)

    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await expect(page.getByRole('heading', { level: 1, name: content.hero.heading })).toBeVisible()
    await expect(page.getByText(content.hero.body)).toBeVisible()

    const features = page.getByRole('region', { name: content.features.heading })
    for (const feature of content.features.items) {
      await expect(features.getByRole('heading', { level: 3, name: feature.title })).toBeVisible()
    }
    const testimonials = page.getByRole('region', { name: content.testimonials.heading })
    for (const testimonial of content.testimonials.items) {
      await expect(testimonials.getByText(testimonial.quote)).toBeVisible()
      await expect(testimonials.getByText(`${testimonial.author}, ${testimonial.role}`)).toBeVisible()
    }
    const faqs = page.getByRole('region', { name: content.faqs.heading })
    for (const faq of content.faqs.items) await expect(faqs.getByText(faq.question)).toBeVisible()

    // 히어로의 링크는 주요 기능 섹션으로 옮겨 간다.
    await page.getByRole('link', { name: content.hero.callToAction.label }).click()
    await expect(page).toHaveURL(new RegExp(`${path}#features$`))
    await expect(features).toBeInViewport()
    expect(contentRequests).toEqual([])
  })

  test(`${path}는 빌드할 때 렌더링한 HTML에 모든 섹션의 문구를 담는다(자바스크립트 없이 읽힌다)`, async ({
    request,
  }) => {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const html = await response.text()

    expect(html).toContain(`<div lang="${locale}">`)
    for (const text of [
      content.hero.heading,
      ...content.features.items.map((feature) => feature.title),
      ...content.testimonials.items.map((testimonial) => testimonial.quote),
      // 접힌 답도 HTML에 있어 검색 엔진이 읽는다.
      ...content.faqs.items.map((faq) => faq.answer),
    ]) {
      expect(html).toContain(text)
    }
  })

  test(`${path}는 ${locale}의 제목·설명, 자기 주소, locale별 주소와 x-default, og:locale, 자기 공유 이미지를 알린다`, async ({
    page,
    request,
  }) => {
    await page.goto(path)

    await expect(page).toHaveTitle(`${content.title} | Starter`)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', content.description)
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', `${content.title} | Starter`)
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', content.description)
    expect(pathOf(await page.locator('link[rel="canonical"]').getAttribute('href'))).toBe(path)
    expect(pathOf(await page.locator('meta[property="og:url"]').getAttribute('content'))).toBe(path)
    for (const [hreflang, alternate] of Object.entries(ALTERNATES)) {
      const link = page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`)
      expect(pathOf(await link.getAttribute('href')), hreflang).toBe(alternate)
    }
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', ogLocale)

    // 공유 이미지는 이 페이지 폴더의 og-image.png(Route Handler)가 locale마다 만든 것이고, Twitter 카드도 같은 이미지를 쓴다.
    const ogImage = page.locator('meta[property="og:image"]')
    await expect(ogImage).toHaveCount(1)
    const ogImagePath = pathOf(await ogImage.getAttribute('content'))
    expect(ogImagePath).toBe(`${path}/og-image.png`)
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', content.title)
    expect(pathOf(await page.locator('meta[name="twitter:image"]').getAttribute('content'))).toBe(ogImagePath)
    await expectPngImage(request, ogImagePath)
  })
}

test('언어 전환 UI로 다른 언어를 고르면 같은 랜딩 페이지의 그 언어 주소로 가고 그 언어의 콘텐츠를 보여 준다', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await page.goto('/ko/landing')

  for (const { locale, path, language, otherLanguage } of LOCALES) {
    const other = LOCALES.find((entry) => entry.locale !== locale)
    if (other === undefined) throw new Error('다른 locale이 없습니다.')
    await expect(page).toHaveURL(new RegExp(`${path}$`))

    await page.getByRole('combobox', { name: language }).click()
    await page.getByRole('option', { name: otherLanguage }).click()

    await expect(page).toHaveURL(new RegExp(`${other.path}$`))
    const content = MOCK_LANDING_PAGES[other.locale]
    await expect(page.getByRole('heading', { level: 1, name: content.hero.heading })).toBeVisible()
    await expect(page.getByRole('region', { name: content.faqs.heading })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', other.locale)
    await expect(page).toHaveTitle(`${content.title} | Starter`)
  }
  expect(errors).toEqual([])
})

test('머리글의 랜딩 링크는 지금 locale의 랜딩 페이지로 간다', async ({ page }) => {
  await page.goto('/en')
  await page.getByRole('navigation', { name: 'Landing' }).getByRole('link', { name: 'Landing' }).click()
  await expect(page).toHaveURL(/\/en\/landing$/)

  await page.goto('/ko')
  await page.getByRole('navigation', { name: '랜딩' }).getByRole('link', { name: '랜딩' }).click()
  await expect(page).toHaveURL(/\/ko\/landing$/)
  await expect(page.getByRole('heading', { level: 1, name: MOCK_LANDING_PAGES.ko.hero.heading })).toBeVisible()
})

test('sitemap.xml은 랜딩 페이지를 locale마다 알리고, 서로를 언어별 주소로 묶는다', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()

  for (const { path } of LOCALES) {
    const entry = new RegExp(`<url>\\s*<loc>[^<]*${path}</loc>([\\s\\S]*?)</url>`).exec(xml)?.[1]
    expect(entry, `${path}가 sitemap.xml에 없습니다`).toBeDefined()
    const languages: Record<string, string> = {}
    for (const [, hreflang = '', href] of (entry ?? '').matchAll(
      /<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g,
    )) {
      languages[hreflang] = pathOf(href)
    }
    expect(languages).toEqual(ALTERNATES)
  }
})

test('지원하지 않는 locale의 랜딩 페이지와 공유 이미지는 찾을 수 없다', async ({ request }) => {
  expect((await request.get('/fr/landing')).status()).toBe(404)
  expect((await request.get('/fr/landing/og-image.png')).status()).toBe(404)
})

for (const { locale, path } of LOCALES) {
  test(`${path}에 자주 묻는 질문을 펼친 상태까지 WCAG 2.2 AA 접근성 위반과 페이지 오류가 없다`, async ({ page }) => {
    const [firstFaq] = MOCK_LANDING_PAGES[locale].faqs.items
    if (firstFaq === undefined) throw new Error('자주 묻는 질문이 없습니다.')
    const errors = collectErrors(page)
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)

    const axe = () => new AxeBuilder({ page }).withTags(WCAG_22_AA_TAGS).analyze()
    expect((await axe()).violations).toEqual([])

    // 질문은 키보드로 펼친다.
    await page.getByText(firstFaq.question).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(firstFaq.answer)).toBeVisible()
    expect((await axe()).violations).toEqual([])
    expect(errors).toEqual([])
  })
}
