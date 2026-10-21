// seo Recipe: 사이트 자체에 대한 값. 검색 결과와 공유 카드에 보이므로 프로젝트에 맞게 바꾼다.

/** 사이트 이름. 페이지 제목 뒤(`상품 | Starter`), og:site_name, OG 이미지에 보인다. */
export const SITE_NAME = 'Starter'

/** 페이지가 설명을 정하지 않았을 때 쓰는 사이트 설명. 검색 결과와 공유 카드에 보인다. */
export const SITE_DESCRIPTION = 'devc-frontend-generator로 만든 Starter입니다.'

/** og:locale. 루트 레이아웃의 `<html lang>`과 맞춘다. */
export const SITE_LOCALE = 'ko_KR'

/** 사이트 주소가 없을 때 목 빌드와 개발 서버가 쓰는 주소. `next dev`의 기본 주소다. */
export const LOCAL_SITE_URL = 'http://localhost:3000'

/**
 * 사이트의 공개 주소. sitemap, robots.txt, 페이지의 canonical·OG 주소를 이 주소로 만든다.
 * NEXT_PUBLIC_SITE_URL에서 가져오며, 이 값은 빌드할 때 코드에 박힌다. 엉뚱한 주소가 검색 엔진에 알려지지 않도록, 값이 없으면
 * 배포하지 않는 목 빌드(API_MOCKING=enabled. GitLab CI의 build 잡, E2E)에서만 LOCAL_SITE_URL을 쓰고 그 밖에는 실패한다.
 * 빌드할 때 루트 레이아웃과 sitemap이 부르므로 배포용 빌드에 값이 없으면 빌드가 멈춘다.
 */
export function siteUrl(): URL {
  const value = process.env.NEXT_PUBLIC_SITE_URL
  if (value === undefined || value === '') {
    if (process.env.API_MOCKING === 'enabled') return new URL(LOCAL_SITE_URL)
    throw new Error(
      'NEXT_PUBLIC_SITE_URL 환경 변수가 없습니다. sitemap, robots.txt, 페이지의 canonical·OG 주소를 사이트 주소로 만들므로 배포용 빌드에는 사이트의 공개 주소(예: https://www.example.com)를 넣어 주세요. 배포하지 않는 목 빌드(API_MOCKING=enabled)는 넣지 않아도 됩니다(README의 "검색 노출(SEO)").',
    )
  }
  const url = URL.parse(value)
  if (url === null || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    throw new Error(`NEXT_PUBLIC_SITE_URL은 https://로 시작하는 주소여야 합니다(지금 값: ${value}).`)
  }
  return url
}
