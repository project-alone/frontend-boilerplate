import { access, readdir, readFile, rmdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

// 파일 시스템을 다루는 범용 함수. Generator가 Base·overlay를 읽고 Starter에 쓸 때 함께 쓴다.

/** Node.js가 던진 오류의 코드(ENOENT, MODULE_NOT_FOUND 등)가 code인지 본다. */
export function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

/** 없는 파일이나 디렉터리를 다루다 난 오류인지 본다. */
export function isNotFound(error: unknown): boolean {
  return hasErrorCode(error, 'ENOENT')
}

/** 파일의 내용. 파일이 없으면 undefined다. */
export async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isNotFound(error)) return undefined
    throw error
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch (error) {
    if (isNotFound(error)) return false
    throw error
  }
}

/** 디렉터리가 있고 비어 있지 않은지 본다. */
export async function isNonEmptyDirectory(directory: string): Promise<boolean> {
  try {
    return (await readdir(directory)).length > 0
  } catch (error) {
    if (isNotFound(error)) return false
    throw error
  }
}

/** 디렉터리 안(하위 디렉터리 포함)의 모든 파일. 경로는 directory 기준이고 이름순이다. */
export async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)))
    .sort()
}

/** directory부터 root 바로 아래까지 올라가며 비게 된 디렉터리를 지운다. root는 지우지 않는다. */
export async function removeEmptyDirectories(root: string, directory: string): Promise<void> {
  let current = directory
  while (current !== root && current.startsWith(root) && (await readdir(current)).length === 0) {
    await rmdir(current)
    current = dirname(current)
  }
}
