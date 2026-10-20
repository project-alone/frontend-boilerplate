import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { TestProject } from 'vitest/node'

const GENERATOR_DIR = resolve(import.meta.dirname, '../packages/devc-frontend-generator')

// Generator를 실제 배포되는 형태(npm pack tarball)로 설치해 둔다.
// 하네스는 워크스페이스 소스가 아니라 이 설치본의 `dcgen`만 실행한다.
export default function setup(project: TestProject) {
  const root = mkdtempSync(join(tmpdir(), 'dcgen-harness-'))

  execFileSync('npm', ['run', 'build'], { cwd: GENERATOR_DIR, stdio: 'inherit' })
  const packed = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', root], {
    cwd: GENERATOR_DIR,
    encoding: 'utf8',
  })
  const [tarball] = JSON.parse(packed) as { filename: string }[]
  if (tarball === undefined) throw new Error(`npm pack 결과를 읽을 수 없습니다: ${packed}`)

  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'harness-consumer', private: true }))
  execFileSync('npm', ['install', '--no-audit', '--no-fund', join(root, tarball.filename)], {
    cwd: root,
    stdio: 'inherit',
  })

  project.provide('dcgenBin', join(root, 'node_modules', '.bin', 'dcgen'))

  return () => {
    rmSync(root, { recursive: true, force: true })
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    dcgenBin: string
  }
}
