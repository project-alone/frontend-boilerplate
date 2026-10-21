// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/sentry/src/shared/sentry/sentry-instrumentation.test.ts

// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { expect, test, vi } from 'vitest'
import { server } from '@/shared/mocks/node'
import { sentryInstrumentation } from './sentry-instrumentation'

// 서버의 SDK를 Node.js 환경에서 실제로 초기화한다. SDK는 프로세스에 하나라 초기화하지 않는 조건(sentry.test.ts)과 파일을 나눈다.
// 가짜 DSN으로 가는 요청은 MSW가 받으므로 실제로 나가지 않는다.
const FAKE_DSN = 'http://public@sentry.test/1'

test('배포 서버에서 DSN이 있으면 서버가 요청을 처리하다 난 오류를 그 DSN으로 보낸다', async () => {
  const envelopes: string[] = []
  server.use(
    http.post('http://sentry.test/api/1/envelope/', async ({ request }) => {
      envelopes.push(await request.text())
      return HttpResponse.json({})
    }),
  )
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('SENTRY_DSN', FAKE_DSN)

  sentryInstrumentation.register()
  await sentryInstrumentation.onRequestError(
    new Error('상품 목록을 렌더링하지 못했습니다'),
    { path: '/products', method: 'GET', headers: {} },
    {
      routerKind: 'App Router',
      routePath: '/products',
      routeType: 'render',
      renderSource: 'react-server-components',
      revalidateReason: undefined,
    },
  )

  await expect.poll(() => envelopes.join('\n'), { timeout: 5000 }).toContain('상품 목록을 렌더링하지 못했습니다')
})
