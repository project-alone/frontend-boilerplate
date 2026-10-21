// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { afterEach, expect, test, vi } from 'vitest'
import { apiFetch } from '@/shared/api/api-fetch'
import { backendFetch } from '@/shared/api/backend-fetch'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import { server } from '@/shared/mocks/node'

// 이 파일은 서버(서버 컴포넌트, Route Handler)처럼 window가 없는 Node.js에서 실행된다.
// order: backendFetch 처리기는 b(100) → a(200)이다.

afterEach(() => {
  vi.unstubAllEnvs()
})

function echoFixtureHeader() {
  server.use(
    http.get('*/fixture-backend-echo', ({ request }) => HttpResponse.json(request.headers.get('x-fixture-backend'))),
  )
}

test('서버의 apiFetch가 백엔드로 보내는 요청은 backendFetch 처리기를 order 순으로 거친다', async () => {
  vi.stubEnv('API_MOCKING', 'enabled')
  vi.stubEnv('API_BASE_URL', '')
  echoFixtureHeader()

  expect(await apiFetch('/fixture-backend-echo')).toBe('b, a')
})

test('처리기는 다음 처리기가 돌려준 응답을 고쳐 돌려준다. 응답은 order의 거꾸로 거쳐 돌아온다', async () => {
  echoFixtureHeader()

  const response = await backendFetch(`${MOCK_API_BASE_URL}/fixture-backend-echo`, { method: 'GET' })

  expect(await response.json()).toBe('b, a')
  expect(response.headers.get('x-fixture-backend-response')).toBe('a, b')
})
