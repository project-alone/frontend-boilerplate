// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/auth-mock-handlers.ts

import { http, HttpResponse } from 'msw'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import { LoginRequest, LogoutRequest, RefreshRequest, type TokenPair, type User } from '@/shared/api/generated/model'

// 목 백엔드의 인증(샘플 명세의 auth operation). 생성된 MSW 핸들러(src/shared/api/generated/auth/auth.msw.ts)는 늘 같은
// example을 돌려주므로, 로그인 실패, accessToken 만료, refreshToken rotation, 로그아웃을 흉내 내려고 발급한 토큰을 기억하는
// 핸들러를 따로 둔다. 확장 지점 mockHandlers(Recipe의 extensions.json)로 선언해 MSW의 핸들러 목록(src/shared/mocks/handlers.ts)이
// 생성된 핸들러보다 앞에 두므로 Vitest, 개발 서버, E2E 대상 서버가 모두 이 핸들러를 쓴다. 실제 백엔드로 바꾸면 쓰이지 않는다.

/** 목 백엔드의 사용자. 비밀번호는 모두 MOCK_PASSWORD다. */
export const MOCK_USERS: readonly User[] = [
  { id: 1, email: 'user@example.com', name: '김사용', roles: ['user'] },
  { id: 2, email: 'admin@example.com', name: '박관리', roles: ['admin', 'user'] },
]

export const MOCK_PASSWORD = 'password'

/** 목 백엔드가 발급하는 accessToken의 수명(초). 개발 서버에서도 refresh가 일어나는 것을 볼 수 있게 짧게 둔다. */
export const MOCK_ACCESS_TOKEN_TTL_SECONDS = 10

interface AccessGrant {
  userId: number
  expiresAt: number
}

const accessTokens = new Map<string, AccessGrant>()
// refreshToken → 사용자 id. refresh하거나 로그아웃하면 지워져 다시 쓸 수 없다.
const refreshTokens = new Map<string, number>()

function issueTokens(userId: number): TokenPair {
  const accessToken = `mock-access-${crypto.randomUUID()}`
  const refreshToken = `mock-refresh-${crypto.randomUUID()}`
  accessTokens.set(accessToken, { userId, expiresAt: Date.now() + MOCK_ACCESS_TOKEN_TTL_SECONDS * 1000 })
  refreshTokens.set(refreshToken, userId)
  return { accessToken, refreshToken, expiresIn: MOCK_ACCESS_TOKEN_TTL_SECONDS }
}

function accessTokenOf(request: Request): string | undefined {
  return /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
}

/**
 * Authorization 헤더의 accessToken이 가리키는 사용자. 없거나 만료된 토큰이면 undefined. 인증이 필요한 operation을 흉내 내는 다른
 * 목 핸들러(예: 대시보드 Archetype의 src/shared/mocks/users.ts)도 이 함수로 요청한 사용자와 역할을 알아내, 실제 백엔드처럼
 * 401(로그인하지 않음)이나 403(역할이 없음)으로 거절한다.
 */
export function mockUserOf(request: Request): User | undefined {
  const token = accessTokenOf(request)
  const grant = token === undefined ? undefined : accessTokens.get(token)
  if (grant === undefined || grant.expiresAt <= Date.now()) return undefined
  return MOCK_USERS.find((user) => user.id === grant.userId)
}

function unauthorized(message: string) {
  return HttpResponse.json({ message }, { status: 401 })
}

async function jsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => undefined)
}

export const authMockHandlers = [
  http.post(`${MOCK_API_BASE_URL}/auth/login`, async ({ request }) => {
    const credentials = LoginRequest.safeParse(await jsonBody(request))
    const user = credentials.success
      ? MOCK_USERS.find(({ email }) => email === credentials.data.email && credentials.data.password === MOCK_PASSWORD)
      : undefined
    if (user === undefined) return unauthorized('이메일이나 비밀번호가 맞지 않습니다.')
    return HttpResponse.json(issueTokens(user.id))
  }),

  http.post(`${MOCK_API_BASE_URL}/auth/refresh`, async ({ request }) => {
    const body = RefreshRequest.safeParse(await jsonBody(request))
    const userId = body.success ? refreshTokens.get(body.data.refreshToken) : undefined
    if (!body.success || userId === undefined) return unauthorized('refreshToken이 만료되었거나 이미 쓰였습니다.')
    // rotation: 쓴 refreshToken은 더 쓸 수 없다. 같은 토큰으로 두 번 refresh하면 두 번째는 실패한다.
    refreshTokens.delete(body.data.refreshToken)
    return HttpResponse.json(issueTokens(userId))
  }),

  http.get(`${MOCK_API_BASE_URL}/auth/me`, ({ request }) => {
    const user = mockUserOf(request)
    return user === undefined ? unauthorized('accessToken이 없거나 만료되었습니다.') : HttpResponse.json(user)
  }),

  // 명세처럼 유효한 accessToken이 있어야 로그아웃을 받는다(bearerAuth).
  http.post(`${MOCK_API_BASE_URL}/auth/logout`, async ({ request }) => {
    if (mockUserOf(request) === undefined) return unauthorized('accessToken이 없거나 만료되었습니다.')
    const body = LogoutRequest.safeParse(await jsonBody(request))
    if (body.success) refreshTokens.delete(body.data.refreshToken)
    const token = accessTokenOf(request)
    if (token !== undefined) accessTokens.delete(token)
    return new HttpResponse(null, { status: 204 })
  }),
]
