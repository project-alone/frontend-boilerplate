// Showcase(apps/showcase)를 만들고, 어긋났는지 검사하고, 실행하는 기여자용 스크립트. 레포 최상위 package.json의
// showcase* 스크립트가 부른다. Showcase는 Base에 Rendering Mode server와 모든 Recipe를 덧입혀 생성한 Starter이고 직접
// 고치지 않는다(ADR-0002). 쓰는 법은 docs/recipes.md의 "Showcase"에 있다.
//
//   generate [--generator <dir>] [--out <dir>]   Showcase를 만들어 out(기본 apps/showcase)을 그 결과와 같게 만든다
//   check    [--generator <dir>] [--out <dir>]   다시 만든 결과와 out이 다르면 다른 파일을 알리고 실패한다(CI)
//   watch    [--generator <dir>] [--out <dir>]   Generator의 Base, Recipe, Rendering Mode overlay, 소스가 바뀔 때마다 generate한다
//   dev [--showcase <dir>] [--run-dir <dir>] [next dev 인자...]
//                                                Showcase를 레포 밖에 설치해 MSW 목으로 개발 서버를 띄운다
//
// --generator는 Showcase를 만들 Generator 패키지의 디렉터리다. 주지 않으면 레포의 Generator를 빌드해 쓴다.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, watch } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { runDev } from './showcase/dev.ts'
import { compareFiles, listFiles, writeFiles } from './showcase/directory.ts'
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

interface Target {
  /** Showcase를 만들 Generator 패키지 디렉터리 */
  generatorDir: string
  /** 레포의 Generator라 소스(src)를 빌드해 써야 한다 */
  fromRepo: boolean
  /** Showcase를 둘 디렉터리 */
  out: string
}

function parseTarget(): Target {
  const { values } = parseArgs({ args, options: { generator: { type: 'string' }, out: { type: 'string' } } })
  return {
    generatorDir: values.generator === undefined ? REPO_GENERATOR : resolve(values.generator),
    fromRepo: values.generator === undefined,
    out: values.out === undefined ? REPO_SHOWCASE : resolve(values.out),
  }
}

function display(path: string): string {
  return relative(process.cwd(), path) || '.'
}

function buildRepoGenerator(): void {
  const result = spawnSync('npm', ['run', 'build'], { cwd: REPO_GENERATOR, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`Generator를 빌드하지 못했습니다.\n${result.stdout}${result.stderr}`)
}

function generate(): void {
  const { generatorDir, fromRepo, out } = parseTarget()
  if (fromRepo) buildRepoGenerator()
  const { written, removed } = writeFiles(out, generateShowcase(generatorDir), listFiles(out))
  console.log(
    `Showcase를 만들었습니다: ${display(out)} (바꾼 파일 ${String(written.length)}개, 지운 파일 ${String(removed.length)}개)`,
  )
}

function check(): void {
  const { generatorDir, fromRepo, out } = parseTarget()
  if (fromRepo) buildRepoGenerator()
  const { changed, missing, extra } = compareFiles(out, generateShowcase(generatorDir), listFiles(out))
  if (changed.length + missing.length + extra.length === 0) {
    console.log(`Showcase(${display(out)})가 Base와 Recipe로 다시 만든 결과와 같습니다.`)
    return
  }
  const list = (label: string, paths: readonly string[]) =>
    paths.length > 0 ? [`  ${label}: ${paths.join(', ')}`] : []
  console.error(
    [
      `Showcase(${display(out)})가 Base와 Recipe로 다시 만든 결과와 다릅니다.`,
      ...list('내용이 다른 파일', changed),
      ...list('빠진 파일', missing),
      ...list('남는 파일', extra),
      'Showcase는 직접 고치지 않습니다. Base나 Recipe를 고친 뒤 레포 최상위에서 npm run showcase로 다시 만들어 함께 커밋하세요(docs/recipes.md).',
    ].join('\n'),
  )
  process.exitCode = 1
}

function watchSources(): void {
  const { generatorDir, fromRepo, out } = parseTarget()
  const regenerate = (rebuild: boolean) => {
    try {
      if (rebuild) buildRepoGenerator()
      const { written, removed } = writeFiles(out, generateShowcase(generatorDir), listFiles(out))
      const time = new Date().toLocaleTimeString('ko-KR')
      console.log(
        `[${time}] Showcase를 다시 만들었습니다(바꾼 파일 ${String(written.length)}개, 지운 파일 ${String(removed.length)}개).`,
      )
    } catch (error) {
      // 패치가 맞지 않는 등 생성이 실패해도 고칠 때까지 계속 지켜본다.
      console.error(error instanceof Error ? error.message : error)
    }
  }
  regenerate(fromRepo)

  // Generator의 소스(src)가 바뀌면 빌드한 뒤에 만든다. 여러 파일이 한꺼번에 바뀌어도 한 번만 만든다.
  let timer: NodeJS.Timeout | undefined
  let rebuild = false
  const sources = ['base', 'recipes', 'rendering-modes', ...(fromRepo ? ['src'] : [])]
  for (const source of sources.filter((name) => existsSync(join(generatorDir, name)))) {
    watch(join(generatorDir, source), { recursive: true }, () => {
      rebuild ||= source === 'src'
      clearTimeout(timer)
      timer = setTimeout(() => {
        const shouldRebuild = rebuild
        rebuild = false
        regenerate(shouldRebuild)
      }, 300)
    })
  }
  console.log(
    `Generator(${display(generatorDir)})의 ${sources.join(', ')}에서 파일이 바뀌면 Showcase(${display(out)})를 다시 만듭니다.`,
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
  buildRepoGenerator()
  return runDev({
    showcaseDir,
    runDir: runDir ?? join(tmpdir(), `devc-frontend-showcase-${hash}`),
    generatorDir: REPO_GENERATOR,
    nextArgs,
  })
}
