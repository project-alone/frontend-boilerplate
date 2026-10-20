// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/access-rules.ts

import type { Role, User } from '@/shared/api/generated/model'

// 보호된 라우트와 역할 기반 접근 규칙. 페이지 요청은 proxy(auth-proxy.ts)가 라우트에 닿기 전에 이 규칙으로 거른다.
// 라우트를 보호하려면 여기에 더한다. 서버 컴포넌트에서 한 번 더 확인하려면 requireServerSession()을 쓴다.

/** 로그인 페이지. 로그인하지 않은 사용자를 보호된 라우트에서 이리로 보낸다. */
export const LOGIN_PATH = '/login'

/** 역할이 맞지 않는 사용자에게 보여 주는 페이지 */
export const FORBIDDEN_PATH = '/forbidden'

export interface ProtectedRoute {
  /** 이 경로와 그 아래 경로(예: /admin, /admin/users)를 보호한다. */
  path: string
  /** 있으면 이 역할 가운데 하나를 가진 사용자만 들어간다. 없으면 로그인한 사용자는 모두 들어간다. */
  roles?: readonly Role[]
}

/** 보호된 라우트. 위에 적은 규칙부터 보므로 더 구체적인 경로를 위에 둔다. */
export const PROTECTED_ROUTES: readonly ProtectedRoute[] = [{ path: '/admin', roles: ['admin'] }, { path: '/account' }]

/** pathname을 보호하는 규칙. 보호하지 않는 경로면 undefined */
export function protectedRouteOf(pathname: string): ProtectedRoute | undefined {
  return PROTECTED_ROUTES.find(({ path }) => pathname === path || pathname.startsWith(`${path}/`))
}

/** 사용자가 이 규칙의 라우트에 들어갈 수 있는가 */
export function canEnter(route: ProtectedRoute, user: User): boolean {
  return route.roles === undefined || route.roles.some((role) => user.roles.includes(role))
}

/**
 * 로그인한 뒤 돌아갈 주소. 다른 사이트로 보내지 못하도록 이 앱 안의 경로(`/`로 시작하고 `//`나 `/\`로 시작하지 않음)만
 * 받고, 아니면 홈으로 보낸다.
 */
export function returnPathOf(next: string | null | undefined): string {
  if (next?.startsWith('/') !== true || next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}
