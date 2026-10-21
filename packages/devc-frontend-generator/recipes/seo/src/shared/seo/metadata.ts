import type { Metadata } from 'next'
import { SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, siteUrl } from './site'

/**
 * 모든 페이지가 물려받는 메타데이터의 기본값. 루트 레이아웃(src/app/layout.tsx)의 metadata다.
 *
 * - 상대 주소(OG 이미지 등)를 사이트 주소(NEXT_PUBLIC_SITE_URL)의 절대 주소로 바꾼다(metadataBase). 사이트 주소가 없는
 *   배포용 빌드는 여기서 실패한다(site.ts).
 * - 페이지의 title 뒤에 사이트 이름을 붙인다(`상품 | Starter`). 홈처럼 title이 없는 페이지는 사이트 이름이다.
 * - canonical과 og:url은 `./`이다. Next.js가 페이지마다 그 페이지의 경로로 풀어 각 페이지가 자기 주소를 알린다.
 * - og:title·og:description과 Twitter 카드의 제목·설명·이미지는 Next.js가 페이지의 title·description과 OG 이미지로 채운다.
 *   OG 이미지는 그 페이지 폴더나 가장 가까운 위 폴더의 opengraph-image.tsx다(src/app/opengraph-image.tsx가 사이트 기본).
 *
 * 그래서 페이지는 metadata에 title과 description만 적는다. Next.js는 metadata의 항목을 통째로 덮어쓰므로, 페이지가
 * openGraph·twitter·alternates를 적으면 그 항목의 기본값(og:url, OG 이미지, canonical)이 사라진다. 적어야 하면 여기의
 * 기본값을 함께 적는다(README의 "검색 노출(SEO)").
 */
export function siteMetadata(): Metadata {
  return {
    metadataBase: siteUrl(),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    alternates: { canonical: './' },
    openGraph: { type: 'website', siteName: SITE_NAME, locale: SITE_LOCALE, url: './' },
    twitter: { card: 'summary_large_image' },
  }
}
