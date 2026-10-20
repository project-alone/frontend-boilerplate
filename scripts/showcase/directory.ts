import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, watch, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import type { ShowcaseFiles } from './generate.ts'

/** directory 아래 모든 파일의 경로(directory 기준, 구분자 /, 이름순) */
export function readAllPaths(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .sort()
}

/**
 * directory에 있는 Showcase 파일(directory 기준 경로, 이름순). git 저장소 안이면 git이 무시하는 파일(node_modules, .next 등)은
 * 빼고 아직 커밋하지 않은 파일은 넣는다. 저장소 밖이면 모든 파일이다.
 */
export function listShowcaseFiles(directory: string): string[] {
  if (!existsSync(directory)) return []
  const git = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: directory,
    encoding: 'utf8',
  })
  if (git.status !== 0) return readAllPaths(directory)
  // git은 지운 채 아직 커밋하지 않은 파일도 알려 준다.
  return git.stdout
    .split('\0')
    .filter((path) => path !== '' && existsSync(join(directory, path)))
    .sort()
}

export interface Difference {
  /** 내용이 다른 파일 */
  changed: string[]
  /** files에는 있는데 directory에는 없는 파일 */
  missing: string[]
  /** directory에만 있는 파일 */
  extra: string[]
}

/** directory에 있는 파일(existing)을 files와 비교한다. */
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
 * directory를 files와 같게 맞춘다. 내용이 다르거나 없는 파일만 쓰고(개발 서버가 바뀐 파일만 다시 읽도록), existing 가운데
 * files에 없는 파일은 지운다. 쓰거나 지운 파일을 돌려준다.
 */
export function syncDirectory(
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

/**
 * directories 아래의 파일이 바뀌면 onChange에 바뀐 디렉터리를 넘긴다. 여러 파일이 한꺼번에 바뀌어도(편집기 저장, 다시 생성)
 * 잠잠해진 뒤에 한 번만 부른다. 지켜보기를 그만두는 함수를 돌려준다.
 */
export function watchDirectories(
  directories: readonly string[],
  onChange: (changed: ReadonlySet<string>) => void,
): () => void {
  let timer: NodeJS.Timeout | undefined
  let changed = new Set<string>()
  const watchers = directories.map((directory) =>
    watch(directory, { recursive: true }, () => {
      changed.add(directory)
      clearTimeout(timer)
      timer = setTimeout(() => {
        const settled = changed
        changed = new Set()
        onChange(settled)
      }, 300)
    }),
  )
  return () => {
    clearTimeout(timer)
    for (const watcher of watchers) watcher.close()
  }
}
