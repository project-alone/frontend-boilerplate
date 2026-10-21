import * as Sentry from '@sentry/nextjs'
import type { Instrumentation } from 'next'
import { enabledSentryDsn, SENTRY_OPTIONS } from './sentry-options'

/**
 * Next.js 서버가 뜰 때 서버 런타임(nodejs, edge)마다 한 번 실행된다(src/instrumentation.ts가 부른다). DSN(SENTRY_DSN)이 있는
 * 배포 서버에서만 그 런타임의 SDK를 초기화한다. DSN은 서버를 띄울 때 읽으므로 바꿔도 다시 빌드하지 않는다.
 * onRequestError는 서버가 요청을 처리하다(서버 컴포넌트, Route Handler, Server Action, proxy) 난 오류를 Sentry로 보낸다.
 * SDK를 초기화하지 않았으면 아무것도 하지 않는다.
 */
export const sentryInstrumentation: { register: () => void; onRequestError: Instrumentation.onRequestError } = {
  register() {
    const dsn = enabledSentryDsn(process.env.SENTRY_DSN)
    if (dsn !== undefined) Sentry.init({ ...SENTRY_OPTIONS, dsn })
  },
  onRequestError: Sentry.captureRequestError,
}
