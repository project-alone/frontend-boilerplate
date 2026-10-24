import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, inject, test } from 'vitest'
import { freePort, run } from './run.ts'
import { buildRouteLine, useStarter } from './starter.ts'

test('route-rendering Recipe는 요청을 받는 서버가 있어야 하므로 static-export Starter에는 이유와 함께 넣지 않는다', () => {
  const workdir = mkdtempSync(join(tmpdir(), 'dcgen-route-rendering-static-'))
  try {
    const result = run(
      inject('dcgenBin'),
      ['new', 'my-app', '--rendering-mode', 'static-export', '--recipe', 'route-rendering', '--skip-install'],
      workdir,
    )

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Recipe route-rendering은(는) Rendering Mode static-export에서 쓸 수 없습니다')
    expect(result.output).toContain('요청을 받는 Next.js 서버')
    expect(readdirSync(workdir)).toEqual([])
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
})

// 하네스 매트릭스: Base에 route-rendering Recipe를 넣은 server Starter를 만들어, Starter 자신의 스크립트와 Recipe가 함께 넣은
// 테스트(CSR 목록의 단위 테스트, e2e/route-rendering.spec.ts)가 통과하는지 본다. 모든 Recipe를 켠 조합은 showcase-starter.test.ts가 본다.
describe('Rendering Mode server에 route-rendering Recipe를 넣은 Starter', () => {
  const starter = useStarter({
    prefix: 'dcgen-route-rendering-',
    renderingMode: 'server',
    recipes: ['route-rendering'],
    install: true,
    playwright: true,
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트, 스토리 검사를 통과한다', () => {
    for (const script of [
      ['run', 'typecheck'],
      ['run', 'lint'],
      ['run', 'format:check'],
      ['test'],
      ['run', 'test:storybook'],
    ]) {
      starter.expectNpmSuccess(script)
    }
  })

  test('빌드하면 SSG 라우트는 HTML을 미리 만들고, SSR·스트리밍 라우트는 요청마다 렌더링한다', () => {
    const { output } = starter.expectNpmSuccess(['run', 'build'])

    expect(buildRouteLine(output, '/rendering/ssg'), output).toContain('○')
    expect(buildRouteLine(output, '/rendering/csr'), output).toContain('○')
    expect(buildRouteLine(output, '/rendering/isr'), output).toMatch(/○.*10s/)
    expect(buildRouteLine(output, '/rendering/ssr'), output).toContain('ƒ')
    expect(buildRouteLine(output, '/rendering/streaming'), output).toContain('ƒ')
  })

  // 위 빌드 결과를 next start로 띄워 검사한다(config/playwright.config.ts).
  test('빌드한 앱에서 E2E가 통과한다(SSG는 미리 만든 HTML, ISR은 다시 렌더링, 스트리밍은 대체 UI 먼저, CSR은 브라우저가 요청)', async () => {
    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })
})
