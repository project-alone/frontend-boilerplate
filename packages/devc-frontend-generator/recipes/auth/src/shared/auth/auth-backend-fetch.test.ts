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

/** BFF 프록시로 request를 전달하고, 그동안 MSW(목 백엔드)가 받은 요청의 주소(sent)도 돌려준다. */
async function forwardWatchingBackend(request: Request): Promise<{ response: Response; sent: string[] }> {
  const sent: string[] = []
  const listener = ({ request: received }: { request: Request }) => {
    sent.push(received.url)
  }
  server.events.on('request:start', listener)
  try {
    return { response: await forwardToBackend(request), sent }
  } finally {
    server.events.removeListener('request:start', listener)
  }
}

/** 막은 응답: 403이고 무엇을 쓰면 되는지 알리며, 목 백엔드가 발급하는 토큰은 담지 않는다. */
async function expectRefusedTokenOperation(response: Response) {
  const text = await response.text()
  expect(response.status).toBe(403)
  expect((JSON.parse(text) as { message: string }).message).toContain('/api/session')
  expect(text).not.toMatch(/mock-(?:access|refresh)-/)
}

test('로그인하지 않은 브라우저가 BFF 프록시로 login을 부르면 백엔드로 보내지 않고 403으로 알린다(응답의 토큰이 브라우저로 가지 않는다)', async () => {
  const request = await browserRequest('/auth/login', undefined, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: USER?.email, password: MOCK_PASSWORD }),
  })

  const { response, sent } = await forwardWatchingBackend(request)

  await expectRefusedTokenOperation(response)
  expect(sent).toEqual([])
})

test.each([
  '/auth/refresh',
  '/auth/login',
  // 백엔드마다 경로를 읽는 규칙(대소문자, 끝의 슬래시, 퍼센트 인코딩, 겹친 슬래시, 경로 매개변수)이 달라도 막는다.
  '/AUTH/Refresh/',
  '/auth/%6Cogin',
  '//auth//refresh',
  '/auth/refresh;jsessionid=1',
])('로그인한 브라우저가 BFF 프록시로 %s를 불러도 토큰을 붙여 보내지 않고 403으로 알린다', async (path) => {
  const session = await loggedIn()
  const request = await browserRequest(path, session, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  })

  const { response, sent } = await forwardWatchingBackend(request)

  await expectRefusedTokenOperation(response)
  expect(sent).toEqual([])
  expect(sessionCookieOf(response)).toBeUndefined()
})

test('BFF가 직접 부르는 login·refreshTokens(auth-backend.ts)는 그대로 백엔드로 보낸다', async () => {
  const session = await loggedIn({ accessToken: 'expired-access-token' })

  // 401을 받은 BFF 프록시가 refresh-session.ts를 거쳐 refreshTokens를 부른다.
  const response = await forwardToBackend(await browserRequest('/auth/me', session))

  expect(response.status).toBe(200)
  expect((await unsealSession(sessionCookieOf(response)?.value))?.refreshToken).not.toBe(session.refreshToken)
})
