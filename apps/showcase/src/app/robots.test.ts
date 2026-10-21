// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/app/robots.test.ts

import { afterEach, expect, test, vi } from 'vitest'
import robots from './robots'
import { sitemapRules } from './sitemap-rules'

afterEach(() => {
  vi.unstubAllEnvs()
})

test('robots.txt는 모든 검색 엔진에 사이트를 열고, 함께 넣은 Recipe가 sitemap 규칙으로 막은 주소만 막으며 sitemap의 주소를 알린다', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.com')
  const disallow = sitemapRules.flatMap((rules) => rules.disallow ?? [])

  expect(robots()).toEqual({
    rules: { userAgent: '*', allow: '/', ...(disallow.length === 0 ? {} : { disallow }) },
    sitemap: 'https://www.example.com/sitemap.xml',
  })
})
