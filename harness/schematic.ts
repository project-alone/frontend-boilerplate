import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from 'vitest'
import { parse, stringify } from 'yaml'
import { run } from './run.ts'
import type { Starter } from './starter.ts'

interface Spec {
  tags: unknown[]
  paths: Record<string, unknown>
  components: { schemas: Record<string, unknown> }
}

/**
 * Starter의 openapi.yaml에 operations(tags, paths, components.schemas를 담은 OpenAPI 조각)를 더하고 API 계층을 다시 만든다.
 * Starter의 포맷 검사를 통과하도록 명세를 Prettier로 다시 쓴다. 같은 path가 있으면 operations의 것으로 바꾼다.
 */
export function addOperations(starter: Starter, operations: string): void {
  const path = join(starter.dir, 'openapi.yaml')
  const spec = parse(readFileSync(path, 'utf8')) as Spec
  const additions = parse(operations) as Spec
  spec.tags.push(...additions.tags)
  Object.assign(spec.paths, additions.paths)
  Object.assign(spec.components.schemas, additions.components.schemas)
  writeFileSync(path, stringify(spec))
  const formatted = run('npx', ['--no', '--', 'prettier', '--write', 'openapi.yaml'], starter.dir)
  expect(formatted.status, formatted.output).toBe(0)
  starter.expectNpmSuccess(['run', 'api:gen'])
}
