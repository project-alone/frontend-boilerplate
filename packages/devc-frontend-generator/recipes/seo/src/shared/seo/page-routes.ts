import { readdirSync } from 'node:fs'
import { relative, sep } from 'node:path'

// Next.js가 페이지로 보는 파일(기본 pageExtensions). page.test.tsx, page.stories.tsx는 페이지가 아니다.
const PAGE_FILE = /^page\.(?:tsx|ts|jsx|js)$/

/** sitemap에 넣을 페이지 하나 */
export interface PageRoute {
  /** 페이지의 주소(예: /products, /en/i18n) */
  path: string
  /** locale마다 넣은 페이지이면 같은 페이지의 locale별 주소(자기 주소 포함, 예: { ko: '/ko/i18n', en: '/en/i18n' }) */
  languages?: Readonly<Record<string, string>>
}

/** locale을 값으로 받는 동적 세그먼트. `[locale]`이면 param은 locale이다. */
export interface LocaleParam {
  param: string
  values: readonly string[]
}

export interface FindPageRoutesOptions {
  /** 넣지 않을 주소. 그 주소와 그 아래 주소(`/account`면 `/account/settings`도)를 뺀다. `/`는 홈만 뺀다. */
  exclude?: readonly string[]
  /** 이 세그먼트 아래 페이지는 locale마다 넣고, 같은 페이지의 locale별 주소를 languages로 알린다. */
  locales?: LocaleParam | undefined
}

/**
 * app 디렉터리(src/app)의 페이지를 찾아 주소의 이름순으로 돌려준다. sitemap(src/app/sitemap.ts)이 빌드할 때 부르므로,
 * Recipe나 `npm run g -- page`가 더한 페이지도 sitemap을 고치지 않고 들어간다.
 *
 * - 경로 그룹(`(marketing)`)은 주소에서 뺀다.
 * - 동적 세그먼트(`[productId]`, `[...slug]`)가 있는 페이지는 빌드할 때 주소를 알 수 없으므로 넣지 않는다. 그런 주소는
 *   sitemap.ts에서 데이터로 만들어 더한다. locales의 세그먼트(i18n Recipe의 `[locale]`)만 그 값마다 넣는다.
 * - 라우트가 아닌 private 폴더(`_components`)와 병렬(`@modal`)·가로채기(`(.)photo`) 라우트의 페이지는 넣지 않는다.
 */
export function findPageRoutes(appDir: string, { exclude = [], locales }: FindPageRoutesOptions = {}): PageRoute[] {
  const localeSegment = locales === undefined ? undefined : `[${locales.param}]`
  // `/`의 아래 주소는 `//`로 시작해야 하므로 `/`는 홈만 뺀다.
  const isExcluded = (path: string) => exclude.some((excluded) => path === excluded || path.startsWith(`${excluded}/`))
  const routes = new Map<string, PageRoute>()

  for (const entry of readdirSync(appDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !PAGE_FILE.test(entry.name)) continue
    const segments = routeSegments(relative(appDir, entry.parentPath))
    if (!segments.every((segment) => segment === localeSegment || hasFixedUrl(segment))) continue
    const urlSegments = segments.filter((segment) => !isRouteGroup(segment))

    // locale 세그먼트가 없는 페이지는 주소 하나, 있는 페이지는 locale마다 주소 하나다.
    const variants =
      locales !== undefined && urlSegments.some((segment) => segment === localeSegment)
        ? locales.values.map((locale) => ({
            locale,
            path: toPath(urlSegments.map((segment) => (segment === localeSegment ? locale : segment))),
          }))
        : [{ locale: undefined, path: toPath(urlSegments) }]
    const kept = variants.filter(({ path }) => !isExcluded(path))
    const languages = Object.fromEntries(
      kept.flatMap(({ locale, path }) => (locale === undefined ? [] : [[locale, path]])),
    )
    for (const { locale, path } of kept) {
      routes.set(path, locale === undefined ? { path } : { path, languages })
    }
  }

  return [...routes.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

// app 디렉터리 기준의 폴더 경로를 라우트 세그먼트로 나눈다. app 디렉터리 자신(홈)은 빈 경로다.
function routeSegments(directory: string): string[] {
  return directory === '' ? [] : directory.split(sep)
}

function toPath(segments: readonly string[]): string {
  return `/${segments.join('/')}`
}

// 이 세그먼트 아래의 페이지가 빌드할 때 정해지는 주소 하나를 갖는가. 동적 세그먼트, private 폴더, 병렬·가로채기 라우트는 아니다.
// 경로 그룹은 주소에서 빠질 뿐 주소를 바꾸지 않으므로 갖는 것으로 본다.
function hasFixedUrl(segment: string): boolean {
  return !segment.startsWith('[') && !segment.startsWith('_') && !segment.startsWith('@') && !segment.startsWith('(.')
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')')
}
