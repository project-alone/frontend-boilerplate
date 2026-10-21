import type { Metadata } from 'next'
import { routing } from './routing'

/**
 * 번역한 페이지(src/app/[locale]/ 아래)의 metadata.alternates. 같은 페이지의 locale별 주소를 검색 엔진에 알린다
 * (<link rel="alternate" hreflang>). path는 locale을 뺀 주소다(홈은 '/', /ko/i18n은 '/i18n').
 *
 * Next.js는 레이아웃과 페이지의 metadata를 항목 단위로 덮어써 alternates를 적으면 루트 레이아웃의 canonical이 사라지므로,
 * 자기 주소(`./`)를 canonical로 함께 적는다. 주소는 루트 레이아웃이 사이트 주소(metadataBase, 예: seo Recipe)를 정하면 절대
 * 주소가 된다.
 */
export function localeAlternates(path: string): NonNullable<Metadata['alternates']> {
  const suffix = path === '/' ? '' : path
  return {
    canonical: './',
    languages: Object.fromEntries(routing.locales.map((locale) => [locale, `/${locale}${suffix}`])),
  }
}
