// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/analytics/src/shared/analytics/analytics-instrumentation-client.ts

import { trackPageView } from './analytics'

/**
 * 브라우저에서 페이지뷰를 남긴다(src/instrumentation-client.ts가 부른다). 브라우저가 페이지를 새로 불러오면(처음 열기, 새로 고침)
 * 앱 코드보다 먼저(register), App Router로 다른 페이지로 옮겨 가면 옮겨 가기 시작할 때(onRouterTransitionStart) 옮겨 갈 주소로
 * 남긴다. 그래서 옮겨 가는 도중에 redirect되면(예: 로그인 페이지로) 처음 요청한 주소가 남고, 도중에 취소된 이동도 남는다.
 */
export const analyticsClientInstrumentation = {
  register() {
    trackPageView(pathWithQuery(window.location))
  },
  onRouterTransitionStart(url: string) {
    trackPageView(pathWithQuery(new URL(url, window.location.href)))
  },
}

/** 페이지뷰의 주소: 경로와 쿼리 문자열(예: /products?page=2) */
function pathWithQuery({ pathname, search }: Pick<URL, 'pathname' | 'search'>): string {
  return `${pathname}${search}`
}
