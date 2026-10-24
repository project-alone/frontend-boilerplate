import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { describe, expect, test } from 'vitest'
import { freePort } from './run.ts'
import { expectFileToPass, newStarter, readTree, type RenderingMode, runVitestScript, useStarter } from './starter.ts'

// chart Recipe가 차트 코드에 쓰는 파일. 색은 디자인 토큰만 써야 한다.
const CHART_SOURCES = [
  'src/shared/chart/chart-theme.ts',
  'src/shared/chart/chart-figure.tsx',
  'src/features/stats-charts/daily-visits-chart.tsx',
  'src/features/stats-charts/channel-sales-chart.tsx',
  'src/features/stats-charts/stats-charts.tsx',
]

test('chart Recipe는 Base의 디자인 토큰과 공통 UI를 고치지 않고, 차트의 색을 Base와 dark-mode에 있는 색 토큰으로만 정한다', () => {
  const workdir = mkdtempSync(join(tmpdir(), 'dcgen-chart-tokens-'))
  try {
    const generate = (directory: string, args: readonly string[]) => {
      const cwd = join(workdir, directory)
      mkdirSync(cwd)
      return newStarter(cwd, [...args, '--skip-install'])
    }
    const base = generate('base', [])
    const chart = generate('chart', ['--recipe', 'chart', '--recipe', 'dark-mode'])
    const darkMode = generate('dark-mode', ['--recipe', 'dark-mode'])

    // 토큰 파일과 공통 컴포넌트는 dark-mode만 넣은 Starter와 같다.
    expect(readTree(join(chart, 'src/shared/ui'))).toEqual(readTree(join(darkMode, 'src/shared/ui')))
    const tokens = readFileSync(join(base, 'src/shared/ui/tokens.css'), 'utf8')
    const darkTokens = readFileSync(join(chart, 'src/shared/ui/tokens-dark.css'), 'utf8')

    const used = new Set<string>()
    for (const path of CHART_SOURCES) {
      const source = readFileSync(join(chart, path), 'utf8')
      // 색을 직접 적지 않는다(#fff, rgb() 등). 토큰 밖의 색은 테마가 바꿀 수 없다.
      expect(source, path).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/i)
      for (const [, name] of source.matchAll(/var\((--color-[\w-]+)\)/g)) used.add(name ?? '')
    }
    expect(used.size).toBeGreaterThan(0)
    for (const name of used) {
      expect(tokens, `${name}는 tokens.css의 토큰이어야 한다`).toContain(`${name}:`)
      expect(darkTokens, `${name}는 tokens-dark.css에 어두운 값이 있어야 한다`).toContain(`${name}:`)
    }
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
})

// 하네스 매트릭스: Base에 chart Recipe를 넣은 Starter를 지원하는 Rendering Mode마다 만들고, dark-mode Recipe를 함께 넣은
// 조합도 만들어, Starter 자신의 스크립트와 Recipe가 함께 넣은 테스트(데이터 표의 컴포넌트 테스트, 차트 스토리,
// e2e/chart.spec.ts)가 통과하는지 본다. server에서 dark-mode와 함께 켠 조합은 모든 Recipe를 켠 Showcase
// (showcase-starter.test.ts)가 보므로, dark-mode 조합은 static-export로 만들어 내보낸 HTML에서도 다크 테마의 토큰을 따르는지 본다.
const COMBINATIONS: readonly { renderingMode: RenderingMode; recipes: readonly string[] }[] = [
  { renderingMode: 'server', recipes: ['chart'] },
  { renderingMode: 'static-export', recipes: ['chart'] },
  { renderingMode: 'static-export', recipes: ['chart', 'dark-mode'] },
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
    test('npm run g -- query로 stats Query Domain을 같은 코드로 다시 만들 수 있다', () => {
      const stats = join(starter.dir, 'src/queries/stats')
      const sample = readTree(stats)
      rmSync(stats, { recursive: true })

      starter.expectNpmSuccess(['run', 'g', '--', 'query', 'listDailyVisits'])
      starter.expectNpmSuccess(['run', 'g', '--', 'query', 'listChannelSales'])

      expect(readTree(stats)).toEqual(sample)
    })

    test('타입 검사, 린트, 포맷 검사, 단위 테스트(차트의 데이터 표)를 통과한다', () => {
      for (const script of [
        ['run', 'typecheck'],
        ['run', 'lint'],
        ['run', 'format:check'],
      ]) {
        starter.expectNpmSuccess(script)
      }

      const report = runVitestScript(starter, ['test'])
      expectFileToPass(report, 'src/features/stats-charts/stats-charts.test.tsx', 1)
    })

    test(`차트 스토리가 ${withDarkMode ? '라이트 모드와 다크 모드 브라우저에서 각각 ' : ''}접근성(axe)과 명도 대비 검사를 통과한다`, () => {
      const report = runVitestScript(starter, ['run', 'test:storybook'])

      for (const story of ['daily-visits-chart.stories.tsx', 'channel-sales-chart.stories.tsx']) {
        expectFileToPass(report, `src/features/stats-charts/${story}`, withDarkMode ? 2 : 1)
      }
    })

    test.runIf(withDarkMode)(
      '다크 테마의 토큰이 차트의 선을 배경과 구별하지 못하게 만들면 다크 모드 브라우저의 차트 스토리 검사가 실패한다',
      () => {
        const tokensPath = join(starter.dir, 'src/shared/ui/tokens-dark.css')
        const original = readFileSync(tokensPath, 'utf8')
        // 주요 계열의 색(primary)을 보조 배경색(배경과 거의 같은 어두운 색)으로 바꾼다.
        const muted = /--color-muted:\s*([^;]+);/.exec(original)?.[1]
        if (muted === undefined) throw new Error('tokens-dark.css에 --color-muted가 없습니다.')
        writeFileSync(tokensPath, original.replace(/(--color-primary:)[^;]+;/, `$1 ${muted};`))

        try {
          const result = starter.npm(['run', 'test:storybook', '--', 'src/features/stats-charts'])

          expect(result.status, result.failureMessage).not.toBe(0)
          // Vitest는 색을 쓸 수 있는 환경(CI 등)에서 프로젝트 이름을 `|이름|` 대신 색 배지로 찍으므로, 색 코드를 지우고 `|`는 있어도 없어도 맞게 본다.
          const output = stripVTControlCharacters(result.output)
          // axe는 SVG의 선을 보지 않으므로, 스토리가 잰 명도 대비가 실패를 잡는다.
          expect(output).toContain('contrastRatio')
          expect(output).toMatch(
            /FAIL\s+\|?storybook \(chromium, dark\)\|?\s+src\/features\/stats-charts\/daily-visits-chart\.stories\.tsx/,
          )
          expect(output).not.toMatch(/FAIL\s+\|?storybook \(chromium\)\|?\s+src\/features\/stats-charts\//)
        } finally {
          writeFileSync(tokensPath, original)
        }
      },
    )

    test('빌드하면 차트 페이지는 데이터 없이 미리 렌더링된다', () => {
      const result = starter.expectNpmSuccess(['run', 'build'])

      if (renderingMode === 'server') {
        // next build는 라우트마다 미리 렌더링했는지(○ Static) 요청마다 렌더링하는지(ƒ Dynamic) 표로 보여 준다.
        const routeLine = result.output.split('\n').find((line) => line.includes(' /charts')) ?? ''
        expect(routeLine, result.output).toContain('○')
      } else {
        const html = readFileSync(join(starter.dir, 'out', 'charts.html'), 'utf8')
        expect(html).toContain('일별 방문 수를 불러오는 중입니다.')
        expect(html).not.toContain('1,680회')
      }
    })

    // server는 위 빌드 결과를 띄워 검사하고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(config/playwright.config.ts).
    test('빌드한 앱에서 E2E가 통과한다(두 차트와 데이터 표, 운영체제가 라이트·다크 모드일 때의 명도 대비와 axe 검사)', async () => {
      starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
    })
  })
}
