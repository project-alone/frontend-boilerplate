import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isRecord } from './manifest.js'

export type PackageJson = Record<string, unknown>

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies']

/**
 * directory의 package.json을 update로 고쳐 쓴다. 의존성 목록은 npm이 `npm install <패키지>`로 의존성을 더할 때처럼
 * 이름순으로 다시 정렬해, 나중에 설치할 때 순서만 바뀌는 diff가 생기지 않게 한다.
 */
export async function updatePackageJson(
  directory: string,
  update: (packageJson: PackageJson) => PackageJson,
): Promise<void> {
  const path = join(directory, 'package.json')
  const updated = update(JSON.parse(await readFile(path, 'utf8')) as PackageJson)
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = updated[field]
    if (isRecord(dependencies)) updated[field] = Object.fromEntries(Object.entries(dependencies).sort(byKey))
  }
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`)
}

/** patch의 값으로 base를 덮어쓴다. 둘 다 객체인 값은 키별로 합친다. */
export function mergePackageJson(base: PackageJson, patch: PackageJson): PackageJson {
  const merged = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    const current = merged[key]
    merged[key] = isRecord(current) && isRecord(value) ? mergePackageJson(current, value) : value
  }
  return merged
}

function byKey([a]: [string, unknown], [b]: [string, unknown]): number {
  return a.localeCompare(b, 'en')
}
