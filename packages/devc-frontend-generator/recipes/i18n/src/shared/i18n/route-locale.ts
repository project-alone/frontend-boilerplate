import { hasLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { type Locale, routing } from './routing'

/**
 * 지금 페이지가 번역한 페이지(src/app/[locale]/ 아래)이면 주소의 locale, 번역하지 않은 페이지([locale] 밖)이면 undefined.
 * 주소에서 읽으므로 서버가 미리 렌더링한 HTML과 브라우저가 같은 값을 쓴다. 클라이언트 컴포넌트에서 쓴다.
 */
export function useRouteLocale(): Locale | undefined {
  const { locale } = useParams<{ locale?: string }>()
  return hasLocale(routing.locales, locale) ? locale : undefined
}
