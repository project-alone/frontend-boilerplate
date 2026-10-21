import type { Metadata, ResolvedMetadata } from 'next'
import { type Locale, routing } from './routing'

/**
 * 번역한 페이지(src/app/[locale]/ 아래)의 metadata.alternates. 같은 페이지의 locale별 주소를 검색 엔진에 알린다
 * (<link rel="alternate" hreflang>). path는 locale을 뺀 주소다(홈은 '/', /ko/i18n은 '/i18n'). 지원하지 않는 언어의 사용자에게
 * 보일 주소(hreflang="x-default")는 기본 locale의 주소다.
 *
 * Next.js는 레이아웃과 페이지의 metadata를 항목 단위로 덮어써 alternates를 적으면 루트 레이아웃의 canonical이 사라지므로,
 * 자기 주소(`./`)를 canonical로 함께 적는다. 주소는 루트 레이아웃이 사이트 주소(metadataBase, 예: seo Recipe)를 정하면 절대
 * 주소가 된다.
 */
export function localeAlternates(path: string): NonNullable<Metadata['alternates']> {
  const suffix = path === '/' ? '' : path
  return {
    canonical: './',
    languages: {
      ...Object.fromEntries(routing.locales.map((locale) => [locale, `/${locale}${suffix}`])),
      'x-default': `/${routing.defaultLocale}${suffix}`,
    },
  }
}

/** og:locale로 알리는 locale마다의 값(언어_지역, Open Graph의 표기) */
export const OPEN_GRAPH_LOCALES: Readonly<Record<Locale, string>> = {
  ko: 'ko_KR',
  en: 'en_US',
}

/**
 * 번역한 페이지의 metadata.openGraph. 공유 카드에 페이지의 언어(og:locale)를 그 locale로 알린다. Next.js는 openGraph를 통째로
 * 덮어쓰므로, 위 레이아웃이 정한 OpenGraph(예: seo Recipe의 og:url, 사이트 이름, 공유 이미지. parent)는 그대로 두고 locale만
 * 바꾼다. 위 레이아웃이 OpenGraph를 정하지 않았으면 og:locale만 알린다. [locale] 레이아웃의 generateMetadata가 쓴다.
 */
export function localeOpenGraph(
  parent: ResolvedMetadata['openGraph'],
  locale: Locale,
): NonNullable<Metadata['openGraph']> {
  // 위 레이아웃의 값은 Next.js가 풀어 둔 값(절대 주소, 제목 객체 등)이고, Next.js는 그 값을 다시 받아도 같은 값으로 푼다.
  // 풀어 둔 값의 타입(ResolvedOpenGraph)은 적는 값의 타입(OpenGraph)과 달라 타입만 맞춘다.
  return { ...(parent as Metadata['openGraph']), locale: OPEN_GRAPH_LOCALES[locale] }
}
