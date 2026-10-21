// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/refresh-session.ts

import { requestNewTokens } from './auth-backend'
import type { Session } from './session'

// accessToken이 만료되면 브라우저가 동시에 보낸 여러 요청(BFF 프록시)과 페이지 요청(proxy)이 함께 refresh하려 한다. 백엔드는
// 쓴 refreshToken을 다시 받지 않으므로(rotation) 두 번째 refresh는 실패해 사용자가 로그아웃된다. 그래서 같은 refreshToken의
// refresh는 한 번만 백엔드에 보내고 나머지는 그 결과를 함께 받는다(single-flight). refresh가 끝난 뒤에도 REUSE_MS 동안은
// 결과를 남겨 두어, 이전 쿠키를 싣고 늦게 도착한 요청도 다시 refresh하지 않고 같은 새 토큰을 쓴다.
//
// 묶는 범위는 서버 프로세스 하나다. 서버를 여러 대 띄우면 같은 사용자의 요청이 서로 다른 서버에서 동시에 refresh할 수 있으므로,
// 백엔드가 같은 refreshToken을 잠시 다시 받아 주게 하거나(reuse interval) 같은 사용자의 요청을 한 서버로 보낸다(README의 "인증").

// 새 쿠키가 브라우저에 닿기 전에 이전 쿠키로 보낸 요청이 도착할 만큼만 남긴다. 길수록 이전 쿠키로 새 토큰을 받을 수 있는 시간도 길어진다.
const REUSE_MS = 10_000

interface Flight {
  readonly result: Promise<Session | undefined>
  /** 백엔드가 답한 시각. 아직 기다리는 중이면 undefined */
  settledAt?: number
}

// BFF 프록시(Route Handler)와 proxy는 따로 번들되어 이 모듈의 변수를 함께 쓰지 못하므로, 프로세스에 하나인 globalThis에 둔다.
const holder = globalThis as typeof globalThis & { authRefreshFlights?: Map<string, Flight> }

/**
 * 세션의 refreshToken으로 새 토큰을 받은 세션을 돌려준다. 같은 refreshToken으로 이미 refresh하는 중이거나 방금 했으면 그 결과를
 * 함께 받는다. 백엔드가 refreshToken을 받아 주지 않으면 undefined다(로그인이 끝남).
 */
export function refreshSession(session: Session): Promise<Session | undefined> {
  const flights = (holder.authRefreshFlights ??= new Map())
  const now = Date.now()
  for (const [token, flight] of flights) {
    if (flight.settledAt !== undefined && now - flight.settledAt > REUSE_MS) flights.delete(token)
  }

  const existing = flights.get(session.refreshToken)
  if (existing !== undefined) return existing.result

  const flight: Flight = { result: requestNewTokens(session) }
  flights.set(session.refreshToken, flight)
  flight.result.then(
    () => {
      flight.settledAt = Date.now()
    },
    // 백엔드 장애 같은 실패는 남겨 두지 않아 다음 요청이 다시 시도한다.
    () => flights.delete(session.refreshToken),
  )
  return flight.result
}
