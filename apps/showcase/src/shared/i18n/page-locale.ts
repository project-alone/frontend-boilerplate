// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/src/shared/i18n/page-locale.ts

import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { type Locale, routing } from './routing'

/** src/app/[locale]/ 아래의 레이아웃과 페이지가 받는 props */
export interface LocaleRouteProps {
  params: Promise<{ locale: string }>
}

/**
 * [locale] 라우트의 params에서 locale을 읽는다. 지원하지 않는 locale이면 404다. 서버 컴포넌트는 이 locale을 next-intl의 서버
 * API에 넘긴다(getTranslations({ locale, namespace })). params만 읽으므로 페이지를 빌드할 때 렌더링할 수 있다.
 */
export async function pageLocale({ params }: LocaleRouteProps): Promise<Locale> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  return locale
}
