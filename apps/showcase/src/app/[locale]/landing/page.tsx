// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/landing/src/app/[locale]/landing/page.tsx

import type { Metadata, ResolvingMetadata } from 'next'
import { Landing } from '@/features/landing/landing'
import { loadLandingPage } from '@/features/landing/landing-content'
import { localeAlternates } from '@/shared/i18n/locale-alternates'
import { type LocaleRouteProps, requireLocale } from '@/shared/i18n/require-locale'
import { ogImageMetadata } from '@/shared/seo/og-image'

// 랜딩 Archetype: 마케팅 랜딩 페이지(/ko/landing, /en/landing). i18n Recipe의 [locale] 레이아웃이 locale마다 경로를 정하므로
// (generateStaticParams) 빌드할 때 locale마다 콘텐츠 API를 불러 미리 렌더링한다(SSG). 배포용 빌드에는 API_BASE_URL(백엔드
// 주소)을 넣고, API_MOCKING=enabled로 만든 목 빌드(GitLab CI의 build 잡, E2E)는 목 응답으로 렌더링하므로 배포하지 않는다
// (README의 "실행과 배포").

// SSG: 'error'는 이 라우트가 요청마다 달라지는 값(cookies(), headers(), searchParams 등)을 읽으면 SSR로 바뀌는 대신 빌드를
// 실패시켜 SSG임을 지킨다.
export const dynamic = 'error'

// 검색 결과와 공유 카드의 제목·설명도 콘텐츠 API의 locale별 문구다. 같은 페이지의 locale별 주소(hreflang)와 x-default를 알리고,
// og:locale은 [locale] 레이아웃이 알린다. 공유 이미지는 이 폴더의 og-image.png(Route Handler)가 locale마다 그린 것이다.
export async function generateMetadata(props: LocaleRouteProps, parent: ResolvingMetadata): Promise<Metadata> {
  const locale = await requireLocale(props)
  const { title, description } = await loadLandingPage(locale)
  // 이미지의 크기와 형식은 seo Recipe의 공유 이미지와 같다.
  const images = ogImageMetadata(title).map(({ alt, size, contentType }) => ({
    url: `/${locale}/landing/og-image.png`,
    alt,
    ...size,
    type: contentType,
  }))

  return {
    title,
    description,
    alternates: localeAlternates('/landing'),
    // Next.js는 openGraph를 통째로 덮어쓰므로, 위 레이아웃이 정한 OpenGraph(seo Recipe의 og:url·사이트 이름, [locale] 레이아웃의
    // og:locale)는 그대로 두고 공유 이미지만 바꾼다. 위 레이아웃의 값은 Next.js가 풀어 둔 값이라 타입만 맞춘다(i18n Recipe의
    // localeOpenGraph와 같다). Twitter 카드의 이미지는 Next.js가 이 공유 이미지로 채운다.
    openGraph: { ...((await parent).openGraph as Metadata['openGraph']), images },
  }
}

export default async function LandingPage(props: LocaleRouteProps) {
  return <Landing content={await loadLandingPage(await requireLocale(props))} />
}
