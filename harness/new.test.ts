import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, inject, test } from 'vitest'
import { run } from './run.ts'

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

test('new로 만든 Starter는 npm으로 설치되고 타입 검사, 테스트, 빌드를 모두 통과한다', () => {
  expect(run(inject('dcgenBin'), ['new', 'my-app'], workdir).status).toBe(0)
  const starter = join(workdir, 'my-app')

  const steps = [
    ['install', '--no-audit', '--no-fund'],
    ['run', 'typecheck'],
    ['test'],
    ['run', 'build'],
  ]
  for (const step of steps) {
    const result = run('npm', step, starter)
    expect(result.status, `npm ${step.join(' ')}\n${result.output}`).toBe(0)
  }

  expect(existsSync(join(starter, '.gitignore'))).toBe(true)
})
