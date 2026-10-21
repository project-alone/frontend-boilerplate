// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/src/features/locale-switcher/locale-switcher.tsx

'use client'

import { hasLocale, useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/shared/i18n/navigation'
import { useRouteLocale } from '@/shared/i18n/route-locale'
import { LOCALE_NAMES, routing } from '@/shared/i18n/routing'
import { Select } from '@/shared/ui/select'

const OPTIONS = routing.locales.map((locale) => ({ value: locale, label: LOCALE_NAMES[locale] }))

/**
 * 화면의 언어(locale)를 고른다. 번역한 페이지(src/app/[locale]/ 아래)에서는 같은 페이지의 그 locale 주소로 가고
 * (/ko/i18n → /en/i18n), 번역하지 않은 페이지에서는 그 locale의 홈으로 간다. 고른 locale은 쿠키(NEXT_LOCALE)에 저장되어,
 * server Starter에서는 다음에 홈(/)을 열 때 그 locale로 간다.
 */
export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher')
  const locale = useLocale()
  const translatedPage = useRouteLocale() !== undefined
  const pathname = usePathname()
  const router = useRouter()

  return (
    <Select
      label={t('label')}
      options={OPTIONS}
      value={locale}
      onValueChange={(value) => {
        if (hasLocale(routing.locales, value)) router.replace(translatedPage ? pathname : '/', { locale: value })
      }}
    />
  )
}
