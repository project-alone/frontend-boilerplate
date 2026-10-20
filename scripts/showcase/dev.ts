import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { listShowcaseFiles, syncDirectory, watchDirectories } from './directory.ts'
import type { ShowcaseFiles } from './generate.ts'

// 실행용 디렉터리에 남기는 기록. node_modules 안에 두어 Starter의 도구(Prettier 등)가 보지 않게 한다.
const MIRRORED_FILES = 'node_modules/.cache/showcase/files.json'
const INSTALLED_PACKAGE = 'node_modules/.cache/showcase/package.json'

export interface DevOptions {
  /** 실행할 Showcase(기본 apps/showcase) */
  showcaseDir: string
  /** Showcase를 복사해 설치하고 실행할 레포 밖의 디렉터리 */
  runDir: string
  /** Showcase가 고정한 Generator 대신 설치할 Generator 패키지 디렉터리(빌드한 것) */
  generatorDir: string
  /** `next dev`에 넘길 인자(예: --port 3001) */
  nextArgs: readonly string[]
}

/**
 * Showcase를 레포 밖의 실행용 디렉터리에 복사해 설치하고 개발 서버(`npm run dev`)를 띄운다. 개발 서버는 Starter의
 * .env.development대로 API 요청을 MSW 목으로 받는다. 띄운 뒤에도 Showcase가 바뀌면(showcase:watch가 다시 만들면) 바뀐
 * 파일을 실행용 디렉터리에 옮겨 개발 서버가 다시 그리게 한다. 개발 서버가 끝나면 그 종료 코드로 끝난다.
 *
 * 레포 안(apps/showcase)에서 설치하지 않는 이유: 설치하면 Starter의 lefthook이 postinstall에서 이 레포에 git 훅과
 * lefthook.yml을 만들고, Showcase를 npm workspace로 두면 레포를 설치할 때마다 같은 일이 생기고 설치도 무거워진다.
 */
export async function runDev(options: DevOptions): Promise<number> {
  const { showcaseDir, runDir, nextArgs } = options
  mirror(options)
  const packageJson = readFileSync(join(runDir, 'package.json'), 'utf8')
  if (readIfExists(join(runDir, INSTALLED_PACKAGE)) !== packageJson) {
    console.log(`Showcase의 의존성을 설치합니다: ${runDir}`)
    const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: runDir, stdio: 'inherit' })
    if (install.status !== 0) return install.status ?? 1
    writeFileSync(join(runDir, INSTALLED_PACKAGE), packageJson)
  }

  console.log(`Showcase를 실행합니다(MSW 목): ${runDir}`)
  const server = spawn('npm', ['run', 'dev', '--', ...nextArgs], { cwd: runDir, stdio: 'inherit' })
  const stopWatching = watchDirectories([showcaseDir], () => {
    try {
      mirror(options)
      if (readFileSync(join(runDir, 'package.json'), 'utf8') !== packageJson) {
        console.warn('Showcase의 package.json이 바뀌었습니다. 의존성을 다시 설치하려면 showcase:dev를 다시 실행하세요.')
      }
    } catch (error) {
      console.error(error)
    }
  })

  return new Promise((resolve) => {
    server.once('exit', (code) => {
      stopWatching()
      resolve(code ?? 1)
    })
  })
}

/** Showcase 파일을 실행용 디렉터리에 옮긴다. 지난번에 옮겼지만 이제 없는 파일은 지운다. */
function mirror({ showcaseDir, runDir, generatorDir }: DevOptions): void {
  const paths = listShowcaseFiles(showcaseDir)
  const files: ShowcaseFiles = new Map(paths.map((path) => [path, readFileSync(join(showcaseDir, path))]))
  const packageJson = files.get('package.json')
  if (packageJson !== undefined) files.set('package.json', withLocalGenerator(packageJson, generatorDir))

  const recorded = join(runDir, MIRRORED_FILES)
  const previous = existsSync(recorded) ? (JSON.parse(readFileSync(recorded, 'utf8')) as string[]) : []
  syncDirectory(
    runDir,
    files,
    previous.filter((path) => existsSync(join(runDir, path))),
  )
  mkdirSync(dirname(recorded), { recursive: true })
  writeFileSync(recorded, JSON.stringify(paths))
}

// Showcase는 자신을 만든 Generator를 npm 레지스트리의 정확한 버전으로 고정하지만 그 버전은 npm에 없을 수 있다.
// 실행용 복사본에서만 레포의 Generator를 가리키게 해 `npm run g`도 쓸 수 있게 한다.
function withLocalGenerator(packageJson: Buffer, generatorDir: string): Buffer {
  const pkg = JSON.parse(packageJson.toString('utf8')) as { devDependencies?: Record<string, string> }
  pkg.devDependencies = { ...pkg.devDependencies, 'devc-frontend-generator': `file:${generatorDir}` }
  return Buffer.from(`${JSON.stringify(pkg, null, 2)}\n`)
}

function readIfExists(path: string): string | undefined {
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined
}
