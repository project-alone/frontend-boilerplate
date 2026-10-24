import type { Archetype } from './archetypes.js'
import { DefinitionError } from './manifest.js'
import type { Recipe } from './recipes.js'
import type { RenderingMode } from './rendering-mode.js'
import { bulletList } from './utils/text.js'

/** Generator에 담긴 Recipe와 Archetype(loadRecipes, loadArchetypes의 결과) */
export interface Catalog {
  recipes: readonly Recipe[]
  archetypes: readonly Archetype[]
}

/** 사용자가 고른 Rendering Mode, Archetype, Recipe의 이름. 플래그로 받거나 터미널에서 묻는다. */
export interface UserChoices {
  renderingMode: RenderingMode
  archetypes: readonly string[]
  recipes: readonly string[]
}

/** 고른 Recipe·Archetype 조합으로는 Starter를 만들 수 없다. 사용자가 선택을 바꿔야 하는 오류다. */
export class SelectionError extends Error {
  /** 거부한 이유. Recipe나 Archetype마다 한 줄이다. */
  readonly reasons: readonly string[]

  constructor(summary: string, reasons: readonly string[]) {
    super(bulletList(summary, reasons))
    this.name = 'SelectionError'
    this.reasons = reasons
  }
}

export interface Selection {
  /** 넣을 Recipe. 필요한 Recipe가 그것을 필요로 하는 Recipe보다 앞에 오는, 덧입힐 순서다. */
  recipes: Recipe[]
  /** 넣을 Archetype. 이름순이고, Recipe를 모두 덧입힌 뒤에 이 순서로 덧입힌다. */
  archetypes: Archetype[]
  /** 고르지 않았지만 다른 Recipe나 Archetype에 필요해 함께 넣은 Recipe와 그것을 필요로 한 곳(예: 'Archetype dashboard') */
  added: { name: string; requiredBy: string }[]
}

/**
 * 고른 Archetype과 Recipe에 필요한 Recipe를 더하고, 덧입힐 순서를 정한다. 고른 순서, 그리고 Archetype이 쓰는 Recipe를 따로
 * 골랐는지와 상관없이 결과가 같도록 이름순으로 정한다. 알 수 없는 Recipe나 Archetype이 있거나, 고른 Rendering Mode를
 * 지원하지 않는 Archetype이나 Recipe(함께 넣을 Recipe 포함)가 있으면 무엇도 만들기 전에 SelectionError로 거부한다.
 */
export function resolveSelection(catalog: Catalog, choices: UserChoices): Selection {
  const { renderingMode } = choices
  const recipesByName = new Map(catalog.recipes.map((recipe) => [recipe.name, recipe]))
  const archetypesByName = new Map(catalog.archetypes.map((archetype) => [archetype.name, archetype]))
  rejectUnknown('Recipe', choices.recipes, recipesByName)
  rejectUnknown('Archetype', choices.archetypes, archetypesByName)

  const archetypes = [...new Set(choices.archetypes)].sort().flatMap((name) => archetypesByName.get(name) ?? [])
  // Archetype이 쓰는 Recipe는 그 Archetype이 필요로 한 것으로 알린다. 여러 Archetype이 쓰면 이름순으로 앞의 Archetype이다.
  const neededBy = new Map<string, string>()
  for (const archetype of archetypes) {
    for (const recipe of archetype.recipes) if (!neededBy.has(recipe)) neededBy.set(recipe, `Archetype ${archetype.name}`)
  }

  const resolved = withRequired([...new Set([...choices.recipes, ...neededBy.keys()])].sort(), recipesByName, (name) =>
    neededBy.get(name),
  )
  const ordered = resolved.map(({ recipe }) => recipe)
  const added = resolved.flatMap(({ recipe: { name }, requiredBy }) =>
    requiredBy !== undefined && !choices.recipes.includes(name) ? [{ name, requiredBy }] : [],
  )

  const reasons = [
    ...archetypes
      .filter((archetype) => !archetype.renderingModes.includes(renderingMode))
      .map((archetype) => unsupportedReason(`Archetype ${archetype.name}`, archetype, renderingMode)),
    ...ordered
      .filter((recipe) => !recipe.renderingModes.includes(renderingMode))
      .map((recipe) => {
        const requiredBy = added.find(({ name }) => name === recipe.name)?.requiredBy
        return [
          unsupportedReason(`Recipe ${recipe.name}`, recipe, renderingMode),
          ...(requiredBy === undefined ? [] : [`${requiredBy}에 필요해 함께 넣으려던 Recipe입니다.`]),
        ].join(' ')
      }),
  ]
  if (reasons.length > 0) {
    throw new SelectionError(
      `고른 Rendering Mode와 ${archetypes.length > 0 ? 'Archetype·' : ''}Recipe를 함께 쓸 수 없습니다.`,
      reasons,
    )
  }

  return { recipes: ordered, archetypes, added }
}

/**
 * names의 Recipe와 그 Recipe가 (거슬러 올라가며) requires로 필요로 하는 Recipe를 덧입힐 순서로 늘어놓는다. 필요한 Recipe가
 * 그것을 필요로 하는 Recipe보다 앞에 오고, 그 밖에는 names의 순서를 따르며 requires는 이름순으로 따라간다. requiredBy는 그
 * Recipe를 처음 넣게 한 곳이다: names의 Recipe는 requiredByOf(name), requires로 따라온 Recipe는 그것을 필요로 한 Recipe
 * (예: 'Recipe auth'). byName에 없는 이름은 건너뛴다. requires가 순환하면 DefinitionError를 던진다.
 */
export function withRequired(
  names: readonly string[],
  byName: ReadonlyMap<string, Recipe>,
  requiredByOf: (name: string) => string | undefined = () => undefined,
): { recipe: Recipe; requiredBy: string | undefined }[] {
  const ordered: { recipe: Recipe; requiredBy: string | undefined }[] = []
  const visiting = new Set<string>()
  const visit = (name: string, requiredBy: string | undefined) => {
    const recipe = byName.get(name)
    if (recipe === undefined || ordered.some((entry) => entry.recipe === recipe)) return
    if (visiting.has(name)) throw new DefinitionError(`Recipe의 requires가 순환합니다: ${[...visiting, name].join(' → ')}`)
    visiting.add(name)
    for (const required of [...recipe.requires].sort()) visit(required, `Recipe ${name}`)
    visiting.delete(name)
    ordered.push({ recipe, requiredBy })
  }
  for (const name of names) visit(name, requiredByOf(name))
  return ordered
}

/** label(예: 'Recipe auth')이 renderingMode를 지원하지 않는다는 이유. 지원하는 Rendering Mode와 선언에 적은 이유를 함께 쓴다. */
function unsupportedReason(
  label: string,
  { renderingModes, renderingModesReason }: Pick<Recipe | Archetype, 'renderingModes' | 'renderingModesReason'>,
  renderingMode: RenderingMode,
): string {
  return [
    `${label}은(는) Rendering Mode ${renderingMode}에서 쓸 수 없습니다(지원: ${renderingModes.join(', ')}).`,
    ...(renderingModesReason === undefined ? [] : [renderingModesReason]),
  ].join(' ')
}

function rejectUnknown(kind: 'Recipe' | 'Archetype', selected: readonly string[], known: ReadonlyMap<string, unknown>): void {
  const unknown = selected.filter((name) => !known.has(name))
  if (unknown.length === 0) return
  const choices = known.size > 0 ? [...known.keys()].join(', ') : '(없음)'
  throw new SelectionError(`알 수 없는 ${kind}입니다: ${unknown.join(', ')}. 고를 수 있는 ${kind}: ${choices}`, [])
}
