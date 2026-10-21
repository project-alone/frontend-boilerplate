// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/extensions.json, recipes/i18n/extensions.json, archetypes/commerce/extensions.json

import { authSitemapRules } from '@/shared/auth/access-rules'
import { i18nSitemapRules } from '@/shared/i18n/routing'
import { shopSitemapRules } from '@/shared/shop/shop-routes'

// Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 만든 파일이다. 이제는 이 프로젝트의 코드이므로 직접 고친다.
// sitemap(src/app/sitemap.ts)과 robots.txt(src/app/robots.ts)가 따르는 규칙. 페이지를 더한 Recipe가 자기 페이지를 어떻게
// 알릴지 정한다(예: 로그인해야 들어가는 페이지는 검색 엔진에 알리지 않고, locale을 받는 페이지는 locale마다 알린다).
// 규칙은 모두 합쳐 쓰므로 순서는 결과를 바꾸지 않는다.
export interface SitemapRules {
  /** sitemap에 넣지 않을 주소. 그 아래 주소도 뺀다(`/`는 홈만 뺀다). robots.txt는 막지 않으므로, 검색 결과에서 빼려면 페이지의 metadata에 robots: { index: false }를 적는다. */
  exclude?: readonly string[]
  /** robots.txt가 검색 엔진에 막을 주소. 그 아래 주소도 막고, sitemap에도 넣지 않는다. */
  disallow?: readonly string[]
  /**
   * locale을 값으로 받는 동적 세그먼트의 이름(`[locale]`이면 locale)과 그 값. 그 아래 페이지를 locale마다 넣고 서로를 언어별 주소(hreflang)로
   * 알린다. defaultValue가 있으면 그 값의 주소를 지원하지 않는 언어의 사용자에게 보일 주소(hreflang="x-default")로도 알린다.
   */
  locales?: { param: string; values: readonly string[]; defaultValue?: string }
}

export const sitemapRules: readonly SitemapRules[] = [authSitemapRules, shopSitemapRules, i18nSitemapRules]
