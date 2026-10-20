import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { TestProject } from 'vitest/node'

const GENERATOR_DIR = resolve(import.meta.dirname, '../packages/devc-frontend-generator')

// 하네스만 쓰는 시험용 Recipe. 아직 실제 Recipe로는 만들 수 없는 조합(server 전용 Recipe, Recipe 사이의 의존,
// Base와 맞지 않는 패치)을 시험한다.
const FIXTURE_RECIPES_DIR = resolve(import.meta.dirname, 'fixtures/recipes')

// Generator를 실제 배포되는 형태(npm pack tarball)로 설치해 둔다.
// 하네스는 워크스페이스 소스가 아니라 이 설치본의 `dcgen`만 실행한다.
export default function setup(project: TestProject) {
  const root = mkdtempSync(join(tmpdir(), 'dcgen-harness-'))

  execFileSync('npm', ['run', 'build'], { cwd: GENERATOR_DIR, stdio: 'inherit' })
  const packed = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', root], {
    cwd: GENERATOR_DIR,
    encoding: 'utf8',
  })
  const [packedFile] = JSON.parse(packed) as { filename: string }[]
  if (packedFile === undefined) throw new Error(`npm pack 결과를 읽을 수 없습니다: ${packed}`)
  const tarball = join(root, packedFile.filename)

  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'harness-consumer', private: true }))
  execFileSync('npm', ['install', '--no-audit', '--no-fund', tarball], {
    cwd: root,
    stdio: 'inherit',
  })

  project.provide('dcgenBin', join(root, 'node_modules', '.bin', 'dcgen'))
  project.provide('dcgenTarball', tarball)

  // 설치한 Generator를 복사해 시험용 Recipe를 recipes/<이름>/에 더한다. 기여자가 Recipe를 더하는 방식 그대로다.
  // 같은 node_modules 안에 두어 Generator의 의존성을 그대로 찾게 한다.
  const withFixtures = join(root, 'node_modules', 'devc-frontend-generator-with-fixtures')
  cpSync(join(root, 'node_modules', 'devc-frontend-generator'), withFixtures, { recursive: true })
  cpSync(FIXTURE_RECIPES_DIR, join(withFixtures, 'recipes'), { recursive: true })
  project.provide('dcgenWithFixturesBin', join(withFixtures, 'dist', 'cli.js'))

  return () => {
    rmSync(root, { recursive: true, force: true })
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    dcgenBin: string
    /** npm pack으로 만든 Generator tarball. Starter가 npm 레지스트리 대신 이 파일로 Generator를 설치한다(starter.ts, registry.ts). */
    dcgenTarball: string
    /** 시험용 Recipe(harness/fixtures/recipes)를 더한 Generator의 dcgen */
    dcgenWithFixturesBin: string
  }
}
