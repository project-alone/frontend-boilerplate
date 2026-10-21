// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/src/features/home/home.tsx

import { getTranslations } from 'next-intl/server'
import { Link } from '@/shared/i18n/navigation'
import type { Locale } from '@/shared/i18n/routing'

/**
 * locale로 번역한 홈 화면(서버 컴포넌트). locale마다 있는 홈(src/app/[locale]/page.tsx)과, proxy가 없는 static-export의
 * 홈(src/app/page.tsx)이 쓴다.
 */
export async function Home({ locale }: Readonly<{ locale: Locale }>) {
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
