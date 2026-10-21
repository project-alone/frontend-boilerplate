import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARCHETYPE_MANIFEST, isNotFound, type Overlay } from './overlay.js'
import type { Recipe } from './recipes.js'
import { isRenderingMode, RENDERING_MODES, type RenderingMode } from './rendering-mode.js'

// Archetype은 `archetypes/<이름>/`에 담긴 overlay(overlay.ts)와 그 최상위의 선언 파일 archetype.json이다. 여러 Recipe를
// 조합한 완성된 앱 유형(예: 관리자 대시보드)으로, 필요한 Recipe와 자기 화면(overlay)을 선언한다. Starter에는 고른
// Recipe(와 Archetype이 필요로 하는 Recipe)를 모두 덧입힌 뒤에 덧입힌다. 작성 방법은 docs/archetypes.md에 있다.
const ARCHETYPES_DIR = fileURLToPath(new URL('../archetypes', import.meta.url))

export interface Archetype {
  name: string
  /** `dcgen new`의 선택지에 보이는 한 줄 설명 */
  description: string
  /** 이 Archetype의 화면이 쓰는 Recipe. 사용자가 고르지 않았으면 Generator가 알리고 함께 넣는다. */
  recipes: readonly string[]
  /**
   * 이 Archetype을 쓸 수 있는 Starter 단위 Rendering Mode. archetype.json에 적지 않으면 필요한 Recipe(그 Recipe가 필요로
   * 하는 Recipe 포함)가 모두 지원하는 Rendering Mode다. 적으면 그 가운데 일부로 좁힌다.
   */
  renderingModes: readonly RenderingMode[]
  /** 빠진 Rendering Mode에서 쓸 수 없는 이유. archetype.json에 적었을 때만 있다. */
  renderingModesReason?: string
  /** overlay 디렉터리 */
  dir: string
}

/** Archetype 선언이 잘못되었다. Generator를 고쳐야 하는 오류다. */
export class ArchetypeDefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ArchetypeDefinitionError'
  }
}

/**
 * Generator에 담긴 Archetype을 이름순으로 읽는다. 필요한 Recipe는 recipes(loadRecipes의 결과)에 있어야 한다.
 * 선언이 잘못되었으면 ArchetypeDefinitionError를 던진다. Archetype이 하나도 없으면(디렉터리가 없으면) 빈 배열이다.
 */
export async function loadArchetypes(recipes: readonly Recipe[]): Promise<Archetype[]> {
  const entries = await readdir(ARCHETYPES_DIR, { withFileTypes: true }).catch((error: unknown) => {
    if (isNotFound(error)) return []
    throw error
  })
  const archetypes = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const dir = join(ARCHETYPES_DIR, entry.name)
        const manifest: unknown = JSON.parse(await readFile(join(dir, ARCHETYPE_MANIFEST), 'utf8'))
        return parseManifest(entry.name, dir, manifest, recipes)
      }),
  )
  return archetypes.sort((a, b) => a.name.localeCompare(b.name, 'en'))
}

/** Archetype의 overlay. Recipe를 모두 덧입힌 뒤에 덧입힌다. */
export function archetypeOverlay(archetype: Archetype): Overlay {
  return { label: `Archetype ${archetype.name}`, dir: archetype.dir }
}

const MANIFEST_KEYS = ['description', 'recipes', 'renderingModes', 'renderingModesReason']

function parseManifest(name: string, dir: string, manifest: unknown, available: readonly Recipe[]): Archetype {
  const fail = (problem: string) => new ArchetypeDefinitionError(`archetypes/${name}/${ARCHETYPE_MANIFEST}: ${problem}`)
  if (!isRecord(manifest)) throw fail('최상위는 객체여야 합니다.')
  const unknownKeys = Object.keys(manifest).filter((key) => !MANIFEST_KEYS.includes(key))
  if (unknownKeys.length > 0) throw fail(`알 수 없는 항목입니다: ${unknownKeys.join(', ')}`)

  const { description, recipes, renderingModes, renderingModesReason } = manifest
  if (typeof description !== 'string' || description === '') throw fail('description(한 줄 설명)이 필요합니다.')
  if (!isStringArray(recipes) || recipes.length === 0) throw fail('recipes는 이 Archetype이 쓰는 Recipe 이름의 배열이어야 합니다.')
  const byName = new Map(available.map((recipe) => [recipe.name, recipe]))
  const unknown = recipes.filter((recipe) => !byName.has(recipe))
  if (unknown.length > 0) throw fail(`recipes에 없는 Recipe가 있습니다: ${unknown.join(', ')}`)
  if (renderingModesReason !== undefined && (typeof renderingModesReason !== 'string' || renderingModes === undefined)) {
    throw fail('renderingModesReason은 renderingModes와 함께 적는 문자열이어야 합니다.')
  }

  // 필요한 Recipe와 그 Recipe가 필요로 하는 Recipe가 모두 지원하는 Rendering Mode
  const supported = RENDERING_MODES.filter((mode) =>
    withRequired(recipes, byName).every((recipe) => recipe.renderingModes.includes(mode)),
  )
  if (supported.length === 0) throw fail(`recipes(${recipes.join(', ')})를 함께 쓸 수 있는 Rendering Mode가 없습니다.`)
  if (renderingModes !== undefined) {
    if (!Array.isArray(renderingModes) || renderingModes.length === 0 || !renderingModes.every(isRenderingMode)) {
      throw fail(`renderingModes는 지원하는 Rendering Mode(${RENDERING_MODES.join(', ')})의 배열이어야 합니다.`)
    }
    const beyond = renderingModes.filter((mode) => !supported.includes(mode))
    if (beyond.length > 0) {
      throw fail(`renderingModes의 ${beyond.join(', ')}는 recipes가 지원하지 않습니다(함께 쓸 수 있는 Rendering Mode: ${supported.join(', ')}).`)
    }
  }

  return {
    name,
    description,
    recipes,
    renderingModes: renderingModes ?? supported,
    ...(typeof renderingModesReason === 'string' ? { renderingModesReason } : {}),
    dir,
  }
}

/** names의 Recipe와 그 Recipe가 (거슬러 올라가며) 필요로 하는 Recipe */
function withRequired(names: readonly string[], byName: ReadonlyMap<string, Recipe>): Recipe[] {
  const found = new Map<string, Recipe>()
  const visit = (name: string) => {
    const recipe = byName.get(name)
    if (recipe === undefined || found.has(name)) return
    found.set(name, recipe)
    for (const required of recipe.requires) visit(required)
  }
  for (const name of names) visit(name)
  return [...found.values()]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
