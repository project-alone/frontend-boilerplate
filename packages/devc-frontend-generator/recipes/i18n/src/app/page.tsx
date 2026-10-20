import { routing } from '@/shared/i18n/routing'
import LocaleHomePage from './[locale]/page'

// i18n Recipe: 홈은 locale마다 src/app/[locale]/page.tsx(/ko, /en)에 있다. server Starter에서는 proxy가 홈(/)을 고른 locale의
// 홈으로 보내므로(src/shared/i18n/i18n-proxy.ts) 이 페이지는 보이지 않는다. 요청을 받는 서버가 없어 proxy가 없는
// static-export Starter에서는 이 페이지가 기본 locale의 홈을 보여 준다.
export default function HomePage() {
  return <LocaleHomePage params={Promise.resolve({ locale: routing.defaultLocale })} />
}
