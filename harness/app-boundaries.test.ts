import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { freePort } from './run.ts'
import { expectFileToPass, runVitestScript, type RenderingMode, type Starter, useStarter } from './starter.ts'

// 하네스 매트릭스: Base의 앱 수준 화면(src/app/error.tsx, global-error.tsx, not-found.tsx)을 Rendering Mode마다 본다.
// Base의 스토리와 E2E(e2e/not-found.spec.ts)에 더해, 라우트에 경계가 없는 페이지와 루트 레이아웃에서 오류를 내는 탐침
// (harness/fixtures/app-boundaries)을 Starter에 두고 빌드한 앱에서 E2E로 확인한다. server Starter에서는 서버 컴포넌트의 오류와
// notFound()가 상태 코드 500·404로 나가는지도 본다. 앱 수준의 loading.tsx를 두면 응답을 먼저 보내 200이 되므로 이 검사가 실패한다. 라우트 수준의 경계(npm run g -- page,
// 대시보드·커머스 Archetype)가 먼저 받는 것은 그 경계를 만든 쪽의 E2E가 본다(fixtures/g-page/server.spec.ts, Archetype의 e2e).

const FIXTURES = join(import.meta.dirname, 'fixtures/app-boundaries')
const LAYOUT = 'src/app/layout.tsx'

/** Base 루트 레이아웃의 import와 본문에 탐침(레이아웃에서 오류를 내는 버튼)을 끼워 넣는다. */
function withLayoutErrorTrigger(layout: string): string {
  const importLine = "import { AppShell } from './app-shell'"
  const body = '<AppShell>{children}</AppShell>'
  expect(layout, 'Base 루트 레이아웃의 모양이 바뀌었습니다. 탐침을 끼워 넣는 자리를 고치세요.').toContain(importLine)
  expect(layout, 'Base 루트 레이아웃의 모양이 바뀌었습니다. 탐침을 끼워 넣는 자리를 고치세요.').toContain(body)
  return layout
    .replace(importLine, `${importLine}\nimport { HarnessLayoutErrorTrigger } from './harness-layout-error-trigger'`)
    .replace(body, `${body}\n        <HarnessLayoutErrorTrigger />`)
}

/** 탐침 페이지, 루트 레이아웃의 탐침, 탐침을 검사하는 E2E를 Starter에 둔다. 서버에서 렌더링하는 탐침은 server Starter에만 둔다. */
function writeProbes(starter: Starter, renderingMode: RenderingMode): void {
  const fixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf8')
  starter.writeFile('src/app/harness-page-error/page.tsx', fixture('page-error.tsx'))
  starter.writeFile('src/app/harness-layout-error-trigger.tsx', fixture('layout-error-trigger.tsx'))
  starter.writeFile(LAYOUT, withLayoutErrorTrigger(readFileSync(join(starter.dir, LAYOUT), 'utf8')))
  if (renderingMode === 'server') {
    starter.writeFile('src/app/harness-server-error/page.tsx', fixture('server-error.tsx'))
    starter.writeFile('src/app/harness-not-found/page.tsx', fixture('not-found.tsx'))
  }
  starter.writeFile('e2e/harness-app-boundaries.spec.ts', fixture('app-boundaries.spec.ts'))
}

describe.each(['server', 'static-export'] as const)('Rendering Mode %s Starter의 앱 수준 오류·404 화면', (renderingMode) => {
  const starter = useStarter({
    prefix: `dcgen-app-boundaries-${renderingMode}-`,
    renderingMode,
    install: true,
    playwright: true,
  })

  test('타입 검사, 린트, 포맷 검사를 통과하고, 화면마다 둔 스토리가 접근성(axe)·상호작용 검사를 통과한다', () => {
    for (const script of [['run', 'typecheck'], ['run', 'lint'], ['run', 'format:check']]) {
      starter.expectNpmSuccess(script)
    }

    const stories = runVitestScript(starter, ['run', 'test:storybook'])
    for (const file of ['src/app/error.stories.tsx', 'src/app/not-found.stories.tsx']) {
      expectFileToPass(stories, file, 1)
    }
  })

  test.runIf(renderingMode === 'static-export')('빌드는 앱 수준의 404 화면을 out/404.html로 내보낸다', () => {
    starter.expectNpmSuccess(['run', 'build'])

    const html = readFileSync(join(starter.dir, 'out', '404.html'), 'utf8')
    expect(html).toContain('찾는 화면이 없습니다')
  })

  // server는 이 빌드 결과를 next start로 띄우고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(playwright.config.ts).
  test('빌드한 앱에서 없는 주소, 페이지의 오류, 루트 레이아웃의 오류(와 server의 서버 오류 500, notFound() 404)를 앱 수준 화면이 받는다', async () => {
    writeProbes(starter, renderingMode)
    if (renderingMode === 'server') starter.expectNpmSuccess(['run', 'build'])

    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })
})
