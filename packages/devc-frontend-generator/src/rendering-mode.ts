import { cp, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeMarkdownSections } from './markdown-sections.js'
import { mergePackageJson, type PackageJson, updatePackageJson } from './package-json.js'

// Starter 단위 Rendering Mode. 라우트마다 고르는 Rendering Mode(SSR, SSG, ISR, 스트리밍)는 server 안의 선택이다.
export const RENDERING_MODES = ['server', 'static-export'] as const

export type RenderingMode = (typeof RENDERING_MODES)[number]

export const DEFAULT_RENDERING_MODE: RenderingMode = 'server'

const RENDERING_MODES_DIR = fileURLToPath(new URL('../rendering-modes', import.meta.url))

/**
 * Base로 만든 Starter에 Rendering Mode를 적용한다. Base는 server Starter 그대로이므로 server는 바꿀 것이 없다.
 * 다른 Rendering Mode는 Base와 달라지는 부분만 `rendering-modes/<mode>/`에 담아 두고 Starter에 덧입힌다.
 *
 * - `package.json`: Starter의 package.json에 합친다(객체는 키별로 합치고, 그 밖의 값은 덮어쓴다).
 * - `README.md`: 절(`## ` 제목) 단위로 덧입힌다. Starter의 README.md에 같은 제목의 절이 있으면 바꾸고, 없으면 끝에 덧붙인다.
 * - 그 밖의 파일: 같은 경로의 Base 파일을 대신한다.
 */
export async function applyRenderingMode(target: string, mode: RenderingMode): Promise<void> {
  if (mode === 'server') return

  const overlay = join(RENDERING_MODES_DIR, mode)
  const entries = await readdir(overlay, { recursive: true, withFileTypes: true })
  for (const entry of entries.filter((candidate) => candidate.isFile())) {
    const source = join(entry.parentPath, entry.name)
    const path = relative(overlay, source)
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
