import { cp, readdir, rename } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { updatePackageJson } from './package-json.js'
import { applyRenderingMode, type RenderingMode } from './rendering-mode.js'

const BASE_DIR = fileURLToPath(new URL('../base', import.meta.url))

// npm은 패키지에 담긴 `.gitignore`를 배포 과정에서 빼 버리므로 다른 이름으로 담아 두었다가 되돌린다.
const PACKED_GITIGNORE = '_gitignore'

export class TargetNotEmptyError extends Error {
  constructor(target: string) {
    super(`${target} 디렉터리가 이미 있고 비어 있지 않습니다. 다른 이름을 쓰거나 디렉터리를 비워 주세요.`)
    this.name = 'TargetNotEmptyError'
  }
}

export async function createStarter(name: string, cwd: string, renderingMode: RenderingMode): Promise<string> {
  const target = resolve(cwd, name)
  if (await isNonEmptyDirectory(target)) throw new TargetNotEmptyError(target)

  await cp(BASE_DIR, target, { recursive: true })
  await rename(join(target, PACKED_GITIGNORE), join(target, '.gitignore'))
  await applyRenderingMode(target, renderingMode)
  await updatePackageJson(target, (packageJson) => ({ ...packageJson, name: basename(target) }))

  return target
}

async function isNonEmptyDirectory(directory: string): Promise<boolean> {
  try {
    return (await readdir(directory)).length > 0
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false
    throw error
  }
}
