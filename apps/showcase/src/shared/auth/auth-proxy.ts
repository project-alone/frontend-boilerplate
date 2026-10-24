// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/auth-proxy.ts

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { canEnter, FORBIDDEN_PATH, LOGIN_PATH, protectedRouteOf } from './access-rules'
import { SESSION_COOKIE } from './auth-client'
import { refreshSession } from './refresh-session'
import {
  clearedSessionCookieOptions,
  isAccessTokenExpiring,
  sealSession,
  sessionCookieOptions,
  unsealSession,
} from './session'

/** 세션 쿠키를 새 값으로 바꾸거나(string) 지운다(null). 바꾸지 않으면 undefined */
type CookieChange = string | null | undefined

/**
 * proxy 처리기(src/proxy.ts가 부른다): 페이지 요청이 라우트에 닿기 전에 로그인과 역할을 확인한다.
 *
 * 1. accessToken이 곧 만료되면 미리 refresh해 새 세션 쿠키를 라우트에 넘기고 응답에 싣는다. 서버 컴포넌트는 쿠키를 고칠 수
 *    없으므로, 서버 컴포넌트가 백엔드를 부를 때 쓰는 토큰은 여기서 새로 받아 둔다.
 * 2. 보호된 라우트(access-rules.ts)에 로그인하지 않고 들어오면 돌아올 주소(next)를 담아 로그인 페이지로 보낸다.
 * 3. 역할이 맞지 않으면 주소는 그대로 두고 접근 권한 없음 페이지를 403으로 보여 준다.
 */
export async function authProxy(
  request: NextRequest,
  next: (request?: NextRequest) => Promise<NextResponse>,
): Promise<NextResponse> {
  const sealed = request.cookies.get(SESSION_COOKIE)?.value
  let session = await unsealSession(sealed)
  // 되읽지 못한 세션 쿠키(만료, 비밀 값을 바꿈 등)는 지운다.
  let change: CookieChange = sealed !== undefined && session === undefined ? null : undefined

  if (session !== undefined && isAccessTokenExpiring(session)) {
    session = await refreshSession(session)
    change = session === undefined ? null : await sealSession(session)
  }

  const route = protectedRouteOf(request.nextUrl.pathname)
  if (route !== undefined && session === undefined) {
    const login = new URL(LOGIN_PATH, request.url)
    login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return withSessionCookie(NextResponse.redirect(login), change)
  }
  if (route !== undefined && session !== undefined && !canEnter(route, session.user)) {
    return withSessionCookie(NextResponse.rewrite(new URL(FORBIDDEN_PATH, request.url), { status: 403 }), change)
  }

  const response = await next(change === undefined ? request : withRequestCookie(request, change))
  return withSessionCookie(response, change)
}

// 라우트(서버 컴포넌트)가 바뀐 세션 쿠키를 읽도록 쿠키를 고친 요청을 만든다.
function withRequestCookie(request: NextRequest, change: string | null): NextRequest {
  const forwarded = new NextRequest(request)
  if (change === null) forwarded.cookies.delete(SESSION_COOKIE)
  else forwarded.cookies.set(SESSION_COOKIE, change)
  return forwarded
}

function withSessionCookie(response: NextResponse, change: CookieChange): NextResponse {
  if (change === null) response.cookies.set(SESSION_COOKIE, '', clearedSessionCookieOptions())
  else if (change !== undefined) response.cookies.set(SESSION_COOKIE, change, sessionCookieOptions())
  return response
}
