// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/shared/seo/page-routes.test.ts

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { type FindPageRoutesOptions, findPageRoutes } from './page-routes'

let appDir: string

beforeEach(() => {
  appDir = mkdtempSync(join(tmpdir(), 'seo-page-routes-'))
})

afterEach(() => {
  rmSync(appDir, { recursive: true, force: true })
})

/** 찾은 페이지의 주소만 */
function pagePaths(options?: FindPageRoutesOptions): string[] {
  return findPageRoutes(appDir, options).map(({ path }) => path)
}

function addFiles(...paths: string[]) {
  for (const path of paths) {
    mkdirSync(dirname(join(appDir, path)), { recursive: true })
    writeFileSync(join(appDir, path), '')
  }
}

test('app 디렉터리의 페이지마다 그 주소를 이름순으로 돌려준다', () => {
  addFiles('page.tsx', 'products/page.tsx', 'about/team/page.ts', 'layout.tsx', 'products/loading.tsx')

  expect(pagePaths()).toEqual(['/', '/about/team', '/products'])
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

  expect(pagePaths()).toEqual(['/pricing'])
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

  expect(pagePaths()).toEqual(['/feed'])
})

test('빼기로 한 주소와 그 아래 주소는 넣지 않는다', () => {
  addFiles('page.tsx', 'account/page.tsx', 'account/settings/page.tsx', 'accounting/page.tsx')

  expect(pagePaths({ exclude: ['/account'] })).toEqual(['/', '/accounting'])
})

test('/를 빼면 홈만 빼고 다른 페이지는 그대로 넣는다', () => {
  addFiles('page.tsx', 'products/page.tsx')

  expect(pagePaths({ exclude: ['/'] })).toEqual(['/products'])
})

test('locale 세그먼트 아래 페이지는 locale마다 넣고, 같은 페이지의 locale별 주소를 서로 알린다', () => {
  addFiles(
    'page.tsx',
    '[locale]/page.tsx',
    '[locale]/i18n/page.tsx',
    '[locale]/(docs)/guide/page.tsx',
    'products/page.tsx',
  )

  expect(findPageRoutes(appDir, { locales: { param: 'locale', values: ['ko', 'en'] } })).toEqual([
    { path: '/' },
    { path: '/en', languages: { ko: '/ko', en: '/en' } },
    { path: '/en/guide', languages: { ko: '/ko/guide', en: '/en/guide' } },
    { path: '/en/i18n', languages: { ko: '/ko/i18n', en: '/en/i18n' } },
    { path: '/ko', languages: { ko: '/ko', en: '/en' } },
    { path: '/ko/guide', languages: { ko: '/ko/guide', en: '/en/guide' } },
    { path: '/ko/i18n', languages: { ko: '/ko/i18n', en: '/en/i18n' } },
    { path: '/products' },
  ])
})

test('locale 세그먼트 아래에 있어도 다른 동적 세그먼트가 있는 페이지는 넣지 않고, 뺀 주소는 언어별 주소에서도 뺀다', () => {
  addFiles('[locale]/page.tsx', '[locale]/posts/[postId]/page.tsx', '[slug]/page.tsx')

  expect(findPageRoutes(appDir, { locales: { param: 'locale', values: ['ko', 'en'] }, exclude: ['/en'] })).toEqual([
    { path: '/ko', languages: { ko: '/ko' } },
  ])
})
