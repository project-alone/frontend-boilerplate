// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/session-routes.test.ts

// @vitest-environment node
import { http } from 'msw'
import { NextRequest, type NextResponse } from 'next/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { server } from '@/shared/mocks/node'
import { loginWithPassword } from './auth-backend'
import { MOCK_PASSWORD, MOCK_USERS } from './auth-mock-handlers'
import { SESSION_COOKIE, sealSession, unsealSession } from './session'
import { getSessionUser, loginRoute, logoutRoute } from './session-routes'

// 브라우저가 부르는 로그인 세션 Route Handler(src/app/api/session/route.ts의 POST, GET, DELETE).
// 이 파일은 서버처럼 window가 없는 Node.js에서 실행되고, 백엔드는 목 백엔드(auth-mock-handlers.ts)다.

const USER = MOCK_USERS[0]
const URL = 'http://localhost/api/session'

beforeEach(() => {
  vi.stubEnv('API_MOCKING', 'enabled')
  vi.stubEnv('API_BASE_URL', '')
  vi.stubEnv('SESSION_SECRET', 'test-only-session-secret-0123456789abcdef')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function loginRequest(body: unknown) {
  return new NextRequest(URL, { method: 'POST', body: JSON.stringify(body) })
}

async function requestWithSession(method: string) {
  const session = await loginWithPassword({ email: USER?.email ?? '', password: MOCK_PASSWORD })
  if (session === undefined) throw new Error('목 백엔드에 로그인하지 못했습니다.')
  const request = new NextRequest(URL, {
    method,
    headers: { cookie: `${SESSION_COOKIE}=${await sealSession(session)}` },
  })
  return { session, request }
}

function sessionCookieOf(response: NextResponse) {
  return response.cookies.get(SESSION_COOKIE)
}

test('로그인하면 백엔드가 발급한 토큰을 암호화한 httpOnly 세션 쿠키에 담고, 브라우저에는 사용자 정보만 돌려준다', async () => {
  const response = await loginRoute(loginRequest({ email: USER?.email, password: MOCK_PASSWORD }))

  expect(response.status).toBe(200)
  const body: unknown = await response.json()
  expect(body).toEqual({ user: USER })
  expect(JSON.stringify(body)).not.toMatch(/token/i)
  const cookie = sessionCookieOf(response)
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
  const session = await unsealSession(cookie?.value)
  expect(session?.user).toEqual(USER)
  expect(session?.accessToken).toMatch(/^mock-access-/)
})

test('이메일이나 비밀번호가 맞지 않으면 401로 알리고 세션 쿠키를 만들지 않는다', async () => {
  const response = await loginRoute(loginRequest({ email: USER?.email, password: 'wrong-password' }))

  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({ message: '이메일이나 비밀번호가 맞지 않습니다.' })
  expect(sessionCookieOf(response)).toBeUndefined()
})

test('요청 본문이 명세의 LoginRequest와 다르면 백엔드에 보내지 않고 400으로 알린다', async () => {
  const response = await loginRoute(loginRequest({ email: 'not-an-email' }))

  expect(response.status).toBe(400)
  expect(sessionCookieOf(response)).toBeUndefined()
})

test('지금 로그인한 사용자를 알려 주고, 로그인하지 않았으면 user가 null이다', async () => {
  const { request } = await requestWithSession('GET')

  expect(await (await getSessionUser(request)).json()).toEqual({ user: USER })
  expect(await (await getSessionUser(new NextRequest(URL))).json()).toEqual({ user: null })
})

test('로그아웃하면 백엔드에 로그아웃을 중계하고 세션 쿠키를 지운다', async () => {
  const { session, request } = await requestWithSession('DELETE')
  const relayed: unknown[] = []
  server.use(
    http.post('*/auth/logout', async ({ request: backendRequest }) => {
      relayed.push({
        authorization: backendRequest.headers.get('authorization'),
        body: await backendRequest.clone().json(),
      })
    }),
  )

  const response = await logoutRoute(request)

  expect(response.status).toBe(204)
  expect(relayed).toEqual([
    { authorization: `Bearer ${session.accessToken}`, body: { refreshToken: session.refreshToken } },
  ])
  expect(sessionCookieOf(response)).toMatchObject({ value: '', maxAge: 0 })
})
