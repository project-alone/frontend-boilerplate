import type { MetadataRoute } from 'next'
import { siteUrl } from '@/shared/seo/site'
import { sitemapRules } from './sitemap-rules'

// seo Recipe: /robots.txt. 빌드할 때 한 번 만들어 둔다(Rendering Mode static-export에서도).
export const dynamic = 'force-static'

/**
 * 모든 검색 엔진에 사이트를 열고 sitemap의 주소를 알린다. Recipe가 sitemap 규칙(sitemap-rules.ts)으로 막은 주소(auth Recipe의
 * 보호된 라우트 등)는 막는다. 이 프로젝트에서 막을 주소가 생기면 disallow에 더한다.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = sitemapRules.flatMap((rules) => rules.disallow ?? [])
  return {
    rules: { userAgent: '*', allow: '/', ...(disallow.length === 0 ? {} : { disallow }) },
    sitemap: new URL('/sitemap.xml', siteUrl()).href,
  }
}
