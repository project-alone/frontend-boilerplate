import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyOverlay } from './overlay.js'

// Starter 단위 Rendering Mode. 라우트마다 고르는 Rendering Mode(SSR, SSG, ISR, 스트리밍)는 server 안의 선택이다.
export const RENDERING_MODES = ['server', 'static-export'] as const

export type RenderingMode = (typeof RENDERING_MODES)[number]

export const DEFAULT_RENDERING_MODE: RenderingMode = 'server'

export const RENDERING_MODE_DESCRIPTIONS: Record<RenderingMode, string> = {
  server: '서버에서 실행한다. 라우트마다 SSR, SSG, ISR, 스트리밍을 고른다',
  'static-export': '빌드할 때 모든 페이지를 정적 파일로 내보내 서버 없이 배포한다',
}

const RENDERING_MODES_DIR = fileURLToPath(new URL('../rendering-modes', import.meta.url))

export function isRenderingMode(value: unknown): value is RenderingMode {
  return RENDERING_MODES.some((mode) => mode === value)
}

/**
 * Base로 만든 Starter에 Rendering Mode를 적용한다. Base는 server Starter 그대로이므로 server는 바꿀 것이 없다.
 * 다른 Rendering Mode는 Base와 달라지는 부분만 `rendering-modes/<mode>/`에 overlay(Recipe와 같은 형식)로 담아 두고
 * Starter에 덧입힌다(overlay.ts).
 */
export async function applyRenderingMode(target: string, mode: RenderingMode): Promise<void> {
  if (mode === 'server') return
  await applyOverlay(target, join(RENDERING_MODES_DIR, mode), `Rendering Mode ${mode}`)
}
