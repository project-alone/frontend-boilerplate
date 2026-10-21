import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { type BackgroundProcess, freePort, start, waitForServer } from './run.ts'
import { expectFileToPass, type RenderingMode, runPlaywrightAgainst, runVitestScript, useStarter } from './starter.ts'

// 하네스 매트릭스: Base에 analytics Recipe를 넣은 Starter를 지원하는 Rendering Mode마다 만들고, sentry Recipe와 함께 켠 조합도
// 만들어, Starter 자신의 스크립트와 Recipe가 함께 넣은 테스트(src/shared/analytics/analytics.test.ts, e2e/analytics.spec.ts)가
// 통과하는지 본다. 두 Recipe는 같은 확장 지점(instrumentation-client)에 조각을 더한다. server에서 함께 켠 조합은 모든 Recipe를 켠
// Showcase(showcase-starter.test.ts)가 보므로, 함께 켠 조합은 static-export로 만든다.
// 이어서 개발자가 분석 서비스를 붙이듯 공급자(analytics-provider.ts)를 바꿔 빌드한 앱에서, 처음 연 페이지와 App Router로 옮겨 간
// 페이지의 페이지뷰, 이벤트가 그 공급자로 가는지 본다.

const COMBINATIONS: readonly { renderingMode: RenderingMode; recipes: readonly string[]; plugProvider: boolean }[] = [
  { renderingMode: 'server', recipes: ['analytics'], plugProvider: true },
  { renderingMode: 'static-export', recipes: ['analytics'], plugProvider: false },
  { renderingMode: 'static-export', recipes: ['analytics', 'sentry'], plugProvider: true },
]

const PROVIDER_PATH = 'src/shared/analytics/analytics-provider.ts'
const PROBE_ROUTE = '/harness-analytics'
const PROBE_SPEC = 'e2e/harness-analytics.spec.ts'

/** 받은 페이지뷰와 이벤트를 브라우저의 전역 배열에 남기는 공급자. 개발자가 분석 서비스의 공급자를 붙이는 자리에 둔다. */
const RECORDING_PROVIDER = `import type { AnalyticsProvider } from './analytics'

const recorded = globalThis as { harnessAnalytics?: string[] }

function record(entry: string) {
  ;(recorded.harnessAnalytics ??= []).push(entry)
}

export const analyticsProvider: AnalyticsProvider = {
  trackPageView: (url) => {
    record(\`page_view \${url}\`)
  },
  trackEvent: (name, properties) => {
    record(\`event \${name} \${JSON.stringify(properties)}\`)
  },
}
`

/** App Router의 링크와 이벤트를 남기는 버튼이 있는 탐침 페이지 */
const PROBE_PAGE = `'use client'

import Link from 'next/link'
import { trackEvent } from '@/shared/analytics/analytics'

export default function HarnessAnalyticsPage() {
  return (
    <main>
      <button type="button" onClick={() => trackEvent('probe_clicked', { source: 'harness' })}>
        이벤트
      </button>
      <Link href="/products?page=2">상품</Link>
    </main>
  )
}
`

const PROBE_SPEC_SOURCE = `import { expect, test } from '@playwright/test'

const recorded = () => (globalThis as { harnessAnalytics?: string[] }).harnessAnalytics

test('처음 연 페이지와 App Router로 옮겨 간 페이지의 페이지뷰, 이벤트를 붙인 공급자로 보낸다', async ({ page }) => {
  await page.goto('${PROBE_ROUTE}')
  await expect.poll(() => page.evaluate(recorded)).toEqual(['page_view ${PROBE_ROUTE}'])

  await page.getByRole('button', { name: '이벤트' }).click()
  await page.getByRole('link', { name: '상품' }).click()

  await expect(page).toHaveURL(/\\/products\\?page=2$/)
  await expect(page.getByRole('heading', { level: 1, name: '상품' })).toBeVisible()
  expect(await page.evaluate(recorded)).toEqual([
    'page_view ${PROBE_ROUTE}',
    'event probe_clicked {"source":"harness"}',
    'page_view /products?page=2',
  ])
})
`

for (const { renderingMode, recipes, plugProvider } of COMBINATIONS) {
  describe(`Rendering Mode ${renderingMode}에 Recipe ${recipes.join(', ')}를 넣은 Starter`, () => {
    const starter = useStarter({
      prefix: `dcgen-${recipes.join('-')}-${renderingMode}-`,
      renderingMode,
      recipes,
      install: true,
      playwright: true,
    })

    test('타입 검사, 린트, 포맷 검사, 단위 테스트(기본 공급자, 페이지뷰)를 통과한다', () => {
      for (const script of [
        ['run', 'typecheck'],
        ['run', 'lint'],
        ['run', 'format:check'],
      ]) {
        starter.expectNpmSuccess(script)
      }

      const report = runVitestScript(starter, ['test'])
      expectFileToPass(report, 'src/shared/analytics/analytics.test.ts', 1)
    })

    test('빌드를 통과한다', () => {
      starter.expectNpmSuccess(['run', 'build'])
    })

    // server는 위 빌드 결과를 띄워 검사하고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(playwright.config.ts).
    test('빌드한 앱에서 E2E가 통과한다(공급자를 붙이지 않으면 페이지를 옮겨도 앱 밖으로 요청을 보내지 않는다)', async () => {
      starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
    })

    describe.runIf(plugProvider)('공급자를 붙여 빌드한 앱', () => {
      let original: string
      let server: BackgroundProcess
      let origin: string

      beforeAll(async () => {
        original = readFileSync(join(starter.dir, PROVIDER_PATH), 'utf8')
        writeFileSync(join(starter.dir, PROVIDER_PATH), RECORDING_PROVIDER)
        starter.writeFile(`src/app${PROBE_ROUTE}/page.tsx`, PROBE_PAGE)
        starter.writeFile(PROBE_SPEC, PROBE_SPEC_SOURCE)
        const env = { API_MOCKING: 'enabled', NEXT_PUBLIC_API_MOCKING: 'enabled' }
        starter.expectNpmSuccess(['run', 'build'], env)

        const port = await freePort()
        origin = `http://localhost:${String(port)}`
        server = start('npm', ['run', 'start', '--', '--port', String(port)], starter.dir, env)
        await waitForServer(origin, server)
      })

      afterAll(async () => {
        await server?.stop()
        writeFileSync(join(starter.dir, PROVIDER_PATH), original)
        rmSync(join(starter.dir, `src/app${PROBE_ROUTE}`), { recursive: true, force: true })
        rmSync(join(starter.dir, PROBE_SPEC), { force: true })
      })

      test('처음 연 페이지와 App Router로 옮겨 간 페이지의 페이지뷰, 이벤트를 그 공급자로 보낸다', () => {
        const result = runPlaywrightAgainst(starter.dir, origin, [PROBE_SPEC])
        expect(result.status, result.output).toBe(0)
      })
    })
  })
}
