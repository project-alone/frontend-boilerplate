import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { freePort, start, waitForServer } from './run.ts'
import { buildRouteLine, expectStarterChecksToPass, runPlaywrightAgainst, useStarter } from './starter.ts'

// 하네스 매트릭스: Base에 i18n Recipe를 넣은 Starter를 Rendering Mode마다 만들어, Starter 자신의 스크립트와 Recipe가 함께
// 넣은 테스트(메시지 카탈로그, locale을 고르는 proxy 처리기, locale 전환 UI 스토리, e2e/i18n.spec.ts)가 통과하는지 본다.
// 다른 Recipe와 함께 넣은 조합은 i18n-combinations.test.ts가, 모든 Recipe를 켠 조합은 showcase-starter.test.ts가 본다.

describe.each(['server', 'static-export'] as const)('Rendering Mode %s에 i18n Recipe를 넣은 Starter', (renderingMode) => {
  const starter = useStarter({
    prefix: `dcgen-i18n-${renderingMode}-`,
    renderingMode,
    recipes: ['i18n'],
    install: true,
    playwright: true,
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트, 스토리 검사를 통과한다', () => {
    expectStarterChecksToPass(starter)
  })

  // 메시지 타입은 Rendering Mode와 상관없으므로 server에서만 본다.
  test.runIf(renderingMode === 'server')('메시지 카탈로그에 없는 키를 쓰면 타입 검사가 실패한다', () => {
    const typo = 'src/features/typo/typo.tsx'
    starter.writeFile(
      typo,
      `'use client'

import { useTranslations } from 'next-intl'

export function Typo() {
  const t = useTranslations('HomePage')
  return <p>{t('titel')}</p>
}
`,
    )
    try {
      const result = starter.npm(['run', 'typecheck'])

      expect(result.status, result.failureMessage).not.toBe(0)
      expect(result.output).toContain(`${typo}(7,16): error TS2345: Argument of type '"titel"'`)
    } finally {
      rmSync(join(starter.dir, 'src/features/typo'), { recursive: true })
    }
  })

  test('빌드하면 i18n Recipe의 페이지를 locale마다 빌드할 때 렌더링한다', () => {
    const { output } = starter.expectNpmSuccess(['run', 'build'])

    for (const route of ['/ko', '/en', '/ko/i18n', '/en/i18n']) expect(buildRouteLine(output, route), output).toContain('●')
  })

  // server는 위 빌드 결과를 띄워 검사하고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(playwright.config.ts).
  test('빌드한 앱에서 E2E가 통과한다(locale이 붙은 주소, locale 전환, 번역하지 않은 페이지, locale 고르기)', async () => {
    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })

  // hydration 불일치 경고는 개발 모드에서만 보인다. 레이아웃과 Provider는 두 Rendering Mode가 같으므로 server에서만 본다.
  test.runIf(renderingMode === 'server')('개발 서버에서도 hydration 오류 없이 locale을 바꾼다', async () => {
    const port = await freePort()
    const baseURL = `http://localhost:${String(port)}`
    const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter.dir)

    try {
      const response = await waitForServer(`${baseURL}/ko`, devServer)
      expect(response.status, devServer.output()).toBe(200)

      // e2e/i18n.spec.ts는 페이지에서 난 오류(hydration 불일치 경고 포함)가 없는지도 본다.
      const result = runPlaywrightAgainst(starter.dir, baseURL, ['e2e/i18n.spec.ts'])
      expect(result.status, `${result.output}\n${devServer.output()}`).toBe(0)
    } finally {
      await devServer.stop()
    }
  })
})
