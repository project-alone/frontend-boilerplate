import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { describe, expect, test } from 'vitest'
import { freePort, start, waitForServer } from './run.ts'
import { newStarter, readTree, runPlaywrightAgainst, useStarter } from './starter.ts'

test('dark-mode Recipe는 공통 컴포넌트와 Base의 토큰 값을 고치지 않고, Base에 있는 토큰의 값만 어두운 테마용으로 더한다', () => {
  const workdir = mkdtempSync(join(tmpdir(), 'dcgen-dark-mode-tokens-'))
  try {
    const generate = (directory: string, args: readonly string[]) => {
      const cwd = join(workdir, directory)
      mkdirSync(cwd)
      return newStarter(cwd, [...args, '--skip-install'])
    }
    const base = generate('base', [])
    const darkMode = generate('dark-mode', ['--recipe', 'dark-mode'])

    const baseUi = readTree(join(base, 'src/shared/ui'))
    const darkModeUi = readTree(join(darkMode, 'src/shared/ui'))
    const changed = Object.keys({ ...baseUi, ...darkModeUi }).filter((path) => baseUi[path] !== darkModeUi[path])
    // 스타일 진입점(styles.css)이 다크 모드 토큰을 불러오는 것 말고는 공통 UI가 같다.
    expect(changed.sort()).toEqual(['styles.css', 'tokens-dark.css'])

    const tokens = baseUi['tokens.css'] ?? ''
    const overridden = [...(darkModeUi['tokens-dark.css'] ?? '').matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name)
    expect(overridden.length).toBeGreaterThan(0)
    for (const name of overridden) expect(tokens, `${name ?? ''}는 tokens.css의 토큰이어야 한다`).toContain(`${name ?? ''}:`)
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
})

// 하네스 매트릭스: Base에 dark-mode Recipe를 넣은 Starter를 Rendering Mode마다 만들어, Starter 자신의 스크립트와
// Recipe가 함께 넣은 테스트(src/shared/theme/theme.test.ts, 테마 전환 UI 스토리, e2e/dark-mode.spec.ts)가 통과하는지 본다.
// Recipe 없이 Base만 넣은 조합은 new.test.ts가 검증한다.
describe.each(['server', 'static-export'] as const)('Rendering Mode %s에 dark-mode Recipe를 넣은 Starter', (renderingMode) => {
  const starter = useStarter({
    prefix: `dcgen-dark-mode-${renderingMode}-`,
    renderingMode,
    recipes: ['dark-mode'],
    install: true,
    playwright: true,
  })

  // Recipe를 덧입힌 뒤에도 Starter가 고정한 Generator와 `npm run g`로 Schematic을 실행할 수 있다. Base의 샘플 Query Domain을
  // 지우고 다시 만들면 같은 코드가 나온다(g-query.test.ts가 Base Starter에서 하는 검사와 같다). 아래 검사가 이 코드로 돈다.
  test('npm run g -- query로 Query Domain 코드를 만들 수 있다', () => {
    const products = join(starter.dir, 'src/queries/products')
    const sample = readTree(products)
    rmSync(products, { recursive: true })

    starter.expectNpmSuccess(['run', 'g', '--', 'query', 'listProducts'])

    expect(readTree(products)).toEqual(sample)
  })

  test('타입 검사, 린트, 포맷 검사, 단위 테스트를 통과한다', () => {
    for (const script of [['run', 'typecheck'], ['run', 'lint'], ['run', 'format:check'], ['test']]) {
      starter.expectNpmSuccess(script)
    }
  })

  test('모든 스토리가 라이트 모드와 다크 모드 브라우저에서 각각 접근성(axe)·상호작용 검사를 통과한다', () => {
    const report = join(starter.workdir, 'storybook-report.json')
    starter.expectNpmSuccess([
      'run',
      'test:storybook',
      '--',
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${report}`,
    ])

    // JSON 보고서의 테스트 이름 앞에는 Vitest 프로젝트 이름이 붙지 않으므로, 실행한 스토리 수가 두 배인지 본다.
    const { numPassedTests, numTotalTests, testResults } = JSON.parse(readFileSync(report, 'utf8')) as {
      numPassedTests: number
      numTotalTests: number
      testResults: { name: string }[]
    }
    expect(numPassedTests).toBe(numTotalTests)
    const switcherRuns = testResults.filter(({ name }) => name.endsWith('/theme-switcher.stories.tsx'))
    expect(switcherRuns).toHaveLength(2)
  })

  // Storybook 설정은 Rendering Mode와 상관없으므로 server에서만 본다.
  test.runIf(renderingMode === 'server')('다크 테마의 토큰이 명도 대비 기준을 어기면 다크 모드 브라우저의 스토리 검사가 실패한다', () => {
    const tokensPath = join(starter.dir, 'src/shared/ui/tokens-dark.css')
    const original = readFileSync(tokensPath, 'utf8')
    // 글자색을 보조 배경색(배경과 거의 같은 어두운 색)으로 바꿔 명도 대비를 떨어뜨린다.
    // 배경색과 똑같이 만들면 axe는 일부러 숨긴 글자일 수 있다며 위반으로 보지 않는다.
    const muted = /--color-muted:\s*([^;]+);/.exec(original)?.[1]
    if (muted === undefined) throw new Error('tokens-dark.css에 --color-muted가 없습니다.')
    writeFileSync(tokensPath, original.replace(/(--color-foreground:)[^;]+;/, `$1 ${muted};`))

    try {
      const result = starter.npm(['run', 'test:storybook'])

      expect(result.status, result.failureMessage).not.toBe(0)
      // Vitest는 색을 쓸 수 있는 환경(CI 등)에서 프로젝트 이름을 `|이름|` 대신 색 배지로 찍으므로, 색 코드를 지우고 `|`는 있어도 없어도 맞게 본다.
      const output = stripVTControlCharacters(result.output)
      expect(output).toContain('color-contrast')
      // 공통 컴포넌트의 스토리는 다크 모드 브라우저에서만 실패한다. 라이트 모드 브라우저는 Base의 토큰을 쓴다.
      expect(output).toMatch(/FAIL\s+\|?storybook \(chromium, dark\)\|?\s+src\/shared\/ui\/button\.stories\.tsx/)
      expect(output).not.toMatch(/FAIL\s+\|?storybook \(chromium\)\|?\s+src\/shared\/ui\//)
    } finally {
      writeFileSync(tokensPath, original)
    }
  })

  test('빌드를 통과한다', () => {
    starter.expectNpmSuccess(['run', 'build'])
  })

  // server는 위 빌드 결과를 띄워 검사하고, static-export는 E2E가 MSW를 켜고 직접 다시 빌드한다(config/playwright.config.ts).
  test('빌드한 앱에서 E2E가 통과한다(운영체제 설정, 저장한 테마, 깜빡임 없음, 두 테마의 접근성)', async () => {
    starter.expectNpmSuccess(['run', 'test:e2e'], { E2E_PORT: String(await freePort()) })
  })

  // hydration 불일치 경고는 개발 모드에서만 보인다. 레이아웃은 두 Rendering Mode가 같으므로 server에서만 본다.
  test.runIf(renderingMode === 'server')('개발 서버에서도 테마가 깜빡임 없이 적용되고 hydration 오류가 없다', async () => {
    const port = await freePort()
    const baseURL = `http://localhost:${String(port)}`
    const devServer = start('npm', ['run', 'dev', '--', '--port', String(port)], starter.dir)

    try {
      const response = await waitForServer(`${baseURL}/`, devServer)
      expect(response.status, devServer.output()).toBe(200)

      // e2e/dark-mode.spec.ts는 페이지에서 난 오류(hydration 불일치 경고 포함)가 없는지도 본다.
      const result = runPlaywrightAgainst(starter.dir, baseURL, ['e2e/dark-mode.spec.ts'])
      expect(result.status, `${result.output}\n${devServer.output()}`).toBe(0)
    } finally {
      await devServer.stop()
    }
  })
})
