import 'client-only'
import * as Sentry from '@sentry/nextjs'
import { enabledSentryDsn, SENTRY_OPTIONS } from './sentry-options'

/**
 * 브라우저에서 앱 코드보다 먼저 한 번 실행된다(src/instrumentation-client.ts가 부른다). DSN(NEXT_PUBLIC_SENTRY_DSN)으로 빌드한
 * 배포용 빌드에서만 SDK를 초기화해, 브라우저에서 처리하지 못한 오류와 Promise 거부를 Sentry로 보낸다.
 * NEXT_PUBLIC_ 값은 빌드할 때 코드에 박히므로 DSN을 바꾸면 다시 빌드한다.
 */
export const sentryClientInstrumentation = {
  register() {
    const dsn = enabledSentryDsn(process.env.NEXT_PUBLIC_SENTRY_DSN)
    if (dsn !== undefined) Sentry.init({ ...SENTRY_OPTIONS, dsn })
  },
  // 페이지 이동을 성능 추적의 span으로 남긴다. 성능 추적을 켜지 않았거나 SDK를 초기화하지 않았으면 아무것도 하지 않는다.
  onRouterTransitionStart: Sentry.captureRouterTransitionStart,
}
