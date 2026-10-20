import { camelCase, kebabCase, splitWords } from './names.js'
import { type Operation, SchematicError } from './starter-project.js'

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
