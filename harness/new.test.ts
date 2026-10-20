import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, inject, test } from 'vitest'
import { run } from './run.ts'
import { GENERATOR_PACKAGE, linkPackedGenerator, newStarter, readTree } from './starter.ts'

let workdir: string

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-new-'))
})

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true })
})

test('new로 만든 Starter는 Starter 이름을 패키지 이름으로 쓴다', () => {
  const result = run(inject('dcgenBin'), ['new', 'my-app'], workdir)
  expect(result.status, result.output).toBe(0)

  const pkg = JSON.parse(readFileSync(join(workdir, 'my-app', 'package.json'), 'utf8')) as { name: string }
  expect(pkg.name).toBe('my-app')
})

test('new로 만든 Starter는 Starter를 만든 Generator를 정확한 버전으로 devDependencies에 고정한다', () => {
  const version = run(inject('dcgenBin'), ['--version'], workdir)
  expect(version.status, version.output).toBe(0)

  const starter = newStarter(workdir)

  const pkg = JSON.parse(readFileSync(join(starter, 'package.json'), 'utf8')) as {
    devDependencies: Record<string, string>
  }
  expect(pkg.devDependencies[GENERATOR_PACKAGE]).toBe(version.output.trim())
})

test('new는 이미 내용이 있는 디렉터리에 Starter를 만들지 않는다', () => {
  const existing = join(workdir, 'my-app')
  mkdirSync(existing)
  writeFileSync(join(existing, 'notes.txt'), '지우면 안 되는 파일')

  const result = run(inject('dcgenBin'), ['new', 'my-app'], workdir)

  expect(result.status).not.toBe(0)
  expect(result.output).toContain('비어 있지 않습니다')
  expect(readdirSync(existing)).toEqual(['notes.txt'])
  expect(readFileSync(join(existing, 'notes.txt'), 'utf8')).toBe('지우면 안 되는 파일')
})

test('new는 알 수 없는 Rendering Mode를 고를 수 있는 값과 함께 거부하고 아무것도 만들지 않는다', () => {
  const result = run(inject('dcgenBin'), ['new', 'my-app', '--rendering-mode', 'spa'], workdir)

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

  const omitted = generate('omitted', [])
  const server = generate('server', ['--rendering-mode', 'server'])

  expect(readTree(omitted)).toEqual(readTree(server))
})

// 하네스 매트릭스: Recipe 없이 Base만 넣은 Starter를 Rendering Mode마다 만들어 본다.
// Rendering Mode별 동작(E2E, Storybook 등)은 test-tools.test.ts(server)와 static-export.test.ts가 더 검증한다.
test.each(['server', 'static-export'])(
  'new --rendering-mode %s로 만든 Starter는 npm으로 설치되고 타입 검사, 테스트, 빌드, 린트, 포맷 검사를 모두 통과한다',
  (renderingMode) => {
    const starter = newStarter(workdir, ['--rendering-mode', renderingMode])
    linkPackedGenerator(starter)

    // 빌드가 설정 파일(예: tsconfig.json)을 고쳐 써서 린트·포맷 검사를 깨뜨리지 않는지 보려고 둘을 빌드 뒤에 둔다.
    const steps = [
      ['install', '--no-audit', '--no-fund'],
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
