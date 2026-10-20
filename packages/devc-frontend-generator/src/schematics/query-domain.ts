import { type ObjectLiteralExpression, type SourceFile, SyntaxKind } from 'ts-morph'
import { camelCase, kebabCase, splitWords } from './names.js'
import { type GeneratedFunction, type Operation, SchematicError, type StarterProject } from './starter-project.js'

const QUERIES_DIR = 'src/queries'

/** operation의 OpenAPI tag로 정한 Query Domain. 코드는 src/queries/<name>/<name>.keys.ts와 <name>.queries.ts에 모인다. */
export interface QueryDomain {
  /** tag를 kebab-case로 바꾼 이름. 폴더·파일 이름과 쿼리 키의 첫 단계로 쓴다. */
  name: string
  tag: string
  /** 쿼리 키 객체의 이름(<camelCase 이름>Keys) */
  keysName: string
  /** 쿼리 키 모듈. Starter 최상위 기준이다. */
  keysPath: string
  /** 쿼리 모듈. Starter 최상위 기준이다. */
  queriesPath: string
}

/** operation의 첫 번째 OpenAPI tag(orval의 tags-split과 같다)를 kebab-case로 바꿔 Query Domain을 정한다. */
export function queryDomainOf(operation: Operation): QueryDomain {
  const tag = operation.definition.tags?.[0]
  if (tag === undefined) {
    throw new SchematicError(`${operation.operationId}에 OpenAPI tag가 없어 Query Domain을 정할 수 없습니다.`)
  }
  const words = splitWords(tag)
  if (words.length === 0 || /^\d/.test(words[0] ?? '')) {
    throw new SchematicError(`OpenAPI tag '${tag}'로는 Query Domain 이름을 만들 수 없습니다. 영문자로 시작하는 tag를 쓰세요.`)
  }
  const name = kebabCase(words)
  const directory = `${QUERIES_DIR}/${name}`
  return {
    name,
    tag,
    keysName: `${camelCase(words)}Keys`,
    keysPath: `${directory}/${name}.keys.ts`,
    queriesPath: `${directory}/${name}.queries.ts`,
  }
}

/** Query Domain의 쿼리 키 모듈과 쿼리 모듈 */
export interface QueryDomainModules {
  keysModule: SourceFile
  /** 쿼리 키 모듈의 쿼리 키 객체(<domain>Keys) */
  keys: ObjectLiteralExpression
  queriesModule: SourceFile
}

/** Query Domain의 쿼리 키 모듈과 쿼리 모듈을 연다. 없으면 새로 만든다(StarterProject.module과 같이 save 전에는 쓰지 않는다). */
export function openQueryDomain(starter: StarterProject, domain: QueryDomain): QueryDomainModules {
  const keysModule = starter.module(domain.keysPath, newKeysModule(domain))
  const queriesModule = starter.module(domain.queriesPath, newQueriesModule(domain))
  return { keysModule, keys: keysObject(keysModule, domain), queriesModule }
}

/** operation의 queryOptions 함수(<operationId>QueryOptions) 또는 infiniteQueryOptions 함수의 이름(ADR-0008) */
export function queryOptionsName(fetcher: GeneratedFunction, kind: 'query' | 'infinite'): string {
  return `${fetcher.name}${kind === 'infinite' ? 'InfiniteQueryOptions' : 'QueryOptions'}`
}

/**
 * queryOptions 함수(그리고 그 쿼리를 고치는 낙관적 업데이트 뮤테이션 훅)가 받는 인자의 선언. fetch 함수와 같은 인자를 받되,
 * 생략할 수 있는 인자(쿼리 파라미터 객체)는 빈 객체를 기본값으로 둬 생략해도 쿼리 키가 늘 같다.
 */
export function queryOptionsParameters(parameters: GeneratedFunction['parameters']): string {
  return parameters.map(({ name, type, optional }) => `${name}: ${type}${optional ? ' = {}' : ''}`).join(', ')
}

/** 모듈에 name이라는 함수나 변수가 이미 있는지 본다. */
export function hasDeclaration(file: SourceFile, name: string): boolean {
  return file.getFunction(name) !== undefined || file.getVariableDeclaration(name) !== undefined
}

/** 만들려는 코드와 이름이 겹치는 기존 코드('<파일>: <이름>')가 있으면 아무 파일도 바꾸지 않고 멈춘다. */
export function rejectConflicts(conflicts: readonly (string | false | undefined)[]): void {
  const found = conflicts.filter((conflict) => typeof conflict === 'string')
  if (found.length === 0) return
  throw new SchematicError(
    `같은 이름의 코드가 이미 있어 덮어쓰지 않았습니다. 파일은 바꾸지 않았습니다.\n${found.map((conflict) => `  ${conflict}`).join('\n')}`,
  )
}

/** 쿼리 키 모듈이 없을 때 새로 만드는 모듈의 처음 내용 */
function newKeysModule({ name, tag, keysName }: QueryDomain): string {
  return `// ${name} Query Domain(OpenAPI tag \`${tag}\`)의 쿼리 키. 위 단계의 키로 아래 단계를 한꺼번에 무효화할 수 있게
// ['${name}'] → ['${name}', <operationId>] → ['${name}', <operationId>, ...인자]처럼 계층으로 만든다.
export const ${keysName} = {
  all: ['${name}'] as const,
}
`
}

/** 쿼리 모듈이 없을 때 새로 만드는 모듈의 처음 내용 */
function newQueriesModule({ name }: QueryDomain): string {
  return `// ${name} Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.
`
}

function keysObject(file: SourceFile, { keysName, keysPath }: QueryDomain): ObjectLiteralExpression {
  const keys = file.getVariableDeclaration(keysName)?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)
  if (keys === undefined) {
    throw new SchematicError(`${keysPath}에 ${keysName} 쿼리 키 객체가 없어 쿼리 키를 끼워 넣을 수 없습니다.`)
  }
  return keys
}
