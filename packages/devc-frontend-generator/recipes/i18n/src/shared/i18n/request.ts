import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { MESSAGES, TIME_ZONE } from './messages'
import { routing } from './routing'

/*
 * 서버 컴포넌트에서 next-intl의 서버 API(getTranslations, getFormatter)가 쓰는 설정. next.config의 next-intl 플러그인이
 * 이 파일을 가리킨다(next-config.ts).
 *
 * 루트 레이아웃(src/app/layout.tsx)이 [locale] 밖에 있어서 next-intl은 요청이 어느 locale인지 스스로 알 수 없다
 * (next/root-params는 [locale]이 루트 레이아웃일 때만 쓸 수 있고, 요청 헤더를 읽으면 모든 페이지가 요청마다 렌더링된다).
 * 그래서 서버 컴포넌트는 페이지의 params에서 읽은 locale을 넘긴다. 넘기지 않으면 기본 locale로 조용히 그리는 대신 실패한다.
 */
export function i18nRequestConfig(locale: string | undefined) {
  if (locale === undefined) {
    throw new Error(
      '서버 컴포넌트에서 next-intl을 locale 없이 썼습니다. 페이지의 params에서 읽은 locale을 넘기세요: ' +
        'getTranslations({ locale, namespace }), getFormatter({ locale }). useTranslations는 클라이언트 컴포넌트에서 ' +
        '쓰고, Link는 @/shared/i18n/navigation의 것을 씁니다(README의 "다국어(i18n)").',
    )
  }
  if (!hasLocale(routing.locales, locale)) {
    throw new Error(`지원하지 않는 locale입니다: ${locale}. 지원하는 locale: ${routing.locales.join(', ')}`)
  }
  return { locale, messages: MESSAGES[locale], timeZone: TIME_ZONE }
}

export default getRequestConfig(({ locale }) => i18nRequestConfig(locale))
