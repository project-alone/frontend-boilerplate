---
"devc-frontend-generator": minor
---

`analytics` Recipe를 더한다(`dcgen new --recipe analytics`, `server`와 `static-export`). 특정 분석 서비스에 묶이지 않는 `trackPageView`, `trackEvent`와 공급자 인터페이스(`AnalyticsProvider`)를 `src/shared/analytics`에 넣고, 페이지뷰는 instrumentation-client 조각이 페이지를 새로 불러올 때와 App Router로 옮겨 갈 때(`onRouterTransitionStart`) 남긴다. 분석 서비스의 SDK는 담지 않는다. 기본 공급자는 개발 서버에서는 브라우저 콘솔에만 남기고 배포용 빌드와 테스트에서는 아무것도 하지 않으며, GA4·Amplitude 같은 서비스는 `analytics-provider.ts`의 공급자만 바꿔 붙인다.
