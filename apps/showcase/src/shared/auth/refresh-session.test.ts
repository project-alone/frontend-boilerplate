// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/refresh-session.test.ts

// @vitest-environment node
import { http } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { server } from '@/shared/mocks/node'
import { loginAtBackend } from './auth-backend'
import { MOCK_PASSWORD } from './auth-mock-handlers'

// proxy(src/proxy.ts)와 BFF 프록시(Route Handler)는 따로 번들되어 refresh-session.ts를 각자 불러온다. 같은 사용자의 페이지 요청과
// 브라우저의 API 요청이 동시에 refresh해도 백엔드에는 한 번만 가야 한다. 백엔드는 쓴 refreshToken을 다시 받지 않는다.

beforeEach(() => {
  vi.stubEnv('API_MOCKING', 'enabled')
  vi.stubEnv('API_BASE_URL', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test('따로 불러온 모듈(proxy와 BFF 프록시의 번들)이 동시에 refresh해도 백엔드에는 한 번만 보내고 같은 새 토큰을 나눠 쓴다', async () => {
  const session = await loginAtBackend({ email: 'user@example.com', password: MOCK_PASSWORD })
  if (session === undefined) throw new Error('목 백엔드에 로그인하지 못했습니다.')
  const refreshes = { count: 0 }
  server.use(
    http.post('*/auth/refresh', () => {
      refreshes.count += 1
    }),
  )
  const proxyBundle = await import('./refresh-session')
  vi.resetModules()
  const routeHandlerBundle = await import('./refresh-session')
  expect(routeHandlerBundle).not.toBe(proxyBundle)

  const [fromProxy, fromRouteHandler] = await Promise.all([
    proxyBundle.refreshSession(session),
    routeHandlerBundle.refreshSession(session),
  ])

  expect(refreshes.count).toBe(1)
  expect(fromProxy?.accessToken).toBeDefined()
  expect(fromRouteHandler?.accessToken).toBe(fromProxy?.accessToken)
})
