import { isMap, isScalar, isSeq, type Node, parseDocument, YAMLMap, YAMLSeq } from 'yaml'
import { OverlayError } from './overlay.js'

/** Starter의 OpenAPI 명세. overlay 최상위에 같은 이름으로 둔 파일은 이 명세에 병합할 명세 조각이다. */
export const OPENAPI_SPEC = 'openapi.yaml'

/** 명세 조각이 담을 수 있는 최상위 항목. info, servers, security처럼 명세 전체에 걸리는 값은 Base만 정한다. */
const FRAGMENT_KEYS = ['paths', 'components', 'tags']

// 명세의 원래 모양(따옴표, [a, b] 같은 흐름 표기, 긴 줄)을 그대로 두는 출력 설정
const STRINGIFY_OPTIONS = { lineWidth: 0, flowCollectionPadding: false }

export interface SpecFragment {
  /** 조각을 더한 overlay. 오류 메시지에 쓴다(예: 'Recipe auth'). */
  label: string
  text: string
}

/**
 * base 명세에 명세 조각을 차례로 병합한 명세를 돌려준다. 조각의 경로(paths), 컴포넌트(components의 스키마 등), tag는
 * base와 앞선 조각 뒤에 덧붙인다. 같은 경로, 같은 컴포넌트 이름, 같은 tag, 같은 operationId가 이미 있으면 병합하지 않고
 * 겹친 것을 모두 알리는 OverlayError를 던진다. 주석과 표기는 그대로 둔다.
 */
export function mergeOpenApiFragments(base: string, fragments: readonly SpecFragment[]): string {
  const spec = parseDocument(base)
  const root = spec.contents
  if (spec.errors.length > 0 || !isMap(root)) {
    throw new OverlayError(`Starter의 ${OPENAPI_SPEC}를 읽지 못했습니다: ${spec.errors[0]?.message ?? '최상위가 객체가 아닙니다.'}`)
  }
  const owners = new Map<string, string>()
  for (const name of definedNames(root, 'Base').names) owners.set(name, 'Base')

  const problems: string[] = []
  const parsed = fragments.map(({ label, text }) => {
    const fragment = parseDocument(text)
    const fail = (problem: string) => new OverlayError(`${label}: ${OPENAPI_SPEC}(명세 조각) ${problem}`)
    if (fragment.errors.length > 0) throw fail(`를 읽지 못했습니다: ${fragment.errors[0]?.message ?? ''}`)
    if (!isMap(fragment.contents)) throw fail(`의 최상위는 ${FRAGMENT_KEYS.join(', ')}를 담은 객체여야 합니다.`)
    const unknown = fragment.contents.items.map((pair) => keyOf(pair.key)).filter((key) => !FRAGMENT_KEYS.includes(key))
    if (unknown.length > 0) {
      throw fail(`에는 ${FRAGMENT_KEYS.join(', ')}만 담을 수 있습니다. 알 수 없는 항목: ${unknown.join(', ')}`)
    }

    const { names, invalid } = definedNames(fragment.contents, label)
    if (invalid.length > 0) throw fail(`의 모양이 잘못되었습니다: ${invalid.join(', ')}`)
    const collisions: string[] = []
    for (const name of names) {
      const owner = owners.get(name)
      if (owner === undefined) owners.set(name, label)
      else collisions.push(`${name}(${owner})`)
    }
    if (collisions.length > 0) problems.push(`${label}: ${collisions.join(', ')}`)
    return fragment.contents
  })
  if (problems.length > 0) {
    throw new OverlayError(
      [
        `명세 조각(${OPENAPI_SPEC})이 Base나 다른 Recipe의 명세와 겹쳐 병합할 수 없습니다. 겹친 이름을 바꾸세요.`,
        ...problems.map((problem) => `- ${problem}`),
      ].join('\n'),
    )
  }

  for (const fragment of parsed) {
    const paths = fragment.get('paths', true)
    if (isMap(paths)) appendPairs(childMap(root, 'paths'), paths)
    const components = fragment.get('components', true)
    if (isMap(components)) {
      for (const section of components.items) {
        if (isMap(section.value)) appendPairs(childMap(childMap(root, 'components'), keyOf(section.key)), section.value)
      }
    }
    const tags = fragment.get('tags', true)
    if (isSeq(tags)) appendItems(childSeq(root, 'tags'), tags)
  }
  return spec.toString(STRINGIFY_OPTIONS)
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']

/**
 * 명세(또는 조각)가 정의한 이름: `paths.<경로>`, `components.<종류>.<이름>`, `tags.<이름>`, `operationId <id>`.
 * 이 이름이 겹치면 병합할 수 없다. 모양이 잘못된 항목은 invalid에 담는다.
 */
function definedNames(contents: unknown, label: string): { names: string[]; invalid: string[] } {
  const names: string[] = []
  const invalid: string[] = []
  if (!isMap(contents)) return { names, invalid: [`${label}의 최상위가 객체가 아닙니다`] }

  const paths = contents.get('paths', true)
  if (paths !== undefined && !isMap(paths)) invalid.push('paths는 객체여야 합니다')
  for (const { key, value } of isMap(paths) ? paths.items : []) {
    names.push(`paths.${templatedPath(keyOf(key))}`)
    for (const { key: method, value: operation } of isMap(value) ? value.items : []) {
      if (!HTTP_METHODS.includes(keyOf(method)) || !isMap(operation)) continue
      const operationId = operation.get('operationId')
      if (typeof operationId === 'string') names.push(`operationId ${operationId}`)
    }
  }

  const components = contents.get('components', true)
  if (components !== undefined && !isMap(components)) invalid.push('components는 객체여야 합니다')
  for (const { key: section, value } of isMap(components) ? components.items : []) {
    if (!isMap(value)) {
      invalid.push(`components.${keyOf(section)}는 객체여야 합니다`)
      continue
    }
    for (const { key } of value.items) names.push(`components.${keyOf(section)}.${keyOf(key)}`)
  }

  const tags = contents.get('tags', true)
  if (tags !== undefined && !isSeq(tags)) invalid.push('tags는 배열이어야 합니다')
  for (const tag of isSeq(tags) ? tags.items : []) {
    const name = isMap(tag) ? tag.get('name') : undefined
    if (typeof name === 'string') names.push(`tags.${name}`)
    else invalid.push('tags의 항목에는 name이 있어야 합니다')
  }
  return { names, invalid }
}

// `/betas/{betaId}`와 `/betas/{id}`는 OpenAPI에서 같은 경로이므로 경로 변수의 이름을 지우고 비교한다.
function templatedPath(path: string): string {
  return path.replace(/\{[^}]*\}/g, '{}')
}

function keyOf(key: unknown): string {
  return String(isScalar(key) ? key.value : key)
}

/** parent의 key 항목(객체). 없으면 빈 객체를 만들어 끝에 더한다. */
function childMap(parent: YAMLMap, key: string): YAMLMap {
  const child = parent.get(key, true)
  if (isMap(child)) return child
  const created = new YAMLMap()
  parent.set(key, created)
  return created
}

function childSeq(parent: YAMLMap, key: string): YAMLSeq {
  const child = parent.get(key, true)
  if (isSeq(child)) return child
  const created = new YAMLSeq()
  parent.set(key, created)
  return created
}

// 조각의 첫 항목 위에 적은 주석은 항목이 아니라 그 항목을 담은 객체·배열에 붙어 있으므로, 옮길 때 첫 항목으로 넘긴다.
function appendPairs(target: YAMLMap, source: YAMLMap): void {
  const [first] = source.items
  if (first !== undefined && isScalar(first.key)) moveCommentBefore(source, first.key)
  target.items.push(...source.items)
}

function appendItems(target: YAMLSeq, source: YAMLSeq): void {
  const [first] = source.items
  if (first !== undefined && isNode(first)) moveCommentBefore(source, first)
  target.items.push(...source.items)
}

function moveCommentBefore(from: YAMLMap | YAMLSeq, to: Node): void {
  if (from.commentBefore === undefined || from.commentBefore === null) return
  to.commentBefore = to.commentBefore ? `${from.commentBefore}\n${to.commentBefore}` : from.commentBefore
  from.commentBefore = null
}

function isNode(value: unknown): value is Node {
  return isMap(value) || isSeq(value) || isScalar(value)
}
