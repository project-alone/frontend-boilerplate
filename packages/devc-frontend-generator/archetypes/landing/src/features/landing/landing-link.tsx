'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/shared/i18n/navigation'
import { LANDING_PATH } from './landing-routes'

/**
 * 모든 페이지 위의 머리글에 놓이는 랜딩 페이지 링크(확장 지점 header). 지금 locale의 랜딩 페이지로 간다(/ko/landing,
 * /en/landing). 번역하지 않은 페이지([locale] 밖)에서는 기본 locale의 랜딩 페이지다. 루트 레이아웃 아래의 머리글은 locale을
 * 주소에서 받지 못하므로, I18nProvider가 넘긴 locale로 번역하는 클라이언트 컴포넌트다.
 */
export function LandingLink() {
  const t = useTranslations('LandingLink')

  return (
    <nav aria-label={t('label')} className="flex items-center">
      <Link
        href={LANDING_PATH}
        className="focus-ring rounded-sm text-sm font-medium underline-offset-4 hover:underline"
      >
        {t('label')}
      </Link>
    </nav>
  )
}
