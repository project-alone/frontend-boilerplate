import 'server-only'
import { sealData, unsealData } from 'iron-session'
import * as z from 'zod'
import { type TokenPair, User } from '@/shared/api/generated/model'
import { SESSION_COOKIE } from './auth-client'

// 로그인 세션(ADR-0006). 백엔드가 발급한 accessToken·refreshToken과 사용자 정보를 암호화해 httpOnly 쿠키 하나에 담는다.
// 프론트엔드는 DB를 쓰지 않으므로 세션의 모든 정보가 이 쿠키에 있다. 쿠키는 서버(Route Handler, BFF 프록시, proxy,
// 서버 컴포넌트)만 읽고 쓰며, 브라우저의 JavaScript는 읽을 수 없다.

/** 세션이 유지되는 시간(초). 토큰을 refresh할 때마다 다시 늘어난다. 백엔드의 refreshToken 수명에 맞춘다. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14

/** accessToken이 만료되기 이 시간(ms) 전부터는 만료된 것으로 보고 refresh한다. 서버와 백엔드의 시계 차이를 견딘다. */
export const REFRESH_LEEWAY_MS = 5_000

// 브라우저가 쿠키 하나에 담는 크기(이름과 속성을 합해 4096바이트)보다 넉넉히 작게 잡는다.
const MAX_SEALED_LENGTH = 3_800

const MIN_SECRET_LENGTH = 32

const SessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** accessToken이 만료되는 시각(epoch ms) */
  accessTokenExpiresAt: z.number(),
  user: User,
})

/** 쿠키에 담는 로그인 세션 */
export type Session = z.output<typeof SessionSchema>

/** 백엔드가 발급한 토큰과 사용자로 세션을 만든다. now는 토큰을 받은 시각(epoch ms)이다. */
export function createSession(tokens: TokenPair, user: User, now = Date.now()): Session {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: now + tokens.expiresIn * 1000,
    user,
  }
}

/** accessToken이 만료되었거나 곧(REFRESH_LEEWAY_MS 안에) 만료되는가 */
export function isAccessTokenExpiring(session: Session, now = Date.now()): boolean {
  return session.accessTokenExpiresAt - REFRESH_LEEWAY_MS <= now
}

/** 세션을 암호화해 쿠키 값으로 만든다(iron-session). 쿠키 하나에 담기지 않으면 조용히 잘리지 않도록 실패한다. */
export async function sealSession(session: Session): Promise<string> {
  const sealed = await sealData(session, { password: sessionSecret(), ttl: SESSION_TTL_SECONDS })
  if (sealed.length > MAX_SEALED_LENGTH) {
    throw new Error(
      `세션 쿠키가 너무 큽니다(${String(sealed.length)}자). 브라우저는 쿠키 하나에 4KB까지만 담으므로 세션에 담는 사용자 정보를 줄이세요(README의 "인증").`,
    )
  }
  return sealed
}

/** 쿠키 값을 세션으로 되읽는다. 없거나, 고쳤거나, 만료되었거나, 다른 비밀 값으로 암호화한 값이면 undefined다. */
export async function unsealSession(sealed: string | undefined): Promise<Session | undefined> {
  if (sealed === undefined || sealed === '') return undefined
  const data = await unsealData<unknown>(sealed, { password: sessionSecret(), ttl: SESSION_TTL_SECONDS })
  const parsed = SessionSchema.safeParse(data)
  return parsed.success ? parsed.data : undefined
}

/** 요청의 쿠키(NextRequest.cookies, next/headers의 cookies())에서 세션을 읽는다. 없거나 되읽지 못하면 undefined */
export function sessionOf(cookies: {
  get: (name: string) => { value: string } | undefined
}): Promise<Session | undefined> {
  return unsealSession(cookies.get(SESSION_COOKIE)?.value)
}

/** 세션 쿠키를 지우는 쿠키의 속성(값은 빈 문자열) */
export function clearedSessionCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: 0 } as const
}

/** 세션 쿠키의 속성. 브라우저의 JavaScript는 읽을 수 없고(httpOnly), 다른 사이트에서 보낸 요청에는 실리지 않는다(SameSite=Lax). */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    // 배포한 서버(HTTPS)에서만 Secure를 붙인다. 브라우저는 http://localhost의 Secure 쿠키도 받는다.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // 세션(SESSION_TTL_SECONDS)보다 먼저 쿠키가 사라지게 한다.
    maxAge: SESSION_TTL_SECONDS - 60,
  } as const
}

/**
 * 세션 쿠키를 암호화하는 비밀 값. 서버에서만 읽는 환경 변수 SESSION_SECRET에서 가져온다. 개발 서버는 .env.development의 값을,
 * E2E 대상 서버는 playwright.config.ts의 값을 쓰고, 배포하는 서버에는 꼭 넣는다. 서버가 뜰 때 auth-instrumentation.ts가
 * 한 번 불러서, 빠졌으면 요청을 받기 전에 알린다.
 */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret === undefined || secret === '') {
    throw new Error(
      'SESSION_SECRET 환경 변수가 없습니다. 로그인 세션 쿠키를 암호화할 32자 이상의 비밀 값(예: `openssl rand -base64 32`의 출력)을 넣어 주세요(README의 "인증").',
    )
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET은 ${String(MIN_SECRET_LENGTH)}자 이상이어야 합니다. 추측할 수 없는 값(예: \`openssl rand -base64 32\`의 출력)을 넣어 주세요(README의 "인증").`,
    )
  }
  return secret
}
