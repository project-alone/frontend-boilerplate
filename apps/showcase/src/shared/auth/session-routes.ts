// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/session-routes.ts

import { type NextRequest, NextResponse } from 'next/server'
import { LoginBody } from '@/shared/api/generated/model'
import { loginWithPassword, logoutAtBackend } from './auth-backend'
import type { SessionResponse } from './auth-client'
import { SESSION_COOKIE, sealSession, sessionCookieOptions, unsealSession } from './session'

// 로그인 세션 Route Handler(src/app/api/session/route.ts). 브라우저가 부르고(auth-client.ts), 서버가 백엔드에 중계한다(ADR-0006).
// 토큰은 암호화한 httpOnly 쿠키에만 담고 브라우저에는 사용자 정보만 돌려준다.

/** POST: 이메일과 비밀번호로 백엔드에 로그인하고 세션 쿠키를 만든다. */
export async function loginRoute(request: NextRequest): Promise<NextResponse> {
  const credentials = LoginBody.safeParse(await request.json().catch(() => undefined))
  if (!credentials.success) {
    return NextResponse.json({ message: '이메일과 비밀번호를 확인해 주세요.' }, { status: 400 })
  }
  const session = await loginWithPassword(credentials.data)
  if (session === undefined) {
    return NextResponse.json({ message: '이메일이나 비밀번호가 맞지 않습니다.' }, { status: 401 })
  }
  const response = NextResponse.json<SessionResponse>({ user: session.user })
  response.cookies.set(SESSION_COOKIE, await sealSession(session), sessionCookieOptions())
  return response
}

/** GET: 지금 로그인한 사용자. 로그인하지 않았으면 user가 null이다(401로 답하면 브라우저 콘솔에 오류가 남는다). */
export async function getSessionUser(request: NextRequest): Promise<NextResponse> {
  const session = await unsealSession(request.cookies.get(SESSION_COOKIE)?.value)
  return NextResponse.json<SessionResponse>(
    { user: session?.user ?? null },
    { headers: { 'cache-control': 'no-store' } },
  )
}

/** DELETE: 백엔드에 로그아웃을 중계하고 세션 쿠키를 지운다. 백엔드가 실패해도 이 브라우저의 세션은 끝낸다. */
export async function logoutRoute(request: NextRequest): Promise<NextResponse> {
  const session = await unsealSession(request.cookies.get(SESSION_COOKIE)?.value)
  if (session !== undefined) {
    await logoutAtBackend(session).catch((error: unknown) => {
      console.error('백엔드에 로그아웃을 알리지 못했습니다. 세션 쿠키는 지웁니다.', error)
    })
  }
  const response = new NextResponse(null, { status: 204 })
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 })
  return response
}
