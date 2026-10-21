import type { ReactNode } from 'react'
import { type LocaleRouteProps, requireLocale } from '@/shared/i18n/require-locale'
import { routing } from '@/shared/i18n/routing'

// i18n Recipe: 번역한 페이지는 이 [locale] 세그먼트 아래에 둔다. 주소 앞에 locale이 붙고(/ko, /en/i18n), 페이지는 locale마다
// 빌드할 때 렌더링한다(SSG). [locale] 밖의 페이지(Base의 /products, 다른 Recipe의 페이지)는 번역하지 않은 그대로 동작한다.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({ children, params }: Readonly<LocaleRouteProps & { children: ReactNode }>) {
  const locale = await requireLocale({ params })

  // 루트 레이아웃의 <html lang>은 locale을 모르므로, 페이지 내용의 언어를 여기서 알린다(I18nProvider가 <html lang>도 바꾼다).
  return <div lang={locale}>{children}</div>
}
