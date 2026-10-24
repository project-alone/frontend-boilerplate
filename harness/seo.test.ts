import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { freePort, start, waitForServer } from './run.ts'
import { expectFileToPass, type RenderingMode, runVitestScript, useStarter } from './starter.ts'

// 하네스 매트릭스: Base에 seo Recipe를 넣은 Starter를 지원하는 Rendering Mode마다 만들어, Starter 자신의 스크립트와 Recipe가
// 함께 넣은 테스트(src/shared/seo, src/app/sitemap.test.ts·robots.test.ts, e2e/seo.spec.ts)가 통과하는지 본다. 다른 Recipe와 함께 켠 조합은
// table과 함께 넣은 static-export 조합(다른 Recipe가 더한 페이지가 sitemap에 저절로 들어가는지)과 i18n, auth와 함께 넣은 server
// 조합(확장 지점 sitemap 규칙으로 locale마다 넣는 페이지와 빼거나 막는 페이지)으로 보고, server에서 모든 Recipe를 켠 조합은
// Showcase(showcase-starter.test.ts)가 본다. docker와 함께 넣은 이미지는 docker.test.ts가 본다.

// 배포용 빌드에 넣는 사이트 주소
const SITE_URL = 'https://www.example.com'

// 배포한 서버처럼 MSW를 끄고 백엔드 주소를 넣어 띄운다(standalone.test.ts). 확인하는 페이지는 백엔드를 부르지 않는다.
// auth Recipe의 서버는 세션 쿠키를 암호화할 SESSION_SECRET이 없으면 요청을 처리하지 않는다.
const DEPLOYED_ENV = {
  API_MOCKING: 'disabled',
  API_BASE_URL: 'https://backend.example.com',
  SESSION_SECRET: 'harness-session-secret-for-seo-combinations',
}

// Recipe가 함께 넣은 단위 테스트
const UNIT_TESTS = [
  'src/shared/seo/site.test.ts',
  'src/shared/seo/page-routes.test.ts',
  'src/shared/seo/metadata.test.ts',
  'src/shared/seo/og-image.test.tsx',
  'src/app/sitemap.test.ts',
  'src/app/robots.test.ts',
]

interface Combination {
  renderingMode: RenderingMode
  recipes: readonly string[]
  /** 배포용 빌드 전에 `npm run g -- page`로 더할 라우트 */
  generatedPages: readonly string[]
  /** sitemap.xml에 들어갈 페이지의 경로 */
  pages: readonly string[]
  /** robots.txt가 막을 주소 */
  disallow?: readonly string[]
  /** sitemap에는 없고 검색 결과에서 빠지도록 noindex를 알리는 페이지 */
  noindex?: readonly string[]
  /** locale마다 넣은 페이지와 그 페이지가 HTML과 sitemap에서 알릴 locale별 경로(x-default 포함), HTML의 og:locale */
  localized?: { page: string; languages: Readonly<Record<string, string>>; ogLocale: string }
}

// Starter를 만든 뒤 Schematic이 더한 페이지(/about)와 다른 Recipe가 더한 페이지(table의 /members)도 sitemap.ts를 고치지 않고 들어간다.
const COMBINATIONS: readonly Combination[] = [
  { renderingMode: 'server', recipes: ['seo'], generatedPages: ['about'], pages: ['/', '/about', '/products'] },
  { renderingMode: 'static-export', recipes: ['seo'], generatedPages: [], pages: ['/', '/products'] },
  { renderingMode: 'static-export', recipes: ['seo', 'table'], generatedPages: [], pages: ['/', '/members', '/products'] },
  // i18n은 [locale] 아래 페이지를 locale마다 넣고 기본 locale을 x-default로 알리게 하며 locale을 골라 보내는 홈(/)을 빼고,
  // auth는 보호된 라우트와 로그인·접근 권한 없음 페이지를 뺀다(확장 지점 sitemap 규칙). 보호된 라우트는 robots.txt에 적지 않는다.
  {
    renderingMode: 'server',
    recipes: ['seo', 'i18n', 'auth'],
    generatedPages: [],
    pages: ['/en', '/en/i18n', '/ko', '/ko/i18n', '/products'],
    noindex: ['/login', '/forbidden'],
    localized: {
      page: '/en/i18n',
      languages: { ko: '/ko/i18n', en: '/en/i18n', 'x-default': '/ko/i18n' },
      ogLocale: 'en_US',
    },
  },
]

for (const { renderingMode, recipes, generatedPages, pages, disallow = [], noindex = [], localized } of COMBINATIONS) {
  describe(`Rendering Mode ${renderingMode}에 Recipe ${recipes.join(', ')}를 넣은 Starter`, () => {
    const starter = useStarter({
      prefix: `dcgen-${recipes.join('-')}-${renderingMode}-`,
      renderingMode,
      recipes,
      install: true,
      playwright: true,
    })

    test('타입 검사, 린트, 포맷 검사, 단위 테스트(사이트 주소, sitemap에 넣을 페이지, 한글 공유 이미지)를 통과한다', () => {
      for (const script of [
        ['run', 'typecheck'],
        ['run', 'lint'],
        ['run', 'format:check'],
      ]) {
        starter.expectNpmSuccess(script)
      }

      const report = runVitestScript(starter, ['test'])
      for (const file of UNIT_TESTS) expectFileToPass(report, file, 1)
    })

    test('사이트 주소(NEXT_PUBLIC_SITE_URL) 없이 만든 배포용 빌드는 무엇을 넣어야 하는지 알리며 실패한다', () => {
      const result = starter.npm(['run', 'build'])

      expect(result.status, result.failureMessage).not.toBe(0)
      expect(result.output).toContain('NEXT_PUBLIC_SITE_URL 환경 변수가 없습니다')
    })

    test('배포용 빌드는 사이트 주소로 sitemap.xml, robots.txt, canonical과 공유 이미지의 주소를 만든다', async () => {
      for (const route of generatedPages) starter.expectNpmSuccess(['run', 'g', '--', 'page', route])
      starter.expectNpmSuccess(['run', 'build'], { NEXT_PUBLIC_SITE_URL: SITE_URL })
      const port = await freePort()
      const origin = `http://localhost:${String(port)}`
      // server는 next start, static-export는 out/만 띄우는 정적 파일 서버다.
      const server = start('npm', ['run', 'start', '--', '--port', String(port)], starter.dir, DEPLOYED_ENV)

      try {
        // 홈을 다른 주소로 보내는 Recipe(i18n)가 있으면 도착한 주소가 홈이다.
        const home = await waitForServer(`${origin}/`, server)
        const html = await home.text()
        const homePath = new URL(home.url).pathname
        expect(home.status, server.output()).toBe(200)
        expect(html).toContain(`<link rel="canonical" href="${homePath === '/' ? SITE_URL : `${SITE_URL}${homePath}`}"/>`)
        const ogImage = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? ''
        expect(ogImage).toMatch(new RegExp(`^${SITE_URL}/opengraph-image/image\\.png\\?`))

        const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text()
        const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url)
        expect(locations).toEqual(pages.map((page) => new URL(page, SITE_URL).href))

        const robots = await (await fetch(`${origin}/robots.txt`)).text()
        expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`)
        expect([...robots.matchAll(/^Disallow: (.+)$/gm)].map(([, path]) => path)).toEqual(disallow)

        for (const page of noindex) {
          const noindexHtml = await (await fetch(`${origin}${page}`)).text()
          expect(noindexHtml, page).toContain('<meta name="robots" content="noindex"/>')
        }

        if (localized !== undefined) {
          const absolute = Object.entries(localized.languages).map(([locale, path]) => [locale, `${SITE_URL}${path}`])
          const pageHtml = await (await fetch(`${origin}${localized.page}`)).text()
          expect(pageHtml).toContain(`<link rel="canonical" href="${SITE_URL}${localized.page}"/>`)
          expect(pageHtml).toContain(`<meta property="og:locale" content="${localized.ogLocale}"/>`)
          // 위 레이아웃(seo)이 정한 OpenGraph는 그대로 남는다.
          expect(pageHtml).toContain(`<meta property="og:url" content="${SITE_URL}${localized.page}"/>`)
          // React는 hreflang을 hrefLang으로 쓴다.
          for (const [locale, url] of absolute) {
            expect(pageHtml).toContain(`<link rel="alternate" hrefLang="${locale ?? ''}" href="${url ?? ''}"/>`)
          }
          const entry = new RegExp(`<url>\\s*<loc>${SITE_URL}${localized.page}</loc>([\\s\\S]*?)</url>`).exec(sitemap)?.[1] ?? ''
          for (const [locale, url] of absolute) {
            expect(entry, sitemap).toContain(`<xhtml:link rel="alternate" hreflang="${locale ?? ''}" href="${url ?? ''}" />`)
          }
        }

        // 공유 이미지의 글꼴을 담는 server의 빌드 결과(standalone)에는 그 라이선스도 담긴다.
        if (renderingMode === 'server') {
          for (const file of ['pretendard-bold.woff', 'pretendard-license.txt']) {
            expect(existsSync(join(starter.dir, '.next/standalone/src/shared/seo', file)), file).toBe(true)
          }
        }

        const image = await fetch(`${origin}${new URL(ogImage).pathname}`)
        expect(image.status).toBe(200)
        expect(image.headers.get('content-type')).toBe('image/png')
      } finally {
        await server.stop()
      }
    })

    // E2E는 배포하지 않는 목 빌드(API_MOCKING=enabled)로 돈다. 사이트 주소 없이도 빌드된다.
    // server는 여기서 만든 목 빌드를 띄우고, static-export는 E2E가 브라우저의 MSW까지 켜고 직접 다시 빌드한다(config/playwright.config.ts).
    test('사이트 주소 없이 만든 목 빌드에서 E2E가 통과한다(메타데이터, 공유 이미지, sitemap.xml, robots.txt)', async () => {
      if (renderingMode === 'server') starter.expectNpmSuccess(['run', 'build'], { API_MOCKING: 'enabled' })

      starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
    })
  })
}
