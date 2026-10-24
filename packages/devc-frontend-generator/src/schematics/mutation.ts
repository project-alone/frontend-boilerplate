import { upperFirst } from '../utils/names.js'
import {
  openQueryDomain,
  queryDomainOf,
  queryOptionsName,
  queryOptionsParameters,
  rejectConflicts,
} from './query-domain.js'
import {
  addNamedImport,
  type ChangedFile,
  GENERATED_API_IMPORT,
  type GeneratedFunction,
  hasDeclaration,
  type Operation,
  SchematicError,
  StarterProject,
  type TypeImport,
} from './starter-project.js'

// 서버의 상태를 바꾸는 operation. 뮤테이션 훅은 이 메서드의 operation으로만 만든다.
const MUTATION_METHODS: readonly Operation['method'][] = ['post', 'put', 'patch', 'delete']

export interface MutationSchematicOptions {
  /** 응답을 기다리지 않고 캐시를 고칠 쿼리의 operationId. 있으면 낙관적 업데이트 뼈대를 만든다. */
  optimistic?: string | undefined
}

/** 만든 뮤테이션 훅 */
export interface GeneratedMutation {
  hookName: string
  /** --optimistic에서 응답 전에 보일 값을 만드는 함수. 만든 직후에는 캐시를 그대로 두므로 개발자가 채운다. */
  optimisticUpdateName: string | undefined
  changed: ChangedFile[]
}

/** 쿼리 모듈에 더할 코드 */
interface MutationCode {
  hookName: string
  optimisticUpdateName: string | undefined
  /** 코드가 쓰는 타입 이름의 import */
  typeImports: TypeImport[]
  source: string
}

/** --optimistic으로 캐시를 고칠 쿼리 */
interface OptimisticTarget {
  operationId: string
  fetcher: GeneratedFunction
  /** 쿼리 모듈에 먼저 있어야 하는 그 쿼리의 queryOptions 함수 */
  optionsName: string
}

/**
 * `mutation` Schematic. OpenAPI operation 하나의 뮤테이션 훅(use<OperationId>Mutation)을 operation의 tag로 정한
 * Query Domain의 쿼리 모듈에 끼워 넣는다. 모듈이 없으면 쿼리 키 모듈과 함께 만든다.
 * 훅은 Query Domain의 쿼리를 모두(<domain>Keys.all) 무효화한다(ADR-0008). --optimistic이면 지정한 쿼리의 캐시를
 * 응답 전에 고치고 실패하면 되돌리는 뼈대를 더한다.
 */
export async function generateMutation(
  cwd: string,
  operationId: string,
  options: MutationSchematicOptions,
): Promise<GeneratedMutation> {
  const starter = StarterProject.open(cwd)
  const operation = await starter.findOperation(operationId)
  if (!MUTATION_METHODS.includes(operation.method)) {
    throw new SchematicError(
      `mutation Schematic은 POST, PUT, PATCH, DELETE operation으로만 만듭니다. ${operationId}는 ${operation.method.toUpperCase()} operation입니다.`,
    )
  }
  const domain = queryDomainOf(operation)
  const fetcher = starter.generatedFunction(operation)
  const hookName = mutationHookName(fetcher)
  // 뮤테이션의 인자. fetch 함수의 인자(요청 옵션 제외)가 하나면 그 값을, 여럿이면 인자 이름을 키로 한 객체를 mutate에 넘긴다.
  const argumentNames = fetcher.parameters.map((parameter) => parameter.name)
  const [single] = fetcher.parameters
  let variables: Variables
  if (fetcher.parameters.length <= 1) {
    const declaration = single === undefined ? '' : `${single.name}${single.optional ? '?' : ''}: ${single.type}`
    variables = {
      declaration,
      arguments: argumentNames.join(', '),
      input: single === undefined ? undefined : { name: single.name, declaration },
    }
  } else {
    const type = `{ ${fetcher.parameters.map(({ name, type, optional }) => `${name}${optional ? '?' : ''}: ${type}`).join('; ')} }`
    variables = {
      declaration: `{ ${argumentNames.join(', ')} }: ${type}`,
      arguments: argumentNames.join(', '),
      input: { name: 'variables', declaration: `variables: ${type}` },
    }
  }
  let target: OptimisticTarget | undefined
  let code: MutationCode
  if (options.optimistic === undefined) {
    code = {
      hookName,
      optimisticUpdateName: undefined,
      typeImports: fetcher.typeImports,
      source: `export function ${hookName}() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (${variables.declaration}) => ${fetcher.name}(${variables.arguments}),
    // 성공하면 ${domain.name} Query Domain의 쿼리를 모두 무효화한다. 범위를 좁히려면 [...${domain.keysName}.all, '<operationId>']를 넘긴다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ${domain.keysName}.all }),
  })
}`,
    }
  } else {
    // --optimistic이 가리키는 쿼리를 찾는다. 같은 Query Domain의 GET operation이어야 한다.
    const targetOperation = await starter.findOperation(options.optimistic)
    if (targetOperation.method !== 'get') {
      throw new SchematicError(
        `--optimistic에는 응답 전에 고칠 쿼리의 GET operation을 지정합니다. ${options.optimistic}는 ${targetOperation.method.toUpperCase()} operation입니다.`,
      )
    }
    const targetDomain = queryDomainOf(targetOperation)
    if (targetDomain.name !== domain.name) {
      throw new SchematicError(
        `--optimistic에는 같은 Query Domain(${domain.name})의 쿼리를 지정합니다. ${options.optimistic}는 ${targetDomain.name} Query Domain의 operation입니다.`,
      )
    }
    const targetFetcher = starter.generatedFunction(targetOperation)
    target = {
      operationId: options.optimistic,
      fetcher: targetFetcher,
      optionsName: queryOptionsName(targetFetcher, 'query'),
    }

    // 응답 전에 target 쿼리의 캐시를 고치고(onMutate), 실패하면 되돌리고(onError), 끝나면 성공·실패와 상관없이
    // Query Domain의 쿼리를 모두 무효화해 서버의 값으로 맞춘다(onSettled). 훅은 고칠 쿼리의 인자를 받고,
    // 고친 값은 apply<OperationId> 함수가 그 쿼리의 데이터와 mutate에 넘긴 값으로 만든다.
    const updateName = `apply${upperFirst(fetcher.name)}`
    const { input } = variables
    const data = targetFetcher.data.type
    const targetName = targetFetcher.name
    const targetArguments = targetFetcher.parameters.map((parameter) => parameter.name).join(', ')
    code = {
      hookName,
      optimisticUpdateName: updateName,
      typeImports: [...fetcher.typeImports, ...targetFetcher.typeImports, ...targetFetcher.data.typeImports],
      source: `// ${fetcher.name}의 응답이 오기 전에 ${targetName} 쿼리에 보일 값(낙관적 업데이트). 보낸 값으로 응답 뒤의 값을 짐작해 돌려주도록 고친다.
// 지금은 캐시를 그대로 두므로, 응답 뒤에 쿼리를 다시 가져와야 화면이 바뀐다.
const ${updateName}: (current: ${data}${input === undefined ? '' : `, ${input.declaration}`}) => ${data} = (current) => current

export function ${hookName}(${queryOptionsParameters(targetFetcher.parameters)}) {
  const queryClient = useQueryClient()
  // 응답 전에 고칠 ${targetName} 쿼리.${targetArguments === '' ? '' : ' 화면이 보고 있는 쿼리와 같은 인자를 훅에 넘긴다.'}
  const { queryKey } = ${target.optionsName}(${targetArguments})
  return useMutation({
    mutationFn: (${variables.declaration}) => ${fetcher.name}(${variables.arguments}),
    onMutate: async (${input?.name ?? ''}) => {
      // 진행 중인 ${targetName} 요청의 응답이 고친 값을 덮어쓰지 않도록 취소하고, 되돌릴 값을 남긴다.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (current) =>
        current === undefined ? undefined : ${updateName}(${['current', ...(input === undefined ? [] : [input.name])].join(', ')}),
      )
      return { previous }
    },
    onError: (_error, _${input?.name ?? 'variables'}, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
    // 성공하든 실패하든 ${domain.name} Query Domain의 쿼리를 모두 무효화해 서버의 값으로 맞춘다.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ${domain.keysName}.all }),
  })
}`,
    }
  }

  const { queriesModule } = openQueryDomain(starter, domain)
  rejectConflicts(
    [code.hookName, code.optimisticUpdateName].map(
      (name) => name !== undefined && hasDeclaration(queriesModule, name) && `${domain.queriesPath}: ${name}`,
    ),
  )
  if (target !== undefined && !hasDeclaration(queriesModule, target.optionsName)) {
    throw new SchematicError(
      `${domain.queriesPath}에 ${target.optionsName}가 없어 --optimistic으로 고칠 쿼리를 찾지 못했습니다. 먼저 npm run g -- query ${target.operationId}로 만드세요.`,
    )
  }

  for (const name of ['useMutation', 'useQueryClient']) {
    addNamedImport(queriesModule, { name, moduleSpecifier: '@tanstack/react-query' })
  }
  addNamedImport(queriesModule, { name: fetcher.name, moduleSpecifier: GENERATED_API_IMPORT })
  for (const typeImport of code.typeImports) addNamedImport(queriesModule, { ...typeImport, typeOnly: true })
  addNamedImport(queriesModule, { name: domain.keysName, moduleSpecifier: `./${domain.name}.keys` })
  queriesModule.addStatements(`\n${code.source}`)

  return { hookName: code.hookName, optimisticUpdateName: code.optimisticUpdateName, changed: await starter.save() }
}

/** operation의 뮤테이션 훅(use<OperationId>Mutation)의 이름. form Schematic이 폼과 이을 훅을 찾을 때도 쓴다. */
export function mutationHookName(fetcher: GeneratedFunction): string {
  return `use${upperFirst(fetcher.name)}Mutation`
}

/** 뮤테이션의 인자(mutate에 넘기는 값) */
interface Variables {
  /** mutationFn의 인자 선언. fetch 함수의 인자가 여럿이면 객체 하나로 받는다. */
  declaration: string
  /** mutationFn이 fetch 함수에 넘기는 인자 */
  arguments: string
  /** mutate에 넘긴 값 전체를 onMutate와 낙관적 업데이트 함수가 받는 이름과 그 선언. 인자가 없으면 undefined */
  input: { name: string; declaration: string } | undefined
}
