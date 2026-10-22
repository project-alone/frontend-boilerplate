import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, test } from 'vitest'
import { type PackedGeneratorRegistry, startPackedGeneratorRegistry } from './registry.ts'
import { KEYS, run, runInTerminal, start } from './run.ts'
import { GENERATOR_PACKAGE, newStarter, readTree } from './starter.ts'

let workdir: string

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-new-'))
})

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true })
})

test('new로 만든 Starter는 Starter 이름을 패키지 이름으로 쓴다', () => {
  const result = run(inject('dcgenBin'), ['new', 'my-app', '--skip-install'], workdir)
  expect(result.status, result.output).toBe(0)

  const pkg = JSON.parse(readFileSync(join(workdir, 'my-app', 'package.json'), 'utf8')) as { name: string }
  expect(pkg.name).toBe('my-app')
})

// Generator 고정과 `npm run g` 별칭은 Rendering Mode와 Recipe를 모두 덧입힌 뒤에도 남아야 한다.
test.each([
  { renderingMode: 'server', recipes: [], label: 'Base만' },
  { renderingMode: 'static-export', recipes: [], label: 'Base만' },
  { renderingMode: 'server', recipes: ['dark-mode'], label: 'dark-mode' },
  { renderingMode: 'static-export', recipes: ['dark-mode'], label: 'dark-mode' },
])(
  'new --rendering-mode $renderingMode($label)로 만든 Starter는 Starter를 만든 Generator를 정확한 버전으로 devDependencies에 고정하고 npm run g 별칭을 가진다',
  ({ renderingMode, recipes }) => {
    const version = run(inject('dcgenBin'), ['--version'], workdir)
    expect(version.status, version.output).toBe(0)

    const recipeArgs = recipes.flatMap((recipe) => ['--recipe', recipe])
    const starter = newStarter(workdir, ['--rendering-mode', renderingMode, ...recipeArgs, '--skip-install'])

    const pkg = JSON.parse(readFileSync(join(starter, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>
      scripts: Record<string, string>
    }
    expect(pkg.devDependencies[GENERATOR_PACKAGE]).toBe(version.output.trim())
    expect(pkg.scripts['g']).toBe('dcgen g')
  },
)

test('new --skip-install은 의존성을 설치하지 않고, 다음 단계로 설치 명령을 안내한다', () => {
  const result = run(inject('dcgenBin'), ['new', 'my-app', '--skip-install'], workdir)

  expect(result.status, result.output).toBe(0)
  expect(existsSync(join(workdir, 'my-app', 'node_modules'))).toBe(false)
  expect(existsSync(join(workdir, 'my-app', 'package-lock.json'))).toBe(false)
  expect(result.output).toMatch(/cd my-app\s+npm install\s+npm run dev/)
})

test('new는 이미 내용이 있는 디렉터리에 Starter를 만들지 않는다', () => {
  const existing = join(workdir, 'my-app')
  mkdirSync(existing)
  writeFileSync(join(existing, 'notes.txt'), '지우면 안 되는 파일')

  const result = run(inject('dcgenBin'), ['new', 'my-app', '--skip-install'], workdir)

  expect(result.status).not.toBe(0)
  expect(result.output).toContain('비어 있지 않습니다')
  expect(readdirSync(existing)).toEqual(['notes.txt'])
  expect(readFileSync(join(existing, 'notes.txt'), 'utf8')).toBe('지우면 안 되는 파일')
})

test('new는 알 수 없는 Rendering Mode를 고를 수 있는 값과 함께 거부하고 아무것도 만들지 않는다', () => {
  const result = run(inject('dcgenBin'), ['new', 'my-app', '--rendering-mode', 'spa', '--skip-install'], workdir)

  expect(result.status).not.toBe(0)
  expect(result.output).toContain('spa')
  expect(result.output).toContain('server')
  expect(result.output).toContain('static-export')
  expect(readdirSync(workdir)).toEqual([])
})

test('new는 Rendering Mode를 지정하지 않으면 server Starter를 만든다', () => {
  const generate = (directory: string, args: readonly string[]) => {
    const cwd = join(workdir, directory)
    mkdirSync(cwd)
    return newStarter(cwd, args)
  }

  const omitted = generate('omitted', ['--skip-install'])
  const server = generate('server', ['--rendering-mode', 'server', '--skip-install'])

  expect(readTree(omitted)).toEqual(readTree(server))
})

describe('터미널에서 실행한 new', () => {
  const RENDERING_MODE_PROMPT = 'Rendering Mode를 고르세요'
  const ARCHETYPE_PROMPT = 'Archetype(완성된 앱 유형)을 고르세요'
  const RECIPE_PROMPT = '넣을 Recipe를 고르세요'

  test('플래그 없이 실행하면 Rendering Mode, Archetype, Recipe를 차례로 묻고 고른 대로 만든다', async () => {
    const terminal = runInTerminal(inject('dcgenBin'), ['new', 'my-app', '--skip-install'], workdir)

    await terminal.waitFor(RENDERING_MODE_PROMPT)
    // 기본값은 server이고, 그 아래가 static-export다.
    terminal.press(KEYS.down)
    terminal.press(KEYS.enter)
    // Archetype은 고르지 않고 넘어간다. Archetype을 고르는 동작은 archetypes.test.ts가 본다.
    await terminal.waitFor(ARCHETYPE_PROMPT)
    terminal.press(KEYS.enter)
    await terminal.waitFor(RECIPE_PROMPT)
    await terminal.waitFor('dark-mode')
    // Recipe는 이름순이고, 고른 Rendering Mode에서 쓸 수 없는 Recipe는 커서가 건너뛴다. 처음 커서는 analytics에 있고
    // chart를 지나 dark-mode로 옮긴다.
    terminal.press(KEYS.down)
    terminal.press(KEYS.down)
    terminal.press(KEYS.space)
    terminal.press(KEYS.enter)

    expect(await terminal.exited, terminal.output()).toBe(0)
    expect(terminal.output()).toContain('Rendering Mode: static-export')
    expect(terminal.output()).toContain('Archetype: 없음')
    expect(terminal.output()).toContain('Recipe: dark-mode')
    expect(readFileSync(join(workdir, 'my-app', 'next.config.ts'), 'utf8')).toContain("output: 'export'")
    expect(existsSync(join(workdir, 'my-app', 'src/shared/ui/tokens-dark.css'))).toBe(true)
  })

  test('묻는 도중에 취소하면 아무것도 만들지 않는다', async () => {
    const terminal = runInTerminal(inject('dcgenBin'), ['new', 'my-app', '--skip-install'], workdir)

    await terminal.waitFor(RENDERING_MODE_PROMPT)
    terminal.press(KEYS.ctrlC)

    expect(await terminal.exited, terminal.output()).not.toBe(0)
    expect(readdirSync(workdir)).toEqual([])
  })

  test('--rendering-mode나 --recipe를 주면 묻지 않고 플래그대로 만든다', async () => {
    const terminal = runInTerminal(inject('dcgenBin'), ['new', 'my-app', '--recipe', 'dark-mode', '--skip-install'], workdir)

    expect(await terminal.exited, terminal.output()).toBe(0)
    expect(terminal.output()).not.toContain(RENDERING_MODE_PROMPT)
    expect(terminal.output()).toContain('Rendering Mode: server')
    expect(terminal.output()).toContain('Recipe: dark-mode')
  })

  test('CI 환경 변수가 있으면 터미널이라도 묻지 않고 기본값으로 만든다', async () => {
    const terminal = runInTerminal(inject('dcgenBin'), ['new', 'my-app', '--skip-install'], workdir, { CI: 'true' })

    expect(await terminal.exited, terminal.output()).toBe(0)
    expect(terminal.output()).not.toContain(RENDERING_MODE_PROMPT)
    expect(terminal.output()).toContain('Rendering Mode: server')
    expect(terminal.output()).toContain('Recipe: 없음')
  })
})

// 하네스 매트릭스: Recipe 없이 Base만 넣은 Starter를 Rendering Mode마다 만들어 본다.
// Rendering Mode별 동작(E2E, Storybook 등)은 test-tools.test.ts(server)와 static-export.test.ts가 더 검증한다.
describe('--skip-install 없이 실행한 new', () => {
  // `dcgen new`는 Starter가 고정한 버전의 Generator를 npm 레지스트리에서 설치하지만 Generator는 아직 npm에 없다.
  // 그래서 하네스의 tarball을 배포된 것처럼 내주는 레지스트리를 띄우고, Generator 코드는 그대로 실행한다.
  // 다른 하네스는 --skip-install로 만든 뒤 Generator를 tarball로 바꿔 설치한다(starter.ts의 useStarter).
  let registry: PackedGeneratorRegistry

  beforeAll(async () => {
    registry = await startPackedGeneratorRegistry(inject('dcgenTarball'))
  })

  afterAll(async () => {
    await registry.close()
  })

  test.each(['server', 'static-export'])(
    'new --rendering-mode %s는 의존성까지 설치한 Starter를 만들고, Starter는 타입 검사, 테스트, 빌드, 린트, 포맷 검사를 모두 통과한다',
    async (renderingMode) => {
      const version = run(inject('dcgenBin'), ['--version'], workdir).output.trim()
      // npm install이 이 프로세스의 레지스트리에 요청하므로 이벤트 루프를 막지 않는 start로 실행한다.
      const creating = start(inject('dcgenBin'), ['new', 'my-app', '--rendering-mode', renderingMode], workdir, {
        npm_config_registry: registry.url,
      })
      expect(await creating.exited, creating.output()).toBe(0)
      const starter = join(workdir, 'my-app')

      // GitLab CI는 package-lock.json으로 설치(npm ci)하므로 첫 커밋부터 들어 있어야 한다.
      expect(existsSync(join(starter, 'package-lock.json'))).toBe(true)
      expect(creating.output()).toMatch(/cd my-app\s+npm run dev/)
      expect(creating.output()).not.toMatch(/cd my-app\s+npm install/)
      // Generator도 고정한 버전 그대로 레지스트리에서 설치했다.
      const lock = JSON.parse(readFileSync(join(starter, 'package-lock.json'), 'utf8')) as {
        packages: Record<string, { version?: string; resolved?: string }>
      }
      const generator = lock.packages[`node_modules/${GENERATOR_PACKAGE}`]
      expect(generator?.version).toBe(version)
      expect(generator?.resolved?.startsWith(registry.url), generator?.resolved).toBe(true)

      // 빌드가 설정 파일(예: tsconfig.json)을 고쳐 써서 린트·포맷 검사를 깨뜨리지 않는지 보려고 둘을 빌드 뒤에 둔다.
      const steps = [
        ['run', 'typecheck'],
        ['test'],
        ['run', 'build'],
        ['run', 'lint'],
        ['run', 'format:check'],
      ]
      for (const step of steps) {
        const result = run('npm', step, starter)
        expect(result.status, `npm ${step.join(' ')}\n${result.output}`).toBe(0)
      }

      expect(existsSync(join(starter, '.gitignore'))).toBe(true)
    },
  )
})
