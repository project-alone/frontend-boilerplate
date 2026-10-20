// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/auth-backend.ts

import { ApiError } from '@/shared/api/api-fetch'
import { getMe, login, logout, refreshTokens } from '@/shared/api/generated'
import type { LoginRequest } from '@/shared/api/generated/model'
import { createSession, type Session } from './session'

// 서버(BFF)가 백엔드의 인증 operation(샘플 명세의 auth tag)을 불러 세션을 만들고, 새로 받고, 끝낸다. 백엔드의 경로나 응답
// 모양이 샘플 명세와 다르면 openapi.yaml과 이 파일을 맞춘다. 브라우저는 이 함수를 부르지 않는다(토큰을 볼 수 없다).

/** 이메일과 비밀번호로 백엔드에 로그인하고, 발급받은 토큰과 그 토큰의 사용자로 세션을 만든다. 맞지 않으면 undefined */
export async function loginWithPassword(credentials: LoginRequest): Promise<Session | undefined> {
  const tokens = await unlessUnauthorized(login(credentials))
  if (tokens === undefined) return undefined
  // 역할 기반 접근 제어(access-rules.ts)에 쓰도록 사용자 정보도 세션에 담는다.
  const user = await getMe({ headers: bearer(tokens.accessToken) })
  return createSession(tokens, user)
}

/**
 * refreshToken으로 새 토큰을 받아 세션을 새로 만든다. 백엔드가 받아 주지 않으면(만료, 이미 씀) undefined다.
 * 동시에 여러 곳에서 부르지 않도록 refresh-session.ts의 refreshSession을 거쳐 부른다.
 */
export async function requestNewTokens(session: Session): Promise<Session | undefined> {
  const tokens = await unlessUnauthorized(refreshTokens({ refreshToken: session.refreshToken }))
  return tokens === undefined ? undefined : createSession(tokens, session.user)
}

/** 백엔드에 로그아웃을 알려 refreshToken을 더 쓸 수 없게 한다. accessToken이 이미 만료되었으면(401) 넘어간다. */
export async function logoutAtBackend(session: Session): Promise<void> {
  await unlessUnauthorized(logout({ refreshToken: session.refreshToken }, { headers: bearer(session.accessToken) }))
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
