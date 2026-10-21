## 분석(analytics)

`analytics` Recipe로 넣었습니다. 특정 분석 서비스에 묶이지 않는 페이지뷰·이벤트 인터페이스와, 아무 데도 보내지 않는 기본 구현입니다. 분석 서비스의 SDK는 들어 있지 않습니다.

| 위치                                                       | 내용                                                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/analytics/analytics.ts`                        | 앱 코드가 부르는 `trackEvent(name, properties)`, `trackPageView(url)`과 공급자의 모양(`AnalyticsProvider`)                                   |
| `src/shared/analytics/analytics-provider.ts`               | 페이지뷰와 이벤트를 실제로 보낼 곳(`analyticsProvider`). 분석 서비스를 붙일 때는 이 파일만 바꿉니다                                          |
| `src/shared/analytics/analytics-instrumentation-client.ts` | 페이지뷰. 브라우저가 페이지를 새로 불러오면 앱 코드보다 먼저, App Router로 옮겨 가면 옮겨 가기 시작할 때(`onRouterTransitionStart`) 남깁니다 |

페이지뷰 조각은 `src/instrumentation-client.ts`에 들어가 있습니다(위 "앱 조립 파일").

- 이벤트: 브라우저 코드(예: 버튼의 `onClick`)에서 `trackEvent('signup_completed', { plan: 'pro' })`처럼 부릅니다. 이름은 snake_case로 짓고, 속성에는 문자열·숫자·불리언만 담습니다. 이메일, 이름 같은 개인정보는 담지 않습니다. 페이지뷰는 저절로 남으므로 부르지 않습니다.
- 페이지뷰의 주소는 경로와 쿼리 문자열입니다(예: `/products?page=2`). 쿼리 문자열에 개인정보가 담기는 화면이 있으면 공급자에서 빼고 보냅니다.
- 기본 구현: 개발 서버(`npm run dev`)에서는 브라우저 콘솔에 `[analytics] page_view /products` 같은 줄만 남기고, 배포용 빌드와 테스트에서는 아무것도 하지 않습니다. 그래서 공급자를 붙이기 전에는 어디에도 보내지 않습니다.
- 분석 서비스 붙이기: `analytics-provider.ts`의 `analyticsProvider`를 그 서비스로 보내는 공급자로 바꿉니다. 측정 ID 같은 값은 `NEXT_PUBLIC_` 환경 변수로 받아 `.env.example`과 `process-env.d.ts`에 적고, 개발과 테스트에서 보내지 않도록 배포용 빌드(`NODE_ENV`가 `production`)에 그 값이 있을 때만 붙입니다. E2E와 GitLab CI의 목 빌드는 그 값 없이 빌드하므로 보내지 않습니다. 이 모듈은 클라이언트 컴포넌트를 서버에서 렌더링할 때도 불러오므로, SDK를 불러오거나 초기화하는 코드는 브라우저(`typeof window !== 'undefined'`)에서만 실행합니다. GA4라면 다음과 같습니다. `gtag.js`는 `src/app/layout.tsx`에서 `next/script`로 불러오고, 페이지뷰를 두 번 남기지 않도록 `gtag('config', <측정 ID>, { send_page_view: false })`로 GA4의 자동 페이지뷰를 끕니다. Amplitude라면 `@amplitude/analytics-browser`의 `init`을 브라우저에서 한 번 부르고 `track(name, properties)`로 보냅니다.

  ```ts
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const gtag = (...args: unknown[]) => {
    ;(window as { gtag?: (...args: unknown[]) => void }).gtag?.(...args)
  }

  const ga4Provider: AnalyticsProvider = {
    trackPageView: (url) => {
      gtag('event', 'page_view', { page_location: new URL(url, window.location.origin).href })
    },
    trackEvent: (name, properties) => {
      gtag('event', name, properties)
    },
  }

  export const analyticsProvider: AnalyticsProvider =
    process.env.NODE_ENV === 'production' && measurementId !== undefined && measurementId !== ''
      ? ga4Provider
      : process.env.NODE_ENV === 'development'
        ? consoleProvider
        : noopProvider
  ```

- 테스트: `src/shared/analytics/analytics.test.ts`(개발 서버에서 콘솔에 남기는 페이지뷰와 이벤트, 배포용 빌드와 테스트에서는 아무것도 하지 않음), `e2e/analytics.spec.ts`(공급자를 붙이지 않은 앱은 페이지를 열고 옮겨도 앱 밖으로 요청을 보내지 않고 콘솔에도 남기지 않음). 공급자를 바꾸면 `analytics.test.ts`의 기본 구현 테스트도 그 공급자에 맞게 고칩니다.
