import * as Sentry from '@sentry/nextjs'
import { afterEach, expect, test, vi } from 'vitest'
import { sentryInstrumentation } from './sentry-instrumentation'
import { sentryClientInstrumentation } from './sentry-instrumentation-client'

// 브라우저와 서버의 SDK를 초기화하는 조건. SDK를 초기화하지 않으면 Sentry로 아무것도 보내지 않는다.
// DSN이 있으면 오류를 보내는지는 sentry-instrumentation.test.ts가 서버 SDK로 보고, DSN으로 빌드한 앱이 브라우저와 서버의 오류를
// 실제로 보내는지는 Generator 레포의 하네스(harness/sentry.test.ts)가 가짜 수집 서버로 본다.

// 이 테스트에서만 쓰는 가짜 DSN. 이 주소로 요청이 나가면 MSW가 테스트를 실패시킨다(vitest.setup.ts).
const FAKE_DSN = 'http://public@sentry.test/1'

afterEach(() => {
  vi.unstubAllEnvs()
})

function registerBoth() {
  sentryInstrumentation.register()
  sentryClientInstrumentation.register()
}

test.each(['development', 'test'])(
  'NODE_ENV가 %s이면 DSN이 있어도 브라우저와 서버의 SDK를 초기화하지 않는다',
  (nodeEnv) => {
    vi.stubEnv('NODE_ENV', nodeEnv)
    vi.stubEnv('SENTRY_DSN', FAKE_DSN)
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', FAKE_DSN)

    registerBoth()

    expect(Sentry.getClient()).toBeUndefined()
  },
)

test.each([undefined, ''])('배포용 빌드와 서버도 DSN이 %j이면 SDK를 초기화하지 않는다', (dsn) => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('SENTRY_DSN', dsn)
  vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', dsn)

  registerBoth()

  expect(Sentry.getClient()).toBeUndefined()
})
