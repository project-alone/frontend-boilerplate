import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, inject, test } from 'vitest'
import { KEYS, run, runInTerminal } from './run.ts'
import { readTree } from './starter.ts'

// `dcgen new`가 Recipe를 고르고 조합을 검사하는 동작. 설치가 필요 없으므로 모두 --skip-install로 만든다.
// dark-mode Recipe를 넣은 Starter의 스크립트·E2E는 dark-mode.test.ts가 검증한다.

let workdir: string

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-recipes-'))
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

test('new는 알 수 없는 Recipe를 고를 수 있는 Recipe 목록과 함께 거부하고 아무것도 만들지 않는다', () => {
  const result = dcgenNew(['--recipe', 'dark-mod'])

  expect(result.status).not.toBe(0)
  expect(result.output).toContain('알 수 없는 Recipe')
  expect(result.output).toContain('dark-mod')
  expect(result.output).toMatch(/고를 수 있는 Recipe: .*dark-mode/)
  expect(readdirSync(workdir)).toEqual([])
})

test('Recipe를 고르지 않으면 Recipe의 파일 없이 Base만으로 만든다', () => {
  const result = dcgenNew([])

  expect(result.status, result.output).toBe(0)
  expect(result.output).toContain('Recipe: 없음')
  expect(existsSync(join(result.starter, 'src/shared/ui/tokens-dark.css'))).toBe(false)
})

describe('Recipe 사이의 의존과 Rendering Mode 제약', () => {
  // 아직 실제 Recipe로 만들 수 없는 조합은 하네스가 Generator에 더한 시험용 Recipe(harness/fixtures/recipes)로 확인한다.
  const bin = inject('dcgenWithFixturesBin')

  test('Recipe가 필요로 하는 Recipe를 알리고 함께 넣는다', () => {
    const result = dcgenNew(['--recipe', 'needs-dark-mode-fixture'], { bin })

    expect(result.status, result.output).toBe(0)
    expect(result.output).toContain('Recipe needs-dark-mode-fixture에 필요한 Recipe dark-mode')
    expect(result.output).toContain('Recipe: dark-mode, needs-dark-mode-fixture')
    expect(existsSync(join(result.starter, 'needs-dark-mode-fixture.txt'))).toBe(true)
    expect(existsSync(join(result.starter, 'src/shared/ui/tokens-dark.css'))).toBe(true)
  })

  test('고른 순서와 상관없이 같은 Starter를 만든다', () => {
    const forward = dcgenNew(['--recipe', 'needs-dark-mode-fixture', '--recipe', 'dark-mode'], {
      bin,
      directory: 'forward',
    })
    const backward = dcgenNew(['--recipe', 'dark-mode', '--recipe', 'needs-dark-mode-fixture'], {
      bin,
      directory: 'backward',
    })
    expect(forward.status, forward.output).toBe(0)
    expect(backward.status, backward.output).toBe(0)

    expect(readTree(forward.starter)).toEqual(readTree(backward.starter))
  })

  test('지원하지 않는 Rendering Mode와의 조합은 만들기 전에 이유와 함께 거부한다', () => {
    const result = dcgenNew(['--rendering-mode', 'static-export', '--recipe', 'server-only-fixture'], { bin })

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Recipe server-only-fixture은(는) Rendering Mode static-export에서 쓸 수 없습니다')
    expect(result.output).toContain('지원: server')
    expect(result.output).toContain('요청을 받는 서버가 있어야 하는 시험용 Recipe입니다.')
    expect(readdirSync(workdir)).toEqual([])
  })

  test('함께 넣어야 하는 Recipe가 Rendering Mode를 지원하지 않아도 만들기 전에 거부한다', () => {
    const result = dcgenNew(['--rendering-mode', 'static-export', '--recipe', 'needs-server-only-fixture'], { bin })

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Recipe server-only-fixture은(는) Rendering Mode static-export에서 쓸 수 없습니다')
    expect(result.output).toContain('needs-server-only-fixture에 필요해 함께 넣으려던 Recipe입니다.')
    expect(readdirSync(workdir)).toEqual([])
  })

  test('터미널에서 고를 때는 고른 Rendering Mode에서 쓸 수 없는 Recipe를 이유와 함께 보여 주고 고르지 못하게 한다', async () => {
    const terminal = runInTerminal(bin, ['new', 'my-app', '--skip-install'], workdir)

    await terminal.waitFor('Rendering Mode를 고르세요')
    terminal.press(KEYS.down) // static-export
    terminal.press(KEYS.enter)
    await terminal.waitFor('넣을 Recipe를 고르세요')

    await terminal.waitFor('요청을 받는 서버가 있어야 하는 시험용 Recipe입니다.')
    await terminal.waitFor('needs-server-only-fixture에 필요해 함께 넣으려던 Recipe입니다.')
    terminal.press(KEYS.ctrlC)
    expect(await terminal.exited, terminal.output()).not.toBe(0)
    expect(readdirSync(workdir)).toEqual([])
  })

  test('server-only Recipe도 server Starter에는 넣는다', () => {
    const result = dcgenNew(['--rendering-mode', 'server', '--recipe', 'server-only-fixture'], { bin })

    expect(result.status, result.output).toBe(0)
    expect(existsSync(join(result.starter, 'server-only-fixture.txt'))).toBe(true)
  })

  test('Recipe의 패치가 Starter의 파일과 맞지 않으면 어느 패치인지 알리며 실패하고 만들던 Starter를 남기지 않는다', () => {
    const result = dcgenNew(['--recipe', 'stale-patch-fixture'], { bin })

    expect(result.status).not.toBe(0)
    expect(result.output).toContain('Recipe stale-patch-fixture')
    expect(result.output).toContain('src/app/page.tsx.patch')
    expect(readdirSync(workdir)).toEqual([])
  })
})
