import type { Command } from 'commander'
import { generateComponent } from './schematics/component.js'
import { generateForm } from './schematics/form.js'
import { generateMutation } from './schematics/mutation.js'
import { generatePage, PAGE_MODES } from './schematics/page.js'
import { generateQuery } from './schematics/query.js'
import { type ChangedFile, SchematicError } from './schematics/starter-project.js'
import { generateStory } from './schematics/story.js'

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
    .command('form')
    .description(
      'OpenAPI operation의 JSON 요청 본문을 입력받는 폼과 테스트를 Feature(src/features/<feature>)에 만든다. 폼은 요청 본문의 Zod 스키마로 검증하고 뮤테이션 훅으로 보낸다',
    )
    .argument('<operationId>', 'Starter 최상위 openapi.yaml의 operationId. 뮤테이션 훅(npm run g -- mutation)이 먼저 있어야 한다')
    .option('--feature <feature>', '폼을 둘 Feature. src/features/<feature>/에 만든다')
    .action(async (operationId: string, options: { feature?: string }, command: Command) => {
      const form = await runSchematic(command, () =>
        generateForm(process.cwd(), operationId, { feature: options.feature }),
      )
      const skipped =
        form.skippedFields.length === 0
          ? ''
          : `\n입력 요소로 만들지 않은 선택 필드: ${form.skippedFields.join(', ')}. 보내야 하면 폼에 직접 더하세요.`
      const hookArguments =
        form.hookArguments.length === 0
          ? ''
          : `\n폼은 뮤테이션 훅(${form.hookName})의 인자(${form.hookArguments.join(', ')})도 props로 받아 훅에 넘깁니다. 훅이 응답 전에 고칠 쿼리의 인자이므로 화면이 보고 있는 쿼리와 같은 값을 넘기세요.`
      report(
        `${operationId}의 폼(${form.componentName})과 테스트를 만들었습니다.${skipped}${hookArguments}`,
        form.changed,
      )
    })

  generate
    .command('page')
    .description(
      '라우트(src/app/<route>)에 페이지와 로딩·오류 상태, 메타데이터를 만들고 라우트의 Rendering Mode를 고른다. 앞서 만든 쿼리와 폼을 끼워 넣는다',
    )
    .argument(
      '<route>',
      'src/app 아래 라우트(예: products/new, products/[productId]). 세그먼트는 kebab-case, 동적 세그먼트는 [이름], 경로 그룹은 (이름)',
    )
    .option(
      '--mode <mode>',
      `라우트의 Rendering Mode: ${PAGE_MODES.join(', ')}. 기본은 server Starter에서 ssr, static-export Starter에서 csr(static-export는 ssg, csr만)`,
    )
    .option(
      '--query <operationId>',
      '이 GET operation의 queryOptions(npm run g -- query)로 데이터를 가져와 보여 준다. 결과를 보여 줄 컴포넌트는 --feature에 만든다',
    )
    .option('--form <operationId>', '이 operation의 폼(npm run g -- form)을 페이지에 넣는다')
    .option(
      '--feature <feature>',
      '--query의 결과를 보여 줄 컴포넌트를 둘 Feature. --form의 폼이 여러 Feature에 있으면 이 Feature의 폼을 쓴다',
    )
    .action(
      async (
        route: string,
        options: { mode?: string; query?: string; form?: string; feature?: string },
        command: Command,
      ) => {
        const page = await runSchematic(command, () =>
          generatePage(process.cwd(), route, {
            mode: options.mode,
            query: options.query,
            form: options.form,
            feature: options.feature,
          }),
        )
        const notes = [
          ...(page.view?.reused === true ? [`Feature에 있던 ${page.view.name}(${page.view.path})를 씁니다.`] : []),
          ...(page.fetchesAtBuild
            ? [
                '빌드할 때 서버 컴포넌트가 백엔드에서 데이터를 가져오므로, 배포용 빌드에는 API_BASE_URL(백엔드 주소)을 넣으세요. GitLab CI의 build 잡처럼 API_MOCKING=enabled로 빌드하면 MSW가 응답하며, 그 결과는 배포하지 않습니다.',
              ]
            : []),
        ]
        report(
          [`${page.path} 페이지(${page.modeLabel})와 로딩·오류 상태를 만들었습니다.`, ...notes].join('\n'),
          page.changed,
        )
      },
    )

  generate
    .command('component')
    .description('컴포넌트와 테스트를 Feature(src/features/<feature>) 또는 공통 UI(src/shared/ui)에 만든다')
    .argument('<name>', '컴포넌트 이름(kebab-case 또는 PascalCase). 파일 이름은 kebab-case, 컴포넌트는 PascalCase가 된다')
    .option('--feature <feature>', '컴포넌트를 둘 Feature. src/features/<feature>/에 만든다')
    .option('--shared', '공통 UI(src/shared/ui/)에 만든다. --feature와 --shared 가운데 하나를 꼭 고른다')
    .action(async (name: string, options: { feature?: string; shared?: boolean }, command: Command) => {
      const changed = await runSchematic(command, () =>
        generateComponent(process.cwd(), name, { feature: options.feature, shared: options.shared === true }),
      )
      report(`${name} 컴포넌트와 테스트를 만들었습니다.`, changed)
    })

  generate
    .command('story')
    .description(
      '컴포넌트의 Storybook 스토리를 컴포넌트 옆에 만든다. Starter에 Storybook이 없으면 먼저 Storybook을 더하고 의존성을 설치한다',
    )
    .argument('<file>', '스토리를 만들 컴포넌트 파일(현재 디렉터리 기준, 예: src/features/orders/order-summary.tsx)')
    .option('--component <name>', '파일이 내보내는 컴포넌트가 여럿일 때 스토리를 만들 컴포넌트(예: FieldLabel)')
    .option('--skip-install', 'Storybook을 더할 때 npm install을 하지 않는다')
    .action(async (file: string, options: { component?: string; skipInstall?: boolean }, command: Command) => {
      const story = await runSchematic(command, () =>
        generateStory(process.cwd(), file, { component: options.component, skipInstall: options.skipInstall === true }),
      )
      const notes = [
        ...(story.storybookAdded ? ['Starter에 Storybook을 더했습니다(README의 "Storybook").'] : []),
        `${story.componentName}의 스토리를 만들었습니다.`,
        ...story.skipped,
        ...(story.fetchesData
          ? [
              `${story.componentName}의 파일은 TanStack Query로 데이터를 가져옵니다. Storybook에는 백엔드가 없으므로 요청이 실패한 화면이 보입니다. 보여 줄 데이터는 스토리에서 QueryClient에 넣어 정하세요(README의 "Storybook").`,
            ]
          : []),
      ]
      report(notes.join('\n'), story.changed)
      const steps = [
        ...(story.storybookAdded && !story.installed ? ['npm install'] : []),
        'npm run storybook',
        'npm run test:storybook',
      ]
      console.log(`\n다음 단계:\n\n${steps.map((step) => `  ${step}`).join('\n')}\n`)
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
