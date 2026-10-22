import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
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

/** Generator의 overlay 디렉터리(recipes, archetypes)에 담긴 이름. 디렉터리가 없으면 빈 배열이다. */
function overlayNames(generatorDir: string, kind: 'recipes' | 'archetypes'): string[] {
  const dir = join(generatorDir, kind)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

// Showcase가 쓰는 Generator 코드의 모듈. Showcase를 만든 Generator의 빌드 결과(dist/<모듈>.js)를 불러와 쓴다.
type Extensions = typeof import('../../packages/devc-frontend-generator/src/extensions.ts')
type OpenApiSpec = typeof import('../../packages/devc-frontend-generator/src/openapi-spec.ts')

/** Showcase를 만든 Generator. 파일의 원본을 찾을 때 Generator 패키지의 파일과 Generator 코드가 정한 이름을 쓴다. */
interface Generator {
  /** Generator 패키지의 디렉터리 */
  dir: string
  extensions: Pick<Extensions, 'ASSEMBLED_FILES' | 'EXTENSIONS_MANIFEST'>
  spec: Pick<OpenApiSpec, 'OPENAPI_SPEC' | 'GENERATED_API_DIR'>
}

async function loadGenerator(dir: string): Promise<Generator> {
  const load = async <T>(module: string) => (await import(pathToFileURL(join(dir, 'dist', module)).href)) as T
  return { dir, extensions: await load<Extensions>('extensions.js'), spec: await load<OpenApiSpec>('openapi-spec.js') }
}

/**
 * generatorDir의 Generator(npm pack으로 묶이는 내용)로 Base에 Rendering Mode server와 Generator에 담긴 모든 Recipe와 Archetype을
 * 덧입힌 Starter를 만들고, 파일마다 생성 안내를 붙여 돌려준다(ADR-0002). 같은 Generator로 만들면 늘 같은 결과가 나온다(시각,
 * 난수를 쓰지 않는다).
 */
export async function generateShowcase(generatorDir: string): Promise<ShowcaseFiles> {
  const recipes = overlayNames(generatorDir, 'recipes')
  const archetypes = overlayNames(generatorDir, 'archetypes')
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
        ...archetypes.flatMap((archetype) => ['--archetype', archetype]),
        '--skip-install',
      ],
      { cwd: workdir, encoding: 'utf8' },
    )
    if (result.status !== 0) {
      throw new Error(`dcgen new로 Showcase를 만들지 못했습니다.\n${result.stdout}${result.stderr}`)
    }

    const starter = join(workdir, STARTER_NAME)
    const files: ShowcaseFiles = new Map(readAllPaths(starter).map((path) => [path, readFileSync(join(starter, path))]))
    return addNotices(files, await loadGenerator(generatorDir), { recipes, archetypes })
  } finally {
    rmSync(workdir, { recursive: true, force: true })
  }
}

/** Showcase에 켠 Recipe와 Archetype의 이름(이름순) */
interface Overlays {
  recipes: readonly string[]
  archetypes: readonly string[]
}

/** 주석을 달 수 있는 파일에는 맨 위에 생성 안내와 원본을 붙이고, README에는 눈에 보이는 안내를 붙인다. */
function addNotices(files: ShowcaseFiles, generator: Generator, overlays: Overlays): ShowcaseFiles {
  const withNotices: ShowcaseFiles = new Map()
  const withoutComments: string[] = []
  for (const [path, content] of files) {
    const comment = commentFor(path)
    if (comment === undefined) {
      if (path !== 'README.md') withoutComments.push(path)
      withNotices.set(path, content)
      continue
    }
    const sources = sourcesOf(path, generator, overlays)
    const origin =
      sources.length > 0
        ? `원본(${GENERATOR_PATH}/): ${sources.join(', ')}`
        : `원본: Generator가 만드는 파일(${GENERATOR_PATH}/src/)`
    withNotices.set(path, prepend(content, comment([NOTICE, origin])))
  }

  const readme = files.get('README.md')
  if (readme !== undefined) withNotices.set('README.md', prepend(readme, readmeNotice(overlays, withoutComments)))
  return withNotices
}

type Comment = (lines: readonly string[]) => string

const lineComment =
  (marker: string): Comment =>
  (lines) =>
    lines.map((line) => `${marker} ${line}`).join('\n')

const cssComment: Comment = (lines) => ['/*', ...lines.map((line) => ` * ${line}`), ' */'].join('\n')

// 형식마다 맨 위에 다는 주석. 주석을 달 수 없는 형식(JSON, .nvmrc 등)과 README는 undefined이고, README의 안내가 대신 알린다.
// Dockerfile은 맨 위 주석 뒤의 parser directive(# syntax= 등)를 읽지 않으므로 Recipe의 Dockerfile은 directive를 쓰지 않는다.
function commentFor(path: string): Comment | undefined {
  const name = path.split('/').at(-1) ?? path
  if (/\.[cm]?[jt]sx?$/.test(name) || /^tsconfig(?:\.[\w-]+)?\.json$/.test(name)) return lineComment('//')
  if (name.endsWith('.css')) return cssComment
  if (
    /\.ya?ml$/.test(name) ||
    /^\.env(?:\.|$)/.test(name) ||
    ['.gitignore', '.prettierignore', '.dockerignore', 'Dockerfile'].includes(name)
  ) {
    return lineComment('#')
  }
  return undefined
}

/**
 * Showcase의 path를 만든 원본(Generator 패키지 기준 경로). Base 파일에 Recipe를 이름순으로, 그 뒤에 Archetype을 이름순으로
 * 덧입혀, overlay의 파일은 앞의 원본을 대신하고 overlay의 패치(<경로>.patch)는 앞의 원본을 고친다고 본다(docs/recipes.md,
 * docs/archetypes.md). requires 때문에 Recipe를 덧입히는 순서가 이름순과 다르면 패치의 나열 순서만 다를 수 있다. 여러 원본을
 * 병합하거나 모아 만드는 파일은 그 원본을 모두 알린다: 확장 지점의 조립 파일은 그 지점을 선언한 extensions.json, 명세
 * (openapi.yaml)와 dotenv 파일은 Base와 overlay의 같은 파일, 재생성 API 계층은 overlay가 명세 조각을 더했으면 병합한 명세의 원본이다.
 */
function sourcesOf(path: string, generator: Generator, { recipes, archetypes }: Overlays): string[] {
  const generatorDir = generator.dir
  const { ASSEMBLED_FILES, EXTENSIONS_MANIFEST } = generator.extensions
  const { OPENAPI_SPEC, GENERATED_API_DIR } = generator.spec
  const overlayDirs = [...recipes.map((recipe) => `recipes/${recipe}`), ...archetypes.map((archetype) => `archetypes/${archetype}`)]
  const existing = (candidates: readonly string[]) =>
    candidates.filter((candidate) => existsSync(join(generatorDir, candidate)))
  const assembled = ASSEMBLED_FILES.find((file) => file.path === path)
  if (assembled !== undefined) {
    return existing(['base', ...overlayDirs].map((dir) => `${dir}/${EXTENSIONS_MANIFEST}`)).filter((manifest) => {
      const declared = JSON.parse(readFileSync(join(generatorDir, manifest), 'utf8')) as Record<string, unknown>
      return assembled.points.some((point) => point in declared)
    })
  }
  const specSources = existing([`base/${OPENAPI_SPEC}`, ...overlayDirs.map((dir) => `${dir}/${OPENAPI_SPEC}`)])
  if (path === OPENAPI_SPEC || (path.startsWith(`${GENERATED_API_DIR}/`) && specSources.length > 1)) return specSources
  if (/^\.env(?:\.|$)/.test(path)) {
    return existing([`base/${path}`, ...overlayDirs.map((dir) => `${dir}/${path}`)])
  }

  // npm이 패키지에서 빼는 .gitignore는 Base에 _gitignore로 담겨 있다.
  const basePath = path === '.gitignore' ? '_gitignore' : path
  let sources = existsSync(join(generatorDir, 'base', basePath)) ? [`base/${basePath}`] : []
  for (const dir of overlayDirs) {
    const overlayPath = `${dir}/${path}`
    if (existsSync(join(generatorDir, overlayPath))) sources = [overlayPath]
    if (existsSync(join(generatorDir, `${overlayPath}.patch`))) sources.push(`${overlayPath}.patch`)
  }
  return sources
}

function prepend(content: Buffer, header: string): Buffer {
  return Buffer.concat([Buffer.from(`${header}\n\n`), content])
}

function readmeNotice({ recipes, archetypes }: Overlays, withoutComments: readonly string[]): string {
  const code = (text: string) => `\`${text}\``
  return [
    '> **생성된 Showcase입니다. 이 디렉터리의 파일은 직접 고치지 마세요.**',
    '>',
    `> Showcase는 Generator(${code(GENERATOR_PATH)})가 Base에 Rendering Mode ${code(RENDERING_MODE)}와 모든 Recipe, Archetype을 덧입혀 만든 Starter입니다([ADR-0002](../../docs/adr/0002-recipes-are-source-of-truth.md)). 바꿀 것이 있으면 Base(${code('base/')}), Recipe(${code('recipes/<이름>/')}), Archetype(${code('archetypes/<이름>/')})을 고친 뒤 레포 최상위에서 ${code('npm run showcase')}로 다시 만들어 함께 커밋합니다. CI는 다시 만든 결과가 커밋된 Showcase와 다르면 실패합니다([Recipe 작성하기](../../docs/recipes.md), [Archetype 작성하기](../../docs/archetypes.md)).`,
    '>',
    `> - 켠 Recipe: ${recipes.map(code).join(', ')}. Recipe가 더한 화면과 쓰는 법은 아래 README의 Recipe 절에 있습니다.`,
    `> - 켠 Archetype: ${archetypes.length > 0 ? archetypes.map(code).join(', ') : '없음'}. Archetype이 더한 화면과 쓰는 법은 아래 README의 Archetype 절에 있습니다.`,
    `> - 주석을 달 수 있는 파일은 맨 위의 주석이 이 안내와 고칠 원본을 알립니다. 주석을 달 수 없는 파일: ${withoutComments.map(code).join(', ')}`,
    `> - 실행: 레포 최상위에서 ${code('npm run showcase:dev')}. Showcase를 레포 밖의 디렉터리에 복사해 설치하고 MSW 목으로 개발 서버를 띄웁니다. 아래는 Starter의 README이고, 그 명령은 그 디렉터리에서 실행합니다.`,
  ].join('\n')
}
