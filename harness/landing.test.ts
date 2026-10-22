import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { freePort } from './run.ts'
import { buildRouteLine, expectFileToPass, readTree, runVitestScript, useStarter } from './starter.ts'

// 하네스 매트릭스: Base에 랜딩 Archetype을 넣은 Starter를 지원하는 Rendering Mode(server, static-export)마다 만들어, Starter 자신의
// 스크립트와 Archetype이 함께 넣은 테스트(locale마다 콘텐츠를 돌려주는 목 백엔드, 랜딩 화면, 스토리, e2e/landing.spec.ts)가
// Archetype이 쓰는 Recipe(i18n, seo)의 테스트와 함께 통과하는지 본다. 모든 Recipe·Archetype을 켠 조합은 showcase-starter.test.ts가 본다.

// 배포용 빌드에 넣는 사이트 주소(seo Recipe). 백엔드 주소(API_BASE_URL)는 넣지 않고, 하네스를 띄운 셸에 있어도 비운다.
const DEPLOY_BUILD_ENV = { NEXT_PUBLIC_SITE_URL: 'https://www.example.com', API_MOCKING: undefined, API_BASE_URL: '' }
const MOCK_BUILD_ENV = { API_MOCKING: 'enabled', API_BASE_URL: '' }

// 빌드할 때 locale마다 미리 렌더링하는 랜딩 페이지와 공유 이미지
const PRERENDERED_ROUTES = ['/ko/landing', '/en/landing', '/ko/landing/og-image.png', '/en/landing/og-image.png']

describe.each(['server', 'static-export'] as const)('Rendering Mode %s에 랜딩 Archetype을 넣은 Starter', (renderingMode) => {
  const starter = useStarter({
    prefix: `dcgen-landing-${renderingMode}-`,
    renderingMode,
    archetypes: ['landing'],
    install: true,
    playwright: true,
  })

  test('Archetype이 쓰는 Recipe가 함께 들어 있고, 머리글에 랜딩 링크가 언어 전환보다 앞에 놓인다', () => {
    const pkg = JSON.parse(readFileSync(join(starter.dir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    // i18n(next-intl)의 의존성. seo는 의존성이 없고 sitemap을 더한다.
    expect(Object.keys(pkg.dependencies)).toContain('next-intl')
    expect(readFileSync(join(starter.dir, 'src/app/sitemap.ts'), 'utf8')).toContain('sitemapRules')
    const appShell = readFileSync(join(starter.dir, 'src/app/app-shell.tsx'), 'utf8')
    const header = /<header[^>]*>([\s\S]*?)<\/header>/.exec(appShell)?.[1] ?? ''
    expect(header.match(/<\w+ \/>/g)).toEqual(['<LandingLink />', '<LocaleSwitcher />'])
  })

  // Archetype의 Query Domain은 `npm run g -- query`가 만드는 코드 그대로다. 지우고 다시 만들면 같은 코드가 나오고, 아래 검사가 이
  // 코드로 돈다. Rendering Mode와 상관없으므로 server에서만 본다.
  test.runIf(renderingMode === 'server')('Query Domain(src/queries/landing)은 npm run g -- query가 만드는 코드와 같다', () => {
    const landing = join(starter.dir, 'src/queries/landing')
    const archetype = readTree(landing)
    rmSync(landing, { recursive: true })

    starter.expectNpmSuccess(['run', 'g', '--', 'query', 'getLandingPage'])

    expect(readTree(landing)).toEqual(archetype)
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트(locale마다 다른 콘텐츠, 섹션과 자주 묻는 질문), 스토리 검사를 통과한다', () => {
    for (const script of [['run', 'typecheck'], ['run', 'lint'], ['run', 'format:check']]) {
      starter.expectNpmSuccess(script)
    }
    const report = runVitestScript(starter, ['test'])
    for (const file of [
      'src/shared/mocks/landing.test.ts',
      'src/features/landing/landing.test.tsx',
      // Archetype이 쓰는 Recipe의 테스트도 함께 돈다. 메시지 카탈로그 검사는 Archetype이 더한 메시지(머리글의 링크)도 본다.
      'src/shared/i18n/messages.test.tsx',
      'src/app/sitemap.test.ts',
    ]) {
      expectFileToPass(report, file, 1)
    }

    const stories = runVitestScript(starter, ['run', 'test:storybook'])
    expectFileToPass(stories, 'src/features/landing/landing.stories.tsx', 1)
  })

  test('배포용 빌드는 빌드할 때 콘텐츠를 가져올 백엔드 주소(API_BASE_URL)가 없으면 알리며 실패한다', () => {
    const build = starter.npm(['run', 'build'], DEPLOY_BUILD_ENV)

    expect(build.status, build.failureMessage).not.toBe(0)
    expect(build.output).toMatch(/Error occurred prerendering page "\/(ko|en)\/landing/)
    expect(build.output).toContain('API_BASE_URL 환경 변수가 없습니다. 빌드할 때 데이터를 가져오는 페이지')
  })

  // server는 여기서 만든 목 빌드를 띄우고, static-export는 E2E가 브라우저의 MSW까지 켜고 직접 다시 빌드한다(playwright.config.ts).
  test('목 빌드는 랜딩 페이지와 공유 이미지를 locale마다 빌드할 때 렌더링하고, 빌드한 앱에서 E2E(주요 섹션, 언어 전환, 언어별 메타데이터·공유 이미지·sitemap, 접근성)가 통과한다', async () => {
    const { output } = starter.expectNpmSuccess(['run', 'build'], MOCK_BUILD_ENV)

    for (const route of PRERENDERED_ROUTES) expect(buildRouteLine(output, route), output).toContain('●')

    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })
})
