// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getMe } from '@/shared/api/generated'
import type { User } from '@/shared/api/generated/model'
import { loginAtBackend } from './auth-backend'
import { MOCK_PASSWORD, mockUsers, resetMockUsers, saveMockUser } from './auth-mock-handlers'
import { refreshSession } from './refresh-session'

// 목 백엔드의 사용자 저장소(auth-mock-handlers.ts). 실제 백엔드의 사용자 테이블처럼 하나라서, 사용자를 더하고 고치는 다른 목
// 핸들러(예: 대시보드 Archetype)가 바꾼 사용자로 로그인과 refresh가 답한다. 이 파일은 서버처럼 window가 없는 Node.js에서
// 실행되고, 서버(BFF)가 목 백엔드를 부른다.

beforeEach(() => {
  vi.stubEnv('API_MOCKING', 'enabled')
  vi.stubEnv('API_BASE_URL', '')
  // 테스트가 바꾼 사용자는 테스트가 끝나면 되돌린다. 처음 사용자를 더 두는 Archetype과 함께 넣은 Starter에서도 그 사용자로 돌아간다.
  const before = mockUsers()
  return () => {
    resetMockUsers(before)
  }
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function loggedIn(email: string) {
  const session = await loginAtBackend({ email, password: MOCK_PASSWORD })
  if (session === undefined) throw new Error(`목 백엔드에 ${email}(으)로 로그인하지 못했습니다.`)
  return session
}

test('사용자의 역할을 바꾸면 목 백엔드는 이미 발급한 accessToken에도 바뀐 역할로 답하고, BFF 세션에는 refresh하거나 다시 로그인할 때 담긴다', async () => {
  const session = await loggedIn('user@example.com')
  expect(session.user.roles).toEqual(['user'])

  saveMockUser({ ...session.user, roles: ['admin', 'user'] })

  // 목 백엔드는 요청마다 accessToken의 사용자를 저장소에서 다시 찾는다.
  await expect(getMe({ headers: { authorization: `Bearer ${session.accessToken}` } })).resolves.toMatchObject({
    roles: ['admin', 'user'],
  })
  // 세션은 담아 둔 사용자를 쓰다가, 새 토큰을 받을 때 getMe로 사용자를 다시 받는다(auth-backend.ts).
  expect((await refreshSession(session))?.user.roles).toEqual(['admin', 'user'])
  expect((await loggedIn('user@example.com')).user.roles).toEqual(['admin', 'user'])
})

test('더한 사용자는 MOCK_PASSWORD로 로그인하고, 이메일을 바꾸면 바뀐 이메일로만 로그인한다', async () => {
  const added: User = { id: 100, email: 'added@example.com', name: '더한사용', roles: ['user'] }
  saveMockUser(added)

  expect((await loggedIn(added.email)).user).toEqual(added)

  saveMockUser({ ...added, email: 'renamed@example.com' })
  await expect(loginAtBackend({ email: added.email, password: MOCK_PASSWORD })).resolves.toBeUndefined()
  expect((await loggedIn('renamed@example.com')).user).toEqual({ ...added, email: 'renamed@example.com' })
})
