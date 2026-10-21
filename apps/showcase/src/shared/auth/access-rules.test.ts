// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/access-rules.test.ts

import { expect, test } from 'vitest'
import { authSitemapRules, FORBIDDEN_PATH, LOGIN_PATH, PROTECTED_ROUTES, returnPathOf } from './access-rules'

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

test('sitemap 규칙은 보호된 라우트를 robots.txt로 막고, 로그인·접근 권한 없음 페이지는 sitemap에서만 뺀다', () => {
  for (const { path } of PROTECTED_ROUTES) expect(authSitemapRules.disallow).toContain(path)
  expect(authSitemapRules.exclude).toEqual([LOGIN_PATH, FORBIDDEN_PATH])
})
