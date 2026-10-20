import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import type { ShowcaseFiles } from './generate.ts'

/**
 * directory에 있는 Showcase 파일(최상위 기준 경로, 이름순). git 저장소 안이면 git이 무시하는 파일(node_modules, .next 등)은
 * 빼고 아직 커밋하지 않은 파일은 넣는다. 저장소 밖이면 모든 파일이다.
 */
export function listFiles(directory: string): string[] {
  if (!existsSync(directory)) return []
  const git = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: directory,
    encoding: 'utf8',
  })
  const paths =
    git.status === 0
      ? git.stdout.split('\0').filter((path) => path !== '')
      : readdirSync(directory, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join('/'))
  // git은 지운 채 아직 커밋하지 않은 파일도 알려 준다.
  return paths.filter((path) => existsSync(join(directory, path))).sort()
}

export interface Difference {
  /** 내용이 다른 파일 */
  changed: string[]
  /** files에는 있는데 directory에는 없는 파일 */
  missing: string[]
  /** directory에만 있는 파일 */
  extra: string[]
}

/** directory의 파일(existing)을 files와 비교한다. */
export function compareFiles(directory: string, files: ShowcaseFiles, existing: readonly string[]): Difference {
  const present = new Set(existing)
  const changed: string[] = []
  const missing: string[] = []
  for (const [path, content] of files) {
    if (!present.has(path)) missing.push(path)
    else if (!readFileSync(join(directory, path)).equals(content)) changed.push(path)
  }
  return { changed, missing, extra: existing.filter((path) => !files.has(path)) }
}

/**
 * directory를 files와 같게 만든다. 내용이 다르거나 없는 파일만 쓰고(개발 서버가 바뀐 파일만 다시 읽도록),
 * existing 가운데 files에 없는 파일은 지운다. 쓰거나 지운 파일을 돌려준다.
 */
export function writeFiles(
  directory: string,
  files: ShowcaseFiles,
  existing: readonly string[],
): { written: string[]; removed: string[] } {
  const { changed, missing, extra } = compareFiles(directory, files, existing)
  for (const path of extra) {
    rmSync(join(directory, path))
    removeEmptyDirectories(directory, dirname(join(directory, path)))
  }
  const written = [...changed, ...missing].sort()
  for (const path of written) {
    const content = files.get(path)
    if (content === undefined) continue
    mkdirSync(dirname(join(directory, path)), { recursive: true })
    writeFileSync(join(directory, path), content)
  }
  return { written, removed: extra }
}

/** from부터 directory 바로 아래까지 올라가며 비게 된 디렉터리를 지운다. */
function removeEmptyDirectories(directory: string, from: string): void {
  let current = from
  while (current !== directory && current.startsWith(directory) && readdirSync(current).length === 0) {
    rmdirSync(current)
    current = dirname(current)
  }
}
