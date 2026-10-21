import { afterEach, expect, test, vi } from 'vitest'
import { siteMetadata } from './metadata'

afterEach(() => {
  vi.unstubAllEnvs()
})

// 페이지마다 풀린 canonical·og:url·공유 이미지의 주소는 빌드한 앱에서 e2e/seo.spec.ts가 본다.
test('모든 페이지의 상대 주소(canonical, og:url, 공유 이미지)는 사이트 주소를 기준으로 절대 주소가 된다', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.com')

  expect(String(siteMetadata().metadataBase)).toBe('https://www.example.com/')
})
