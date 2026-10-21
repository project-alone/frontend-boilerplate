// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/src/app/[locale]/page.tsx

import type { Metadata } from 'next'
import { Home } from '@/features/home/home'
import { localeAlternates } from '@/shared/i18n/locale-alternates'
import { type LocaleRouteProps, requireLocale } from '@/shared/i18n/require-locale'

// 같은 페이지의 locale별 주소(/ko, /en)를 검색 엔진에 알린다.
export const metadata: Metadata = {
  alternates: localeAlternates('/'),
}

// i18n Recipe: locale마다 있는 홈(/ko, /en). 서버 컴포넌트는 params의 locale을 next-intl에 넘겨 번역한다.
export default async function HomePage(props: LocaleRouteProps) {
  return <Home locale={await requireLocale(props)} />
}
