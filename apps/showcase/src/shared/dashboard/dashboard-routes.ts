// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/shared/dashboard/dashboard-routes.ts

import type { User } from '@/shared/api/generated/model'
import { canEnter, protectedRouteOf } from '@/shared/auth/access-rules'

// 대시보드 Archetype의 라우트(src/app/dashboard). 누가 들어갈 수 있는지는 auth Recipe의 접근 규칙
// (src/shared/auth/access-rules.ts의 PROTECTED_ROUTES)에 적고, 화면은 그 규칙을 보고 링크를 보이거나 숨긴다.

/** 대시보드 개요. 로그인한 사용자 모두 들어간다. */
export const DASHBOARD_PATH = '/dashboard'

/** 사용자 목록. 로그인한 사용자 모두 들어간다. */
export const USERS_PATH = '/dashboard/users'

/** 사용자 추가. 관리자만 들어간다. */
export const NEW_USER_PATH = '/dashboard/users/new'

/** 사용자 수정. 관리자만 들어간다. */
export function editUserPath(userId: number): string {
  return `${USERS_PATH}/${String(userId)}/edit`
}

/** 사용자가 pathname에 들어갈 수 있는가. 보호하지 않는 경로면 늘 들어간다. */
export function canVisit(pathname: string, user: User): boolean {
  const route = protectedRouteOf(pathname)
  return route === undefined || canEnter(route, user)
}

/** 사용자를 추가하고 고치는 화면에 들어갈 수 있는가. 두 화면은 같은 역할 규칙(관리자)을 쓴다. */
export function canManageUsers(user: User): boolean {
  return canVisit(NEW_USER_PATH, user)
}
