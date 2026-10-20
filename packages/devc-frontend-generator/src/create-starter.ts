import { cp, readdir, rename, rm } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generatorPackage } from './generator-package.js'
import { isNotFound } from './overlay.js'
import { mergePackageJson, updatePackageJson } from './package-json.js'
import { applyRecipe, type Recipe } from './recipes.js'
import { applyRenderingMode, type RenderingMode } from './rendering-mode.js'

const BASE_DIR = fileURLToPath(new URL('../base', import.meta.url))

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
  /** 덧입힐 순서대로 늘어놓은 Recipe(resolveRecipes의 결과) */
  recipes: readonly Recipe[]
}

/** Starter를 만들 디렉터리의 절대 경로. 이미 내용이 있으면 TargetNotEmptyError를 던진다. 아무것도 쓰지 않는다. */
export async function prepareTarget(name: string, cwd: string): Promise<string> {
  const target = resolve(cwd, name)
  if (await isNonEmptyDirectory(target)) throw new TargetNotEmptyError(target)
  return target
}

/**
 * Base에 Rendering Mode와 Recipe를 차례로 덧입혀 target에 Starter를 만든다(ADR-0002).
 * 도중에 실패하면 반쯤 만든 Starter를 지운다. prepareTarget이 확인했듯 target은 없거나 빈 디렉터리였으므로,
 * 원래 있던 빈 디렉터리는 비운 채로 남긴다.
 */
export async function createStarter(target: string, { renderingMode, recipes }: StarterChoices): Promise<void> {
  const existed = await readdir(target).then(
    () => true,
    () => false,
  )
  try {
    await cp(BASE_DIR, target, { recursive: true })
    await rename(join(target, PACKED_GITIGNORE), join(target, '.gitignore'))
    await applyRenderingMode(target, renderingMode)
    for (const recipe of recipes) await applyRecipe(target, recipe)
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

async function isNonEmptyDirectory(directory: string): Promise<boolean> {
  try {
    return (await readdir(directory)).length > 0
  } catch (error) {
    if (isNotFound(error)) return false
    throw error
  }
}
