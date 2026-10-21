// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/access-rules.ts

import type { Role, User } from '@/shared/api/generated/model'

// 보호된 라우트와 역할 기반 접근 규칙. 페이지 요청은 proxy(auth-proxy.ts)가 라우트에 닿기 전에 이 규칙으로 거른다.
// 라우트를 보호하려면 여기에 더한다. 서버 컴포넌트에서 한 번 더 확인하려면 requireServerSession()을 쓴다.

/** 로그인 페이지. 로그인하지 않은 사용자를 보호된 라우트에서 이리로 보낸다. */
export const LOGIN_PATH = '/login'

/** 역할이 맞지 않는 사용자에게 보여 주는 페이지 */
export const FORBIDDEN_PATH = '/forbidden'

/** 로그인한 사용자의 정보 페이지. 머리글의 사용자 메뉴가 잇는다. */
export const ACCOUNT_PATH = '/account'

export interface ProtectedRoute {
  /** 이 경로와 그 아래 경로(예: /admin, /admin/users)를 보호한다. */
  path: string
  /** 있으면 이 역할 가운데 하나를 가진 사용자만 들어간다. 없으면 로그인한 사용자는 모두 들어간다. */
  roles?: readonly Role[]
}

/** 보호된 라우트. 위에 적은 규칙부터 보므로 더 구체적인 경로를 위에 둔다. */
export const PROTECTED_ROUTES: readonly ProtectedRoute[] = [
  { path: '/admin', roles: ['admin'] },
  { path: ACCOUNT_PATH },
]

/**
 * sitemap 규칙(확장 지점 sitemap, src/app/sitemap-rules.ts). sitemap을 만드는 Recipe(seo 등)가 있으면 보호된 라우트와 로그인·접근
 * 권한 없음 페이지를 sitemap에 넣지 않는다. robots.txt로는 막지 않는다. 보호된 라우트는 로그인하지 않은 요청을 로그인 페이지로
 * 보내 공개된 내용이 없고 그 페이지들은 metadata의 robots: { index: false }로 검색 결과에서 빠지므로, robots.txt에 적으면 누구나
 * 읽는 파일에 보호된 주소를 알려 줄 뿐이다. 로그인 페이지도 막지 않아야 검색 엔진이 noindex를 읽는다. sitemap이 없는 Starter에서는
 * 쓰이지 않는다.
 */
export const authSitemapRules = {
  exclude: [...PROTECTED_ROUTES.map(({ path }) => path), LOGIN_PATH, FORBIDDEN_PATH],
}

/** pathname을 보호하는 규칙. 보호하지 않는 경로면 undefined */
export function protectedRouteOf(pathname: string): ProtectedRoute | undefined {
  return PROTECTED_ROUTES.find(({ path }) => pathname === path || pathname.startsWith(`${path}/`))
}

/** 사용자가 이 규칙의 라우트에 들어갈 수 있는가 */
export function canEnter(route: ProtectedRoute, user: User): boolean {
  return route.roles === undefined || route.roles.some((role) => user.roles.includes(role))
}

// 돌아갈 주소를 이 앱의 주소로 풀어 보려고 쓰는 가짜 출처
const APP_ORIGIN = 'https://app.invalid'

/**
 * 로그인한 뒤 돌아갈 주소. 다른 사이트로 보내지 못하도록(open redirect) 이 앱 안의 경로만 받고, 아니면 홈으로 보낸다.
 * 브라우저처럼 URL로 풀어 출처가 그대로이고, 푼 경로가 다시 `//`(다른 사이트)로 시작하지 않는지 본다. 문자열만 보면
 * `/\t/evil.example.com`(브라우저가 탭을 지움)이나 `/..//evil.example.com`(`..`을 풂)처럼 `//evil.example.com`이 되는 값을 놓친다.
 */
export function returnPathOf(next: string | null | undefined): string {
  if (next?.startsWith('/') !== true) return '/'
  const url = new URL(next, APP_ORIGIN)
  if (url.origin !== APP_ORIGIN || url.pathname.startsWith('//')) return '/'
  return `${url.pathname}${url.search}${url.hash}`
}
