// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/app/sitemap.test.ts

import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import sitemap from './sitemap'
import { sitemapRules } from './sitemap-rules'

// 함께 넣은 Recipe가 sitemap 규칙(sitemap-rules.ts)으로 뺀 주소와 robots.txt가 막는 주소
const EXCLUDED = sitemapRules.flatMap(({ exclude = [], disallow = [] }) => [...exclude, ...disallow])
const isExcluded = (path: string) => EXCLUDED.some((excluded) => path === excluded || path.startsWith(`${excluded}/`))

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.com')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test('sitemap은 이 Starter의 페이지(홈, 샘플 /products 등)를 사이트 주소의 절대 주소로 알린다', () => {
  const urls = sitemap().map(({ url }) => url)

  const pages = ['/', '/products'].filter((path) => !isExcluded(path))
  expect(urls).toEqual(expect.arrayContaining(pages.map((path) => `https://www.example.com${path}`)))
  for (const url of urls) expect(url).toMatch(/^https:\/\/www\.example\.com\/[^[\]]*$/)
})

test('함께 넣은 Recipe가 sitemap 규칙으로 뺀 주소와 robots.txt가 막는 주소(와 그 아래 주소)는 넣지 않는다', () => {
  const paths = sitemap().map(({ url }) => new URL(url).pathname)

  expect(paths.filter(isExcluded)).toEqual([])
})

test('locale마다 넣은 페이지는 같은 페이지의 locale별 주소(자기 주소 포함)를 서로 알린다', () => {
  const entries = sitemap()
  const byUrl = new Map(entries.map((entry) => [entry.url, entry]))

  for (const { url, alternates } of entries) {
    const languages = Object.values(alternates?.languages ?? {})
    if (languages.length === 0) continue
    expect(languages).toContain(url)
    for (const alternate of languages) expect(byUrl.get(alternate ?? '')?.alternates).toEqual(alternates)
  }
})
