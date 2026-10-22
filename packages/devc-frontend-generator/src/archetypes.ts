import { isStringArray, loadManifests, type Manifest, parseRenderingModes } from './manifest.js'
import { ARCHETYPE_MANIFEST, type Overlay } from './overlay.js'
import type { Recipe } from './recipes.js'
import { RENDERING_MODES, type RenderingMode } from './rendering-mode.js'
import { withRequired } from './selection.js'

// Archetype은 `archetypes/<이름>/`에 담긴 overlay(overlay.ts)와 그 최상위의 선언 파일 archetype.json이다. 여러 Recipe를
// 조합한 완성된 앱 유형(예: 관리자 대시보드)으로, 필요한 Recipe와 자기 화면(overlay)을 선언한다. Starter에는 고른
// Recipe(와 Archetype이 필요로 하는 Recipe)를 모두 덧입힌 뒤에 덧입힌다. 작성 방법은 docs/archetypes.md에 있다.

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

/**
 * Generator에 담긴 Archetype을 이름순으로 읽는다. 필요한 Recipe는 recipes(loadRecipes의 결과)에 있어야 한다.
 * 선언이 잘못되었으면 DefinitionError를 던진다. Archetype이 하나도 없으면(디렉터리가 없으면) 빈 배열이다.
 */
export async function loadArchetypes(recipes: readonly Recipe[]): Promise<Archetype[]> {
  return loadManifests('archetypes', ARCHETYPE_MANIFEST, MANIFEST_KEYS, (manifest) => parseManifest(manifest, recipes))
}

/** Archetype의 overlay. Recipe를 모두 덧입힌 뒤에 덧입힌다. */
export function archetypeOverlay(archetype: Archetype): Overlay {
  return { label: `Archetype ${archetype.name}`, dir: archetype.dir }
}

const MANIFEST_KEYS = ['description', 'recipes', 'renderingModes', 'renderingModesReason']

function parseManifest({ name, dir, description, fields, fail }: Manifest, available: readonly Recipe[]): Archetype {
  const { recipes, renderingModes, renderingModesReason } = fields
  if (!isStringArray(recipes) || recipes.length === 0) throw fail('recipes는 이 Archetype이 쓰는 Recipe 이름의 배열이어야 합니다.')
  const byName = new Map(available.map((recipe) => [recipe.name, recipe]))
  const unknown = recipes.filter((recipe) => !byName.has(recipe))
  if (unknown.length > 0) throw fail(`recipes에 없는 Recipe가 있습니다: ${unknown.join(', ')}`)
  if (renderingModesReason !== undefined && (typeof renderingModesReason !== 'string' || renderingModes === undefined)) {
    throw fail('renderingModesReason은 renderingModes와 함께 적는 문자열이어야 합니다.')
  }

  // 필요한 Recipe와 그 Recipe가 필요로 하는 Recipe가 모두 지원하는 Rendering Mode
  const required = withRequired(recipes, byName).map(({ recipe }) => recipe)
  const supported = RENDERING_MODES.filter((mode) => required.every((recipe) => recipe.renderingModes.includes(mode)))
  if (supported.length === 0) throw fail(`recipes(${recipes.join(', ')})를 함께 쓸 수 있는 Rendering Mode가 없습니다.`)
  const declared = renderingModes === undefined ? undefined : parseRenderingModes(renderingModes, fail)
  const beyond = declared?.filter((mode) => !supported.includes(mode)) ?? []
  if (beyond.length > 0) {
    throw fail(`renderingModes의 ${beyond.join(', ')}는 recipes가 지원하지 않습니다(함께 쓸 수 있는 Rendering Mode: ${supported.join(', ')}).`)
  }

  return {
    name,
    description,
    recipes,
    renderingModes: declared ?? supported,
    ...(typeof renderingModesReason === 'string' ? { renderingModesReason } : {}),
    dir,
  }
}
