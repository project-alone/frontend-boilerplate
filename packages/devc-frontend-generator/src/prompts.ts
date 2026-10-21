import { cancel, intro, isCancel, log, multiselect, select } from '@clack/prompts'
import {
  DEFAULT_RENDERING_MODE,
  RENDERING_MODE_DESCRIPTIONS,
  RENDERING_MODES,
  type RenderingMode,
} from './rendering-mode.js'
import { type Catalog, resolveSelection, SelectionError, type UserChoices } from './selection.js'

/**
 * 터미널에서 Rendering Mode, Archetype, Recipe를 차례로 묻는다. 사용자가 취소하면 undefined를 돌려준다.
 * 고른 Rendering Mode에서 쓸 수 없는 Archetype과 Recipe는 이유와 함께 보여 주고 고르지 못하게 하며, 고른 Archetype이 쓰는
 * Recipe는 함께 들어간다고 보여 준다.
 */
export async function promptChoices(name: string, catalog: Catalog): Promise<UserChoices | undefined> {
  intro(`dcgen new ${name}`)

  const renderingMode = await select({
    message: 'Rendering Mode를 고르세요',
    options: RENDERING_MODES.map((mode) => ({ value: mode, label: mode, hint: RENDERING_MODE_DESCRIPTIONS[mode] })),
    initialValue: DEFAULT_RENDERING_MODE,
  })
  if (isCancel(renderingMode)) return cancelled()

  const archetypes = await promptArchetypes(catalog, renderingMode)
  if (archetypes === undefined) return cancelled()
  if (catalog.recipes.length === 0) return { renderingMode, archetypes, recipes: [] }

  // 고른 Archetype이 쓰는 Recipe(그 Recipe가 필요로 하는 Recipe 포함)는 고르지 않아도 들어간다.
  const included = new Map(
    resolveSelection(catalog, { renderingMode, archetypes, recipes: [] }).added.map(({ name: recipe, requiredBy }) => [
      recipe,
      requiredBy,
    ]),
  )
  const recipes = await multiselect({
    message: '넣을 Recipe를 고르세요(스페이스로 선택, 엔터로 확인. 고르지 않으면 Base만 씁니다)',
    options: catalog.recipes.map((recipe) => {
      const includedBy = included.get(recipe.name)
      const reason =
        includedBy === undefined
          ? unusableReason(catalog, { renderingMode, archetypes: [], recipes: [recipe.name] })
          : `${includedBy}에 들어 있어 함께 넣습니다.`
      return {
        value: recipe.name,
        label: recipe.name,
        hint: reason ?? recipe.description,
        disabled: reason !== undefined,
      }
    }),
    required: false,
  })
  if (isCancel(recipes)) return cancelled()
  return { renderingMode, archetypes, recipes }
}

/** Archetype을 묻는다. 담긴 Archetype이 없으면 묻지 않는다. 취소하면 undefined다. */
async function promptArchetypes(catalog: Catalog, renderingMode: RenderingMode): Promise<string[] | undefined> {
  if (catalog.archetypes.length === 0) return []
  const options = catalog.archetypes.map((archetype) => {
    const reason = unusableReason(catalog, { renderingMode, archetypes: [archetype.name], recipes: [] })
    return {
      value: archetype.name,
      label: archetype.name,
      hint: reason ?? `${archetype.description} (Recipe: ${archetype.recipes.join(', ')})`,
      disabled: reason !== undefined,
    }
  })
  // 고를 수 있는 Archetype이 없으면 묻지 않고 이유만 알린다(선택지가 모두 막힌 목록에서는 막힌 항목이 골라진다).
  if (options.every(({ disabled }) => disabled)) {
    log.info(
      [
        `Rendering Mode ${renderingMode}에서 쓸 수 있는 Archetype이 없어 Archetype 없이 만듭니다.`,
        ...options.map(({ label, hint }) => `${label}: ${hint}`),
      ].join('\n'),
    )
    return []
  }
  const archetypes = await multiselect({
    message: 'Archetype(완성된 앱 유형)을 고르세요(스페이스로 선택, 엔터로 확인. 필요한 Recipe가 함께 들어갑니다)',
    options,
    required: false,
  })
  return isCancel(archetypes) ? undefined : archetypes
}

// 필요한 Recipe까지 함께 넣어 그 Rendering Mode에서 쓸 수 있는지 본다. 쓸 수 없으면 그 이유를 돌려준다.
function unusableReason(catalog: Catalog, choices: UserChoices): string | undefined {
  try {
    resolveSelection(catalog, choices)
    return undefined
  } catch (error) {
    if (error instanceof SelectionError) return error.reasons.join(' ')
    throw error
  }
}

function cancelled(): undefined {
  cancel('Starter를 만들지 않았습니다.')
  return undefined
}
