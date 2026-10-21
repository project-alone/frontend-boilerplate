// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/shared/dashboard/dashboard-routes.test.ts

import { expect, test } from 'vitest'
import type { User } from '@/shared/api/generated/model'
import { canManageUsers, canVisit, DASHBOARD_PATH, editUserPath, NEW_USER_PATH, USERS_PATH } from './dashboard-routes'

// 누가 어느 대시보드 화면에 들어가는지는 auth Recipe의 접근 규칙(src/shared/auth/access-rules.ts)에 대시보드 Archetype이 더한
// 규칙을 따른다.

const USER: User = { id: 1, email: 'user@example.com', name: '김사용', roles: ['user'] }
const ADMIN: User = { id: 2, email: 'admin@example.com', name: '박관리', roles: ['admin', 'user'] }

test('로그인한 사용자는 역할과 상관없이 개요와 사용자 목록에 들어간다', () => {
  for (const user of [USER, ADMIN]) {
    expect(canVisit(DASHBOARD_PATH, user)).toBe(true)
    expect(canVisit(USERS_PATH, user)).toBe(true)
  }
})

test('사용자를 추가하고 고치는 화면은 관리자만 들어간다', () => {
  expect(canVisit(NEW_USER_PATH, ADMIN)).toBe(true)
  expect(canVisit(editUserPath(1), ADMIN)).toBe(true)
  expect(canManageUsers(ADMIN)).toBe(true)

  expect(canVisit(NEW_USER_PATH, USER)).toBe(false)
  expect(canVisit(editUserPath(1), USER)).toBe(false)
  expect(canManageUsers(USER)).toBe(false)
})
