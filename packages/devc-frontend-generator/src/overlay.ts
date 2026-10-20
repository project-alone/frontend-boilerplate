import { cp, readdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { applyPatch } from 'diff'
import { isDotenvFile, mergeDotenv } from './dotenv.js'
import { mergeMarkdownSections } from './markdown-sections.js'
import { mergePackageJson, type PackageJson, updatePackageJson } from './package-json.js'

// Base와 달라지는 부분을 담아 Starter에 덧입히는 디렉터리를 overlay라 부른다. Rendering Mode(`rendering-modes/<mode>/`)와
// Recipe(`recipes/<name>/`)가 같은 형식을 쓴다. overlay 안의 경로는 Starter 최상위 기준이다.

/** Recipe의 선언 파일. overlay 최상위에 있어도 Starter에 덧입히지 않는다(Rendering Mode overlay에는 없다). */
export const RECIPE_MANIFEST = 'recipe.json'
// 지울 Base의 경로 목록. 덧입히는 파일이 아니라 지울 경로를 적는다.
const REMOVE_LIST = 'remove.txt'
const PACKAGE_JSON = 'package.json'
const README = 'README.md'
const PATCH_SUFFIX = '.patch'

/** Starter에 덧입힐 overlay 디렉터리와 오류 메시지에 쓸 이름(예: 'Recipe dark-mode', 'Rendering Mode static-export') */
export interface Overlay {
  label: string
  dir: string
}

export class OverlayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OverlayError'
  }
}

/**
 * overlay 디렉터리를 Starter에 덧입힌다. label은 오류 메시지에 쓸 overlay 이름이다(예: 'Recipe dark-mode').
 *
 * - `remove.txt`: 한 줄에 하나씩 적은 Starter 안의 경로(파일이나 디렉터리)를 지운다. `#`으로 시작하는 줄은 주석이다.
 *   그 경로가 Starter에 없으면 목록이 낡은 것이므로 실패한다. 다른 파일보다 먼저 처리한다.
 * - `package.json`: Starter의 package.json에 합친다(객체는 키별로 합치고, 그 밖의 값은 덮어쓴다).
 * - `README.md`: 절(`## ` 제목) 단위로 덧입힌다. Starter의 README.md에 같은 제목의 절이 있으면 바꾸고, 없으면 끝에 덧붙인다.
 * - dotenv 파일(`.env`, `.env.<이름>`): 변수 단위로 병합한다(dotenv.ts). Starter에 그 파일이 없으면 새로 만든다.
 * - `<경로>.patch`: Starter의 `<경로>` 파일에 unified diff를 적용한다. 맥락 줄이 맞지 않으면 실패한다.
 * - 최상위의 skip에 적힌 파일: 덧입히지 않는다. 확장 지점의 선언과 명세 조각처럼 모든 overlay를 덧입힌 뒤에 한꺼번에
 *   조립하는 파일이다(create-starter.ts).
 * - 그 밖의 파일: Starter에 더한다. 같은 경로의 파일이 있으면 대신한다.
 */
export async function applyOverlay(
  target: string,
  { dir: overlay, label }: Overlay,
  skip: readonly string[] = [],
): Promise<void> {
  const entries = await readdir(overlay, { recursive: true, withFileTypes: true })
  const paths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(overlay, join(entry.parentPath, entry.name)))
    .filter((path) => path !== RECIPE_MANIFEST && !skip.includes(path))
    .sort()
  if (paths.includes(REMOVE_LIST)) {
    await removePaths(target, await readFile(join(overlay, REMOVE_LIST), 'utf8'), label)
  }

  for (const path of paths.filter((candidate) => candidate !== REMOVE_LIST)) {
    const source = join(overlay, path)
    if (path === PACKAGE_JSON) {
      const patch = JSON.parse(await readFile(source, 'utf8')) as PackageJson
      await updatePackageJson(target, (packageJson) => mergePackageJson(packageJson, patch))
    } else if (path === README) {
      const readme = join(target, path)
      await writeFile(readme, mergeMarkdownSections(await readFile(readme, 'utf8'), await readFile(source, 'utf8')))
    } else if (path.endsWith(PATCH_SUFFIX)) {
      await patchFile(target, path.slice(0, -PATCH_SUFFIX.length), await readFile(source, 'utf8'), label)
    } else if (isDotenvFile(path)) {
      const file = join(target, path)
      const existing = await readFile(file, 'utf8').catch((error: unknown) => {
        if (isNotFound(error)) return ''
        throw error
      })
      await writeFile(file, mergeDotenv(existing, await readFile(source, 'utf8')))
    } else {
      await cp(source, join(target, path))
    }
  }
}

async function patchFile(target: string, path: string, patch: string, label: string): Promise<void> {
  const file = join(target, path)
  const original = await readFile(file, 'utf8').catch((error: unknown) => {
    if (isNotFound(error)) throw new OverlayError(`${label}: ${path}.patch를 적용할 ${path}가 Starter에 없습니다.`)
    throw error
  })
  const patched = (() => {
    try {
      return applyPatch(original, patch)
    } catch (error) {
      // 여러 파일을 고치는 패치처럼 형식이 잘못된 경우
      throw new OverlayError(`${label}: ${path}.patch를 읽지 못했습니다(${String(error)}). 패치 하나는 파일 하나만 고칩니다.`)
    }
  })()
  if (patched === false) {
    throw new OverlayError(
      `${label}: ${path}.patch의 맥락 줄이 Starter의 ${path}와 맞지 않아 적용하지 못했습니다. ` +
        'Base나 먼저 덧입힌 Rendering Mode·Recipe가 그 부분을 바꿨는지 확인하고 패치를 다시 만드세요.',
    )
  }
  await writeFile(file, patched)
}

async function removePaths(target: string, list: string, label: string): Promise<void> {
  const paths = list
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
  for (const path of paths) {
    const absolute = join(target, path)
    // force 없이 지워서, 목록에 적힌 경로가 Starter에 없으면 실패한다.
    await rm(absolute, { recursive: true }).catch((error: unknown) => {
      if (isNotFound(error)) throw new OverlayError(`${label}: ${REMOVE_LIST}에 적힌 ${path}가 Starter에 없습니다.`)
      throw error
    })
    await removeEmptyDirectories(target, dirname(absolute))
  }
}

/** directory부터 target 바로 아래까지 올라가며 비게 된 디렉터리를 지운다. */
async function removeEmptyDirectories(target: string, directory: string): Promise<void> {
  let current = directory
  while (current !== target && current.startsWith(target) && (await readdir(current)).length === 0) {
    await rmdir(current)
    current = dirname(current)
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
