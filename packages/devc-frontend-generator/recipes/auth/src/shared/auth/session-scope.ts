import { cache } from 'react'
import type { Session } from './session'

// 서버 컴포넌트를 렌더링하는 동안(요청 하나)만 사는 세션 자리. React의 cache는 서버 컴포넌트를 렌더링하는 동안 요청마다 따로
// 값을 기억하고, 렌더링 밖(Route Handler, proxy)에서는 기억하지 않는다. server-session.ts가 쿠키에서 읽은 세션을 여기에 두면,
// 같은 렌더링에서 부른 apiFetch의 요청에 auth-backend-fetch.ts가 그 세션의 accessToken을 붙인다.
//
// 쿠키를 읽은 라우트는 요청마다 렌더링되므로(SSR), 모든 서버 요청이 알아서 쿠키를 읽게 하지 않고 세션을 읽은 렌더링에서만 붙인다.
// 그래서 로그인과 상관없는 SSG·ISR 페이지는 그대로 미리 렌더링된다.
const currentRender = cache((): { session: Session | undefined } => ({ session: undefined }))

/** 지금 렌더링에서 읽은 세션을 기억한다. */
export function rememberSessionForRender(session: Session | undefined): void {
  currentRender().session = session
}

/** 지금 렌더링에서 읽은 세션. 읽지 않았거나 렌더링 밖이면 undefined */
export function sessionOfRender(): Session | undefined {
  return currentRender().session
}
