// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/server-session.ts

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LOGIN_PATH } from './access-rules'
import { type Session, sessionOf } from './session'
import { rememberSessionForRender } from './session-scope'

/**
 * 서버 컴포넌트에서 로그인 세션을 읽는다. 읽은 세션의 accessToken은 같은 렌더링에서 부르는 apiFetch의 요청(서버 컴포넌트가
 * 백엔드를 직접 부름)에 붙는다(auth-backend-fetch.ts). 그래서 인증이 필요한 API를 부르는 페이지는 데이터를 가져오기 전에
 * 이 함수를 먼저 부른다. 쿠키를 읽으므로 부른 라우트는 요청마다 렌더링된다(SSR).
 *
 * accessToken이 곧 만료되면 proxy(auth-proxy.ts)가 페이지를 렌더링하기 전에 refresh해 두므로 여기서는 refresh하지 않는다
 * (서버 컴포넌트는 쿠키를 고칠 수 없다).
 */
export async function getServerSession(): Promise<Session | undefined> {
  const session = await sessionOf(await cookies())
  rememberSessionForRender(session)
  return session
}

/** getServerSession과 같고, 로그인하지 않았으면 로그인 페이지로 보낸다. 보호된 라우트는 proxy가 먼저 거르므로 한 번 더 확인하는 셈이다. */
export async function requireServerSession(): Promise<Session> {
  const session = await getServerSession()
  if (session === undefined) redirect(LOGIN_PATH)
  return session
}
