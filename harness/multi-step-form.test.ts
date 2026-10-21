import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { freePort } from './run.ts'
import { expectFileToPass, readTree, type RenderingMode, runVitestScript, useStarter } from './starter.ts'

// 하네스 매트릭스: Base에 multi-step-form Recipe를 넣은 Starter를 지원하는 Rendering Mode마다 만들고, dark-mode Recipe를 함께
// 넣은 조합도 만들어, Starter 자신의 스크립트와 Recipe가 함께 넣은 테스트(단계마다 검증·값 유지·한 번에 제출을 보는 컴포넌트
// 테스트, 저장소 테스트, 폼 스토리, e2e/multi-step-form.spec.ts)가 통과하는지 본다. server에서 dark-mode와 함께 켠 조합은 모든
// Recipe를 켠 Showcase(showcase-starter.test.ts)가 보므로, dark-mode 조합은 static-export로 만든다.
const COMBINATIONS: readonly { renderingMode: RenderingMode; recipes: readonly string[] }[] = [
  { renderingMode: 'server', recipes: ['multi-step-form'] },
  { renderingMode: 'static-export', recipes: ['multi-step-form'] },
  { renderingMode: 'static-export', recipes: ['multi-step-form', 'dark-mode'] },
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

    // 폼이 제출에 쓰는 뮤테이션 훅은 명세 조각의 operation으로 `npm run g -- mutation`이 만드는 코드와 같다(ADR-0008).
    test('npm run g -- mutation으로 partners Query Domain을 같은 코드로 다시 만들 수 있다', () => {
      const partners = join(starter.dir, 'src/queries/partners')
      const sample = readTree(partners)
      rmSync(partners, { recursive: true })

      starter.expectNpmSuccess(['run', 'g', '--', 'mutation', 'submitPartnerApplication'])

      expect(readTree(partners)).toEqual(sample)
    })

    test('타입 검사, 린트, 포맷 검사, 단위 테스트(단계마다 검증, 값 유지, 한 번에 제출, 새로 고침)를 통과한다', () => {
      for (const script of [
        ['run', 'typecheck'],
        ['run', 'lint'],
        ['run', 'format:check'],
      ]) {
        starter.expectNpmSuccess(script)
      }

      const report = runVitestScript(starter, ['test'])
      expectFileToPass(report, 'src/features/partner-application/partner-application-form.test.tsx', 1)
      expectFileToPass(report, 'src/shared/multi-step-form/draft-storage.test.ts', 1)
    })

    test(`폼 스토리(첫 단계, 검증 오류, 확인 단계)가 ${withDarkMode ? '라이트 모드와 다크 모드 브라우저에서 각각 ' : ''}접근성(axe) 검사를 통과한다`, () => {
      const report = runVitestScript(starter, ['run', 'test:storybook'])

      expectFileToPass(
        report,
        'src/features/partner-application/partner-application-form.stories.tsx',
        withDarkMode ? 2 : 1,
      )
    })

    test('빌드하면 /partners/apply는 첫 단계를 미리 렌더링한다', () => {
      const result = starter.expectNpmSuccess(['run', 'build'])

      if (renderingMode === 'server') {
        // next build는 라우트마다 미리 렌더링했는지(○ Static) 요청마다 렌더링하는지(ƒ Dynamic) 표로 보여 준다.
        const routeLine = result.output.split('\n').find((line) => line.includes(' /partners/apply')) ?? ''
        expect(routeLine, result.output).toContain('○')
      } else {
        const html = readFileSync(join(starter.dir, 'out/partners/apply.html'), 'utf8')
        expect(html).toContain('사업자 정보')
        expect(html).toContain('4단계 중 1단계')
      }
    })

    // server는 위 빌드 결과를 띄워 검사하고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(playwright.config.ts).
    test('빌드한 앱에서 E2E가 통과한다(끝까지 신청, 검증 오류와 포커스, 이전·다음과 새로 고침, 라이트·다크 모드의 axe 검사)', async () => {
      starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
    })
  })
}
