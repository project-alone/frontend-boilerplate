import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { afterAll, beforeAll, expect, inject } from 'vitest'
import { run, type RunResult } from './run.ts'

export type RenderingMode = 'server' | 'static-export'

/**
 * 설치된 Generator의 `dcgen new`로 cwd에 my-app Starter를 만들고 그 경로를 돌려준다.
 * `dcgen new`는 의존성까지 설치하는데, Starter가 고정한 Generator는 아직 npm에 없어 설치가 실패한다.
 * 그래서 args에 `--skip-install`을 넣고, 설치가 필요하면 linkPackedGenerator를 거쳐 설치한다(useStarter).
 */
export function newStarter(cwd: string, args: readonly string[] = []): string {
  const created = run(inject('dcgenBin'), ['new', 'my-app', ...args], cwd)
  expect(created.status, created.output).toBe(0)
  return join(cwd, 'my-app')
}

/** Starter 안에서 Starter에 설치된 Generator의 `dcgen`을 실행한다. `--`가 없으면 npm이 인자의 옵션을 가로챈다. */
export function dcgen(starter: Pick<Starter, 'dir'>, args: readonly string[]): RunResult {
  return run('npx', ['--no', '--', 'dcgen', ...args], starter.dir)
}

/** Generator의 npm 패키지 이름. Starter가 이 이름으로 Generator를 devDependencies에 고정한다. */
export const GENERATOR_PACKAGE = 'devc-frontend-generator'

/**
 * Starter가 devDependencies에 고정한 Generator를 하네스가 npm pack으로 만든 tarball로 바꾼다. Starter를 설치하기 전에
 * 불러야 하므로 `dcgen new --skip-install`로 만든 Starter에 쓴다.
 * Starter는 Generator를 npm 레지스트리의 정확한 버전으로 고정하지만 Generator는 아직 npm에 배포되지 않았으므로,
 * 하네스에서는 그 항목만 tarball 경로(`file:`)로 바꿔 지금 소스로 만든 Generator를 설치한다. Generator 코드에는 하네스용 분기를 두지 않는다.
 */
export function linkPackedGenerator(starterDir: string): void {
  const path = join(starterDir, 'package.json')
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as { devDependencies: Record<string, string> }
  expect(pkg.devDependencies[GENERATOR_PACKAGE], 'Starter가 Generator를 devDependencies에 고정하지 않았습니다').toBeDefined()
  pkg.devDependencies[GENERATOR_PACKAGE] = `file:${inject('dcgenTarball')}`
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
}

export interface NpmResult extends RunResult {
  /** 실행한 npm 명령과 출력. 실패했을 때 보여 준다. */
  failureMessage: string
}

/** 테스트 파일이 함께 쓰는 Starter 하나 */
export interface Starter {
  /** Starter 디렉터리 */
  readonly dir: string
  /** Starter를 만든 임시 디렉터리. Starter 밖에 파일을 둘 때 쓴다. */
  readonly workdir: string
  /** Starter 안에서 npm 명령을 실행한다. */
  npm: (args: readonly string[], env?: NodeJS.ProcessEnv) => NpmResult
  /** Starter 안에서 npm 명령을 실행하고 성공했는지 확인한다. */
  expectNpmSuccess: (args: readonly string[], env?: NodeJS.ProcessEnv) => NpmResult
  /** 개발자가 Starter에 파일을 추가하는 상황을 흉내 낸다. 디렉터리가 없으면 만든다. */
  writeFile: (path: string, content: string) => void
}

export interface StarterOptions {
  /** 임시 디렉터리 이름의 접두사(예: 'dcgen-api-layer-') */
  prefix: string
  /** `dcgen new --rendering-mode`. 없으면 플래그 없이 만든다(server). */
  renderingMode?: RenderingMode
  /** `dcgen new --recipe`로 넣을 Recipe */
  recipes?: readonly string[]
  /**
   * npm으로 설치까지 한다. `dcgen new --skip-install`로 만든 뒤 Generator를 하네스가 팩한 tarball로 바꾸고(linkPackedGenerator)
   * 설치한다. `dcgen new`가 직접 설치하는 경로는 new.test.ts가 하네스의 레지스트리(registry.ts)로 검증한다.
   */
  install?: boolean
  /** Storybook 테스트와 E2E가 쓰는 Chromium을 받는다(이미 받아 두었으면 건너뛴다). install이 필요하다. */
  playwright?: boolean
}

/**
 * 테스트 파일(또는 describe)의 모든 테스트가 함께 쓸 Starter를 beforeAll에서 만들고 afterAll에서 지운다.
 * 설치가 오래 걸리므로 테스트마다 다시 만들지 않는다. 같은 파일의 beforeAll은 이 다음에 실행되므로 Starter를 쓸 수 있다.
 */
export function useStarter(options: StarterOptions): Starter {
  let created: { dir: string; workdir: string } | undefined
  const current = () => {
    if (created === undefined) throw new Error('Starter는 beforeAll에서 만들어진 뒤에 쓸 수 있습니다.')
    return created
  }

  const npm = (args: readonly string[], env?: NodeJS.ProcessEnv): NpmResult => {
    const result = run('npm', args, current().dir, env)
    return { ...result, failureMessage: `npm ${args.join(' ')}\n${result.output}` }
  }
  const starter: Starter = {
    get dir() {
      return current().dir
    },
    get workdir() {
      return current().workdir
    },
    npm,
    expectNpmSuccess: (args, env) => {
      const result = npm(args, env)
      expect(result.status, result.failureMessage).toBe(0)
      return result
    },
    writeFile: (path, content) => {
      const file = join(current().dir, path)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, content)
    },
  }

  beforeAll(() => {
    const workdir = mkdtempSync(join(tmpdir(), options.prefix))
    const args = [
      ...(options.renderingMode === undefined ? [] : ['--rendering-mode', options.renderingMode]),
      ...(options.recipes ?? []).flatMap((recipe) => ['--recipe', recipe]),
      '--skip-install',
    ]
    created = { workdir, dir: newStarter(workdir, args) }
    if (options.install === true) {
      linkPackedGenerator(starter.dir)
      starter.expectNpmSuccess(['install', '--no-audit', '--no-fund'])
    }
    if (options.playwright === true) starter.expectNpmSuccess(['run', 'playwright:install'])
  })

  afterAll(() => {
    if (created !== undefined) rmSync(created.workdir, { recursive: true, force: true })
  })

  return starter
}

/**
 * 이미 떠 있는 서버(예: 개발 서버)를 대상으로 Starter의 Playwright 테스트를 실행한다.
 * Starter의 playwright.config.ts는 빌드 결과를 띄워 검사하므로, baseURL만 바꾼 설정을 잠시 두고 지운다.
 */
export function runPlaywrightAgainst(starterDir: string, baseURL: string, specs: readonly string[]): RunResult {
  const config = 'playwright.harness-dev.config.ts'
  writeFileSync(
    join(starterDir, config),
    `import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: '${baseURL}' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
`,
  )
  try {
    return run('npx', ['playwright', 'test', '--config', config, ...specs], starterDir)
  } finally {
    rmSync(join(starterDir, config))
  }
}

/** 디렉터리 아래 모든 파일을 { 상대 경로: 내용 }으로 읽는다. */
export function readTree(directory: string): Record<string, string> {
  const files = readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
  return Object.fromEntries(
    files.map((entry) => {
      const path = join(entry.parentPath, entry.name)
      return [relative(directory, path), readFileSync(path, 'utf8')]
    }),
  )
}

/** Base의 샘플 명세(openapi.yaml)에 적힌 listProducts의 example. MSW가 이 값을 돌려준다. */
export const SAMPLE_PRODUCTS = [
  { id: 1, name: '기본 티셔츠', price: 19000 },
  { id: 2, name: '데님 재킷', price: 89000 },
]

/** 서버 컴포넌트가 렌더링할 때마다 샘플 API를 부르는 탐침 페이지의 경로. Next.js 서버 안에서 MSW가 요청을 받는지 볼 때 쓴다. */
export const MSW_PROBE_ROUTE = '/harness-msw'

/** 샘플 API 주소. 샘플 명세의 servers이고, MSW가 켜져 있으면 이 주소로 가는 요청을 MSW가 받는다. */
export const SAMPLE_API_URL = 'https://api.example.com/products'

/** MSW_PROBE_ROUTE에 탐침 페이지를 만든다. 페이지는 SAMPLE_API_URL의 응답에 담긴 상품 이름을 목록으로 보여 준다. */
export function writeMswProbePage(starter: Pick<Starter, 'writeFile'>): void {
  starter.writeFile(
    `src/app${MSW_PROBE_ROUTE}/page.tsx`,
    `export default async function HarnessMswPage() {
  const response = await fetch('${SAMPLE_API_URL}', { cache: 'no-store' })
  const products = (await response.json()) as { id: number; name: string }[]
  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  )
}
`,
  )
}
