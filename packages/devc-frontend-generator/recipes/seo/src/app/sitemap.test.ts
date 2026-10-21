import { afterEach, beforeEach, expect, test, vi } from 'vitest'
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
