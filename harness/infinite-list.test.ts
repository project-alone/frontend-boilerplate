import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { freePort } from './run.ts'
import { expectFileToPass, readTree, type RenderingMode, runVitestScript, useStarter } from './starter.ts'

// 하네스 매트릭스: Base에 infinite-list Recipe를 넣은 Starter를 지원하는 Rendering Mode마다 만들고, dark-mode Recipe를 함께
// 넣은 조합도 만들어, Starter 자신의 스크립트와 Recipe가 함께 넣은 테스트(무한 스크롤·번호형 페이지네이션의 컴포넌트 테스트,
// 스토리, e2e/infinite-list.spec.ts)가 통과하는지 본다. server에서 다른 Recipe와 함께 켠 조합은 모든 Recipe를 켠 Showcase
// (showcase-starter.test.ts)가 보므로, dark-mode 조합은 static-export로 만든다.
const COMBINATIONS: readonly { renderingMode: RenderingMode; recipes: readonly string[] }[] = [
  { renderingMode: 'server', recipes: ['infinite-list'] },
  { renderingMode: 'static-export', recipes: ['infinite-list'] },
  { renderingMode: 'static-export', recipes: ['infinite-list', 'dark-mode'] },
]

// Recipe가 함께 넣은 테스트 파일
const UNIT_TESTS = [
  'src/features/article-list/article-infinite-list.test.tsx',
  'src/features/article-list/article-paged-list.test.tsx',
  'src/shared/paging/pagination.test.tsx',
]
const STORIES = ['src/shared/paging/infinite-list.stories.tsx', 'src/shared/paging/pagination.stories.tsx']

// 두 라우트와, 미리 렌더링한 HTML에 담기는 불러오는 중 상태
const ROUTES = [
  { path: '/articles', html: 'articles.html' },
  { path: '/articles/pagination', html: 'articles/pagination.html' },
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

    // Recipe의 Query Domain은 명세 조각의 operation으로 `npm run g -- query`가 만드는 코드와 같다(ADR-0008).
    test('npm run g -- query로 articles Query Domain(infiniteQueryOptions 포함)을 같은 코드로 다시 만들 수 있다', () => {
      const articles = join(starter.dir, 'src/queries/articles')
      const sample = readTree(articles)
      rmSync(articles, { recursive: true })

      starter.expectNpmSuccess(['run', 'g', '--', 'query', 'listArticles', '--infinite'])
      starter.expectNpmSuccess(['run', 'g', '--', 'query', 'listArticles'])
      starter.expectNpmSuccess(['run', 'g', '--', 'query', 'countArticles'])

      expect(readTree(articles)).toEqual(sample)
    })

    test('타입 검사, 린트, 포맷 검사, 단위 테스트(무한 스크롤과 번호형 페이지네이션)를 통과한다', () => {
      for (const script of [
        ['run', 'typecheck'],
        ['run', 'lint'],
        ['run', 'format:check'],
      ]) {
        starter.expectNpmSuccess(script)
      }

      const report = runVitestScript(starter, ['test'])
      for (const file of UNIT_TESTS) expectFileToPass(report, file, 1)
    })

    test(`목록 스토리가 ${withDarkMode ? '라이트 모드와 다크 모드 브라우저에서 각각 ' : ''}접근성(axe)과 상호작용 검사를 통과한다`, () => {
      const report = runVitestScript(starter, ['run', 'test:storybook'])

      for (const story of STORIES) expectFileToPass(report, story, withDarkMode ? 2 : 1)
    })

    test('빌드하면 두 목록 페이지는 데이터 없이 미리 렌더링된다', () => {
      const result = starter.expectNpmSuccess(['run', 'build'])

      for (const route of ROUTES) {
        if (renderingMode === 'server') {
          // next build는 라우트마다 미리 렌더링했는지(○ Static) 요청마다 렌더링하는지(ƒ Dynamic) 표로 보여 준다.
          const routeLine = result.output.split('\n').find((line) => line.trimEnd().endsWith(` ${route.path}`)) ?? ''
          expect(routeLine, result.output).toContain('○')
        } else {
          const html = readFileSync(join(starter.dir, 'out', route.html), 'utf8')
          expect(html, route.path).toContain('게시글 목록을 불러오는 중입니다.')
          // 목 백엔드의 첫 게시글 제목. 데이터는 브라우저가 가져온다.
          expect(html, route.path).not.toContain('릴리스 노트 46호')
        }
      }
    })

    // server는 위 빌드 결과를 띄워 검사하고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(config/playwright.config.ts).
    test('빌드한 앱에서 E2E가 통과한다(스크롤로 다음 페이지, 마지막 페이지, 더 보기 버튼, 번호형 페이지네이션, 접근성)', async () => {
      starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
    })
  })
}
