// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/auth-client.ts

import * as z from 'zod'
import { type LoginBody, User } from '@/shared/api/generated/model'

// 브라우저가 로그인 세션을 다루는 BFF의 Route Handler(src/app/api/session/route.ts)를 부르는 함수. 토큰은 서버의 세션 쿠키에만
// 있으므로 브라우저는 사용자 정보만 받는다.

/** 로그인 세션을 다루는 Route Handler의 경로. POST는 로그인, GET은 지금 사용자, DELETE는 로그아웃이다. */
export const SESSION_API_PATH = '/api/session'

/** 세션 Route Handler의 응답. 로그인하지 않았으면 user가 null이다. */
export const SessionResponse = z.object({ user: User.nullable() })
export type SessionResponse = z.input<typeof SessionResponse>

/** 이메일이나 비밀번호가 맞지 않아 로그인하지 못했다. message는 화면에 보여 줄 문구다. */
export class LoginFailedError extends Error {
  override readonly name = 'LoginFailedError'
}

/** 지금 로그인한 사용자. 로그인하지 않았으면 null */
export async function fetchSessionUser({ signal }: { signal?: AbortSignal } = {}): Promise<User | null> {
  const response = await fetch(SESSION_API_PATH, { cache: 'no-store', ...(signal === undefined ? {} : { signal }) })
  if (!response.ok) throw new Error(`로그인 세션을 확인하지 못했습니다(${String(response.status)}).`)
  return SessionResponse.parse(await response.json()).user
}

/** 이메일과 비밀번호로 로그인한다. 맞지 않으면 LoginFailedError를 던진다. */
export async function startSession(credentials: LoginBody): Promise<User> {
  const response = await fetch(SESSION_API_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  })
  if (response.status === 401) throw new LoginFailedError('이메일이나 비밀번호가 맞지 않습니다.')
  if (!response.ok) throw new Error(`로그인하지 못했습니다(${String(response.status)}).`)
  const { user } = SessionResponse.parse(await response.json())
  if (user === null) throw new Error('로그인 응답에 사용자가 없습니다.')
  return user
}

/** 로그아웃한다. 서버가 백엔드에 로그아웃을 알리고 세션 쿠키를 지운다. */
export async function endSession(): Promise<void> {
  const response = await fetch(SESSION_API_PATH, { method: 'DELETE' })
  if (!response.ok) throw new Error(`로그아웃하지 못했습니다(${String(response.status)}).`)
}
