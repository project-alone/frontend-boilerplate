import { afterEach, expect, test, vi } from 'vitest'
import robots from './robots'

afterEach(() => {
  vi.unstubAllEnvs()
})

test('robots.txt는 모든 검색 엔진에 사이트를 열고 sitemap의 주소를 알린다', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.com')

  expect(robots()).toEqual({
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://www.example.com/sitemap.xml',
  })
})
