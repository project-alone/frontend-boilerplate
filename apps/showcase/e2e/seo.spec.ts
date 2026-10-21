// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/e2e/seo.spec.ts

import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

// seo Recipe: 빌드한 앱이 검색 엔진과 공유 카드에 알리는 메타데이터, OG 이미지, sitemap.xml, robots.txt를 확인한다.
// E2E는 목 빌드(API_MOCKING=enabled)로 돌므로 사이트 주소는 개발 서버의 주소(src/shared/seo/site.ts의 LOCAL_SITE_URL)다.
// 그래서 알린 주소는 경로만 비교하고, 그 경로를 띄운 앱에서 받아 본다. Rendering Mode server와 static-export에서 같은 spec이 돈다.

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** 페이지가 알린 메타데이터. Next.js는 메타데이터를 <head>나 <body>에 둘 수 있으므로 문서 전체에서 찾는다. */
async function readMetadata(page: Page) {
  const content = (selector: string) => page.locator(selector).first().getAttribute('content')
  return {
    title: await page.title(),
    canonical: await page.locator('link[rel="canonical"]').getAttribute('href'),
    ogTitle: await content('meta[property="og:title"]'),
    ogUrl: await content('meta[property="og:url"]'),
    ogImage: await content('meta[property="og:image"]'),
    ogImageAlt: await content('meta[property="og:image:alt"]'),
    ogSiteName: await content('meta[property="og:site_name"]'),
    twitterCard: await content('meta[name="twitter:card"]'),
    twitterImage: await content('meta[name="twitter:image"]'),
  }
}

/** 절대 주소의 경로(쿼리 포함). 절대 주소가 아니면 실패한다. */
function pathOf(url: string | null): string {
  expect(url, '메타데이터의 주소는 절대 주소여야 한다').toMatch(/^https?:\/\//)
  const { pathname, search } = new URL(url ?? '')
  return `${pathname}${search}`
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

test('홈은 사이트 이름을 제목으로, 자기 주소를 canonical·og:url로 알리고 사이트의 기본 공유 이미지를 쓴다', async ({
  page,
  request,
}) => {
  await page.goto('/')

  const metadata = await readMetadata(page)
  expect(metadata.title).toBe('Starter')
  expect(pathOf(metadata.canonical)).toBe('/')
  expect(pathOf(metadata.ogUrl)).toBe('/')
  expect(metadata.ogSiteName).toBe('Starter')
  expect(metadata.ogImageAlt).toBe('Starter')
  expect(metadata.twitterCard).toBe('summary_large_image')
  expect(metadata.twitterImage).toBe(metadata.ogImage)
  // 확장자가 붙은 주소라 정적 파일 서버(static-export)도 image/png로 응답한다.
  expect(pathOf(metadata.ogImage)).toMatch(/^\/opengraph-image\/image\.png\?/)
  await expectPngImage(request, pathOf(metadata.ogImage))
})

test('페이지는 제목 뒤에 사이트 이름을 붙이고, 자기 주소와 자기 폴더의 공유 이미지(/products)를 알린다', async ({
  page,
  request,
}) => {
  await page.goto('/products')

  const metadata = await readMetadata(page)
  expect(metadata.title).toBe('상품 | Starter')
  expect(metadata.ogTitle).toBe('상품 | Starter')
  expect(pathOf(metadata.canonical)).toBe('/products')
  expect(pathOf(metadata.ogUrl)).toBe('/products')
  expect(metadata.ogImageAlt).toBe('상품')
  expect(pathOf(metadata.ogImage)).toMatch(/^\/products\/opengraph-image\/image\.png\?/)
  await expectPngImage(request, pathOf(metadata.ogImage))
})

test('sitemap.xml은 앱의 페이지를 사이트 주소로 알리고, robots.txt는 sitemap의 주소를 알린다', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  const locations = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => pathOf(url ?? null))
  expect(locations).toEqual(expect.arrayContaining(['/', '/products']))

  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  const text = await robots.text()
  expect(text).toContain('Allow: /')
  const sitemapLine = /^Sitemap: (.+)$/m.exec(text)?.[1] ?? null
  expect(pathOf(sitemapLine)).toBe('/sitemap.xml')
})
