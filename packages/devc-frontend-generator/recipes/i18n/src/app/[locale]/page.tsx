import { Home } from '@/features/home/home'
import { type LocaleRouteProps, requireLocale } from '@/shared/i18n/require-locale'

// i18n Recipe: locale마다 있는 홈(/ko, /en). 서버 컴포넌트는 params의 locale을 next-intl에 넘겨 번역한다.
export default async function HomePage(props: LocaleRouteProps) {
  return <Home locale={await requireLocale(props)} />
}
