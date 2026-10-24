import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { freePort } from './run.ts'
import { expectFileToPass, readTree, type RenderingMode, runVitestScript, useStarter } from './starter.ts'

// 하네스 매트릭스: Base에 optimistic-update Recipe를 넣은 Starter를 Recipe가 지원하는 Rendering Mode마다 만들고, dark-mode
// Recipe를 함께 넣은 조합도 만들어, Starter 자신의 스크립트와 Recipe가 함께 넣은 테스트
// (src/features/todo-list/todo-list.test.tsx, e2e/optimistic-update.spec.ts)가 통과하는지 본다. server에서 다른 Recipe와 함께
// 켠 조합은 모든 Recipe를 켠 Showcase(showcase-starter.test.ts)가 보므로, dark-mode 조합은 static-export로 만든다.
const COMBINATIONS: readonly { renderingMode: RenderingMode; recipes: readonly string[] }[] = [
  { renderingMode: 'server', recipes: ['optimistic-update'] },
  { renderingMode: 'static-export', recipes: ['optimistic-update'] },
  { renderingMode: 'static-export', recipes: ['optimistic-update', 'dark-mode'] },
]

const TODOS_QUERY_DOMAIN = 'src/queries/todos'

// mutation --optimistic이 만든 뼈대에서 개발자가 채우는 함수(applyUpdateTodo)의 선언. 바로 위의 설명 주석부터 뮤테이션 훅 앞까지다.
const APPLY_UPDATE_TODO = /\/\/ updateTodo의 응답이 오기 전에[\s\S]*?\n\n(?=export function useUpdateTodoMutation)/

/** 쿼리 모듈에서 applyUpdateTodo의 선언을 뺀다. 선언이 없으면 실패한다. */
function withoutApplyUpdateTodo(source: string | undefined): string {
  expect(source).toMatch(APPLY_UPDATE_TODO)
  return (source ?? '').replace(APPLY_UPDATE_TODO, '')
}

for (const { renderingMode, recipes } of COMBINATIONS) {
  describe(`Rendering Mode ${renderingMode}에 Recipe ${recipes.join(', ')}를 넣은 Starter`, () => {
    const alone = recipes.length === 1
    const starter = useStarter({
      prefix: `dcgen-${recipes.join('-')}-${renderingMode}-`,
      renderingMode,
      recipes,
      install: true,
      playwright: true,
    })

    // Recipe의 Query Domain은 명세 조각의 operation으로 `npm run g`가 만드는 뼈대에, 응답 전에 보일 값을 만드는 함수만 채운
    // 것이다(ADR-0008). 다시 만든 뒤에는 Recipe의 코드로 되돌려 아래 검사가 Recipe의 코드로 돈다.
    test('npm run g -- query listTodos와 mutation updateTodo --optimistic listTodos가 만든 뼈대에 applyUpdateTodo만 채웠다', () => {
      const todos = join(starter.dir, TODOS_QUERY_DOMAIN)
      const recipe = readTree(todos)
      rmSync(todos, { recursive: true })

      try {
        starter.expectNpmSuccess(['run', 'g', '--', 'query', 'listTodos'])
        starter.expectNpmSuccess(['run', 'g', '--', 'mutation', 'updateTodo', '--optimistic', 'listTodos'])

        const generated = readTree(todos)
        expect(Object.keys(generated).sort()).toEqual(Object.keys(recipe).sort())
        expect(generated['todos.keys.ts']).toBe(recipe['todos.keys.ts'])
        expect(withoutApplyUpdateTodo(generated['todos.queries.ts'])).toBe(
          withoutApplyUpdateTodo(recipe['todos.queries.ts']),
        )
        // 생성한 뼈대는 캐시를 그대로 두고, Recipe는 보낸 값을 목록에 덮어쓴다.
        expect(generated['todos.queries.ts']).toContain('= (current) =>')
        expect(recipe['todos.queries.ts']).toContain('{ ...todo, ...todoUpdate }')
      } finally {
        rmSync(todos, { recursive: true, force: true })
        for (const [file, content] of Object.entries(recipe)) starter.writeFile(`${TODOS_QUERY_DOMAIN}/${file}`, content)
      }
    })

    test('타입 검사, 린트, 포맷 검사, 단위 테스트(응답 전의 캐시, 실패했을 때 되돌리기와 알림)를 통과한다', () => {
      for (const script of [
        ['run', 'typecheck'],
        ['run', 'lint'],
        ['run', 'format:check'],
      ]) {
        starter.expectNpmSuccess(script)
      }

      const report = runVitestScript(starter, ['test'])
      expectFileToPass(report, 'src/features/todo-list/todo-list.test.tsx', 1)
      if (!alone) expectFileToPass(report, 'theme.test.ts', 1)
    })

    test('빌드하면 /todos는 할 일 없이 페이지 뼈대를 미리 만든다', () => {
      const result = starter.expectNpmSuccess(['run', 'build'])

      if (renderingMode === 'server') {
        // next build는 라우트마다 미리 렌더링했는지(○ Static) 요청마다 렌더링하는지(ƒ Dynamic) 표로 보여 준다.
        const routeLine = result.output.split('\n').find((line) => line.includes(' /todos')) ?? ''
        expect(routeLine, result.output).toContain('○')
      } else {
        const html = readFileSync(join(starter.dir, 'out/todos.html'), 'utf8')
        expect(html).toContain('할 일을 불러오는 중입니다.')
        expect(html).not.toContain('회의록 공유하기')
      }
    })

    // server는 위 빌드 결과를 띄워 검사하고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(config/playwright.config.ts).
    test('빌드한 앱에서 E2E가 통과한다(응답 전에 바뀌는 체크, MSW가 거절한 할 일의 되돌리기와 알림, 접근성)', async () => {
      starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
    })
  })
}
