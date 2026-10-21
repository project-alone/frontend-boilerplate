import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { freePort } from './run.ts'
import { expectFileToPass, readTree, type RenderingMode, runVitestScript, useStarter } from './starter.ts'

// 하네스 매트릭스: Base에 realtime Recipe를 넣은 Starter를 Recipe가 지원하는 Rendering Mode마다 만들고, dark-mode Recipe를
// 함께 넣은 조합도 만들어, Starter 자신의 스크립트와 Recipe가 함께 넣은 테스트(이벤트 스트림 클라이언트와 배송 현황의
// 컴포넌트 테스트, 연결 상태 스토리, e2e/realtime.spec.ts)가 통과하는지 본다. server는 브라우저가 BFF 프록시를 거쳐 이벤트
// 스트림을 받고, static-export는 백엔드 주소로 직접 받는다. server에서 dark-mode와 함께 켠 조합은 모든 Recipe를 켠
// Showcase(showcase-starter.test.ts)가 본다.
const COMBINATIONS: readonly { renderingMode: RenderingMode; recipes: readonly string[] }[] = [
  { renderingMode: 'server', recipes: ['realtime'] },
  { renderingMode: 'static-export', recipes: ['realtime'] },
  { renderingMode: 'static-export', recipes: ['realtime', 'dark-mode'] },
]

for (const { renderingMode, recipes } of COMBINATIONS) {
  describe(`Rendering Mode ${renderingMode}에 Recipe ${recipes.join(', ')}를 넣은 Starter`, () => {
    const withDarkMode = recipes.includes('dark-mode')
    const starter = useStarter({
      prefix: `dcgen-${recipes.join('-')}-${renderingMode}-`,
      renderingMode,
      recipes,
      install: true,
      playwright: true,
    })

    // Query Domain의 쿼리 키와 queryOptions는 명세 조각의 operation으로 `npm run g -- query`가 만드는 코드 그대로다(ADR-0008).
    // 이벤트를 캐시에 반영하는 코드(deliveries.events.ts)는 Recipe가 더한 것이라 그대로 남는다.
    test('npm run g -- query listDeliveries로 deliveries Query Domain의 쿼리 키와 queryOptions를 같은 코드로 다시 만들 수 있다', () => {
      const deliveries = join(starter.dir, 'src/queries/deliveries')
      const sample = readTree(deliveries)
      rmSync(join(deliveries, 'deliveries.keys.ts'))
      rmSync(join(deliveries, 'deliveries.queries.ts'))

      starter.expectNpmSuccess(['run', 'g', '--', 'query', 'listDeliveries'])

      expect(readTree(deliveries)).toEqual(sample)
    })

    test('타입 검사, 린트, 포맷 검사, 단위 테스트(이벤트 스트림, 이벤트로 바뀌는 캐시, 다시 연결한 뒤 맞추기)를 통과한다', () => {
      for (const script of [
        ['run', 'typecheck'],
        ['run', 'lint'],
        ['run', 'format:check'],
      ]) {
        starter.expectNpmSuccess(script)
      }

      const report = runVitestScript(starter, ['test'])
      expectFileToPass(report, 'src/shared/realtime/event-stream.test.ts', 1)
      expectFileToPass(report, 'src/features/delivery-board/delivery-board.test.tsx', 1)
    })

    test(`연결 상태 스토리가 ${withDarkMode ? '라이트 모드와 다크 모드 브라우저에서 각각 ' : ''}접근성(axe) 검사를 통과한다`, () => {
      const report = runVitestScript(starter, ['run', 'test:storybook'])

      expectFileToPass(report, 'src/shared/realtime/connection-status.stories.tsx', withDarkMode ? 2 : 1)
    })

    test('빌드하면 /realtime은 배송 없이 페이지 뼈대만 미리 만든다', () => {
      const result = starter.expectNpmSuccess(['run', 'build'])

      if (renderingMode === 'server') {
        // next build는 라우트마다 미리 렌더링했는지(○ Static) 요청마다 렌더링하는지(ƒ Dynamic) 표로 보여 준다.
        const routeLine = result.output.split('\n').find((line) => line.includes(' /realtime')) ?? ''
        expect(routeLine, result.output).toContain('○')
      } else {
        const html = readFileSync(join(starter.dir, 'out', 'realtime.html'), 'utf8')
        expect(html).toContain('배송 현황을 불러오는 중입니다.')
        expect(html).toContain('실시간 연결 중')
        expect(html).not.toContain('D-1001')
      }
    })

    // server는 위 빌드 결과를 띄워 검사하고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(playwright.config.ts).
    test('빌드한 앱에서 E2E가 통과한다(실시간 이벤트가 목록에 바로 반영됨, 끊긴 뒤 다시 연결해 놓친 변경을 맞춤, 접근성)', async () => {
      starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
    })
  })
}
