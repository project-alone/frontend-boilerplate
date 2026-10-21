import { ApiError } from '@/shared/api/api-fetch'
import { getMe, login, logout, refreshTokens } from '@/shared/api/generated'
import type { LoginRequest, TokenPair } from '@/shared/api/generated/model'
import { createSession, type Session } from './session'

// 서버(BFF)가 백엔드의 인증 operation(샘플 명세의 auth tag)을 불러 세션을 만들고, 새로 받고, 끝낸다. 백엔드의 경로나 응답
// 모양이 샘플 명세와 다르면 openapi.yaml과 이 파일을 맞춘다. 이 operation은 서버에서만 부른다. 브라우저에서 생성된
// login·refreshTokens를 BFF 프록시로 부르면 응답의 토큰이 브라우저의 JavaScript로 간다.

/** 이메일과 비밀번호로 백엔드에 로그인하고, 발급받은 토큰과 그 토큰의 사용자로 세션을 만든다. 맞지 않으면 undefined */
export async function loginAtBackend(credentials: LoginRequest): Promise<Session | undefined> {
  const tokens = await unlessUnauthorized(login(credentials))
  return tokens === undefined ? undefined : sessionWith(tokens)
}

/**
 * refreshToken으로 새 토큰을 받아 세션을 새로 만든다. 백엔드가 받아 주지 않으면(만료, 이미 씀) undefined다.
 * 동시에 여러 곳에서 부르지 않도록 refresh-session.ts의 refreshSession을 거쳐 부른다.
 */
export async function requestNewTokens(session: Session): Promise<Session | undefined> {
  const tokens = await unlessUnauthorized(refreshTokens({ refreshToken: session.refreshToken }))
  return tokens === undefined ? undefined : sessionWith(tokens)
}

/**
 * 백엔드에 로그아웃을 알려 refreshToken을 더 쓸 수 없게 한다. 백엔드가 받아 주었으면 true, accessToken이 만료되어 받지
 * 않았으면(401) false다.
 */
export async function logoutAtBackend(session: Session): Promise<boolean> {
  const done = await unlessUnauthorized(
    logout({ refreshToken: session.refreshToken }, { headers: bearer(session.accessToken) }).then(() => true),
  )
  return done ?? false
}

// 역할 기반 접근 제어(access-rules.ts)에 쓰도록 사용자 정보도 세션에 담는다. refresh할 때마다 다시 받아, 백엔드에서 바꾼
// 역할이 다음 refresh부터 반영된다.
async function sessionWith(tokens: TokenPair): Promise<Session> {
  const user = await getMe({ headers: bearer(tokens.accessToken) })
  return createSession(tokens, user)
}

function bearer(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` }
}

// 백엔드가 401로 답하면 undefined를 돌려준다. 그 밖의 실패(백엔드 장애 등)는 그대로 던진다.
async function unlessUnauthorized<T>(request: Promise<T>): Promise<T | undefined> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return undefined
    throw error
  }
}
