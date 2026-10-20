import { getTranslations } from 'next-intl/server'
import { Link } from '@/shared/i18n/navigation'
import { type LocaleRouteProps, pageLocale } from '@/shared/i18n/page-locale'

// i18n Recipe: locale마다 있는 홈(/ko, /en). 서버 컴포넌트는 params의 locale을 next-intl에 넘겨 번역한다.
export default async function HomePage(props: LocaleRouteProps) {
  const locale = await pageLocale(props)
  const t = await getTranslations({ locale, namespace: 'HomePage' })

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">{t('title')}</h1>
      <p>{t('description')}</p>
      <p>
        <Link href="/i18n" className="focus-ring underline">
          {t('exampleLink')}
        </Link>
      </p>
    </main>
  )
}
