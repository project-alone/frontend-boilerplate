import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, expect, inject, test } from 'vitest'
import { packPackage, startPackedGeneratorRegistry } from './registry.ts'
import { run, start } from './run.ts'
import { GENERATOR_PACKAGE } from './starter.ts'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const CHANGESET_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'changeset')

let workdir: string

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'dcgen-release-'))
})

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true })
})

/**
 * 레포의 릴리스 설정(루트 package.json과 package-lock.json, .changeset/config.json)과 배포되는 Generator(npm pack
 * tarball)로 레포 밖에 작은 레포를 만들고, Generator의 버전을 generatorVersion(이미 배포한 버전)으로 둔다.
 * 레포에 쌓여 있는 changeset은 가져오지 않는다.
 */
function createReleaseRepo(generatorVersion: string): { root: string; generator: string } {
  const root = join(workdir, 'repo')
  const generator = join(root, 'packages', 'devc-frontend-generator')
  mkdirSync(generator, { recursive: true })
  mkdirSync(join(root, '.changeset'))
  // changesets는 package-lock.json이 있어야 npm workspaces 모노레포로 알아본다.
  for (const file of ['package.json', 'package-lock.json', '.changeset/config.json']) {
    copyFileSync(join(REPO_ROOT, file), join(root, file))
  }
  execFileSync('tar', ['-xzf', inject('dcgenTarball'), '-C', generator, '--strip-components=1'])

  const pkgPath = join(generator, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string }
  pkg.version = generatorVersion
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  return { root, generator }
}

// changesets는 "private": true가 아닌 워크스페이스 패키지를 모두 npm에 배포한다. 다른 패키지가 실수로 배포되지 않게 지킨다.
// Showcase(apps/showcase)는 워크스페이스가 아니어서 changesets가 보지 않지만, 워크스페이스에 들어가더라도 배포되지 않게 private인지 함께 본다.
test('npm에 배포되는 패키지는 Generator 하나뿐이다', () => {
  const root = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { private?: boolean }
  expect(root.private).toBe(true)

  const workspaces = JSON.parse(
    execFileSync('npm', ['query', '.workspace', '--json'], { cwd: REPO_ROOT, encoding: 'utf8' }),
  ) as { name: string; private?: boolean }[]
  expect(workspaces.filter((pkg) => pkg.private !== true).map((pkg) => pkg.name)).toEqual([GENERATOR_PACKAGE])

  const showcase = JSON.parse(readFileSync(join(REPO_ROOT, 'apps', 'showcase', 'package.json'), 'utf8')) as {
    private?: boolean
  }
  expect(showcase.private).toBe(true)
})

// 릴리스 흐름(docs/release.md)을 레포의 changesets 설정으로 레포 밖에서 따라 한다. 기여자가 changeset을 더하고,
// Version PR이 changeset version으로 버전과 CHANGELOG를 올리고, 배포가 그 버전을 npm pack한 tarball을 레지스트리에 올린다.
// 릴리스 워크플로와 달리 package-lock.json은 맞추지 않고, changeset pack 대신 npm pack을 쓴다(둘 다 npm 레지스트리에 묻는다).
// 사용자는 레지스트리에서 받은 Generator로 Starter를 만든다.
test('changeset으로 버전을 올려 배포한 Generator는 Starter에 배포된 자기 버전을 고정한다', async () => {
  const { root, generator } = createReleaseRepo('1.4.2')

  const added = run(CHANGESET_BIN, ['--minor', GENERATOR_PACKAGE, '--message', '새 Schematic을 더한다'], root)
  expect(added.status, added.output).toBe(0)
  const versioned = run(CHANGESET_BIN, ['version'], root)
  expect(versioned.status, versioned.output).toBe(0)

  const pkg = JSON.parse(readFileSync(join(generator, 'package.json'), 'utf8')) as { version: string }
  expect(pkg.version).toBe('1.5.0')
  const changelog = readFileSync(join(generator, 'CHANGELOG.md'), 'utf8')
  expect(changelog).toContain('## 1.5.0')
  expect(changelog).toContain('새 Schematic을 더한다')

  const registry = await startPackedGeneratorRegistry(packPackage(generator, workdir))
  try {
    // 사용자처럼 버전을 지정하지 않고 레지스트리에서 Generator를 받는다.
    const user = join(workdir, 'user')
    mkdirSync(user)
    writeFileSync(join(user, 'package.json'), JSON.stringify({ name: 'release-consumer', private: true }))
    // npm install이 이 프로세스의 레지스트리에 요청하므로 이벤트 루프를 막지 않는 start로 실행한다.
    const installing = start('npm', ['install', '--no-audit', '--no-fund', GENERATOR_PACKAGE], user, {
      npm_config_registry: registry.url,
    })
    expect(await installing.exited, installing.output()).toBe(0)

    const created = run(join(user, 'node_modules', '.bin', 'dcgen'), ['new', 'my-app', '--skip-install'], user)
    expect(created.status, created.output).toBe(0)
    const starterPkg = JSON.parse(readFileSync(join(user, 'my-app', 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>
    }
    expect(starterPkg.devDependencies[GENERATOR_PACKAGE]).toBe('1.5.0')
  } finally {
    await registry.close()
  }
})
