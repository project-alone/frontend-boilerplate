// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/auth-proxy.test.ts

// @vitest-environment node
import { NextRequest, NextResponse } from 'next/server'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { loginWithPassword } from './auth-backend'
import { MOCK_PASSWORD } from './auth-mock-handlers'
import { authProxy } from './auth-proxy'
import { type Session, SESSION_COOKIE, sealSession, unsealSession } from './session'

// 페이지 요청이 라우트에 닿기 전에 실행되는 proxy 처리기(src/proxy.ts가 부른다). 보호된 라우트와 역할은 access-rules.ts에 있다.
// 이 파일은 서버처럼 window가 없는 Node.js에서 실행되고, 백엔드는 목 백엔드(auth-mock-handlers.ts)다.

beforeEach(() => {
  vi.stubEnv('API_MOCKING', 'enabled')
  vi.stubEnv('API_BASE_URL', '')
  vi.stubEnv('SESSION_SECRET', 'test-only-session-secret-0123456789abcdef')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function loggedIn(email: string, overrides: Partial<Session> = {}): Promise<Session> {
  const session = await loginWithPassword({ email, password: MOCK_PASSWORD })
  if (session === undefined) throw new Error('목 백엔드에 로그인하지 못했습니다.')
  return { ...session, ...overrides }
}

/** session의 쿠키를 실은 페이지 요청과, 처리기가 다음으로 넘긴 요청을 모으는 next */
async function pageRequest(path: string, session?: Session) {
  const headers = new Headers()
  if (session !== undefined) headers.set('cookie', `${SESSION_COOKIE}=${await sealSession(session)}`)
  const request = new NextRequest(`http://localhost${path}`, { headers })
  const forwarded: NextRequest[] = []
  const next = (nextRequest: NextRequest = request) => {
    forwarded.push(nextRequest)
    return Promise.resolve(NextResponse.next())
  }
  return { request, forwarded, next }
}

function sessionCookieOf(response: NextResponse) {
  return response.cookies.get(SESSION_COOKIE)
}

test('로그인하지 않은 사용자가 보호된 라우트에 들어오면 돌아올 주소를 담아 로그인 페이지로 보낸다', async () => {
  const { request, forwarded, next } = await pageRequest('/account?tab=orders')

  const response = await authProxy(request, next)

  expect(forwarded).toEqual([])
  expect(response.status).toBe(307)
  const location = new URL(response.headers.get('location') ?? '')
  expect(location.pathname).toBe('/login')
  expect(location.searchParams.get('next')).toBe('/account?tab=orders')
})

test('보호하지 않은 라우트는 로그인하지 않아도 그대로 넘긴다', async () => {
  const { request, forwarded, next } = await pageRequest('/products')

  await authProxy(request, next)

  expect(forwarded).toEqual([request])
})

test('로그인한 사용자는 보호된 라우트에 들어간다', async () => {
  const { request, forwarded, next } = await pageRequest('/account', await loggedIn('user@example.com'))

  const response = await authProxy(request, next)

  expect(forwarded).toEqual([request])
  expect(sessionCookieOf(response)).toBeUndefined()
})

test('역할이 필요한 라우트는 그 역할이 있는 사용자만 들어가고, 없으면 접근 권한 없음 페이지를 403으로 보여 준다', async () => {
  const user = await pageRequest('/admin/users', await loggedIn('user@example.com'))
  const admin = await pageRequest('/admin/users', await loggedIn('admin@example.com'))

  const denied = await authProxy(user.request, user.next)
  await authProxy(admin.request, admin.next)

  expect(user.forwarded).toEqual([])
  expect(denied.status).toBe(403)
  expect(new URL(denied.headers.get('x-middleware-rewrite') ?? '').pathname).toBe('/forbidden')
  expect(admin.forwarded).toEqual([admin.request])
})

test('accessToken이 곧 만료되면 페이지를 렌더링하기 전에 refresh하고, 새 세션 쿠키를 라우트에 넘기고 응답에도 싣는다', async () => {
  const session = await loggedIn('user@example.com', { accessTokenExpiresAt: Date.now() })
  const { request, forwarded, next } = await pageRequest('/account', session)

  const response = await authProxy(request, next)

  const routeSession = await unsealSession(forwarded[0]?.cookies.get(SESSION_COOKIE)?.value)
  expect(routeSession?.accessToken).toBeDefined()
  expect(routeSession?.accessToken).not.toBe(session.accessToken)
  expect(routeSession?.accessTokenExpiresAt).toBeGreaterThan(Date.now())
  expect(await unsealSession(sessionCookieOf(response)?.value)).toEqual(routeSession)
})

test('refreshToken도 만료되었으면 세션 쿠키를 지우고, 보호된 라우트면 로그인 페이지로 보낸다', async () => {
  const session = await loggedIn('user@example.com', {
    accessTokenExpiresAt: Date.now(),
    refreshToken: 'expired-refresh-token',
  })
  const protectedPage = await pageRequest('/account', session)
  const publicPage = await pageRequest('/products', session)

  const redirected = await authProxy(protectedPage.request, protectedPage.next)
  const passed = await authProxy(publicPage.request, publicPage.next)

  expect(redirected.status).toBe(307)
  expect(sessionCookieOf(redirected)?.value).toBe('')
  expect(publicPage.forwarded[0]?.cookies.has(SESSION_COOKIE)).toBe(false)
  expect(sessionCookieOf(passed)?.value).toBe('')
})
