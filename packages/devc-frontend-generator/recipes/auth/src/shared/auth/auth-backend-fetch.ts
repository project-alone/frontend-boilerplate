import { parseCookie, stringifyCookie, stringifySetCookie } from 'cookie'
import { refreshSession } from './refresh-session'
import { type Session, SESSION_COOKIE, sealSession, sessionCookieOptions, unsealSession } from './session'
import { sessionOfRender } from './session-scope'

type Next = (url: string, init: RequestInit) => Promise<Response>

/**
 * backendFetch 처리기(ADR-0006): 서버가 백엔드로 보내는 요청에 로그인한 사용자의 accessToken을 붙인다.
 *
 * - BFF 프록시(/api/proxy/*)가 전달하는 브라우저의 요청: 요청에 실린 세션 쿠키의 accessToken을 붙인다. 세션 쿠키는 백엔드가
 *   쓰지 않으므로 넘기지 않는다. 백엔드가 401로 답하면 refresh한 뒤 한 번 다시 보내고, 응답에 새 세션 쿠키를 싣는다.
 *   동시에 여러 요청이 401을 받아도 refresh는 한 번만 한다(refresh-session.ts). refresh도 실패하면 세션 쿠키를 지운다.
 * - 서버 컴포넌트가 부른 apiFetch: 그 렌더링에서 getServerSession()으로 읽은 세션의 accessToken을 붙인다(session-scope.ts).
 *   서버 컴포넌트는 쿠키를 고칠 수 없으므로 refresh하지 않는다. 대신 페이지 요청은 proxy(auth-proxy.ts)가 accessToken이
 *   만료되기 전에 미리 refresh해 둔다.
 * - 이미 Authorization 헤더가 있는 요청(예: BFF가 직접 부르는 인증 operation)과 로그인하지 않은 요청은 그대로 보낸다.
 */
export async function authBackendFetch(url: string, init: RequestInit, next: Next): Promise<Response> {
  const headers = new Headers(init.headers)
  if (headers.has('authorization')) return next(url, init)

  const { [SESSION_COOKIE]: sealed, ...otherCookies } = parseCookie(headers.get('cookie') ?? '')
  if (sealed !== undefined) {
    const forwardedCookies = stringifyCookie(otherCookies)
    if (forwardedCookies === '') headers.delete('cookie')
    else headers.set('cookie', forwardedCookies)
    return forwardBrowserRequest(url, { ...init, headers }, await unsealSession(sealed), next)
  }

  const session = sessionOfRender()
  if (session === undefined) return next(url, init)
  return next(url, withAccessToken(init, session))
}

async function forwardBrowserRequest(
  url: string,
  init: RequestInit,
  session: Session | undefined,
  next: Next,
): Promise<Response> {
  // 되읽지 못한 세션 쿠키(만료, 비밀 값을 바꿈 등)는 지운다.
  if (session === undefined) return withSetCookie(await next(url, init), clearedSessionCookie())

  const response = await next(url, withAccessToken(init, session))
  if (response.status !== 401) return response

  const refreshed = await refreshSession(session)
  if (refreshed === undefined) return withSetCookie(response, clearedSessionCookie())
  // 다시 보내기 전에 쓰지 않을 401 응답의 본문을 끝까지 읽어 연결을 놓아준다. body.cancel()은 쓰지 않는다. Next.js의 fetch는
  // 응답 본문을 둘로 나눠(tee) 쓰므로, 한쪽만 cancel하면 다른 쪽이 끝날 때까지 기다리느라 멈춘다.
  await response.arrayBuffer()
  const retried = await next(url, withAccessToken(init, refreshed))
  return withSetCookie(
    retried,
    stringifySetCookie({ name: SESSION_COOKIE, value: await sealSession(refreshed), ...sessionCookieOptions() }),
  )
}

function withAccessToken(init: RequestInit, session: Session): RequestInit {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${session.accessToken}`)
  return { ...init, headers }
}

function clearedSessionCookie(): string {
  return stringifySetCookie({ name: SESSION_COOKIE, value: '', ...sessionCookieOptions(), maxAge: 0 })
}

// fetch가 돌려준 응답의 헤더는 고칠 수 없으므로 헤더를 복사한 새 응답을 만든다. BFF 프록시가 이 헤더를 브라우저에 넘긴다.
function withSetCookie(response: Response, setCookie: string): Response {
  const headers = new Headers([...response.headers])
  headers.append('set-cookie', setCookie)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
