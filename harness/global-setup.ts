import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { TestProject } from 'vitest/node'
import { packPackage } from './registry.ts'

const GENERATOR_DIR = resolve(import.meta.dirname, '../packages/devc-frontend-generator')

// 하네스만 쓰는 시험용 Recipe와 Archetype. 아직 실제 Recipe·Archetype으로는 만들 수 없는 조합(server 전용 Recipe, Recipe
// 사이의 의존, Base와 맞지 않는 패치, Rendering Mode를 스스로 좁힌 Archetype)을 시험한다.
const FIXTURE_RECIPES_DIR = resolve(import.meta.dirname, 'fixtures/recipes')
const FIXTURE_ARCHETYPES_DIR = resolve(import.meta.dirname, 'fixtures/archetypes')

// Generator를 실제 배포되는 형태(npm pack tarball)로 설치해 둔다.
// 하네스는 워크스페이스 소스가 아니라 이 설치본의 `dcgen`만 실행한다.
export default function setup(project: TestProject) {
  const root = mkdtempSync(join(tmpdir(), 'dcgen-harness-'))

  execFileSync('npm', ['run', 'build'], { cwd: GENERATOR_DIR, stdio: 'inherit' })
  const tarball = packPackage(GENERATOR_DIR, root)

  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'harness-consumer', private: true }))
  execFileSync('npm', ['install', '--no-audit', '--no-fund', tarball], {
    cwd: root,
    stdio: 'inherit',
  })

  project.provide('dcgenBin', join(root, 'node_modules', '.bin', 'dcgen'))
  project.provide('dcgenTarball', tarball)
  project.provide('generatorDir', join(root, 'node_modules', 'devc-frontend-generator'))

  // 설치한 Generator를 복사해 시험용 Recipe를 recipes/<이름>/에, 시험용 Archetype을 archetypes/<이름>/에 더한다. 기여자가
  // Recipe와 Archetype을 더하는 방식 그대로다. 같은 node_modules 안에 두어 Generator의 의존성을 그대로 찾게 한다.
  const withFixtures = join(root, 'node_modules', 'devc-frontend-generator-with-fixtures')
  cpSync(join(root, 'node_modules', 'devc-frontend-generator'), withFixtures, { recursive: true })
  cpSync(FIXTURE_RECIPES_DIR, join(withFixtures, 'recipes'), { recursive: true })
  cpSync(FIXTURE_ARCHETYPES_DIR, join(withFixtures, 'archetypes'), { recursive: true })
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
    /** npm pack tarball로 설치한 Generator 패키지의 디렉터리. Showcase 스크립트(scripts/showcase.ts)의 --generator로 넘긴다. */
    generatorDir: string
    /** 시험용 Recipe(harness/fixtures/recipes)와 Archetype(harness/fixtures/archetypes)을 더한 Generator의 dcgen */
    dcgenWithFixturesBin: string
  }
}
