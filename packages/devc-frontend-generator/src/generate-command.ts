import type { Command } from 'commander'
import { generateComponent } from './schematics/component.js'
import { generateMutation } from './schematics/mutation.js'
import { generateQuery } from './schematics/query.js'
import { type ChangedFile, SchematicError } from './schematics/starter-project.js'

/**
 * `dcgen g <schematic>`: Starter 안에서 Schematic으로 코드를 만든다. Schematic마다 하위 명령을 하나씩 둔다.
 * Starter에서는 `npm run g -- <schematic> ...`으로도 실행한다.
 */
export function registerGenerateCommand(program: Command): void {
  const generate = program.command('g').description('Starter 안에서 Schematic으로 코드를 만든다')

  generate
    .command('query')
    .description('OpenAPI operation의 쿼리 키와 queryOptions를 그 tag의 Query Domain(src/queries/<domain>)에 만든다')
    .argument('<operationId>', 'Starter 최상위 openapi.yaml의 operationId')
    .option('--infinite', '목록형 operation의 infiniteQueryOptions를 만든다')
    .option('--page-param <name>', '--infinite에서 페이지 번호로 쓸 쿼리 파라미터', 'page')
    .action(async (operationId: string, options: { infinite?: boolean; pageParam: string }, command: Command) => {
      const changed = await runSchematic(command, () =>
        generateQuery(process.cwd(), operationId, { infinite: options.infinite === true, pageParam: options.pageParam }),
      )
      report(`${operationId}의 쿼리 키와 queryOptions를 만들었습니다.`, changed)
    })

  generate
    .command('mutation')
    .description(
      'OpenAPI operation의 뮤테이션 훅을 그 tag의 Query Domain(src/queries/<domain>)에 만든다. 훅은 성공하면 Query Domain의 쿼리를 모두 무효화한다',
    )
    .argument('<operationId>', 'Starter 최상위 openapi.yaml의 operationId(POST, PUT, PATCH, DELETE)')
    .option(
      '--optimistic <queryOperationId>',
      '이 쿼리(같은 Query Domain의 queryOptions)의 캐시를 응답 전에 고치고, 실패하면 되돌리는 낙관적 업데이트 뼈대를 만든다',
    )
    .action(async (operationId: string, options: { optimistic?: string }, command: Command) => {
      const mutation = await runSchematic(command, () =>
        generateMutation(process.cwd(), operationId, { optimistic: options.optimistic }),
      )
      const optimistic =
        mutation.optimisticUpdateName === undefined
          ? ''
          : `\n응답 전에 보일 값은 ${mutation.optimisticUpdateName}에서 만듭니다. 지금은 캐시를 그대로 두므로 직접 채우세요.`
      report(`${operationId}의 뮤테이션 훅(${mutation.hookName})을 만들었습니다.${optimistic}`, mutation.changed)
    })

  generate
    .command('component')
    .description('컴포넌트와 Storybook 스토리, 테스트를 Feature(src/features/<feature>) 또는 공통 UI(src/shared/ui)에 만든다')
    .argument('<name>', '컴포넌트 이름(kebab-case 또는 PascalCase). 파일 이름은 kebab-case, 컴포넌트는 PascalCase가 된다')
    .option('--feature <feature>', '컴포넌트를 둘 Feature. src/features/<feature>/에 만든다')
    .option('--shared', '공통 UI(src/shared/ui/)에 만든다. --feature와 --shared 가운데 하나를 꼭 고른다')
    .action(async (name: string, options: { feature?: string; shared?: boolean }, command: Command) => {
      const changed = await runSchematic(command, () =>
        generateComponent(process.cwd(), name, { feature: options.feature, shared: options.shared === true }),
      )
      report(`${name} 컴포넌트와 스토리, 테스트를 만들었습니다.`, changed)
    })
}

/** Schematic을 실행한다. SchematicError는 스택 없이 알리고 실패 코드로 끝낸다. */
async function runSchematic<T>(command: Command, schematic: () => Promise<T>): Promise<T> {
  try {
    return await schematic()
  } catch (error) {
    if (error instanceof SchematicError) command.error(error.message)
    throw error
  }
}

function report(summary: string, changed: readonly ChangedFile[]): void {
  const lines = changed.map(({ path, created }) => `  ${created ? '만듦' : '고침'}  ${path}`)
  console.log([summary, ...lines].join('\n'))
}
