import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Overlay, RECIPE_MANIFEST } from './overlay.js'
import { isRenderingMode, RENDERING_MODES, type RenderingMode } from './rendering-mode.js'

// Recipe는 `recipes/<이름>/`에 담긴 overlay(overlay.ts)와 그 최상위의 선언 파일 recipe.json이다.
// 작성 방법은 docs/recipes.md에 있다.
const RECIPES_DIR = fileURLToPath(new URL('../recipes', import.meta.url))

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

/** Recipe 선언이 잘못되었다. Generator를 고쳐야 하는 오류다. */
export class RecipeDefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecipeDefinitionError'
  }
}

/** Generator에 담긴 Recipe를 이름순으로 읽는다. 선언이 잘못되었으면 RecipeDefinitionError를 던진다. */
export async function loadRecipes(): Promise<Recipe[]> {
  const entries = await readdir(RECIPES_DIR, { withFileTypes: true })
  const recipes = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const dir = join(RECIPES_DIR, entry.name)
        const manifest: unknown = JSON.parse(await readFile(join(dir, RECIPE_MANIFEST), 'utf8'))
        return parseManifest(entry.name, dir, manifest)
      }),
  )
  recipes.sort((a, b) => a.name.localeCompare(b.name, 'en'))

  const names = new Set(recipes.map(({ name }) => name))
  for (const recipe of recipes) {
    const unknown = recipe.requires.filter((name) => !names.has(name))
    if (unknown.length > 0) {
      throw new RecipeDefinitionError(`Recipe ${recipe.name}의 requires에 없는 Recipe가 있습니다: ${unknown.join(', ')}`)
    }
  }
  return recipes
}

const MANIFEST_KEYS = ['description', 'requires', 'renderingModes', 'renderingModesReason']

function parseManifest(name: string, dir: string, manifest: unknown): Recipe {
  const fail = (problem: string) => new RecipeDefinitionError(`recipes/${name}/${RECIPE_MANIFEST}: ${problem}`)
  if (!isRecord(manifest)) throw fail('최상위는 객체여야 합니다.')
  const unknownKeys = Object.keys(manifest).filter((key) => !MANIFEST_KEYS.includes(key))
  if (unknownKeys.length > 0) throw fail(`알 수 없는 항목입니다: ${unknownKeys.join(', ')}`)

  const { description, requires = [], renderingModes, renderingModesReason } = manifest
  if (typeof description !== 'string' || description === '') throw fail('description(한 줄 설명)이 필요합니다.')
  if (!isStringArray(requires)) throw fail('requires는 Recipe 이름의 배열이어야 합니다.')
  if (!Array.isArray(renderingModes) || renderingModes.length === 0 || !renderingModes.every(isRenderingMode)) {
    throw fail(`renderingModes는 지원하는 Rendering Mode(${RENDERING_MODES.join(', ')})의 배열이어야 합니다.`)
  }
  if (renderingModesReason !== undefined && typeof renderingModesReason !== 'string') {
    throw fail('renderingModesReason은 문자열이어야 합니다.')
  }

  return {
    name,
    description,
    requires,
    renderingModes,
    ...(renderingModesReason === undefined ? {} : { renderingModesReason }),
    dir,
  }
}

/** Starter에 덧입힐 Recipe의 overlay */
export function recipeOverlay(recipe: Recipe): Overlay {
  return { label: `Recipe ${recipe.name}`, dir: recipe.dir }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
