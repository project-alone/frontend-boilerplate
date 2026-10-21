// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/shared/seo/page-routes.ts

import { readdirSync } from 'node:fs'
import { relative, sep } from 'node:path'

// Next.js가 페이지로 보는 파일(기본 pageExtensions). page.test.tsx, page.stories.tsx는 페이지가 아니다.
const PAGE_FILE = /^page\.(?:tsx|ts|jsx|js)$/

export interface FindPageRoutesOptions {
  /** 넣지 않을 주소. 그 주소와 그 아래 주소(`/account`면 `/account/settings`도)를 뺀다. */
  exclude?: readonly string[]
}

/**
 * app 디렉터리(src/app)의 페이지를 찾아 그 주소를 이름순으로 돌려준다. sitemap(src/app/sitemap.ts)이 빌드할 때 부르므로,
 * Recipe나 `npm run g -- page`가 더한 페이지도 sitemap을 고치지 않고 들어간다.
 *
 * - 경로 그룹(`(marketing)`)은 주소에서 뺀다.
 * - 동적 세그먼트(`[productId]`, `[...slug]`)가 있는 페이지는 빌드할 때 주소를 알 수 없으므로 넣지 않는다. 그런 주소는
 *   sitemap.ts에서 데이터로 만들어 더한다.
 * - 라우트가 아닌 private 폴더(`_components`)와 병렬(`@modal`)·가로채기(`(.)photo`) 라우트의 페이지는 넣지 않는다.
 */
export function findPageRoutes(appDir: string, { exclude = [] }: FindPageRoutesOptions = {}): string[] {
  const routes = readdirSync(appDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && PAGE_FILE.test(entry.name))
    .map((entry) => routeSegments(relative(appDir, entry.parentPath)))
    .filter((segments) => segments.every(hasFixedUrl))
    .map((segments) => `/${segments.filter((segment) => !isRouteGroup(segment)).join('/')}`)
    .filter((route) => !exclude.some((excluded) => route === excluded || route.startsWith(`${excluded}/`)))
  return [...new Set(routes)].sort()
}

// app 디렉터리 기준의 폴더 경로를 라우트 세그먼트로 나눈다. app 디렉터리 자신(홈)은 빈 경로다.
function routeSegments(directory: string): string[] {
  return directory === '' ? [] : directory.split(sep)
}

// 이 세그먼트 아래의 페이지가 빌드할 때 정해지는 주소 하나를 갖는가. 동적 세그먼트, private 폴더, 병렬·가로채기 라우트는 아니다.
// 경로 그룹은 주소에서 빠질 뿐 주소를 바꾸지 않으므로 갖는 것으로 본다.
function hasFixedUrl(segment: string): boolean {
  return !segment.startsWith('[') && !segment.startsWith('_') && !segment.startsWith('@') && !segment.startsWith('(.')
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')')
}
