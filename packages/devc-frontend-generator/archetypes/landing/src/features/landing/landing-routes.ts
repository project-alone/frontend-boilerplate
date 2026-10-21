import type { Locale } from '@/shared/i18n/routing'

/**
 * 랜딩 페이지의 주소에서 locale을 뺀 경로(src/app/[locale]/landing/). 페이지의 locale별 주소(hreflang)와 머리글의 링크가 쓴다.
 * 랜딩 페이지를 옮기면 이 값과 라우트 폴더를 함께 바꾼다.
 */
export const LANDING_PATH = '/landing'

/** locale의 랜딩 페이지 공유 이미지 주소(src/app/[locale]/landing/og-image.png/route.tsx) */
export function landingOgImagePath(locale: Locale): string {
  return `/${locale}${LANDING_PATH}/og-image.png`
}
