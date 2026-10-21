import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, inject, test } from 'vitest'
import { KEYS, run, runInTerminal } from './run.ts'
import { readTree } from './starter.ts'

// `dcgen new`가 Archetype을 고르고 조합을 검사하는 동작. 설치가 필요 없으므로 모두 --skip-install로 만든다.
// Archetype을 넣은 Starter의 스크립트·E2E는 Archetype마다 commerce.test.ts, dashboard.test.ts, landing.test.ts가 검증한다.

let workdir: string

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-archetypes-'))
})

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true })
})

/** workdir/<directory>에서 dcgen new my-app을 실행한다. */
function dcgenNew(args: readonly string[], { bin = inject('dcgenBin'), directory = '.' } = {}) {
  const cwd = join(workdir, directory)
  mkdirSync(cwd, { recursive: true })
  const result = run(bin, ['new', 'my-app', ...args, '--skip-install'], cwd)
  return { ...result, starter: join(cwd, 'my-app') }
}

test('new는 알 수 없는 Archetype을 고를 수 있는 Archetype 목록과 함께 거부하고 아무것도 만들지 않는다', () => {
  const result = dcgenNew(['--archetype', 'dashbord'])

  expect(result.status).not.toBe(0)
  expect(result.output).toContain('알 수 없는 Archetype')
  expect(result.output).toContain('dashbord')
  expect(result.output).toMatch(/고를 수 있는 Archetype: .*dashboard/)
  expect(readdirSync(workdir)).toEqual([])
  expect(existsSync(result.starter)).toBe(false)
})

test('Archetype을 고르면 그 Archetype이 쓰는 Recipe를 알리고 함께 넣은 뒤, Recipe 위에 Archetype의 화면을 더한다', () => {
  const result = dcgenNew(['--archetype', 'dashboard'])

  expect(result.status, result.output).toBe(0)
  for (const recipe of ['auth', 'chart', 'table']) {
    expect(result.output).toContain(`Archetype dashboard에 필요한 Recipe ${recipe}을(를) 함께 넣습니다.`)
  }
  expect(result.output).toContain('Archetype: dashboard')
  expect(result.output).toContain('Recipe: auth, chart, table')
  // Recipe의 파일(auth의 세션, table의 테이블, chart의 차트 틀)과 Archetype의 화면이 함께 있다.
  for (const path of [
    'src/shared/auth/session.ts',
    'src/features/member-table/member-table.tsx',
    'src/shared/chart/chart-figure.tsx',
    'src/app/dashboard/page.tsx',
  ]) {
    expect(existsSync(join(result.starter, path)), path).toBe(true)
  }
  // 선언 파일은 Starter에 덧입히지 않는다.
  expect(existsSync(join(result.starter, 'archetype.json'))).toBe(false)
})

test('Archetype이 쓰는 Recipe를 따로 골라도, 고른 순서가 달라도 같은 Starter를 만든다', () => {
  const archetypeOnly = dcgenNew(['--archetype', 'dashboard'], { directory: 'archetype-only' })
  const withRecipes = dcgenNew(['--recipe', 'table', '--archetype', 'dashboard', '--recipe', 'auth'], {
    directory: 'with-recipes',
  })
  expect(archetypeOnly.status, archetypeOnly.output).toBe(0)
  expect(withRecipes.status, withRecipes.output).toBe(0)
  // 직접 고른 Recipe는 함께 넣는다고 알리지 않는다.
  expect(withRecipes.output).not.toContain('필요한 Recipe auth')
  expect(withRecipes.output).toContain('Archetype dashboard에 필요한 Recipe chart')

  expect(readTree(withRecipes.starter)).toEqual(readTree(archetypeOnly.starter))
})

describe('터미널에서 실행한 new', () => {
  test('Rendering Mode 다음에 Archetype을 묻고, 고른 Archetype이 쓰는 Recipe는 함께 들어간다고 보여 준 뒤 고른 대로 만든다', async () => {
    const terminal = runInTerminal(inject('dcgenBin'), ['new', 'my-app', '--skip-install'], workdir)

    await terminal.waitFor('Rendering Mode를 고르세요')
    terminal.press(KEYS.enter) // server
    await terminal.waitFor('Archetype(완성된 앱 유형)을 고르세요')
    // Archetype은 이름순이고, 커서가 놓인 Archetype의 설명과 쓰는 Recipe를 보여 준다. 처음 커서는 commerce에 있고 그 아래가
    // dashboard다.
    await terminal.waitFor('Recipe: multi-step-form, optimistic-update')
    terminal.press(KEYS.down)
    await terminal.waitFor('Recipe: auth, chart, table')
    terminal.press(KEYS.space) // dashboard
    terminal.press(KEYS.enter)
    await terminal.waitFor('넣을 Recipe를 고르세요')
    await terminal.waitFor('Archetype dashboard에 들어 있어 함께 넣습니다.')
    terminal.press(KEYS.enter)

    expect(await terminal.exited, terminal.output()).toBe(0)
    expect(terminal.output()).toContain('Archetype: dashboard')
    expect(terminal.output()).toContain('Recipe: auth, chart, table')
    expect(existsSync(join(workdir, 'my-app', 'src/app/dashboard/page.tsx'))).toBe(true)
  })

  test('고른 Rendering Mode에서 쓸 수 없는 Archetype은 이유와 함께 알리고 고르지 못하게 하며, 쓸 수 있는 Archetype은 고른 대로 넣는다', async () => {
    const terminal = runInTerminal(inject('dcgenBin'), ['new', 'my-app', '--skip-install'], workdir)

    await terminal.waitFor('Rendering Mode를 고르세요')
    terminal.press(KEYS.down) // static-export
    terminal.press(KEYS.enter)

    await terminal.waitFor('Archetype dashboard은(는) Rendering Mode static-export에서 쓸 수 없습니다')
    await terminal.waitFor('Archetype dashboard에 필요해 함께 넣으려던 Recipe입니다.')
    // 쓰는 Recipe는 static-export를 지원해도 archetype.json에서 server로 좁힌 Archetype은 적어 둔 이유를 보인다.
    await terminal.waitFor('Archetype commerce은(는) Rendering Mode static-export에서 쓸 수 없습니다')
    // 커서는 고를 수 없는 commerce, dashboard를 건너뛰어 static-export에서도 쓸 수 있는 landing에 있다.
    await terminal.waitFor('Recipe: i18n, seo')
    terminal.press(KEYS.space)
    terminal.press(KEYS.enter)
    await terminal.waitFor('넣을 Recipe를 고르세요')
    await terminal.waitFor('Archetype landing에 들어 있어 함께 넣습니다.')
    terminal.press(KEYS.enter)

    expect(await terminal.exited, terminal.output()).toBe(0)
    expect(terminal.output()).toContain('Rendering Mode: static-export')
    expect(terminal.output()).toContain('Archetype: landing')
    expect(terminal.output()).toContain('Recipe: i18n, seo')
    expect(existsSync(join(workdir, 'my-app', 'src/app/[locale]/landing/page.tsx'))).toBe(true)
    expect(existsSync(join(workdir, 'my-app', 'src/app/dashboard'))).toBe(false)
  })

  test('--archetype을 주면 묻지 않고 플래그대로 만든다', async () => {
    const terminal = runInTerminal(inject('dcgenBin'), ['new', 'my-app', '--archetype', 'dashboard', '--skip-install'], workdir)

    expect(await terminal.exited, terminal.output()).toBe(0)
    expect(terminal.output()).not.toContain('Rendering Mode를 고르세요')
    expect(terminal.output()).toContain('Archetype: dashboard')
  })
})

describe('Rendering Mode를 스스로 좁힌 Archetype', () => {
  // 쓰는 Recipe는 두 Rendering Mode를 모두 지원하지만 Archetype의 화면이 server를 요구하는 경우(예: ISR 화면)는 하네스가
  // Generator에 더한 시험용 Archetype(harness/fixtures/archetypes)으로 확인한다.
  const bin = inject('dcgenWithFixturesBin')

  test('archetype.json에 적은 Rendering Mode만 받고, 빠진 Rendering Mode는 적은 이유와 함께 거부한다', () => {
    const rejected = dcgenNew(['--rendering-mode', 'static-export', '--archetype', 'server-only-archetype-fixture'], {
      bin,
      directory: 'static-export',
    })
    expect(rejected.status).not.toBe(0)
    expect(rejected.output).toContain(
      'Archetype server-only-archetype-fixture은(는) Rendering Mode static-export에서 쓸 수 없습니다(지원: server).',
    )
    expect(rejected.output).toContain('요청마다 다시 만드는 화면이 있는 시험용 Archetype입니다.')
    expect(readdirSync(join(workdir, 'static-export'))).toEqual([])

    const created = dcgenNew(['--archetype', 'server-only-archetype-fixture'], { bin, directory: 'server' })
    expect(created.status, created.output).toBe(0)
    expect(created.output).toContain('Archetype server-only-archetype-fixture에 필요한 Recipe dark-mode')
    expect(existsSync(join(created.starter, 'server-only-archetype-fixture.txt'))).toBe(true)
    expect(existsSync(join(created.starter, 'src/shared/ui/tokens-dark.css'))).toBe(true)
  })
})
