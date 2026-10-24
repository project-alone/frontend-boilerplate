import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import { TokenPair } from '@/shared/api/generated/model'
import { MOCK_PASSWORD } from './auth-mock-handlers'

/**
 * 테스트(Vitest)의 브라우저 코드가 email의 목 사용자(auth-mock-handlers.ts의 사용자 저장소. 처음에는 MOCK_USERS)로 로그인한
 * 것처럼 목 백엔드를 부르게 하고, 되돌리는 함수를 돌려준다.
 *
 *   beforeEach(() => signInAsMockUser('admin@example.com')) // 돌려준 함수로 테스트가 끝날 때마다 되돌린다
 *   onTestFinished(signInAsMockUser('user@example.com'))     // 테스트 하나에서만
 *
 * 앱에서는 브라우저의 요청을 BFF 프록시가 받아 세션 쿠키의 accessToken을 붙여 백엔드로 보낸다(auth-backend-fetch.ts). 테스트에는
 * BFF 프록시가 없어 브라우저 코드가 목 백엔드를 바로 부르므로(src/shared/api/base-url.ts) 그 일을 fetch에서 대신한다.
 * 목 백엔드로 가는 요청마다 목 백엔드에 로그인해 새로 받은 accessToken을 붙이므로 테스트가 길어져도 토큰이 만료되지 않고,
 * 인증이 필요한 목 핸들러는 실제 백엔드처럼 그 사용자의 역할을 보고 답한다. 부르지 않은 테스트의 요청에는 accessToken이 없다
 * (로그인하지 않음).
 */
export function signInAsMockUser(email: string): () => void {
  const fetchWithoutSession = globalThis.fetch

  const issueAccessToken = async (): Promise<string> => {
    const response = await fetchWithoutSession(`${MOCK_API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: MOCK_PASSWORD }),
    })
    if (!response.ok) throw new Error(`목 사용자 ${email}(으)로 로그인하지 못했습니다(${String(response.status)}).`)
    return TokenPair.parse(await response.json()).accessToken
  }

  const fetchWithSession: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString()
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    // 이미 accessToken을 붙인 요청(예: 테스트가 직접 고른 토큰)은 그대로 보낸다.
    if (!url.startsWith(`${MOCK_API_BASE_URL}/`) || headers.has('authorization')) {
      return fetchWithoutSession(input, init)
    }
    headers.set('authorization', `Bearer ${await issueAccessToken()}`)
    return fetchWithoutSession(input, { ...init, headers })
  }

  // fetch는 함수로 선언되어 있어 대입할 수 없으므로 config/vitest.setup.ts의 dns.lookup처럼 Object.assign으로 바꾼다.
  Object.assign(globalThis, { fetch: fetchWithSession })
  return () => {
    Object.assign(globalThis, { fetch: fetchWithoutSession })
  }
}
