import { cancel, intro, isCancel, multiselect, select } from '@clack/prompts'
import { type Recipe, RecipeSelectionError, resolveRecipes } from './recipes.js'
import {
  DEFAULT_RENDERING_MODE,
  RENDERING_MODE_DESCRIPTIONS,
  RENDERING_MODES,
  type RenderingMode,
} from './rendering-mode.js'

/** 사용자가 고른 Rendering Mode와 Recipe 이름. 플래그로 받거나 터미널에서 묻는다. */
export interface UserChoices {
  renderingMode: RenderingMode
  recipes: string[]
}

/** 터미널에서 Rendering Mode와 Recipe를 차례로 묻는다. 사용자가 취소하면 undefined를 돌려준다. */
export async function promptChoices(name: string, available: readonly Recipe[]): Promise<UserChoices | undefined> {
  intro(`dcgen new ${name}`)

  const renderingMode = await select({
    message: 'Rendering Mode를 고르세요',
    options: RENDERING_MODES.map((mode) => ({ value: mode, label: mode, hint: RENDERING_MODE_DESCRIPTIONS[mode] })),
    initialValue: DEFAULT_RENDERING_MODE,
  })
  if (isCancel(renderingMode)) return cancelled()
  if (available.length === 0) return { renderingMode, recipes: [] }

  const recipes = await multiselect({
    message: '넣을 Recipe를 고르세요(스페이스로 선택, 엔터로 확인. 고르지 않으면 Base만 씁니다)',
    options: available.map((recipe) => {
      const reason = unusableReason(available, recipe.name, renderingMode)
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
  return { renderingMode, recipes }
}

// 필요한 Recipe까지 함께 넣어 그 Rendering Mode에서 쓸 수 있는지 본다. 쓸 수 없으면 그 이유를 돌려준다.
function unusableReason(available: readonly Recipe[], name: string, renderingMode: RenderingMode): string | undefined {
  try {
    resolveRecipes(available, [name], renderingMode)
    return undefined
  } catch (error) {
    if (error instanceof RecipeSelectionError) return error.reasons.join(' ')
    throw error
  }
}

function cancelled(): undefined {
  cancel('Starter를 만들지 않았습니다.')
  return undefined
}
