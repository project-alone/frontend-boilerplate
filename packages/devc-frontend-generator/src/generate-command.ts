import type { Command } from 'commander'
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
}

/** Schematic을 실행한다. SchematicError는 스택 없이 알리고 실패 코드로 끝낸다. */
async function runSchematic(command: Command, schematic: () => Promise<ChangedFile[]>): Promise<ChangedFile[]> {
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
