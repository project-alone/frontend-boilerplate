import type { MetadataRoute } from 'next'
import { siteUrl } from '@/shared/seo/site'

// seo Recipe: /robots.txt. 빌드할 때 한 번 만들어 둔다(Rendering Mode static-export에서도).
export const dynamic = 'force-static'

/** 모든 검색 엔진에 사이트 전체를 열고 sitemap의 주소를 알린다. 막을 경로가 생기면 rules에 disallow를 더한다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: new URL('/sitemap.xml', siteUrl()).href,
  }
}
