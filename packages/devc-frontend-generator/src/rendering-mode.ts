import { cp, readdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeMarkdownSections } from './markdown-sections.js'
import { mergePackageJson, type PackageJson, updatePackageJson } from './package-json.js'

// Starter 단위 Rendering Mode. 라우트마다 고르는 Rendering Mode(SSR, SSG, ISR, 스트리밍)는 server 안의 선택이다.
export const RENDERING_MODES = ['server', 'static-export'] as const

export type RenderingMode = (typeof RENDERING_MODES)[number]

export const DEFAULT_RENDERING_MODE: RenderingMode = 'server'

const RENDERING_MODES_DIR = fileURLToPath(new URL('../rendering-modes', import.meta.url))

// Rendering Mode에서 쓰지 않는 Base의 경로 목록. 덧입히는 파일이 아니라 지울 경로를 적는다.
const REMOVE_LIST = 'remove.txt'

/**
 * Base로 만든 Starter에 Rendering Mode를 적용한다. Base는 server Starter 그대로이므로 server는 바꿀 것이 없다.
 * 다른 Rendering Mode는 Base와 달라지는 부분만 `rendering-modes/<mode>/`에 담아 두고 Starter에 덧입힌다.
 *
 * - `remove.txt`: 한 줄에 하나씩 적은 Starter 안의 경로(파일이나 디렉터리)를 지운다. `#`으로 시작하는 줄은 주석이다.
 *   Base에서 그 경로가 사라졌으면 목록이 낡은 것이므로 실패한다. 다른 파일보다 먼저 처리한다.
 * - `package.json`: Starter의 package.json에 합친다(객체는 키별로 합치고, 그 밖의 값은 덮어쓴다).
 * - `README.md`: 절(`## ` 제목) 단위로 덧입힌다. Starter의 README.md에 같은 제목의 절이 있으면 바꾸고, 없으면 끝에 덧붙인다.
 * - 그 밖의 파일: 같은 경로의 Base 파일을 대신한다.
 */
export async function applyRenderingMode(target: string, mode: RenderingMode): Promise<void> {
  if (mode === 'server') return

  const overlay = join(RENDERING_MODES_DIR, mode)
  const entries = await readdir(overlay, { recursive: true, withFileTypes: true })
  const paths = entries
    .filter((candidate) => candidate.isFile())
    .map((entry) => relative(overlay, join(entry.parentPath, entry.name)))
  if (paths.includes(REMOVE_LIST)) await removePaths(target, await readFile(join(overlay, REMOVE_LIST), 'utf8'))

  for (const path of paths.filter((candidate) => candidate !== REMOVE_LIST)) {
    const source = join(overlay, path)
    if (path === 'package.json') {
      const patch = JSON.parse(await readFile(source, 'utf8')) as PackageJson
      await updatePackageJson(target, (packageJson) => mergePackageJson(packageJson, patch))
    } else if (path === 'README.md') {
      const readme = join(target, path)
      await writeFile(readme, mergeMarkdownSections(await readFile(readme, 'utf8'), await readFile(source, 'utf8')))
    } else {
      await cp(source, join(target, path))
    }
  }
}

async function removePaths(target: string, list: string): Promise<void> {
  const paths = list
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
  for (const path of paths) {
    const absolute = join(target, path)
    // force 없이 지워서, 목록에 적힌 경로가 Base에 없으면 ENOENT로 실패한다.
    await rm(absolute, { recursive: true })
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
