import { spawnSync } from 'node:child_process'
import { relative } from 'node:path'
import { Command, Option } from 'commander'
import { createStarter, prepareTarget, TargetNotEmptyError } from './create-starter.js'
import { OverlayError } from './overlay.js'
import { promptChoices, type UserChoices } from './prompts.js'
import { loadRecipes, type RecipeSelection, RecipeSelectionError, resolveRecipes } from './recipes.js'
import { DEFAULT_RENDERING_MODE, RENDERING_MODES, type RenderingMode } from './rendering-mode.js'

interface NewOptions {
  renderingMode: RenderingMode
  recipe: string[]
  skipInstall?: true
}

/** `dcgen new`: Base에 고른 Rendering Mode와 Recipe를 덧입혀 Starter를 만들고 의존성을 설치한다. */
export function newCommand(): Command {
  return new Command('new')
    .description('Base에 고른 Rendering Mode와 Recipe를 덧입혀 새 Starter를 만들고 의존성을 설치한다')
    .argument('<name>', 'Starter 이름이자 만들 디렉터리')
    .addOption(
      new Option('--rendering-mode <mode>', 'Starter 전체의 Rendering Mode')
        .choices(RENDERING_MODES)
        .default(DEFAULT_RENDERING_MODE),
    )
    .addOption(
      new Option('--recipe <name>', '넣을 Recipe. 여러 번 쓸 수 있다(예: --recipe dark-mode --recipe <다른 Recipe>)')
        .argParser(collect)
        .default([], '없음'),
    )
    .option('--skip-install', 'Starter를 만든 뒤 npm install을 하지 않는다')
    .addHelpText(
      'after',
      '\n터미널에서 --rendering-mode와 --recipe 없이 실행하면 둘을 차례로 묻는다. CI처럼 터미널이 아니면 묻지 않고 기본값(server, Recipe 없음)으로 만든다.',
    )
    .action(async (name: string, options: NewOptions, command: Command) => {
      await runNew(name, options, command)
    })
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value]
}

async function runNew(name: string, options: NewOptions, command: Command): Promise<void> {
  // 무엇을 묻거나 쓰기 전에 만들 곳부터 확인한다.
  const target = await prepareTarget(name, process.cwd()).catch((error: unknown) => exitWithMessage(command, error))
  const available = await loadRecipes()

  const flagsGiven =
    command.getOptionValueSource('renderingMode') !== 'default' || command.getOptionValueSource('recipe') !== 'default'
  const choices: UserChoices | undefined =
    !flagsGiven && isInteractive()
      ? await promptChoices(name, available)
      : { renderingMode: options.renderingMode, recipes: options.recipe }
  if (choices === undefined) {
    process.exitCode = 1
    return
  }

  let selection: RecipeSelection
  try {
    selection = resolveRecipes(available, choices.recipes, choices.renderingMode)
  } catch (error) {
    exitWithMessage(command, error)
  }
  for (const { name: recipe, requiredBy } of selection.added) {
    console.log(`Recipe ${requiredBy}에 필요한 Recipe ${recipe}을(를) 함께 넣습니다.`)
  }

  await createStarter(target, { renderingMode: choices.renderingMode, recipes: selection.recipes }).catch(
    (error: unknown) => exitWithMessage(command, error),
  )
  const recipeNames = selection.recipes.map((recipe) => recipe.name)
  console.log(
    [
      `Starter를 만들었습니다: ${target}`,
      `  Rendering Mode: ${choices.renderingMode}`,
      `  Recipe: ${recipeNames.length > 0 ? recipeNames.join(', ') : '없음(Base만)'}`,
    ].join('\n'),
  )

  const installed = options.skipInstall !== true && installDependencies(target)
  const nextSteps = [`cd ${relative(process.cwd(), target)}`, ...(installed ? [] : ['npm install']), 'npm run dev']
  console.log(`\n다음 단계:\n\n${nextSteps.map((step) => `  ${step}`).join('\n')}\n`)
}

// 사용자가 고칠 수 있는 오류(만들 곳, Recipe 조합)와 Recipe를 덧입히지 못한 오류는 스택 없이 메시지만 보여 주고 끝낸다.
function exitWithMessage(command: Command, error: unknown): never {
  if (error instanceof TargetNotEmptyError || error instanceof RecipeSelectionError || error instanceof OverlayError) {
    command.error(error.message)
  }
  throw error
}

// 사람이 터미널에서 실행했을 때만 묻는다. CI와 다른 프로그램이 실행한 경우(입출력이 터미널이 아님)에는 묻지 않는다.
function isInteractive(): boolean {
  const ci = process.env['CI']
  const inCi = ci !== undefined && ci !== '' && ci !== 'false'
  return process.stdin.isTTY === true && process.stdout.isTTY && !inCi
}

/**
 * Starter 디렉터리에서 `npm install`로 의존성을 설치하고 성공했는지 돌려준다. npm의 출력은 그대로 보여 준다.
 * 실패하면 다시 설치하라고 알리고 종료 코드를 1로 정한다. 설치로 생기는 package-lock.json은 Starter의
 * GitLab CI가 `npm ci`로 설치할 때 쓴다.
 */
function installDependencies(target: string): boolean {
  console.log('\n의존성을 설치합니다(npm install).\n')
  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: target,
    stdio: 'inherit',
    // Windows의 npm은 npm.cmd라 셸을 거쳐야 실행된다.
    shell: process.platform === 'win32',
  })
  if (result.status === 0) return true
  // Starter는 이미 만들었으므로 지우지 않고, 설치만 다시 하도록 알린다.
  console.error('\nnpm install이 실패했습니다. 위 오류를 확인하고 Starter 디렉터리에서 npm install을 다시 실행하세요.')
  process.exitCode = 1
  return false
}
