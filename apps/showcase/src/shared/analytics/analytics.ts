// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/analytics/src/shared/analytics/analytics.ts

import { analyticsProvider } from './analytics-provider'

// 분석 서비스에 묶이지 않는 페이지뷰·이벤트 인터페이스(README의 "분석(analytics)"). 앱 코드는 이 파일의 함수만 부르고,
// 어디로 보낼지는 analytics-provider.ts의 공급자가 정한다. 분석 서비스를 바꿔도 앱 코드는 고치지 않는다.

/** 이벤트에 붙이는 속성. 분석 서비스가 대부분 받는 원시 값만 담는다. 이메일, 이름 같은 개인정보는 담지 않는다. */
export type AnalyticsProperties = Readonly<Record<string, string | number | boolean>>

/** 분석 서비스(GA4, Amplitude 등)를 감싸는 공급자. 이 모양만 맞추면 어떤 분석 서비스든 붙일 수 있다. */
export interface AnalyticsProvider {
  /** 페이지를 보았다. url은 경로와 쿼리 문자열이다(예: /products?page=2). */
  trackPageView: (url: string) => void
  /** 사용자가 한 일. name은 snake_case로 짓는다(예: signup_completed). */
  trackEvent: (name: string, properties?: AnalyticsProperties) => void
}

/** 페이지뷰를 남긴다. 페이지를 열거나 옮길 때마다 analytics-instrumentation-client.ts가 부르므로 앱 코드는 부르지 않는다. */
export function trackPageView(url: string): void {
  analyticsProvider.trackPageView(url)
}

/** 사용자가 한 일을 남긴다. 브라우저에서 부른다(예: 버튼의 onClick). */
export function trackEvent(name: string, properties?: AnalyticsProperties): void {
  analyticsProvider.trackEvent(name, properties)
}
