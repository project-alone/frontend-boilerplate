import { beforeEach, expect, onTestFinished, test } from 'vitest'
import { createUser, getMe, getUser, getUserStats, listUsers, updateUser } from '@/shared/api/generated'
import type { NewUserAccount, UserAccountUpdate } from '@/shared/api/generated/model'
import { signInAsMockUser } from '@/shared/auth/mock-session'
import { resetMockUsers } from './users'

// 대시보드의 목 백엔드는 실제 백엔드처럼 요청의 accessToken으로 로그인과 역할을 확인한다(명세의 bearerAuth, 401, 403).
// accessToken은 auth Recipe의 목 백엔드가 발급하고, 테스트에서는 signInAsMockUser가 BFF 프록시 대신 붙인다. 사용자의 이름,
// 이메일, 역할은 auth의 목 백엔드와 같은 사용자 저장소에 있어, 대시보드에서 바꾸면 로그인한 사용자(getMe)도 바뀐다. 요청은
// Vitest의 MSW(@/shared/mocks/node)가 받는다.

const NEW_USER: NewUserAccount = { name: '신입사', email: 'newbie@example.com', role: 'user' }
const SUSPENDED: UserAccountUpdate = { name: '김사용', email: 'user@example.com', role: 'user', status: 'suspended' }
// 처음 사용자 가운데 user@example.com(1, 사용자)과 hajun.jung@example.com(5, 관리자)
const KIM: UserAccountUpdate = { name: '김사용', email: 'user@example.com', role: 'user', status: 'active' }
const HAJUN: UserAccountUpdate = { name: '정하준', email: 'hajun.jung@example.com', role: 'admin', status: 'active' }

beforeEach(() => {
  resetMockUsers()
})

// 사용자 관리 operation마다 한 번씩 부른다(재생성 계층의 fetch 함수).
const OPERATIONS = [
  ['listUsers', () => listUsers()],
  ['getUserStats', () => getUserStats()],
  ['getUser', () => getUser(1)],
  ['createUser', () => createUser(NEW_USER)],
  ['updateUser', () => updateUser(1, SUSPENDED)],
] as const

test.each(OPERATIONS)('로그인하지 않고 부른 %s는 401로 거절한다', async (_operationId, call) => {
  await expect(call()).rejects.toMatchObject({ name: 'ApiError', status: 401 })
})

test('목 백엔드가 발급하지 않았거나 만료된 accessToken도 401로 거절한다', async () => {
  const unknownToken = { headers: { authorization: 'Bearer mock-access-unknown' } }

  await expect(listUsers(undefined, unknownToken)).rejects.toMatchObject({ status: 401 })
})

test('관리자가 아닌 사용자는 목록·통계·상세를 보지만, 사용자를 추가하거나 고치면 403으로 거절하고 아무것도 바꾸지 않는다', async () => {
  onTestFinished(signInAsMockUser('user@example.com'))

  await expect(getUserStats()).resolves.toMatchObject({ total: 12 })
  await expect(createUser(NEW_USER)).rejects.toMatchObject({ name: 'ApiError', status: 403 })
  await expect(updateUser(1, SUSPENDED)).rejects.toMatchObject({ name: 'ApiError', status: 403 })

  await expect(listUsers({ q: NEW_USER.email })).resolves.toMatchObject({ total: 0 })
  await expect(getUser(1)).resolves.toMatchObject({ status: 'active' })
})

test('관리자는 사용자를 추가하고 고친다', async () => {
  onTestFinished(signInAsMockUser('admin@example.com'))

  await expect(createUser(NEW_USER)).resolves.toMatchObject({ ...NEW_USER, status: 'invited' })
  await expect(updateUser(1, SUSPENDED)).resolves.toMatchObject(SUSPENDED)
  await expect(getUserStats()).resolves.toMatchObject({ total: 13 })
})

/** 관리자(admin@example.com)로 로그인해 사용자를 고친다. 로그인은 고친 뒤 되돌린다. */
async function updateAsAdmin(userId: number, update: UserAccountUpdate) {
  const signOut = signInAsMockUser('admin@example.com')
  try {
    return await updateUser(userId, update)
  } finally {
    signOut()
  }
}

test('관리자가 다른 관리자를 사용자로 바꾸면, 그 계정으로 다시 로그인했을 때 사용자로 답하고 추가·수정을 403으로 거절한다', async () => {
  await updateAsAdmin(5, { ...HAJUN, role: 'user' })

  onTestFinished(signInAsMockUser(HAJUN.email))
  await expect(getMe()).resolves.toMatchObject({ email: HAJUN.email, roles: ['user'] })
  await expect(createUser(NEW_USER)).rejects.toMatchObject({ name: 'ApiError', status: 403 })
  await expect(updateUser(5, HAJUN)).rejects.toMatchObject({ name: 'ApiError', status: 403 })
})

test('관리자가 사용자를 관리자로 바꾸면, 그 계정으로 다시 로그인했을 때 관리자로 답하고 사용자를 추가한다', async () => {
  await updateAsAdmin(1, { ...KIM, role: 'admin' })

  onTestFinished(signInAsMockUser(KIM.email))
  await expect(getMe()).resolves.toMatchObject({ email: KIM.email, roles: ['admin', 'user'] })
  await expect(createUser(NEW_USER)).resolves.toMatchObject(NEW_USER)
})

test('추가한 사용자도 목 계정이라 MOCK_PASSWORD로 로그인하고, 바꾼 이름과 이메일은 로그인한 사용자에도 반영된다', async () => {
  const signOut = signInAsMockUser('admin@example.com')
  const created = await createUser({ ...NEW_USER, role: 'admin' })
  await updateUser(created.id, { name: '신입관리', email: 'renamed@example.com', role: 'admin', status: 'active' })
  signOut()

  onTestFinished(signInAsMockUser('renamed@example.com'))
  await expect(getMe()).resolves.toEqual({
    id: created.id,
    name: '신입관리',
    email: 'renamed@example.com',
    roles: ['admin', 'user'],
  })
})
