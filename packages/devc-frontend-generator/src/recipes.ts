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

/** 고른 Recipe 조합으로는 Starter를 만들 수 없다. 사용자가 선택을 바꿔야 하는 오류다. */
export class RecipeSelectionError extends Error {
  /** 거부한 이유. Recipe마다 한 줄이다. */
  readonly reasons: readonly string[]

  constructor(summary: string, reasons: readonly string[]) {
    super([summary, ...reasons.map((reason) => `- ${reason}`)].join('\n'))
    this.name = 'RecipeSelectionError'
    this.reasons = reasons
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

export interface RecipeSelection {
  /** 넣을 Recipe. 필요한 Recipe가 그것을 필요로 하는 Recipe보다 앞에 오는, 덧입힐 순서다. */
  recipes: Recipe[]
  /** 고르지 않았지만 다른 Recipe에 필요해 함께 넣은 Recipe와 그것을 필요로 한 Recipe */
  added: { name: string; requiredBy: string }[]
}

/**
 * 고른 Recipe에 필요한 Recipe를 더하고, 덧입힐 순서를 정한다. 고른 순서와 상관없이 결과가 같도록 이름순으로 정한다.
 * 알 수 없는 Recipe가 있거나 renderingMode를 지원하지 않는 Recipe가 있으면 무엇도 만들기 전에 RecipeSelectionError로 거부한다.
 */
export function resolveRecipes(
  available: readonly Recipe[],
  selected: readonly string[],
  renderingMode: RenderingMode,
): RecipeSelection {
  const byName = new Map(available.map((recipe) => [recipe.name, recipe]))
  const unknown = selected.filter((name) => !byName.has(name))
  if (unknown.length > 0) {
    const choices = available.length > 0 ? available.map(({ name }) => name).join(', ') : '(없음)'
    throw new RecipeSelectionError(`알 수 없는 Recipe입니다: ${unknown.join(', ')}. 고를 수 있는 Recipe: ${choices}`, [])
  }

  const ordered: Recipe[] = []
  const added: RecipeSelection['added'] = []
  const visiting = new Set<string>()
  const visit = (name: string, requiredBy: string | undefined) => {
    const recipe = byName.get(name)
    if (recipe === undefined || ordered.includes(recipe)) return
    if (visiting.has(name)) throw new RecipeDefinitionError(`Recipe의 requires가 순환합니다: ${[...visiting, name].join(' → ')}`)
    visiting.add(name)
    for (const required of [...recipe.requires].sort()) visit(required, name)
    visiting.delete(name)
    ordered.push(recipe)
    if (requiredBy !== undefined && !selected.includes(name)) added.push({ name, requiredBy })
  }
  for (const name of [...new Set(selected)].sort()) visit(name, undefined)

  const unsupported = ordered.filter((recipe) => !recipe.renderingModes.includes(renderingMode))
  if (unsupported.length > 0) {
    const reasons = unsupported.map((recipe) => {
      const requiredBy = added.find(({ name }) => name === recipe.name)?.requiredBy
      return [
        `Recipe ${recipe.name}은(는) Rendering Mode ${renderingMode}에서 쓸 수 없습니다` +
          `(지원: ${recipe.renderingModes.join(', ')}).`,
        ...(recipe.renderingModesReason === undefined ? [] : [recipe.renderingModesReason]),
        ...(requiredBy === undefined ? [] : [`${requiredBy}에 필요해 함께 넣으려던 Recipe입니다.`]),
      ].join(' ')
    })
    throw new RecipeSelectionError('고른 Rendering Mode와 Recipe를 함께 쓸 수 없습니다.', reasons)
  }

  return { recipes: ordered, added }
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
