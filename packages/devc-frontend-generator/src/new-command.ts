import { spawnSync } from 'node:child_process'
import { relative } from 'node:path'
import { Command, Option } from 'commander'
import { loadArchetypes } from './archetypes.js'
import { createStarter, prepareTarget, TargetNotEmptyError } from './create-starter.js'
import { OverlayError } from './overlay.js'
import { promptChoices } from './prompts.js'
import { loadRecipes } from './recipes.js'
import { DEFAULT_RENDERING_MODE, RENDERING_MODES, type RenderingMode } from './rendering-mode.js'
import { type Catalog, resolveSelection, type Selection, SelectionError, type UserChoices } from './selection.js'

interface NewOptions {
  renderingMode: RenderingMode
  archetype: string[]
  recipe: string[]
  skipGit?: true
  skipInstall?: true
}

/**
 * `dcgen new`: Base에 고른 Rendering Mode와 Recipe, Archetype을 덧입혀 Starter를 만들고, git 저장소를 만든 뒤 의존성을
 * 설치한다.
 */
export function newCommand(): Command {
  return new Command('new')
    .description(
      'Base에 고른 Rendering Mode와 Recipe, Archetype을 덧입혀 새 Starter를 만들고, git 저장소를 만든 뒤 의존성을 설치한다',
    )
    .argument('<name>', 'Starter 이름이자 만들 디렉터리')
    .addOption(
      new Option('--rendering-mode <mode>', 'Starter 전체의 Rendering Mode')
        .choices(RENDERING_MODES)
        .default(DEFAULT_RENDERING_MODE),
    )
    .addOption(
      new Option(
        '--archetype <name>',
        '넣을 Archetype(완성된 앱 유형). 필요한 Recipe가 함께 들어간다. 여러 번 쓸 수 있다(예: --archetype dashboard)',
      )
        .argParser(collect)
        .default([], '없음'),
    )
    .addOption(
      new Option('--recipe <name>', '넣을 Recipe. 여러 번 쓸 수 있다(예: --recipe dark-mode --recipe <다른 Recipe>)')
        .argParser(collect)
        .default([], '없음'),
    )
    .option(
      '--skip-git',
      'Starter에 git 저장소를 만들지 않는다(git init). 이미 git 저장소 안이면 이 옵션이 없어도 만들지 않는다',
    )
    .option('--skip-install', 'Starter를 만든 뒤 npm install을 하지 않는다')
    .addHelpText(
      'after',
      '\n터미널에서 --rendering-mode, --archetype, --recipe 없이 실행하면 셋을 차례로 묻는다. CI처럼 터미널이 아니면 묻지 않고 기본값(server, Archetype과 Recipe 없음)으로 만든다.',
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
  const recipes = await loadRecipes()
  const catalog: Catalog = { recipes, archetypes: await loadArchetypes(recipes) }

  const flagsGiven = (['renderingMode', 'archetype', 'recipe'] as const).some(
    (option) => command.getOptionValueSource(option) !== 'default',
  )
  const choices: UserChoices | undefined =
    !flagsGiven && isInteractive()
      ? await promptChoices(name, catalog)
      : { renderingMode: options.renderingMode, archetypes: options.archetype, recipes: options.recipe }
  if (choices === undefined) {
    process.exitCode = 1
    return
  }

  let selection: Selection
  try {
    selection = resolveSelection(catalog, choices)
  } catch (error) {
    exitWithMessage(command, error)
  }
  for (const { name: recipe, requiredBy } of selection.added) {
    console.log(`${requiredBy}에 필요한 Recipe ${recipe}을(를) 함께 넣습니다.`)
  }

  await createStarter(target, {
    renderingMode: choices.renderingMode,
    recipes: selection.recipes,
    archetypes: selection.archetypes,
  }).catch((error: unknown) => exitWithMessage(command, error))
  const names = (items: readonly { name: string }[], none: string) =>
    items.length > 0 ? items.map((item) => item.name).join(', ') : none
  console.log(
    [
      `Starter를 만들었습니다: ${target}`,
      `  Rendering Mode: ${choices.renderingMode}`,
      `  Archetype: ${names(selection.archetypes, '없음')}`,
      `  Recipe: ${names(selection.recipes, '없음(Base만)')}`,
    ].join('\n'),
  )

  // 설치하기 전에 git 저장소를 만들어야 lefthook이 설치(postinstall)하면서 커밋 훅을 설치한다.
  const inRepository = prepareGitRepository(target, { create: options.skipGit !== true })
  const installed = options.skipInstall !== true && installDependencies(target)
  const steps = nextSteps(relative(process.cwd(), target), { inRepository, installed })
  console.log(`\n다음 단계:\n\n${steps.map((step) => `  ${step}`).join('\n')}\n`)
}

/**
 * Starter를 만든 뒤 사용자가 할 일. git 저장소가 없으면 저장소를 만드는 단계를 넣는다. 설치하기 전이면 git init 뒤의 npm install이
 * 커밋 훅을 설치하고, 이미 설치했으면 npx lefthook install로 훅을 설치한다.
 */
function nextSteps(starterPath: string, { inRepository, installed }: { inRepository: boolean; installed: boolean }) {
  const git = inRepository ? [] : ['git init', ...(installed ? ['npx lefthook install'] : [])]
  return [`cd ${starterPath}`, ...git, ...(installed ? [] : ['npm install']), 'npm run dev']
}

/**
 * Starter가 git 저장소 안에 있게 되었는지 돌려준다. create이면 저장소 밖일 때 Starter 디렉터리에 git 저장소를 만든다(git init).
 * 첫 커밋은 만들지 않는다(사용자의 git 이름·이메일 설정이 없을 수 있다). 기본 브랜치 이름은 사용자의 git 설정을 따른다.
 * 이미 git 저장소 안이면(모노레포 등) 새 저장소를 만들지 않는다. create가 아니어도(--skip-git) 저장소 안인지는 보아, 다음 단계
 * 안내가 바깥 저장소 안에 git init을 적지 않게 한다. git이 없거나 git init이 실패하면 경고만 하고 false를 돌려준다.
 * Starter는 이미 만들었으므로 실패로 끝내지 않고, 다음 단계에서 저장소를 만들도록 안내한다.
 */
function prepareGitRepository(target: string, { create }: { create: boolean }): boolean {
  const git = (args: readonly string[]) => spawnSync('git', args, { cwd: target, encoding: 'utf8' })
  const repository = git(['rev-parse', '--git-dir'])
  if (repository.error !== undefined) {
    if (create) {
      console.warn('\ngit을 찾지 못해 git 저장소를 만들지 않았습니다. git을 설치한 뒤 다음 단계대로 저장소를 만드세요.')
    }
    return false
  }
  if (repository.status === 0) {
    if (create) console.log('\n이미 git 저장소 안이라 새 git 저장소를 만들지 않았습니다.')
    return true
  }
  if (!create) return false
  // --quiet는 기본 브랜치 이름을 정하라는 git의 안내(hint)도 숨긴다.
  const created = git(['init', '--quiet'])
  if (created.status === 0) {
    console.log('\ngit 저장소를 만들었습니다(git init).')
    return true
  }
  console.warn(`\ngit init이 실패해 git 저장소를 만들지 않았습니다.\n${created.error?.message ?? created.stderr.trim()}`)
  return false
}

// 사용자가 고칠 수 있는 오류(만들 곳, Recipe·Archetype 조합)와 overlay를 덧입히지 못한 오류는 스택 없이 메시지만 보여 주고 끝낸다.
function exitWithMessage(command: Command, error: unknown): never {
  if (error instanceof TargetNotEmptyError || error instanceof SelectionError || error instanceof OverlayError) {
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
