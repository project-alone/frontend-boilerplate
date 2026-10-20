import { describe, expect, test } from 'vitest'
import { freePort } from './run.ts'
import { buildRouteLine, type Starter, useStarter } from './starter.ts'

// 하네스 매트릭스: i18n Recipe를 다른 Recipe와 함께 넣은 Starter. 다른 Recipe는 i18n을 모르고 [locale] 밖에 페이지를 더하고,
// 같은 확장 지점(Provider, 머리글)과 같은 설정 파일(vitest.config.ts의 패치)에 끼어든다. 두 Recipe의 테스트가 한 Starter
// 안에서 함께 통과하는지 본다. i18n Recipe만 넣은 조합은 i18n.test.ts가, 모든 Recipe를 켠 조합은 showcase-starter.test.ts가 본다.

function expectStarterScriptsToPass(starter: Starter) {
  for (const script of [
    ['run', 'typecheck'],
    ['run', 'lint'],
    ['run', 'format:check'],
    ['test'],
    ['run', 'test:storybook'],
  ]) {
    starter.expectNpmSuccess(script)
  }
}

describe.each(['server', 'static-export'] as const)('Rendering Mode %s에 i18n과 dark-mode Recipe를 함께 넣은 Starter', (renderingMode) => {
  const starter = useStarter({
    prefix: `dcgen-i18n-dark-mode-${renderingMode}-`,
    renderingMode,
    recipes: ['i18n', 'dark-mode'],
    install: true,
    playwright: true,
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트, 두 테마의 스토리 검사를 통과한다', () => {
    expectStarterScriptsToPass(starter)
  })

  // 머리글에 테마 전환과 locale 전환이 나란히 있고, 홈(/)이 locale의 홈으로 바뀌어도 dark-mode의 E2E(첫 화면의 테마 등)가 통과한다.
  test('빌드한 앱에서 두 Recipe의 E2E가 통과한다', async () => {
    starter.expectNpmSuccess(['run', 'build'])

    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })
})

describe('Rendering Mode server에 i18n과 route-rendering Recipe를 함께 넣은 Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-i18n-route-rendering-',
    renderingMode: 'server',
    recipes: ['i18n', 'route-rendering'],
    install: true,
    playwright: true,
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트, 스토리 검사를 통과한다', () => {
    expectStarterScriptsToPass(starter)
  })

  // 앱 전체를 감싼 i18n의 Provider와 머리글은 요청마다 달라지는 값(쿠키, 헤더)을 읽지 않으므로, 다른 Recipe의 라우트가 고른
  // Rendering Mode가 그대로다. SSG 라우트(dynamic = 'error')는 그런 값을 읽으면 빌드가 실패한다.
  test('빌드하면 i18n의 페이지는 locale마다 미리 렌더링하고, route-rendering의 라우트는 고른 Rendering Mode 그대로다', () => {
    const { output } = starter.expectNpmSuccess(['run', 'build'])

    for (const route of ['/ko', '/en', '/ko/i18n', '/en/i18n']) expect(buildRouteLine(output, route), output).toContain('●')
    expect(buildRouteLine(output, '/rendering/ssg'), output).toContain('○')
    expect(buildRouteLine(output, '/rendering/csr'), output).toContain('○')
    expect(buildRouteLine(output, '/rendering/isr'), output).toMatch(/○.*10s/)
    expect(buildRouteLine(output, '/rendering/ssr'), output).toContain('ƒ')
    expect(buildRouteLine(output, '/rendering/streaming'), output).toContain('ƒ')
  })

  // 위 빌드 결과를 next start로 띄워 검사한다(playwright.config.ts). proxy는 [locale] 밖의 /rendering 라우트에 손대지 않는다.
  test('빌드한 앱에서 두 Recipe의 E2E가 통과한다', async () => {
    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })
})
