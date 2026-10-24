import { describe, expect, test } from 'vitest'
import { freePort } from './run.ts'
import { buildRouteLine, expectStarterChecksToPass, useStarter } from './starter.ts'

// 하네스 매트릭스: i18n Recipe를 다른 Recipe와 함께 넣은 Starter. 다른 Recipe는 i18n을 모르고 [locale] 밖에 페이지를 더하고,
// 같은 확장 지점(Provider, 머리글)과 같은 설정 파일(config/vitest.config.ts의 패치)에 끼어든다. 두 Recipe의 테스트가 한 Starter
// 안에서 함께 통과하는지 본다. i18n Recipe만 넣은 조합은 i18n.test.ts가 보고, server에서 모든 Recipe를 함께 켠 조합
// (dark-mode와 route-rendering 포함)은 showcase-starter.test.ts가 본다.

// dark-mode의 server 조합은 Showcase가 보므로 proxy가 없는 static-export만 본다. 홈(/)이 proxy 대신 기본 locale의 홈을 그린다.
describe('Rendering Mode static-export에 i18n과 dark-mode Recipe를 함께 넣은 Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-i18n-dark-mode-static-export-',
    renderingMode: 'static-export',
    recipes: ['i18n', 'dark-mode'],
    install: true,
    playwright: true,
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트를 통과한다', () => {
    expectStarterChecksToPass(starter)
  })

  // 머리글에 테마 전환과 locale 전환이 나란히 있고, 홈(/)이 기본 locale의 홈이어도 dark-mode의 E2E(첫 화면의 테마 등)가 통과한다.
  // E2E가 MSW를 켜고 직접 다시 빌드한다(config/playwright.config.ts).
  test('빌드한 앱에서 두 Recipe의 E2E가 통과한다', async () => {
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

  test('타입 검사, 린트, 포맷 검사, 단위 테스트를 통과한다', () => {
    expectStarterChecksToPass(starter)
  })

  // 앱 전체를 감싼 i18n의 Provider와 머리글은 요청마다 달라지는 값(쿠키, 헤더)을 읽지 않으므로, 다른 Recipe의 라우트를 빌드할
  // 때 미리 렌더링할 수 있다. 그런 값을 읽으면 SSG 라우트(dynamic = 'error')는 빌드가 실패하고 나머지는 요청마다 렌더링된다.
  test('빌드하면 i18n의 페이지는 locale마다, route-rendering의 SSG·CSR·ISR 라우트는 그대로 미리 렌더링한다', () => {
    const { output } = starter.expectNpmSuccess(['run', 'build'])

    for (const route of ['/ko', '/en', '/ko/i18n', '/en/i18n']) expect(buildRouteLine(output, route), output).toContain('●')
    for (const route of ['/rendering/ssg', '/rendering/csr']) expect(buildRouteLine(output, route), output).toContain('○')
    expect(buildRouteLine(output, '/rendering/isr'), output).toMatch(/○.*10s/)
  })

  // 위 빌드 결과를 next start로 띄워 검사한다(config/playwright.config.ts). proxy는 [locale] 밖의 /rendering 라우트에 손대지 않는다.
  test('빌드한 앱에서 두 Recipe의 E2E가 통과한다', async () => {
    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })
})
