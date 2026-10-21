import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readAllPaths } from './directory.ts'

/** Showcase의 파일. 키는 Showcase 최상위 기준의 경로(구분자 /)이고, 경로 이름순이다. */
export type ShowcaseFiles = Map<string, Buffer>

// Showcase의 Starter 단위 Rendering Mode. 라우트별 Rendering Mode 데모처럼 요청을 받는 서버가 있어야 하는 Recipe까지
// 모두 켜려면 server여야 한다. server는 Base 그대로라 Rendering Mode overlay가 없다.
const RENDERING_MODE = 'server'

// Starter 이름. Showcase의 package.json name이 된다.
const STARTER_NAME = 'showcase'

// 생성 안내가 원본 경로 앞에 붙이는 Generator 패키지의 레포 안 경로
const GENERATOR_PATH = 'packages/devc-frontend-generator'

const NOTICE =
  '생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.'

/**
 * generatorDir의 Generator(npm pack으로 묶이는 내용)로 Base에 Rendering Mode server와 Generator에 담긴 모든 Recipe를 덧입힌
 * Starter를 만들고, 파일마다 생성 안내를 붙여 돌려준다(ADR-0002). 같은 Generator로 만들면 늘 같은 결과가 나온다(시각, 난수를
 * 쓰지 않는다). Archetype이 생기면 모든 Archetype도 함께 켠다.
 */
export function generateShowcase(generatorDir: string): ShowcaseFiles {
  const recipes = readdirSync(join(generatorDir, 'recipes'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const workdir = mkdtempSync(join(tmpdir(), 'devc-showcase-'))
  try {
    const result = spawnSync(
      process.execPath,
      [
        join(generatorDir, 'dist', 'cli.js'),
        'new',
        STARTER_NAME,
        '--rendering-mode',
        RENDERING_MODE,
        ...recipes.flatMap((recipe) => ['--recipe', recipe]),
        '--skip-install',
      ],
      { cwd: workdir, encoding: 'utf8' },
    )
    if (result.status !== 0) {
      throw new Error(`dcgen new로 Showcase를 만들지 못했습니다.\n${result.stdout}${result.stderr}`)
    }

    const starter = join(workdir, STARTER_NAME)
    const files: ShowcaseFiles = new Map(readAllPaths(starter).map((path) => [path, readFileSync(join(starter, path))]))
    return addNotices(files, generatorDir, recipes)
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
}

/** 주석을 달 수 있는 파일에는 맨 위에 생성 안내와 원본을 붙이고, README에는 눈에 보이는 안내를 붙인다. */
function addNotices(files: ShowcaseFiles, generatorDir: string, recipes: readonly string[]): ShowcaseFiles {
  const withNotices: ShowcaseFiles = new Map()
  const withoutComments: string[] = []
  for (const [path, content] of files) {
    const comment = commentFor(path)
    if (comment === undefined) {
      if (path !== 'README.md') withoutComments.push(path)
      withNotices.set(path, content)
      continue
    }
    const sources = sourcesOf(path, generatorDir, recipes)
    const origin =
      sources.length > 0
        ? `원본(${GENERATOR_PATH}/): ${sources.join(', ')}`
        : `원본: Generator가 만드는 파일(${GENERATOR_PATH}/src/)`
    withNotices.set(path, prepend(content, comment([NOTICE, origin])))
  }

  const readme = files.get('README.md')
  if (readme !== undefined) withNotices.set('README.md', prepend(readme, readmeNotice(recipes, withoutComments)))
  return withNotices
}

type Comment = (lines: readonly string[]) => string

const lineComment =
  (marker: string): Comment =>
  (lines) =>
    lines.map((line) => `${marker} ${line}`).join('\n')

const cssComment: Comment = (lines) => ['/*', ...lines.map((line) => ` * ${line}`), ' */'].join('\n')

// 형식마다 맨 위에 다는 주석. 주석을 달 수 없는 형식(JSON, .nvmrc 등)과 README는 undefined이고, README의 안내가 대신 알린다.
function commentFor(path: string): Comment | undefined {
  const name = path.split('/').at(-1) ?? path
  if (/\.[cm]?[jt]sx?$/.test(name) || /^tsconfig(?:\.[\w-]+)?\.json$/.test(name)) return lineComment('//')
  if (name.endsWith('.css')) return cssComment
  if (/\.ya?ml$/.test(name) || /^\.env(?:\.|$)/.test(name) || name === '.gitignore' || name === '.prettierignore') {
    return lineComment('#')
  }
  return undefined
}

// Generator가 확장 지점의 선언(Base와 Recipe의 extensions.json)으로 조립하는 파일과 그 파일에 모이는 확장 지점
// (packages/devc-frontend-generator/src/extensions.ts)
const EXTENSION_FILES: Record<string, readonly string[]> = {
  'src/app/app-shell.tsx': ['providers', 'header'],
  'next.config.plugins.ts': ['nextConfig'],
  'src/instrumentation.ts': ['instrumentation'],
  'src/instrumentation-client.ts': ['instrumentationClient'],
  'src/proxy.ts': ['proxy'],
  'src/shared/api/backend-fetch.ts': ['backendFetch'],
  'src/shared/mocks/handlers.ts': ['mockHandlers'],
}

const OPENAPI_SPEC = 'openapi.yaml'
const GENERATED_API_DIR = 'src/shared/api/generated/'

/**
 * Showcase의 path를 만든 원본(Generator 패키지 기준 경로). Base 파일에 Recipe를 이름순으로 덧입혀, Recipe의 파일은 앞의
 * 원본을 대신하고 Recipe의 패치(<경로>.patch)는 앞의 원본을 고친다고 본다(docs/recipes.md). requires 때문에 덧입히는 순서가
 * 이름순과 다르면 패치의 나열 순서만 다를 수 있다. 여러 원본을 병합하거나 모아 만드는 파일은 그 원본을 모두 알린다:
 * 확장 지점의 조립 파일은 그 지점을 선언한 extensions.json, 명세(openapi.yaml)와 dotenv 파일은 Base와 Recipe의 같은 파일,
 * 재생성 API 계층은 Recipe가 명세 조각을 더했으면 병합한 명세의 원본이다.
 */
function sourcesOf(path: string, generatorDir: string, recipes: readonly string[]): string[] {
  const existing = (candidates: readonly string[]) =>
    candidates.filter((candidate) => existsSync(join(generatorDir, candidate)))
  const points = EXTENSION_FILES[path]
  if (points !== undefined) {
    return existing(['base', ...recipes.map((recipe) => `recipes/${recipe}`)].map((dir) => `${dir}/extensions.json`)).filter(
      (manifest) => {
        const declared = JSON.parse(readFileSync(join(generatorDir, manifest), 'utf8')) as Record<string, unknown>
        return points.some((point) => point in declared)
      },
    )
  }
  const specSources = existing([`base/${OPENAPI_SPEC}`, ...recipes.map((recipe) => `recipes/${recipe}/${OPENAPI_SPEC}`)])
  if (path === OPENAPI_SPEC || (path.startsWith(GENERATED_API_DIR) && specSources.length > 1)) return specSources
  if (/^\.env(?:\.|$)/.test(path)) {
    return existing([`base/${path}`, ...recipes.map((recipe) => `recipes/${recipe}/${path}`)])
  }

  // npm이 패키지에서 빼는 .gitignore는 Base에 _gitignore로 담겨 있다.
  const basePath = path === '.gitignore' ? '_gitignore' : path
  let sources = existsSync(join(generatorDir, 'base', basePath)) ? [`base/${basePath}`] : []
  for (const recipe of recipes) {
    const recipePath = `recipes/${recipe}/${path}`
    if (existsSync(join(generatorDir, recipePath))) sources = [recipePath]
    if (existsSync(join(generatorDir, `${recipePath}.patch`))) sources.push(`${recipePath}.patch`)
  }
  return sources
}

function prepend(content: Buffer, header: string): Buffer {
  return Buffer.concat([Buffer.from(`${header}\n\n`), content])
}

function readmeNotice(recipes: readonly string[], withoutComments: readonly string[]): string {
  const code = (text: string) => `\`${text}\``
  return [
    '> **생성된 Showcase입니다. 이 디렉터리의 파일은 직접 고치지 마세요.**',
    '>',
    `> Showcase는 Generator(${code(GENERATOR_PATH)})가 Base에 Rendering Mode ${code(RENDERING_MODE)}와 모든 Recipe를 덧입혀 만든 Starter입니다([ADR-0002](../../docs/adr/0002-recipes-are-source-of-truth.md)). 바꿀 것이 있으면 Base(${code('base/')})나 Recipe(${code('recipes/<이름>/')})를 고친 뒤 레포 최상위에서 ${code('npm run showcase')}로 다시 만들어 함께 커밋합니다. CI는 다시 만든 결과가 커밋된 Showcase와 다르면 실패합니다([Recipe 작성하기](../../docs/recipes.md)).`,
    '>',
    `> - 켠 Recipe: ${recipes.map(code).join(', ')}. Recipe가 더한 화면과 쓰는 법은 아래 README의 Recipe 절에 있습니다.`,
    `> - 주석을 달 수 있는 파일은 맨 위의 주석이 이 안내와 고칠 원본을 알립니다. 주석을 달 수 없는 파일: ${withoutComments.map(code).join(', ')}`,
    `> - 실행: 레포 최상위에서 ${code('npm run showcase:dev')}. Showcase를 레포 밖의 디렉터리에 복사해 설치하고 MSW 목으로 개발 서버를 띄웁니다. 아래는 Starter의 README이고, 그 명령은 그 디렉터리에서 실행합니다.`,
  ].join('\n')
}
