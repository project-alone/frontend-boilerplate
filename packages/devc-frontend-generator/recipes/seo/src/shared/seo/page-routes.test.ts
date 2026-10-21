import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { findPageRoutes } from './page-routes'

let appDir: string

beforeEach(() => {
  appDir = mkdtempSync(join(tmpdir(), 'seo-page-routes-'))
})

afterEach(() => {
  rmSync(appDir, { recursive: true, force: true })
})

function addFiles(...paths: string[]) {
  for (const path of paths) {
    mkdirSync(dirname(join(appDir, path)), { recursive: true })
    writeFileSync(join(appDir, path), '')
  }
}

test('app 디렉터리의 페이지마다 그 주소를 이름순으로 돌려준다', () => {
  addFiles('page.tsx', 'products/page.tsx', 'about/team/page.ts', 'layout.tsx', 'products/loading.tsx')

  expect(findPageRoutes(appDir)).toEqual(['/', '/about/team', '/products'])
})

test('경로 그룹은 주소에서 빼고, 페이지가 아닌 파일(테스트, 스토리, Route Handler, 메타데이터 라우트)은 넣지 않는다', () => {
  addFiles(
    '(marketing)/pricing/page.tsx',
    'page.test.tsx',
    'page.stories.tsx',
    'api/proxy/[...path]/route.ts',
    'sitemap.ts',
    'opengraph-image.tsx',
  )

  expect(findPageRoutes(appDir)).toEqual(['/pricing'])
})

test('빌드할 때 주소를 알 수 없는 동적 세그먼트, 라우트가 아닌 private 폴더와 병렬·가로채기 라우트의 페이지는 넣지 않는다', () => {
  addFiles(
    'products/[productId]/page.tsx',
    'docs/[[...slug]]/page.tsx',
    '_components/page.tsx',
    '@modal/login/page.tsx',
    'feed/(.)photo/page.tsx',
    'feed/page.tsx',
  )

  expect(findPageRoutes(appDir)).toEqual(['/feed'])
})

test('빼기로 한 주소와 그 아래 주소는 넣지 않는다', () => {
  addFiles('page.tsx', 'account/page.tsx', 'account/settings/page.tsx', 'accounting/page.tsx')

  expect(findPageRoutes(appDir, { exclude: ['/account'] })).toEqual(['/', '/accounting'])
})
