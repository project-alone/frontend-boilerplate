import type { MetadataRoute } from 'next'
import { join } from 'node:path'
import { findPageRoutes } from '@/shared/seo/page-routes'
import { siteUrl } from '@/shared/seo/site'

// seo Recipe: /sitemap.xml. 빌드할 때 한 번 만들어 두므로(Rendering Mode static-export에서도) 요청마다 다시 만들지 않는다.
export const dynamic = 'force-static'

// sitemap에 넣지 않을 주소. 그 아래 주소도 빠진다. 검색에 노출하지 않을 페이지(로그인, 내 정보 등)를 적고, 그 페이지의
// metadata에는 robots: { index: false }를 적는다.
const EXCLUDED_ROUTES: readonly string[] = []

/**
 * src/app의 페이지를 빌드할 때 찾아 알린다(src/shared/seo/page-routes.ts). Recipe나 `npm run g -- page`가 더한 페이지도
 * 이 파일을 고치지 않고 들어간다. 동적 세그먼트가 있는 페이지(`products/[productId]`)는 빠지므로, 그런 주소는 데이터를
 * 가져와 아래 배열에 더한다(README의 "검색 노출(SEO)").
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = siteUrl()
  // 빌드한 결과에 소스 폴더가 담기지 않도록 이 경로는 번들러가 따라가지 않게 한다. 빌드할 때만 읽는다.
  const appDir = join(/* turbopackIgnore: true */ process.cwd(), 'src/app')
  return findPageRoutes(appDir, { exclude: EXCLUDED_ROUTES }).map((route) => ({ url: new URL(route, site).href }))
}
