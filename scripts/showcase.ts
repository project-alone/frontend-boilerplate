// Showcase(apps/showcase)를 만들고, 어긋났는지 검사하고, 실행하는 기여자용 스크립트. 레포 최상위 package.json의
// showcase* 스크립트가 부른다. Showcase는 Base에 Rendering Mode server와 모든 Recipe를 덧입혀 생성한 Starter이고 직접
// 고치지 않는다(ADR-0002). 쓰는 법은 docs/recipes.md의 "Showcase"에 있다.
//
//   generate [--generator <dir>] [--out <dir>]   Showcase를 만들어 out(기본 apps/showcase)을 그 결과와 같게 맞춘다
//   check    [--generator <dir>] [--out <dir>]   다시 만든 결과와 out이 다르면 다른 파일을 알리고 실패한다(CI)
//   watch    [--generator <dir>] [--out <dir>]   Generator의 Base, Recipe, Rendering Mode overlay, 소스가 바뀔 때마다 generate한다
//   dev [--showcase <dir>] [--run-dir <dir>] [next dev 인자...]
//                                                Showcase를 레포 밖에 설치해 MSW 목으로 개발 서버를 띄운다
//
// --generator는 Showcase를 만들 Generator 패키지의 디렉터리다(예: 하네스가 npm pack으로 설치한 것). 주지 않으면 레포의
// Generator를 빌드하고 npm pack으로 묶은 내용으로 만든다.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { runDev } from './showcase/dev.ts'
import { compareFiles, listShowcaseFiles, syncDirectory, watchDirectories } from './showcase/directory.ts'
import { generateShowcase } from './showcase/generate.ts'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const REPO_GENERATOR = join(REPO_ROOT, 'packages', 'devc-frontend-generator')
const REPO_SHOWCASE = join(REPO_ROOT, 'apps', 'showcase')

const [command, ...args] = process.argv.slice(2)

switch (command) {
  case 'generate':
    generate()
    break
  case 'check':
    check()
    break
  case 'watch':
    watchSources()
    break
  case 'dev':
    process.exitCode = await dev()
    break
  default:
    console.error('사용법: node scripts/showcase.ts <generate|check|watch|dev> [옵션]')
    process.exitCode = 1
}

interface ShowcaseOptions {
  /** --generator로 받은 Generator 패키지 디렉터리. 없으면 레포의 Generator를 쓴다. */
  generatorDir: string | undefined
  /** Showcase를 둘 디렉터리 */
  out: string
}

function parseShowcaseOptions(): ShowcaseOptions {
  const { values } = parseArgs({ args, options: { generator: { type: 'string' }, out: { type: 'string' } } })
  return {
    generatorDir: values.generator === undefined ? undefined : resolve(values.generator),
    out: values.out === undefined ? REPO_SHOWCASE : resolve(values.out),
  }
}

function relativeToCwd(path: string): string {
  return relative(process.cwd(), path) || '.'
}

/** 명령을 실행하고 표준 출력을 돌려준다. 실패하면 출력과 함께 오류를 던진다. */
function exec(command: string, commandArgs: readonly string[], cwd: string): string {
  const result = spawnSync(command, commandArgs, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')}이(가) 실패했습니다.\n${result.stdout}${result.stderr}`)
  }
  return result.stdout
}

/**
 * Showcase를 만들어 돌려준다. --generator가 없으면 레포의 Generator를 (build이면 빌드하고) npm pack으로 묶어 꺼낸 내용으로
 * 만든다. 배포되는 패키지와 같은 파일로 만들어야, 기여자의 컴퓨터에 흘린 파일(.DS_Store 등)이 끼지 않고 npm이 빼는
 * dotfile이 드러나 어디서 만들어도 같은 결과가 나온다. 레포의 node_modules 아래에 꺼내 Generator의 의존성(레포 최상위에
 * 설치된)을 그대로 찾게 한다.
 */
function buildShowcase({ generatorDir }: ShowcaseOptions, build: boolean) {
  if (generatorDir !== undefined) return generateShowcase(generatorDir)

  if (build) exec('npm', ['run', 'build'], REPO_GENERATOR)
  const cache = join(REPO_ROOT, 'node_modules', '.cache')
  mkdirSync(cache, { recursive: true })
  const packDir = mkdtempSync(join(cache, 'devc-showcase-generator-'))
  try {
    const packed = JSON.parse(
      exec('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', packDir], REPO_GENERATOR),
    ) as { filename: string }[]
    const tarball = packed[0]?.filename
    if (tarball === undefined) throw new Error('npm pack이 만든 Generator tarball을 찾지 못했습니다.')
    exec('tar', ['-xzf', join(packDir, tarball), '-C', packDir], REPO_ROOT)
    return generateShowcase(join(packDir, 'package'))
  } finally {
    rmSync(packDir, { recursive: true, force: true })
  }
}

/** Showcase를 만들어 out을 그 결과와 같게 맞추고, 바꾸거나 지운 파일 수를 알리는 문장을 돌려준다. */
function regenerate(options: ShowcaseOptions, build: boolean): string {
  const { written, removed } = syncDirectory(options.out, buildShowcase(options, build), listShowcaseFiles(options.out))
  return `바꾼 파일 ${String(written.length)}개, 지운 파일 ${String(removed.length)}개`
}

function generate(): void {
  const options = parseShowcaseOptions()
  console.log(`Showcase를 만들었습니다: ${relativeToCwd(options.out)} (${regenerate(options, true)})`)
}

function check(): void {
  const options = parseShowcaseOptions()
  const { out } = options
  const { changed, missing, extra } = compareFiles(out, buildShowcase(options, true), listShowcaseFiles(out))
  if (changed.length + missing.length + extra.length === 0) {
    console.log(`Showcase(${relativeToCwd(out)})가 Base와 Recipe로 다시 만든 결과와 같습니다.`)
    return
  }
  const list = (label: string, paths: readonly string[]) =>
    paths.length > 0 ? [`  ${label}: ${paths.join(', ')}`] : []
  console.error(
    [
      `Showcase(${relativeToCwd(out)})가 Base와 Recipe로 다시 만든 결과와 다릅니다.`,
      ...list('내용이 다른 파일', changed),
      ...list('빠진 파일', missing),
      ...list('남는 파일', extra),
      'Showcase는 직접 고치지 않습니다. Base나 Recipe를 고친 뒤 레포 최상위에서 npm run showcase로 다시 만들어 함께 커밋하세요(docs/recipes.md).',
    ].join('\n'),
  )
  process.exitCode = 1
}

function watchSources(): void {
  const options = parseShowcaseOptions()
  const generatorDir = options.generatorDir ?? REPO_GENERATOR
  const run = (build: boolean) => {
    try {
      const summary = regenerate(options, build)
      console.log(`[${new Date().toLocaleTimeString('ko-KR')}] Showcase를 다시 만들었습니다(${summary}).`)
    } catch (error) {
      // 패치가 맞지 않는 등 생성이 실패해도 고칠 때까지 계속 지켜본다.
      console.error(error instanceof Error ? error.message : error)
    }
  }
  run(true)

  // Generator의 소스(src)가 바뀌었으면 빌드한 뒤에 만든다.
  const src = join(generatorDir, 'src')
  const sources = ['base', 'recipes', 'rendering-modes', 'src']
    .map((name) => join(generatorDir, name))
    .filter((directory) => existsSync(directory))
  watchDirectories(sources, (changed) => {
    run(changed.has(src))
  })
  console.log(
    `Generator(${relativeToCwd(generatorDir)})의 base, recipes, rendering-modes, src에서 파일이 바뀌면 Showcase(${relativeToCwd(options.out)})를 다시 만듭니다.`,
  )
}

async function dev(): Promise<number> {
  // --showcase와 --run-dir 말고는 모두 next dev에 넘긴다.
  let showcaseDir = REPO_SHOWCASE
  let runDir: string | undefined
  const nextArgs: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const value = args[index + 1]
    if ((arg === '--showcase' || arg === '--run-dir') && value !== undefined) {
      if (arg === '--showcase') showcaseDir = resolve(value)
      else runDir = resolve(value)
      index += 1
    } else if (arg !== undefined) {
      nextArgs.push(arg)
    }
  }
  // 실행용 디렉터리는 레포 밖(운영체제의 임시 디렉터리)에 Showcase마다 하나씩 두고, 다음 실행에서 설치를 다시 쓴다.
  const hash = createHash('sha256').update(showcaseDir).digest('hex').slice(0, 8)
  exec('npm', ['run', 'build'], REPO_GENERATOR)
  return runDev({
    showcaseDir,
    runDir: runDir ?? join(tmpdir(), `devc-frontend-showcase-${hash}`),
    generatorDir: REPO_GENERATOR,
    nextArgs,
  })
}
