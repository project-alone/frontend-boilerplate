// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/session-routes.ts

import { type NextRequest, NextResponse } from 'next/server'
import { LoginBody } from '@/shared/api/generated/model'
import { loginAtBackend, logoutAtBackend } from './auth-backend'
import type { SessionResponse } from './auth-client'
import { refreshSession } from './refresh-session'
import {
  clearedSessionCookieOptions,
  type Session,
  SESSION_COOKIE,
  sealSession,
  sessionCookieOptions,
  sessionOf,
} from './session'

// 로그인 세션 Route Handler(src/app/api/session/route.ts). 브라우저가 부르고(auth-client.ts), 서버가 백엔드에 중계한다(ADR-0006).
// 토큰은 암호화한 httpOnly 쿠키에만 담고 브라우저에는 사용자 정보만 돌려준다.

/**
 * POST: 이메일과 비밀번호로 백엔드에 로그인하고 세션 쿠키를 만든다. 본문은 JSON만 받는다. 다른 사이트의 HTML 폼은 JSON
 * Content-Type으로 보낼 수 없고, 다른 사이트의 fetch는 JSON을 보내기 전에 CORS 사전 요청에서 막히므로, 다른 사이트가
 * 공격자의 계정으로 로그인시키지(login CSRF) 못한다.
 */
export async function postSession(request: NextRequest): Promise<NextResponse> {
  if (request.headers.get('content-type')?.startsWith('application/json') !== true) {
    return NextResponse.json({ message: '로그인 요청은 JSON으로 보내 주세요.' }, { status: 415 })
  }
  const credentials = LoginBody.safeParse(await request.json().catch(() => undefined))
  if (!credentials.success) {
    return NextResponse.json({ message: '이메일과 비밀번호를 확인해 주세요.' }, { status: 400 })
  }
  const session = await loginAtBackend(credentials.data)
  if (session === undefined) {
    return NextResponse.json({ message: '이메일이나 비밀번호가 맞지 않습니다.' }, { status: 401 })
  }
  const response = NextResponse.json<SessionResponse>({ user: session.user })
  response.cookies.set(SESSION_COOKIE, await sealSession(session), sessionCookieOptions())
  return response
}

/** GET: 지금 로그인한 사용자. 로그인하지 않았으면 user가 null이다(401로 답하면 브라우저 콘솔에 오류가 남는다). */
export async function getSession(request: NextRequest): Promise<NextResponse> {
  const session = await sessionOf(request.cookies)
  return NextResponse.json<SessionResponse>(
    { user: session?.user ?? null },
    { headers: { 'cache-control': 'no-store' } },
  )
}

/** DELETE: 백엔드에 로그아웃을 중계하고 세션 쿠키를 지운다. 백엔드가 실패해도 이 브라우저의 세션은 끝낸다. */
export async function deleteSession(request: NextRequest): Promise<NextResponse> {
  const session = await sessionOf(request.cookies)
  if (session !== undefined) {
    await relayLogout(session).catch((error: unknown) => {
      console.error('백엔드에 로그아웃을 알리지 못했습니다. 세션 쿠키는 지웁니다.', error)
    })
  }
  const response = new NextResponse(null, { status: 204 })
  response.cookies.set(SESSION_COOKIE, '', clearedSessionCookieOptions())
  return response
}

// accessToken이 만료되어 백엔드가 로그아웃을 받지 않으면(401) refresh한 뒤 새 토큰으로 다시 보낸다. 그러지 않으면 백엔드에서
// refreshToken이 살아 있어, 쿠키를 지운 뒤에도 그 토큰으로 계속 refresh할 수 있다.
async function relayLogout(session: Session): Promise<void> {
  if (await logoutAtBackend(session)) return
  const refreshed = await refreshSession(session)
  if (refreshed !== undefined) await logoutAtBackend(refreshed)
}
