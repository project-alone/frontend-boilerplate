// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/access-rules.test.ts

import { expect, test } from 'vitest'
import {
  authSitemapRules,
  FORBIDDEN_PATH,
  LOGIN_PATH,
  PROTECTED_ROUTES,
  type ProtectedRoute,
  protectedRouteOf,
  returnPathOf,
} from './access-rules'

// 더 구체적인 규칙을 위에 둔다(PROTECTED_ROUTES와 같다).
const ROUTES = [
  { path: '/teams/[teamId]/settings', roles: ['admin'] },
  { path: '/teams' },
] as const satisfies readonly ProtectedRoute[]

test.each([
  ['규칙의 경로', '/teams', ROUTES[1]],
  ['규칙의 경로 아래의 경로', '/teams/7/members', ROUTES[1]],
  ['대괄호로 감싼 단계(동적 세그먼트)에 아무 값이나 넣은 경로', '/teams/7/settings', ROUTES[0]],
  ['동적 세그먼트에 값을 넣은 경로 아래의 경로', '/teams/abc/settings/billing', ROUTES[0]],
  ['동적 세그먼트를 비운 경로는 그 규칙 대신 다음 규칙', '/teams//settings', ROUTES[1]],
])('보호된 라우트의 규칙은 %s에 맞는다', (_case, pathname, expected) => {
  expect(protectedRouteOf(pathname, ROUTES)).toBe(expected)
})

test('이름만 같이 시작하는 다른 경로는 보호하지 않는다', () => {
  expect(protectedRouteOf('/teamspace', ROUTES)).toBeUndefined()
})

test('로그인한 뒤 돌아갈 주소는 이 앱 안의 경로를 쿼리와 함께 그대로 쓴다', () => {
  expect(returnPathOf('/account?tab=orders#recent')).toBe('/account?tab=orders#recent')
})

test.each([
  ['다른 사이트의 주소', 'https://evil.example.com/account'],
  ['프로토콜을 생략한 다른 사이트의 주소', '//evil.example.com'],
  ['역슬래시로 시작하는 다른 사이트의 주소', '/\\evil.example.com'],
  ['브라우저가 탭을 지우면 다른 사이트가 되는 주소', '/\t/evil.example.com'],
  ['..을 풀면 다른 사이트가 되는 주소', '/..//evil.example.com'],
  ['..을 퍼센트 인코딩한 주소', '/a/%2e%2e//evil.example.com'],
  ['JavaScript 주소', 'javascript:alert(1)'],
  ['경로가 아닌 값', 'account'],
])('%s는 받지 않고 홈으로 보낸다', (_case, next) => {
  expect(returnPathOf(next)).toBe('/')
})

test('돌아갈 주소가 없으면 홈으로 보낸다', () => {
  expect(returnPathOf(undefined)).toBe('/')
})

test('sitemap 규칙은 보호된 라우트와 로그인·접근 권한 없음 페이지를 sitemap에서 빼고, robots.txt에는 적지 않는다', () => {
  expect(authSitemapRules.exclude).toEqual([...PROTECTED_ROUTES.map(({ path }) => path), LOGIN_PATH, FORBIDDEN_PATH])
  expect(authSitemapRules).not.toHaveProperty('disallow')
})
