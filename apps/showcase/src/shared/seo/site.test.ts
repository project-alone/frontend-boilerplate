// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/shared/seo/site.test.ts

import { afterEach, expect, test, vi } from 'vitest'
import { siteUrl } from './site'

afterEach(() => {
  vi.unstubAllEnvs()
})

test('사이트 주소는 NEXT_PUBLIC_SITE_URL이다', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.com')

  expect(siteUrl().href).toBe('https://www.example.com/')
})

test('사이트 주소가 없으면 무엇을 넣어야 하는지 알리며 실패한다', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
  vi.stubEnv('API_MOCKING', 'disabled')

  expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL 환경 변수가 없습니다/)
})

test('배포하지 않는 목 빌드(API_MOCKING=enabled)에서는 사이트 주소가 없으면 개발 서버의 주소를 쓴다', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
  vi.stubEnv('API_MOCKING', 'enabled')

  expect(siteUrl().href).toBe('http://localhost:3000/')
})

test('http(s) 주소가 아니면 실패한다', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'www.example.com')

  expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/)
})
