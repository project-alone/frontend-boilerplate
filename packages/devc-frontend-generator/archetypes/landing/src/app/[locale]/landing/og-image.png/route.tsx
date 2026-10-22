import { loadLandingPage } from '@/features/landing/landing-content'
import { type LocaleRouteProps, requireLocale } from '@/shared/i18n/require-locale'
import { routing } from '@/shared/i18n/routing'
import { ogImage } from '@/shared/seo/og-image'

// 랜딩 Archetype: 랜딩 페이지의 locale별 공유 이미지(/ko/landing/og-image.png, /en/landing/og-image.png). seo Recipe의 공유
// 이미지(ogImage)로 그리고, 제목과 설명은 페이지의 metadata와 같은 콘텐츠 API의 locale별 문구다. 페이지의 metadata가 이 주소를
// 공유 이미지로 알린다(page.tsx).
//
// seo Recipe처럼 페이지 폴더에 opengraph-image.tsx를 두지 않는 까닭: Next.js는 그 이미지 라우트에 위 [locale] 레이아웃의
// generateStaticParams를 쓰지 않아, [locale] 아래에서는 locale마다 미리 만들지 못한다(요청이 올 때 백엔드를 불러 그리고,
// static-export는 빌드가 실패한다). 그래서 locale을 스스로 정하는 Route Handler로 둔다. 주소가 .png로 끝나 static-export가
// 내보낸 파일도 정적 파일 서버가 이미지로 알린다.
export const dynamic = 'force-static'

// 빌드할 때 locale마다 만들고, 그 밖의 locale은 찾을 수 없다(404).
export const dynamicParams = false

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function GET(_request: Request, props: LocaleRouteProps) {
  const { title, description } = await loadLandingPage(await requireLocale(props))
  return ogImage({ title, description })
}
