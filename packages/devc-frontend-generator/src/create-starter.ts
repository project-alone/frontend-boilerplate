import { cp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { regenerateApiLayer } from './api-layer.js'
import { type Archetype, archetypeOverlay } from './archetypes.js'
import { type DotenvSource, findDotenvConflicts, isDotenvFile } from './dotenv.js'
import { checkExtensions, EXTENSIONS_MANIFEST, readExtensions, writeExtensionFiles } from './extensions.js'
import { formatForStarter } from './format.js'
import { generatorPackage } from './generator-package.js'
import { mergeOpenApiFragments, type SpecFragment } from './openapi-fragments.js'
import { OPENAPI_SPEC } from './openapi-spec.js'
import { applyOverlay, type Overlay, OverlayError, STORYBOOK_OVERLAY_DIR } from './overlay.js'
import { mergePackageJson, updatePackageJson } from './package-json.js'
import { type Recipe, recipeOverlay } from './recipes.js'
import { type RenderingMode, renderingModeOverlay } from './rendering-mode.js'
import { isNonEmptyDirectory, listFiles, readOptionalFile } from './utils/fs.js'
import { bulletList } from './utils/text.js'

const BASE_DIR = fileURLToPath(new URL('../base', import.meta.url))
export const BASE: Overlay = { label: 'Base', dir: BASE_DIR }

// Base를 복사할 때 빼는 파일과 디렉터리. Storybook overlay는 Storybook을 더할 때만 덧입힌다(storybook.ts).
const NOT_COPIED = [join(BASE_DIR, EXTENSIONS_MANIFEST), join(BASE_DIR, STORYBOOK_OVERLAY_DIR)]

// overlay를 덧입힐 때 복사하지 않고, 모든 overlay를 덧입힌 뒤 한꺼번에 조립하는 파일
const ASSEMBLED = [EXTENSIONS_MANIFEST, OPENAPI_SPEC]

// npm은 패키지에 담긴 `.gitignore`를 배포 과정에서 빼 버리므로 다른 이름으로 담아 두었다가 되돌린다.
const PACKED_GITIGNORE = '_gitignore'

export class TargetNotEmptyError extends Error {
  constructor(target: string) {
    super(`${target} 디렉터리가 이미 있고 비어 있지 않습니다. 다른 이름을 쓰거나 디렉터리를 비워 주세요.`)
    this.name = 'TargetNotEmptyError'
  }
}

export interface StarterChoices {
  renderingMode: RenderingMode
  /** 덧입힐 순서대로 늘어놓은 Recipe(resolveSelection의 결과) */
  recipes: readonly Recipe[]
  /** Recipe를 모두 덧입힌 뒤에 덧입힐 Archetype(resolveSelection의 결과) */
  archetypes: readonly Archetype[]
}

/** Starter를 만들 디렉터리의 절대 경로. 이미 내용이 있으면 TargetNotEmptyError를 던진다. 아무것도 쓰지 않는다. */
export async function prepareTarget(name: string, cwd: string): Promise<string> {
  const target = resolve(cwd, name)
  if (await isNonEmptyDirectory(target)) throw new TargetNotEmptyError(target)
  return target
}

/**
 * Base에 Rendering Mode, Recipe, Archetype을 차례로 덧입혀 target에 Starter를 만든다(ADR-0002, ADR-0007). Archetype은
 * 자기가 쓰는 Recipe 위에 화면을 더하므로 Recipe를 모두 덧입힌 뒤에 덧입힌다. 그다음 overlay의 명세 조각을
 * Base 명세에 병합하고, Base와 overlay가 선언한 확장 지점의 조각(extensions.json)으로 조립 파일을 만든다(ADR-0010).
 * 확장 지점의 선언, 명세 조각, dotenv 파일은 무엇을 쓰기 전에 읽어 보고, 잘못되었거나 명세가 겹치거나 같은 변수에 다른 값을
 * 적었으면 OverlayError로 실패한다.
 * 도중에 실패하면 반쯤 만든 Starter를 지운다. prepareTarget이 확인했듯 target은 없거나 빈 디렉터리였으므로,
 * 원래 있던 빈 디렉터리는 비운 채로 남긴다.
 */
export async function createStarter(
  target: string,
  { renderingMode, recipes, archetypes }: StarterChoices,
): Promise<void> {
  const overlays = [
    renderingModeOverlay(renderingMode),
    ...recipes.map(recipeOverlay),
    ...archetypes.map(archetypeOverlay),
  ].filter((overlay) => overlay !== undefined)
  const pieces = (await Promise.all([BASE, ...overlays].map(readExtensions))).flat()
  checkExtensions(pieces)
  // overlay 최상위의 명세 조각(openapi.yaml)을 덧입히는 순서대로 읽고, 쓰기 전에 병합해 보아 겹치는 명세 조각을 먼저 알린다.
  const fragments: SpecFragment[] = []
  for (const { label, dir } of overlays) {
    const text = await readOptionalFile(join(dir, OPENAPI_SPEC))
    if (text !== undefined) fragments.push({ label, text })
  }
  mergeOpenApiFragments(await readFile(join(BASE_DIR, OPENAPI_SPEC), 'utf8'), fragments)

  // dotenv 파일은 변수 단위로 병합하므로(overlay.ts), Base·Rendering Mode·Recipe 가운데 둘이 같은 파일의 같은 변수에 다른 값을
  // 적었으면 어느 쪽의 값이 맞는지 Generator가 정할 수 없다. 그런 변수를 모두 알리고 멈춘다. 값이 같으면 된다.
  const dotenvSources: DotenvSource[] = []
  for (const { label, dir } of [BASE, ...overlays]) {
    for (const path of (await listFiles(dir)).filter(isDotenvFile)) {
      dotenvSources.push({ label, path, text: await readFile(join(dir, path), 'utf8') })
    }
  }
  const conflicts = findDotenvConflicts(dotenvSources)
  if (conflicts.length > 0) {
    throw new OverlayError(
      bulletList(
        '환경 변수 파일의 같은 변수에 서로 다른 값을 적은 곳이 있어 병합할 수 없습니다. 같은 값을 적거나, 다른 값이 필요하면 ' +
          'Recipe 이름을 담은 다른 변수를 쓰세요(docs/recipes.md의 "환경 변수").',
        conflicts.map(
          ({ path, key, first, second }) =>
            `${path}의 ${key}: ${first.label}에서 '${first.value}', ${second.label}에서 '${second.value}'`,
        ),
      ),
    )
  }

  const existed = await readdir(target).then(
    () => true,
    () => false,
  )
  try {
    await cp(BASE_DIR, target, { recursive: true, filter: (source) => !NOT_COPIED.includes(source) })
    await rename(join(target, PACKED_GITIGNORE), join(target, '.gitignore'))
    for (const overlay of overlays) await applyOverlay(target, overlay, ASSEMBLED)
    if (fragments.length > 0) {
      // Starter의 명세에 명세 조각을 병합해 쓰고, 병합한 명세로 재생성 API 계층을 다시 만든다(`npm run api:gen`과 같다).
      const spec = join(target, OPENAPI_SPEC)
      const base = await readOptionalFile(spec)
      if (base === undefined) throw new OverlayError(`명세 조각을 병합할 ${OPENAPI_SPEC}가 Starter에 없습니다.`)
      await writeFile(spec, await formatForStarter(spec, mergeOpenApiFragments(base, fragments)))
      await regenerateApiLayer(target).catch((error: unknown) => {
        const sources = fragments.map(({ label }) => label).join(', ')
        throw new OverlayError(
          `명세 조각(${sources})을 병합한 ${OPENAPI_SPEC}로 재생성 API 계층을 만들지 못했습니다(orval): ${String(error)}`,
        )
      })
    }
    await writeExtensionFiles(target, pieces, renderingMode)
    // Starter는 자신을 만든 Generator를 정확한 버전으로 고정해, 팀원 모두가 같은 Schematic 결과를 얻는다(`npm run g`).
    // Rendering Mode와 Recipe를 모두 덧입힌 뒤에 정하므로 어떤 overlay도 이 값을 바꾸지 못한다.
    await updatePackageJson(target, (packageJson) =>
      mergePackageJson(packageJson, {
        name: basename(target),
        devDependencies: { [generatorPackage.name]: generatorPackage.version },
      }),
    )
  } catch (error) {
    if (existed) await Promise.all((await readdir(target)).map((entry) => rm(join(target, entry), { recursive: true })))
    else await rm(target, { recursive: true, force: true })
    throw error
  }
}
