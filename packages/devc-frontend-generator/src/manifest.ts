import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isRenderingMode, RENDERING_MODES, type RenderingMode } from './rendering-mode.js'

// Generator가 읽는 JSON 선언 파일(recipe.json, archetype.json, extensions.json, package.json)의 값을 검사할 때 함께 쓰는 것.
// Recipe와 Archetype의 선언 파일은 같은 방법으로 읽는다(docs/recipes.md, docs/archetypes.md).

/** Recipe나 Archetype의 선언 파일(recipe.json, archetype.json)이 잘못되었다. Generator를 고쳐야 하는 오류다. */
export class DefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DefinitionError'
  }
}

/** Recipe나 Archetype의 선언 파일 하나. 최상위가 객체이고, 알 수 없는 항목이 없고, description이 있음을 확인했다. */
export interface Manifest {
  /** overlay 디렉터리의 이름(Recipe·Archetype의 이름) */
  name: string
  /** overlay 디렉터리 */
  dir: string
  /** `dcgen new`의 선택지에 보이는 한 줄 설명 */
  description: string
  /** 선언 파일의 항목 */
  fields: Record<string, unknown>
  /** 이 선언 파일의 문제를 알리는 DefinitionError를 만든다. */
  fail: (problem: string) => DefinitionError
}

/**
 * Generator 패키지의 kind 디렉터리(recipes, archetypes)에 담긴 overlay마다 최상위의 선언 파일(file)을 읽어 parse로 바꾸고
 * 이름순으로 돌려준다. 디렉터리가 없으면 빈 배열이다. 선언 파일의 최상위가 객체가 아니거나, keys에 없는 항목이 있거나,
 * description이 없으면 DefinitionError를 던진다. parse도 선언이 잘못되었으면 Manifest.fail로 DefinitionError를 던진다.
 */
export async function loadManifests<T extends { name: string }>(
  kind: 'recipes' | 'archetypes',
  file: string,
  keys: readonly string[],
  parse: (manifest: Manifest) => T,
): Promise<T[]> {
  const directory = fileURLToPath(new URL(`../${kind}`, import.meta.url))
  if (!existsSync(directory)) return []
  const entries = await readdir(directory, { withFileTypes: true })
  const parsed = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async ({ name }) => {
        const dir = join(directory, name)
        const fields: unknown = JSON.parse(await readFile(join(dir, file), 'utf8'))
        const fail = (problem: string) => new DefinitionError(`${kind}/${name}/${file}: ${problem}`)
        if (!isRecord(fields)) throw fail('최상위는 객체여야 합니다.')
        const unknownKeys = Object.keys(fields).filter((key) => !keys.includes(key))
        if (unknownKeys.length > 0) throw fail(`알 수 없는 항목입니다: ${unknownKeys.join(', ')}`)
        const { description } = fields
        if (typeof description !== 'string' || description === '') throw fail('description(한 줄 설명)이 필요합니다.')
        return parse({ name, dir, description, fields, fail })
      }),
  )
  return parsed.sort((a, b) => a.name.localeCompare(b.name, 'en'))
}

/** 선언 파일의 renderingModes. 지원하는 Rendering Mode의 비지 않은 배열이 아니면 fail로 DefinitionError를 던진다. */
export function parseRenderingModes(value: unknown, fail: Manifest['fail']): RenderingMode[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isRenderingMode)) {
    throw fail(`renderingModes는 지원하는 Rendering Mode(${RENDERING_MODES.join(', ')})의 배열이어야 합니다.`)
  }
  return value
}

/** JSON의 객체인지 본다(배열과 null은 아니다). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
