import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { freePort } from './run.ts'
import { expectFileToPass, type RenderingMode, runVitestScript, useStarter } from './starter.ts'

// 하네스 매트릭스: Base에 file-upload Recipe를 넣은 Starter를 Recipe가 지원하는 Rendering Mode마다 만들어, Starter 자신의 스크립트와
// Recipe가 함께 넣은 테스트(src/shared/upload/의 api-upload·upload-policy 테스트, src/features/file-uploader/의 컴포넌트 테스트와
// 스토리, e2e/file-upload.spec.ts)가 통과하는지 본다. server의 E2E는 업로드가 BFF 프록시를 거쳐 multipart 본문 그대로 목 백엔드에 닿는지도 본다.
// 다른 Recipe와 함께 켠 조합은 아래의 dark-mode 조합(static-export)과, 모든 Recipe를 켠 server Showcase(showcase-starter.test.ts)가 본다.

describe.each(['server', 'static-export'] as const)(
  'Rendering Mode %s에 file-upload Recipe를 넣은 Starter',
  (renderingMode) => {
    const starter = useStarter({
      prefix: `dcgen-file-upload-${renderingMode}-`,
      renderingMode,
      recipes: ['file-upload'],
      install: true,
      playwright: true,
    })

    test('타입 검사, 린트, 포맷 검사, 단위 테스트(업로드 요청, 명세와 같은 업로드 기준, 업로더), 스토리 검사를 통과한다', () => {
      for (const script of [
        ['run', 'typecheck'],
        ['run', 'lint'],
        ['run', 'format:check'],
      ]) {
        starter.expectNpmSuccess(script)
      }
      const report = runVitestScript(starter, ['test'])
      expectFileToPass(report, 'src/shared/upload/api-upload.test.ts', 1)
      expectFileToPass(report, 'src/shared/upload/upload-policy.test.ts', 1)
      expectFileToPass(report, 'src/features/file-uploader/file-uploader.test.tsx', 1)
      const stories = runVitestScript(starter, ['run', 'test:storybook'])
      expectFileToPass(stories, 'src/features/file-uploader/file-uploader.stories.tsx', 1)
    })

    test('빌드하면 /upload는 페이지 뼈대를 미리 만든다', () => {
      const result = starter.expectNpmSuccess(['run', 'build'])

      // server의 next build는 라우트마다 미리 렌더링했는지(○ Static) 표로 보여 준다. static-export는 모든 라우트를 미리 만든다.
      if (renderingMode === 'server') {
        const routeLine = result.output.split('\n').find((line) => line.includes(' /upload')) ?? ''
        expect(routeLine, result.output).toContain('○')
      } else {
        expect(readFileSync(join(starter.dir, 'out/upload.html'), 'utf8')).toContain('파일 선택')
      }
    })

    // server는 위 빌드 결과를 띄워 검사하고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(playwright.config.ts).
    test('빌드한 앱에서 E2E가 통과한다(진행률, 끌어 놓기, 크기·형식 검사, 취소와 재시도, 실패와 재시도, 접근성)', async () => {
      starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
    })
  },
)

// 같은 화면에 다른 Recipe가 더한 요소(dark-mode의 머리글, 다크 테마의 토큰)가 있어도 두 Recipe의 테스트가 함께 통과한다.
// server 조합은 모든 Recipe를 켠 Showcase(showcase-starter.test.ts)가 보므로 여기서는 static-export만 본다.
const COMBINED_MODE: RenderingMode = 'static-export'

describe(`Rendering Mode ${COMBINED_MODE}에 file-upload와 dark-mode Recipe를 함께 넣은 Starter`, () => {
  const starter = useStarter({
    prefix: 'dcgen-file-upload-dark-mode-',
    renderingMode: COMBINED_MODE,
    recipes: ['file-upload', 'dark-mode'],
    install: true,
    playwright: true,
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트, 라이트·다크 모드 브라우저의 스토리 검사를 통과한다', () => {
    for (const script of [
      ['run', 'typecheck'],
      ['run', 'lint'],
      ['run', 'format:check'],
    ]) {
      starter.expectNpmSuccess(script)
    }
    const report = runVitestScript(starter, ['test'])
    expectFileToPass(report, 'src/features/file-uploader/file-uploader.test.tsx', 1)
    expectFileToPass(report, 'theme.test.ts', 1)
    // dark-mode가 있으면 스토리마다 다크 모드 브라우저에서 한 번 더 실행된다.
    const stories = runVitestScript(starter, ['run', 'test:storybook'])
    expectFileToPass(stories, 'src/features/file-uploader/file-uploader.stories.tsx', 2)
  })

  test('빌드한 앱에서 두 Recipe의 E2E가 함께 통과한다(다크 모드에서의 axe 검사 포함)', async () => {
    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })
})
