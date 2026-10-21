// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/shared/mocks/users.test.ts

import { beforeEach, expect, onTestFinished, test } from 'vitest'
import { createUser, getUser, getUserStats, listUsers, updateUser } from '@/shared/api/generated'
import type { NewUserAccount, UserAccountUpdate } from '@/shared/api/generated/model'
import { signInAsMockUser } from '@/shared/auth/mock-session'
import { resetMockUsers } from './users'

// 대시보드의 목 백엔드는 실제 백엔드처럼 요청의 accessToken으로 로그인과 역할을 확인한다(명세의 bearerAuth, 401, 403).
// accessToken은 auth Recipe의 목 백엔드가 발급하고, 테스트에서는 signInAsMockUser가 BFF 프록시 대신 붙인다. 요청은 Vitest의
// MSW(@/shared/mocks/node)가 받는다.

const NEW_USER: NewUserAccount = { name: '신입사', email: 'newbie@example.com', role: 'user' }
const SUSPENDED: UserAccountUpdate = { name: '김사용', email: 'user@example.com', role: 'user', status: 'suspended' }

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
