import { DefinitionError, isStringArray, loadManifests, type Manifest, parseRenderingModes } from './manifest.js'
import { type Overlay, RECIPE_MANIFEST } from './overlay.js'
import type { RenderingMode } from './rendering-mode.js'

// Recipe는 `recipes/<이름>/`에 담긴 overlay(overlay.ts)와 그 최상위의 선언 파일 recipe.json이다.
// 작성 방법은 docs/recipes.md에 있다.

export interface Recipe {
  name: string
  /** `dcgen new`의 선택지에 보이는 한 줄 설명 */
  description: string
  /** 함께 넣어야 하는 다른 Recipe */
  requires: readonly string[]
  /** 이 Recipe를 쓸 수 있는 Starter 단위 Rendering Mode */
  renderingModes: readonly RenderingMode[]
  /** 빠진 Rendering Mode에서 쓸 수 없는 이유. 조합을 거부할 때 함께 보여 준다. */
  renderingModesReason?: string
  /** overlay 디렉터리 */
  dir: string
}

const MANIFEST_KEYS = ['description', 'requires', 'renderingModes', 'renderingModesReason']

/** Generator에 담긴 Recipe를 이름순으로 읽는다. 선언이 잘못되었으면 DefinitionError를 던진다. */
export async function loadRecipes(): Promise<Recipe[]> {
  const recipes = await loadManifests('recipes', RECIPE_MANIFEST, MANIFEST_KEYS, parseManifest)
  const names = new Set(recipes.map(({ name }) => name))
  for (const recipe of recipes) {
    const unknown = recipe.requires.filter((name) => !names.has(name))
    if (unknown.length > 0) {
      throw new DefinitionError(`Recipe ${recipe.name}의 requires에 없는 Recipe가 있습니다: ${unknown.join(', ')}`)
    }
  }
  return recipes
}

function parseManifest({ name, dir, description, fields, fail }: Manifest): Recipe {
  const { requires = [], renderingModes, renderingModesReason } = fields
  if (!isStringArray(requires)) throw fail('requires는 Recipe 이름의 배열이어야 합니다.')
  const modes = parseRenderingModes(renderingModes, fail)
  if (renderingModesReason !== undefined && typeof renderingModesReason !== 'string') {
    throw fail('renderingModesReason은 문자열이어야 합니다.')
  }

  return {
    name,
    description,
    requires,
    renderingModes: modes,
    ...(renderingModesReason === undefined ? {} : { renderingModesReason }),
    dir,
  }
}

/** Starter에 덧입힐 Recipe의 overlay */
export function recipeOverlay(recipe: Recipe): Overlay {
  return { label: `Recipe ${recipe.name}`, dir: recipe.dir }
}
