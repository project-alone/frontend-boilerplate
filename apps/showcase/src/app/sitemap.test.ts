// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/app/sitemap.test.ts

import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import robots from './robots'
import sitemap from './sitemap'

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.com')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test('sitemap은 이 Starter의 페이지(홈, 샘플 /products 등)를 사이트 주소의 절대 주소로 알린다', () => {
  const urls = sitemap().map(({ url }) => url)

  expect(urls).toEqual(expect.arrayContaining(['https://www.example.com/', 'https://www.example.com/products']))
  for (const url of urls) expect(url).toMatch(/^https:\/\/www\.example\.com\/[^[\]]*$/)
})

test('robots.txt는 모든 검색 엔진에 사이트를 열고 sitemap의 주소를 알린다', () => {
  expect(robots()).toEqual({
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://www.example.com/sitemap.xml',
  })
})
