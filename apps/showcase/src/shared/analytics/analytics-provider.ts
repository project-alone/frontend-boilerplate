// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/analytics/src/shared/analytics/analytics-provider.ts

import type { AnalyticsProvider } from './analytics'

// 페이지뷰와 이벤트를 실제로 보낼 곳. 분석 서비스(GA4, Amplitude 등)를 붙일 때는 이 파일의 analyticsProvider만 바꾼다
// (README의 "분석(analytics)"). 지금은 아무 데도 보내지 않는다. 개발 서버(next dev)에서는 무엇을 남기는지 브라우저 콘솔에만
// 적고, 배포용 빌드와 테스트에서는 아무것도 하지 않는다.

/** 브라우저 콘솔에만 남기는 공급자. 개발 서버에서 쓴다. */
const consoleProvider: AnalyticsProvider = {
  trackPageView: (url) => {
    console.info('[analytics] page_view', url)
  },
  trackEvent: (name, properties) => {
    console.info('[analytics] event', name, properties ?? {})
  },
}

/** 아무것도 하지 않는 공급자 */
const noopProvider: AnalyticsProvider = {
  trackPageView: () => undefined,
  trackEvent: () => undefined,
}

export const analyticsProvider: AnalyticsProvider =
  process.env.NODE_ENV === 'development' ? consoleProvider : noopProvider
