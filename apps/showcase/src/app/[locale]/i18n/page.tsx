// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/src/app/[locale]/i18n/page.tsx

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { CartCounter } from '@/features/i18n-example/cart-counter'
import { localeAlternates } from '@/shared/i18n/locale-alternates'
import { Link } from '@/shared/i18n/navigation'
import { type LocaleRouteProps, requireLocale } from '@/shared/i18n/require-locale'

// 날짜 형식을 보여 줄 고정된 날짜. 빌드할 때 렌더링하므로 지금 시각을 쓰지 않는다.
const RELEASE_DATE = new Date('2026-03-02T10:00:00+09:00')

export async function generateMetadata(props: LocaleRouteProps): Promise<Metadata> {
  const t = await getTranslations({ locale: await requireLocale(props), namespace: 'I18nExample' })
  // 같은 페이지의 locale별 주소(/ko/i18n, /en/i18n)를 검색 엔진에 알린다.
  return { title: t('title'), alternates: localeAlternates('/i18n') }
}

// i18n Recipe: 같은 메시지 키를 locale마다 다른 문장과 형식(날짜, 통화, 복수형)으로 보여 주는 예(/ko/i18n, /en/i18n).
export default async function I18nExamplePage(props: LocaleRouteProps) {
  const locale = await requireLocale(props)
  const t = await getTranslations({ locale, namespace: 'I18nExample' })

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">{t('title')}</h1>
      <p>{t('description')}</p>
      <ul className="list-disc pl-6">
        <li>{t('releaseDate', { date: RELEASE_DATE })}</li>
        <li>{t('price', { price: 19000 })}</li>
      </ul>
      <CartCounter />
      <p>
        <Link href="/" className="focus-ring underline">
          {t('homeLink')}
        </Link>
      </p>
    </main>
  )
}
