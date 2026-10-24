import type { OpenAPIV3 } from 'openapi-types'
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
  QUERY_PARAMS_ARGUMENT,
  SchematicError,
  StarterProject,
  successSchema,
} from './starter-project.js'

export interface QuerySchematicOptions {
  /** 목록형 operation의 infiniteQueryOptions를 만든다. */
  infinite: boolean
  /** infinite에서 페이지 번호로 쓸 쿼리 파라미터 */
  pageParam: string
}

/** 만들 쿼리 하나. 쿼리 키 모듈에 넣을 키와 쿼리 모듈에 넣을 queryOptions 함수다. */
interface Query {
  keyName: string
  keyInitializer: string
  optionsFactory: 'queryOptions' | 'infiniteQueryOptions'
  optionsName: string
  optionsDeclaration: string
}

/**
 * `query` Schematic. OpenAPI operation 하나의 계층형 쿼리 키와 queryOptions(또는 infiniteQueryOptions)를
 * operation의 tag로 정한 Query Domain의 쿼리 키 모듈과 쿼리 모듈에 끼워 넣는다. 모듈이 없으면 만든다.
 */
export async function generateQuery(
  cwd: string,
  operationId: string,
  options: QuerySchematicOptions,
): Promise<ChangedFile[]> {
  const starter = StarterProject.open(cwd)
  const operation = await starter.findOperation(operationId)
  if (operation.method !== 'get') {
    throw new SchematicError(
      `query Schematic은 GET operation으로만 만듭니다. ${operationId}는 ${operation.method.toUpperCase()} operation입니다.`,
    )
  }
  const domain = queryDomainOf(operation)
  const fetcher = starter.generatedFunction(operation)
  const { keysName } = domain
  const { name } = fetcher
  let query: Query
  if (!options.infinite) {
    const args = fetcher.parameters.map((parameter) => parameter.name)
    const optionsName = queryOptionsName(fetcher, 'query')
    query = {
      keyName: name,
      keyInitializer: `(${keyParameters(fetcher.parameters)}) => [...${keysName}.all, ${[`'${name}'`, ...args].join(', ')}] as const`,
      optionsFactory: 'queryOptions',
      optionsName,
      optionsDeclaration: `export function ${optionsName}(${queryOptionsParameters(fetcher.parameters)}) {
  return queryOptions({
    queryKey: ${keysName}.${name}(${args.join(', ')}),
    queryFn: ({ signal }) => ${name}(${[...args, '{ signal }'].join(', ')}),
  })
}`,
    }
  } else {
    // infiniteQueryOptions를 만들 수 있는 목록형 operation인지 보고, 페이지 번호로 쓸 쿼리 파라미터를 찾는다.
    const pageParam = options.pageParam
    if (successSchema(operation)?.type !== 'array') {
      throw new SchematicError(
        `--infinite는 배열을 돌려주는 목록형 operation에만 쓸 수 있습니다. ${operationId}의 응답은 배열이 아닙니다.`,
      )
    }
    const parameter = operation.parameters.findLast((candidate) => candidate.in === 'query' && candidate.name === pageParam)
    if (parameter === undefined) {
      throw new SchematicError(
        `${operationId}에 '${pageParam}' 쿼리 파라미터가 없습니다. 페이지 번호로 쓸 쿼리 파라미터를 --page-param으로 지정하세요.`,
      )
    }
    const schema = parameter.schema as OpenAPIV3.SchemaObject | undefined
    if (schema?.type !== 'integer' && schema?.type !== 'number') {
      throw new SchematicError(`${operationId}의 '${pageParam}' 쿼리 파라미터는 숫자가 아니어서 페이지 번호로 쓸 수 없습니다.`)
    }
    // 첫 페이지 번호는 명세의 기본값, 없으면 최솟값을 따르고, 둘 다 없으면 1이다.
    const initialPage = ([schema.default, schema.minimum].find((value) => typeof value === 'number') as number | undefined) ?? 1

    // 페이지 번호를 하나씩 늘려 다음 페이지를 가져온다. 페이지 번호는 fetch 함수의 쿼리 파라미터 객체 인자에 담는다.
    // 같은 operation의 queryOptions와 캐시가 섞이지 않도록 키에 'infinite' 단계를 더한다.
    const parameters = fetcher.parameters.map((candidate) =>
      candidate.name === QUERY_PARAMS_ARGUMENT
        ? { ...candidate, type: `Omit<${candidate.type}, '${pageParam}'>` }
        : candidate,
    )
    const args = parameters.map((candidate) => candidate.name)
    const fetchArgs = args.map((arg) => (arg === QUERY_PARAMS_ARGUMENT ? `{ ...${arg}, ${pageParam}: pageParam }` : arg))
    const keyName = `${name}Infinite`
    const optionsName = queryOptionsName(fetcher, 'infinite')
    query = {
      keyName,
      keyInitializer: `(${keyParameters(parameters)}) => [...${keysName}.all, ${[`'${name}'`, `'infinite'`, ...args].join(', ')}] as const`,
      optionsFactory: 'infiniteQueryOptions',
      optionsName,
      optionsDeclaration: `export function ${optionsName}(${queryOptionsParameters(parameters)}) {
  return infiniteQueryOptions({
    queryKey: ${keysName}.${keyName}(${args.join(', ')}),
    queryFn: ({ pageParam, signal }) => ${name}(${[...fetchArgs, '{ signal }'].join(', ')}),
    initialPageParam: ${String(initialPage)},
    // 빈 페이지를 받으면 다음 페이지가 없다고 본다. 백엔드가 다음 페이지 정보를 함께 주면 그 값을 쓰도록 고친다.
    getNextPageParam: (lastPage, _allPages, lastPageParam) => (lastPage.length === 0 ? undefined : lastPageParam + 1),
  })
}`,
    }
  }

  const { keysModule, keys, queriesModule } = openQueryDomain(starter, domain)
  rejectConflicts([
    keys.getProperty(query.keyName) !== undefined && `${domain.keysPath}: ${keysName}.${query.keyName}`,
    hasDeclaration(queriesModule, query.optionsName) && `${domain.queriesPath}: ${query.optionsName}`,
  ])

  // 키와 queryOptions는 fetch 함수와 같은 인자를 받으므로 인자 타입을 두 모듈 모두 가져온다.
  for (const typeImport of fetcher.typeImports) addNamedImport(keysModule, { ...typeImport, typeOnly: true })
  keys.addPropertyAssignment({ name: query.keyName, initializer: query.keyInitializer })

  addNamedImport(queriesModule, { name: query.optionsFactory, moduleSpecifier: '@tanstack/react-query' })
  addNamedImport(queriesModule, { name: fetcher.name, moduleSpecifier: GENERATED_API_IMPORT })
  for (const typeImport of fetcher.typeImports) addNamedImport(queriesModule, { ...typeImport, typeOnly: true })
  addNamedImport(queriesModule, { name: keysName, moduleSpecifier: `./${domain.name}.keys` })
  queriesModule.addStatements(`\n${query.optionsDeclaration}`)

  return starter.save()
}

// 키는 인자를 모두 받는다. 인자가 빠지면 서로 다른 요청이 같은 키를 쓰게 된다.
function keyParameters(parameters: GeneratedFunction['parameters']): string {
  return parameters.map(({ name, type }) => `${name}: ${type}`).join(', ')
}
