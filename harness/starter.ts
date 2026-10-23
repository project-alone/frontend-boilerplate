import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { devNull, tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { afterAll, beforeAll, beforeEach, expect, inject } from 'vitest'
import { run, type RunResult } from './run.ts'

/**
 * git을 실행하는 명령(`git`, git 저장소를 만드는 `dcgen new`)에 넣는 환경 변수. 사용자의 전역·시스템 git 설정(core.hooksPath,
 * 커밋 서명, init.templateDir 등)이 결과를 바꾸지 않도록 격리하고, 커밋에 쓸 이름과 이메일은 그 명령에만 정한다. 전역 설정은
 * 바꾸지 않는다.
 */
export const GIT_ENV: NodeJS.ProcessEnv = {
  GIT_CONFIG_GLOBAL: devNull,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'harness',
  GIT_AUTHOR_EMAIL: 'harness@example.com',
  GIT_COMMITTER_NAME: 'harness',
  GIT_COMMITTER_EMAIL: 'harness@example.com',
}

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

/**
 * 설치한 Starter의 package.json과 package-lock.json에서 Generator를 뺀다. 이미지를 빌드하는 docker Recipe의 Dockerfile은 두 파일만
 * 먼저 복사해 npm ci로 설치하는데, linkPackedGenerator가 고정한 tarball은 Starter 밖에 있어 이미지 안에서 설치할 수 없기 때문이다.
 * Generator는 코드 생성(npm run g)에만 쓰고 빌드와 실행에는 쓰지 않는다. `npm uninstall --package-lock-only`는 Generator와 상관없는
 * 선택 의존성(@emnapi 등)까지 lock에서 지워 npm ci가 실패하므로 Generator의 항목만 직접 지운다. Generator만 쓰던 의존성은 lock에 남는다.
 */
export function unlinkPackedGenerator(starterDir: string): void {
  interface Manifest {
    devDependencies?: Record<string, string>
  }
  const update = <T>(file: string, edit: (json: T) => void) => {
    const path = join(starterDir, file)
    const json = JSON.parse(readFileSync(path, 'utf8')) as T
    edit(json)
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`)
  }
  const removeGenerator = (manifest: Manifest | undefined) => {
    expect(manifest?.devDependencies?.[GENERATOR_PACKAGE], 'Starter가 Generator를 devDependencies에 고정하지 않았습니다').toBeDefined()
    delete manifest?.devDependencies?.[GENERATOR_PACKAGE]
  }

  update<Manifest>('package.json', removeGenerator)
  update<{ packages: Record<string, Manifest> }>('package-lock.json', ({ packages }) => {
    removeGenerator(packages[''])
    expect(packages[`node_modules/${GENERATOR_PACKAGE}`]).toBeDefined()
    delete packages[`node_modules/${GENERATOR_PACKAGE}`]
  })
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
  /** `dcgen new --archetype`으로 넣을 Archetype */
  archetypes?: readonly string[]
  /**
   * `dcgen new` 대신 Starter를 만드는 방법. 임시 디렉터리를 받아 그 안에 만든 Starter의 경로를 돌려준다(예: Showcase 생성 스크립트).
   * 있으면 renderingMode, recipes, archetypes는 쓰지 않는다.
   */
  create?: (workdir: string) => string
  /**
   * npm으로 설치까지 한다. `dcgen new --skip-install`로 만든 뒤 Generator를 하네스가 팩한 tarball로 바꾸고(linkPackedGenerator)
   * 설치한다. 의존성 구성이 같은 Starter를 이미 설치했으면 그 결과를 복사한다(installDependencies). `dcgen new`가 직접 설치하는
   * 경로는 new.test.ts가 하네스의 레지스트리(registry.ts)로 검증한다.
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
      ...(options.archetypes ?? []).flatMap((archetype) => ['--archetype', archetype]),
      '--skip-install',
    ]
    created = { workdir, dir: options.create?.(workdir) ?? newStarter(workdir, args) }
    if (options.install === true) {
      linkPackedGenerator(starter.dir)
      installDependencies(starter)
    }
    if (options.playwright === true) starter.expectNpmSuccess(['run', 'playwright:install'])
  })

  afterAll(() => {
    if (created !== undefined) rmSync(created.workdir, { recursive: true, force: true })
  })

  return starter
}

/**
 * linkPackedGenerator를 거친 Starter의 의존성을 설치한다. 설치가 하네스 시간에서 가장 크므로, 하네스가 한 번 실행되는 동안 의존성
 * 구성이 같은 Starter를 이미 설치했으면 그 결과(node_modules와 package-lock.json)를 복사해 `npm install`을 건너뛴다(#109).
 * 의존성 구성마다 처음 한 번은 `npm install`을 실행한다. 의존성 구성은 package.json에, Starter에서 Generator tarball까지의 상대
 * 경로를 더한 것이다. package-lock.json이 tarball을 Starter 기준 상대 경로로 적기 때문이다.
 * 하드 링크가 아니라 복사하므로 한 Starter에서 node_modules를 고쳐도 다른 Starter에 번지지 않는다. 설치할 때 의존성이 node_modules
 * 밖에 남기는 lefthook의 git 훅은 복사하지 않는데, lefthook은 CI에서는 훅을 설치하지 않고 훅이 필요한 quality-gates.test.ts는 직접
 * 설치한다.
 */
function installDependencies(starter: Starter): void {
  const store = inject('installStore')
  const dependencies = createHash('sha256')
    .update(readFileSync(join(starter.dir, 'package.json')))
    .update(relative(starter.dir, inject('dcgenTarball')))
    .digest('hex')
  const saved = join(store, dependencies)
  if (existsSync(saved)) {
    copyInstall(saved, starter.dir)
    return
  }

  starter.expectNpmSuccess(['install', '--no-audit', '--no-fund'])
  // 같은 의존성 구성을 다른 워커의 테스트 파일이 동시에 설치했을 수 있다. 다 복사한 뒤 rename으로 한 번에 놓아 다른 워커가 반쯤
  // 복사된 결과를 쓰지 않게 하고, 먼저 놓인 결과가 있으면 그것을 남긴다.
  if (existsSync(saved)) return
  const staging = mkdtempSync(join(store, 'staging-'))
  copyInstall(starter.dir, staging)
  try {
    renameSync(staging, saved)
  } catch {
    rmSync(staging, { recursive: true, force: true })
  }
}

/**
 * from 디렉터리의 설치 결과(node_modules, package-lock.json)를 to 디렉터리에 복사한다. node_modules에는 파일이 수만 개 있는데,
 * macOS에서는 fs.cpSync가 cp보다 몇 배 느려 cp를 쓴다. cp -R은 node_modules/.bin의 상대 경로 심볼릭 링크를 따라가지 않고 그대로
 * 복사하므로 복사본이 원본을 가리키지 않는다. macOS(APFS)에서는 -c로 파일을 복제(clonefile)해 더 빨리 복사한다. 복제한 파일도
 * 고치면 따로 저장되므로 서로 독립적이다.
 */
function copyInstall(from: string, to: string): void {
  const flags = process.platform === 'darwin' ? ['-cR'] : ['-R']
  const copied = run('cp', [...flags, join(from, 'node_modules'), join(from, 'package-lock.json'), to], from)
  expect(copied.status, copied.output).toBe(0)
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

/**
 * 테스트마다 Starter의 directories(Starter 최상위 기준)를 처음 상태로 되돌린다. 처음 상태는 이 함수가 등록하는 beforeAll에서
 * 복사해 두므로, 그보다 먼저 등록한 beforeAll(예: 명세에 operation 더하기)의 결과까지 담긴다.
 */
export function restoreBeforeEach(starter: Starter, directories: readonly string[]): void {
  const pristine = () => join(starter.workdir, 'pristine')
  beforeAll(() => {
    for (const directory of directories) {
      cpSync(join(starter.dir, directory), join(pristine(), directory), { recursive: true })
    }
  })
  beforeEach(() => {
    for (const directory of directories) {
      rmSync(join(starter.dir, directory), { recursive: true, force: true })
      cpSync(join(pristine(), directory), join(starter.dir, directory), { recursive: true })
    }
  })
}

/**
 * Schematic이 directory(Starter 최상위 기준)에 만든 files가 snapshots(테스트 파일 기준) 아래 같은 이름의 스냅샷과 같은지 본다.
 * 스냅샷은 Starter의 코드이므로 하네스의 타입 검사 대상에서 뺀다(tsconfig.json).
 */
export async function expectFilesToMatchSnapshots(
  starter: Starter,
  snapshots: string,
  directory: string,
  files: readonly string[],
): Promise<void> {
  for (const file of files) {
    const source = readFileSync(join(starter.dir, directory, file), 'utf8')
    await expect(source).toMatchFileSnapshot(`${snapshots}/${file}`)
  }
}

/** Starter의 Vitest 스크립트(npm test, npm run test:storybook)가 남긴 JSON 보고서 */
export interface VitestReport {
  testResults: { name: string; status: string; assertionResults: unknown[] }[]
}

/** Starter의 npm 스크립트(Vitest)를 JSON 보고서와 함께 실행해 성공했는지 확인하고 보고서를 돌려준다. */
export function runVitestScript(starter: Starter, script: readonly string[]): VitestReport {
  const report = join(starter.workdir, 'vitest-report.json')
  starter.expectNpmSuccess([...script, '--', '--reporter=default', '--reporter=json', `--outputFile.json=${report}`])
  return JSON.parse(readFileSync(report, 'utf8')) as VitestReport
}

/** report에서 file로 끝나는 테스트 파일이 runs번 실행되었고 모두 통과했는지 본다. 생성한 테스트가 실제로 돌았는지 확인할 때 쓴다. */
export function expectFileToPass(report: VitestReport, file: string, runs: number): void {
  const results = report.testResults.filter(({ name }) => name.endsWith(`/${file}`))
  expect(results, file).toHaveLength(runs)
  for (const result of results) {
    expect(result.status, file).toBe('passed')
    expect(result.assertionResults.length, file).toBeGreaterThan(0)
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

/** Starter의 검사 스크립트(타입 검사, 린트, 포맷 검사, 단위 테스트, 스토리 검사)가 모두 통과하는지 본다. */
export function expectStarterChecksToPass(starter: Pick<Starter, 'expectNpmSuccess'>): void {
  for (const script of [['run', 'typecheck'], ['run', 'lint'], ['run', 'format:check'], ['test'], ['run', 'test:storybook']]) {
    starter.expectNpmSuccess(script)
  }
}

/**
 * `next build`가 보여 주는 라우트 표에서 route의 줄. 라우트마다 미리 렌더링했는지(○ Static, ● generateStaticParams로 만든
 * SSG) 요청마다 렌더링하는지(ƒ Dynamic) 보여 준다. 없으면 빈 문자열이다.
 */
export function buildRouteLine(buildOutput: string, route: string): string {
  return buildOutput.split('\n').find((line) => line.trimEnd().endsWith(` ${route}`) || line.includes(` ${route} `)) ?? ''
}

/** Base의 샘플 명세(openapi.yaml)에 적힌 listProducts의 example. MSW가 이 값을 돌려준다. */
export const SAMPLE_PRODUCTS = [
  { id: 1, name: '기본 티셔츠', price: 19000 },
  { id: 2, name: '데님 재킷', price: 89000 },
]

/** 서버 컴포넌트가 렌더링할 때마다 샘플 API를 부르는 탐침 페이지의 경로. Next.js 서버 안에서 MSW가 요청을 받는지 볼 때 쓴다. */
export const MSW_PROBE_ROUTE = '/harness-msw'

/** 샘플 API 주소. Starter의 목 백엔드 주소(src/shared/api/base-url.ts의 MOCK_API_BASE_URL)라 MSW가 켜져 있으면 이 주소로 가는 요청을 MSW가 받는다. */
export const SAMPLE_API_URL = 'https://mock.api.test/products'

/**
 * MSW_PROBE_ROUTE에 탐침 페이지를 만든다. 페이지는 SAMPLE_API_URL의 응답에 담긴 상품 이름을 목록으로 보여 준다.
 * label을 주면 그 값을 내보내는 모듈(label.ts)을 페이지 옆에 만들고, 페이지가 그 모듈을 import해 목록의 이름(aria-label)으로 쓴다.
 * 개발 서버가 떠 있는 동안 페이지가 새 모듈을 import하게 고칠 때 쓴다.
 */
export function writeMswProbePage(starter: Pick<Starter, 'writeFile'>, label?: string): void {
  const page = `export default async function HarnessMswPage() {
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
`
  const path = `src/app${MSW_PROBE_ROUTE}/page.tsx`
  if (label === undefined) {
    starter.writeFile(path, page)
    return
  }
  starter.writeFile(`src/app${MSW_PROBE_ROUTE}/label.ts`, `export const LABEL = ${JSON.stringify(label)}\n`)
  starter.writeFile(path, `import { LABEL } from './label'\n\n${page.replace('<ul>', '<ul aria-label={LABEL}>')}`)
}
