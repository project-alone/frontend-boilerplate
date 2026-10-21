// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/shared/seo/metadata.test.ts

import { afterEach, expect, test, vi } from 'vitest'
import { siteMetadata } from './metadata'

afterEach(() => {
  vi.unstubAllEnvs()
})

test('사이트 메타데이터는 사이트 주소를 기준으로 페이지마다 자기 주소를 canonical과 og:url로 알리고, 제목 뒤에 사이트 이름을 붙인다', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://www.example.com')

  const metadata = siteMetadata()

  expect(String(metadata.metadataBase)).toBe('https://www.example.com/')
  expect(metadata.title).toEqual({ default: 'Starter', template: '%s | Starter' })
  // Next.js는 ./로 시작하는 주소를 그 페이지의 경로로 푼다(/products → https://www.example.com/products).
  expect(metadata.alternates?.canonical).toBe('./')
  expect(metadata.openGraph).toMatchObject({ url: './', siteName: 'Starter', locale: 'ko_KR', type: 'website' })
  expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' })
})

test('사이트 주소가 없는 배포용 빌드에서는 실패한다', () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
  vi.stubEnv('API_MOCKING', 'disabled')

  expect(() => siteMetadata()).toThrow(/NEXT_PUBLIC_SITE_URL/)
})
