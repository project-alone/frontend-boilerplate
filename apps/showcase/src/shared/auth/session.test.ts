// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/session.test.ts

// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest'
import { createSession, sealSession, unsealSession } from './session'

// 이 파일은 서버(Route Handler, BFF 프록시, proxy)처럼 window가 없는 Node.js에서 실행된다.

const SECRET = 'test-only-session-secret-0123456789abcdef'
const USER = { id: 1, email: 'user@example.com', name: '김사용', roles: ['user' as const] }
const TOKENS = { accessToken: 'access-token-1', refreshToken: 'refresh-token-1', expiresIn: 60 }

afterEach(() => {
  vi.unstubAllEnvs()
})

test('세션은 토큰이 보이지 않게 암호화한 쿠키 값이 되고, 같은 비밀 값으로만 다시 읽힌다', async () => {
  vi.stubEnv('SESSION_SECRET', SECRET)
  const session = createSession(TOKENS, USER)

  const sealed = await sealSession(session)

  expect(sealed).not.toContain(TOKENS.accessToken)
  expect(sealed).not.toContain(TOKENS.refreshToken)
  expect(sealed).not.toContain(USER.email)
  expect(await unsealSession(sealed)).toEqual(session)

  vi.stubEnv('SESSION_SECRET', 'another-session-secret-0123456789abcdef')
  expect(await unsealSession(sealed)).toBeUndefined()
})

test('고친 쿠키 값이나 세션이 아닌 값은 로그인하지 않은 것으로 본다', async () => {
  vi.stubEnv('SESSION_SECRET', SECRET)
  const sealed = await sealSession(createSession(TOKENS, USER))

  expect(await unsealSession(`${sealed.slice(0, -4)}AAAA`)).toBeUndefined()
  expect(await unsealSession('not-a-session')).toBeUndefined()
  expect(await unsealSession(undefined)).toBeUndefined()
})

test('accessToken의 만료 시각은 토큰을 받은 시각에 expiresIn(초)을 더한 것이다', () => {
  const session = createSession(TOKENS, USER, Date.UTC(2026, 0, 1))

  expect(session.accessTokenExpiresAt).toBe(Date.UTC(2026, 0, 1, 0, 1))
})

test('SESSION_SECRET이 없거나 32자보다 짧으면 무엇을 넣어야 하는지 알려 주며 실패한다', async () => {
  const session = createSession(TOKENS, USER)

  vi.stubEnv('SESSION_SECRET', '')
  await expect(sealSession(session)).rejects.toThrow('SESSION_SECRET 환경 변수가 없습니다')

  vi.stubEnv('SESSION_SECRET', 'too-short')
  await expect(sealSession(session)).rejects.toThrow('SESSION_SECRET은 32자 이상')
})

test('세션이 쿠키 하나에 담기지 않을 만큼 크면 조용히 잘리지 않도록 실패한다', async () => {
  vi.stubEnv('SESSION_SECRET', SECRET)

  await expect(sealSession(createSession({ ...TOKENS, accessToken: 'a'.repeat(4000) }, USER))).rejects.toThrow(
    '세션 쿠키가 너무 큽니다',
  )
})
