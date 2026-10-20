import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { freePort } from './run.ts'
import { expectFileToPass, readTree, type RenderingMode, runVitestScript, useStarter } from './starter.ts'

// 하네스 매트릭스: Base에 table Recipe를 넣은 Starter를 Recipe가 지원하는 Rendering Mode마다 만들어, Starter 자신의 스크립트와
// Recipe가 함께 넣은 테스트(src/features/member-table/member-table.test.tsx, e2e/table.spec.ts)가 통과하는지 본다.
// 다른 Recipe와 함께 켠 조합은 아래의 dark-mode 조합(static-export)과, 모든 Recipe를 켠 server Showcase(showcase-starter.test.ts)가 본다.

describe.each(['server', 'static-export'] as const)(
  'Rendering Mode %s에 table Recipe를 넣은 Starter',
  (renderingMode) => {
    const starter = useStarter({
      prefix: `dcgen-table-${renderingMode}-`,
      renderingMode,
      recipes: ['table'],
      install: true,
      playwright: true,
    })

    // Recipe의 Query Domain은 `npm run g -- query`가 만드는 코드 그대로다. 지우고 다시 만들면 같은 코드가 나오고,
    // 아래 검사가 이 코드로 돈다.
    test('Query Domain(src/queries/members)은 npm run g -- query listMembers가 만드는 코드와 같다', () => {
      const members = join(starter.dir, 'src/queries/members')
      const recipe = readTree(members)
      rmSync(members, { recursive: true })

      starter.expectNpmSuccess(['run', 'g', '--', 'query', 'listMembers'])

      expect(readTree(members)).toEqual(recipe)
    })

    test('타입 검사, 린트, 포맷 검사, 단위 테스트(테이블의 정렬·필터·페이지 포함), 스토리 검사를 통과한다', () => {
      for (const script of [
        ['run', 'typecheck'],
        ['run', 'lint'],
        ['run', 'format:check'],
      ]) {
        starter.expectNpmSuccess(script)
      }
      expectFileToPass(runVitestScript(starter, ['test']), 'member-table.test.tsx', 1)
      starter.expectNpmSuccess(['run', 'test:storybook'])
    })

    test('빌드하면 /members는 페이지 뼈대를 미리 만든다', () => {
      const result = starter.expectNpmSuccess(['run', 'build'])

      // server의 next build는 라우트마다 미리 렌더링했는지(○ Static) 표로 보여 준다. static-export는 모든 라우트를 미리 만든다.
      if (renderingMode === 'server') {
        const routeLine = result.output.split('\n').find((line) => line.includes(' /members')) ?? ''
        expect(routeLine, result.output).toContain('○')
      } else {
        expect(readFileSync(join(starter.dir, 'out/members.html'), 'utf8')).toContain('회원을 불러오는 중입니다.')
      }
    })

    // server는 위 빌드 결과를 띄워 검사하고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(playwright.config.ts).
    test('빌드한 앱에서 E2E가 통과한다(키보드로 정렬·검색·역할 필터, 요청 파라미터, 페이지 이동, 접근성)', async () => {
      starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
    })
  },
)

// 같은 화면에 다른 Recipe가 더한 요소(dark-mode의 머리글, 다크 테마의 토큰)가 있어도 두 Recipe의 테스트가 함께 통과한다.
// server 조합은 모든 Recipe를 켠 Showcase(showcase-starter.test.ts)가 보므로 여기서는 static-export만 본다.
const COMBINED_MODE: RenderingMode = 'static-export'

describe(`Rendering Mode ${COMBINED_MODE}에 table과 dark-mode Recipe를 함께 넣은 Starter`, () => {
  const starter = useStarter({
    prefix: 'dcgen-table-dark-mode-',
    renderingMode: COMBINED_MODE,
    recipes: ['table', 'dark-mode'],
    install: true,
    playwright: true,
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트를 통과한다', () => {
    for (const script of [
      ['run', 'typecheck'],
      ['run', 'lint'],
      ['run', 'format:check'],
    ]) {
      starter.expectNpmSuccess(script)
    }
    const report = runVitestScript(starter, ['test'])
    expectFileToPass(report, 'member-table.test.tsx', 1)
    expectFileToPass(report, 'theme.test.ts', 1)
  })

  test('빌드한 앱에서 두 Recipe의 E2E가 함께 통과한다', async () => {
    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })
})
