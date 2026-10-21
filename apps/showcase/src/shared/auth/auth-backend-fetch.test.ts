// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/auth-backend-fetch.test.ts

// @vitest-environment node
import { parseSetCookie } from 'cookie'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { forwardToBackend } from '@/shared/api/bff-proxy'
import { server } from '@/shared/mocks/node'
import { loginAtBackend } from './auth-backend'
import { MOCK_PASSWORD, MOCK_USERS } from './auth-mock-handlers'
import { type Session, SESSION_COOKIE, sealSession, unsealSession } from './session'

// BFF 프록시(Base의 forwardToBackend, /api/proxy/*)가 브라우저의 요청을 백엔드로 전달할 때 auth Recipe의 backendFetch
// 처리기(auth-backend-fetch.ts)가 하는 일을 본다. 백엔드는 발급한 토큰을 기억하는 목 백엔드(auth-mock-handlers.ts)다.
// 이 파일은 서버처럼 window가 없는 Node.js에서 실행된다.

const USER = MOCK_USERS[0]

beforeEach(() => {
  vi.stubEnv('API_MOCKING', 'enabled')
  vi.stubEnv('API_BASE_URL', '')
  vi.stubEnv('SESSION_SECRET', 'test-only-session-secret-0123456789abcdef')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

/** 목 백엔드에 로그인해 받은 세션. overrides로 토큰을 바꿔 만료된 토큰을 흉내 낸다. */
async function loggedIn(overrides: Partial<Session> = {}): Promise<Session> {
  const session = await loginAtBackend({ email: USER?.email ?? '', password: MOCK_PASSWORD })
  if (session === undefined) throw new Error('목 백엔드에 로그인하지 못했습니다.')
  return { ...session, ...overrides }
}

/** 브라우저가 BFF 프록시로 보내는 요청. session이 있으면 그 세션 쿠키를 다른 쿠키와 함께 싣는다. */
async function browserRequest(path: string, session?: Session, init: RequestInit = {}): Promise<Request> {
  const headers = new Headers(init.headers)
  if (session !== undefined) headers.set('cookie', `theme=dark; ${SESSION_COOKIE}=${await sealSession(session)}`)
  return new Request(`http://localhost/api/proxy${path}`, { ...init, headers })
}

/** 응답이 브라우저에 보낸 세션 쿠키 */
function sessionCookieOf(response: Response) {
  return response.headers
    .getSetCookie()
    .map((header) => parseSetCookie(header))
    .find(({ name }) => name === SESSION_COOKIE)
}

/** 목 백엔드가 받은 refresh 요청의 수. 세기만 하고 응답은 목 백엔드의 핸들러가 한다. */
function countRefreshes(): { count: number } {
  const refreshes = { count: 0 }
  server.use(
    http.post('*/auth/refresh', () => {
      refreshes.count += 1
    }),
  )
  return refreshes
}

test('브라우저의 요청에 세션 쿠키의 accessToken을 붙여 전달하고, 세션 쿠키는 백엔드로 넘기지 않는다', async () => {
  const request = await browserRequest('/auth/me', await loggedIn())
  const forwardedCookies: (string | null)[] = []
  server.use(
    http.get('*/auth/me', ({ request: forwarded }) => {
      forwardedCookies.push(forwarded.headers.get('cookie'))
    }),
  )

  const response = await forwardToBackend(request)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(USER)
  expect(forwardedCookies).toEqual(['theme=dark'])
  expect(sessionCookieOf(response)).toBeUndefined()
})

test('브라우저가 Authorization 헤더를 직접 실었으면 그 헤더를 쓰고, 이때도 세션 쿠키는 백엔드로 넘기지 않는다', async () => {
  const request = await browserRequest('/auth-headers', await loggedIn(), {
    headers: { authorization: 'Bearer token-from-browser' },
  })
  server.use(
    http.get('*/auth-headers', ({ request: forwarded }) =>
      HttpResponse.json({
        authorization: forwarded.headers.get('authorization'),
        cookie: forwarded.headers.get('cookie'),
      }),
    ),
  )

  const response = await forwardToBackend(request)

  expect(await response.json()).toEqual({ authorization: 'Bearer token-from-browser', cookie: 'theme=dark' })
})

test('로그인하지 않은 브라우저의 요청은 토큰 없이 그대로 전달한다', async () => {
  const response = await forwardToBackend(await browserRequest('/auth/me'))

  expect(response.status).toBe(401)
  expect(sessionCookieOf(response)).toBeUndefined()
})

test('백엔드가 401로 답하면(accessToken 만료) refresh한 뒤 다시 보내고, 새 토큰을 담은 세션 쿠키를 응답에 싣는다', async () => {
  const session = await loggedIn({ accessToken: 'expired-access-token' })

  const response = await forwardToBackend(await browserRequest('/auth/me', session))

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(USER)
  const cookie = sessionCookieOf(response)
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
  const refreshed = await unsealSession(cookie?.value)
  expect(refreshed?.user).toEqual(USER)
  expect(refreshed?.accessToken).not.toBe(session.accessToken)
  expect(refreshed?.refreshToken).not.toBe(session.refreshToken)
})

test('다시 보낼 때 요청 본문도 함께 보낸다', async () => {
  server.use(
    http.post('*/auth-echo', async ({ request }) =>
      request.headers.get('authorization') === 'Bearer expired-access-token'
        ? new HttpResponse(null, { status: 401 })
        : HttpResponse.json(await request.json()),
    ),
  )
  const session = await loggedIn({ accessToken: 'expired-access-token' })

  const response = await forwardToBackend(
    await browserRequest('/auth-echo', session, { method: 'POST', body: JSON.stringify({ quantity: 2 }) }),
  )

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ quantity: 2 })
})

test('동시에 여러 요청이 401을 받아도 refresh는 한 번만 하고, 모든 요청이 새 토큰으로 다시 보낸 응답을 받는다', async () => {
  const session = await loggedIn({ accessToken: 'expired-access-token' })
  const refreshes = countRefreshes()
  const requests = await Promise.all(Array.from({ length: 5 }, () => browserRequest('/auth/me', session)))

  const responses = await Promise.all(requests.map((request) => forwardToBackend(request)))

  expect(refreshes.count).toBe(1)
  expect(responses.map(({ status }) => status)).toEqual([200, 200, 200, 200, 200])
  const sessions = await Promise.all(responses.map((response) => unsealSession(sessionCookieOf(response)?.value)))
  expect(new Set(sessions.map((refreshed) => refreshed?.accessToken)).size).toBe(1)

  // refresh가 끝난 뒤 이전 쿠키를 싣고 늦게 도착한 요청도 같은 새 토큰을 쓴다. 목 백엔드는 쓴 refreshToken을 다시 받지
  // 않으므로(rotation), 다시 refresh했다면 로그아웃되었을 것이다.
  const late = await forwardToBackend(await browserRequest('/auth/me', session))
  expect(late.status).toBe(200)
  expect(refreshes.count).toBe(1)
})

test('refreshToken도 받아 주지 않으면 401을 그대로 돌려주고 세션 쿠키를 지운다', async () => {
  const session = await loggedIn({ accessToken: 'expired-access-token', refreshToken: 'expired-refresh-token' })

  const response = await forwardToBackend(await browserRequest('/auth/me', session))

  expect(response.status).toBe(401)
  expect(sessionCookieOf(response)).toMatchObject({ value: '', maxAge: 0 })
})
