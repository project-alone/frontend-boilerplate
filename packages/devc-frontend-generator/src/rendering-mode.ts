import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Overlay } from './overlay.js'

// Starter 단위 Rendering Mode. 라우트마다 고르는 Rendering Mode(SSR, SSG, ISR, 스트리밍, CSR)는 server 안의 선택이다.
export const RENDERING_MODES = ['server', 'static-export'] as const

export type RenderingMode = (typeof RENDERING_MODES)[number]

export const DEFAULT_RENDERING_MODE: RenderingMode = 'server'

export const RENDERING_MODE_DESCRIPTIONS: Record<RenderingMode, string> = {
  server: '서버에서 실행한다. 라우트마다 SSR, SSG, ISR, 스트리밍, CSR을 고른다',
  'static-export': '빌드할 때 모든 페이지를 정적 파일로 내보내 서버 없이 배포한다',
}

const RENDERING_MODES_DIR = fileURLToPath(new URL('../rendering-modes', import.meta.url))

/**
 * Base로 만든 Starter에 덧입힐 Rendering Mode의 overlay. Base는 server Starter 그대로이므로 server는 overlay가 없다.
 * 다른 Rendering Mode는 Base와 달라지는 부분만 `rendering-modes/<mode>/`에 overlay(Recipe와 같은 형식)로 담아 둔다(overlay.ts).
 */
export function renderingModeOverlay(mode: RenderingMode): Overlay | undefined {
  if (mode === 'server') return undefined
  return { label: `Rendering Mode ${mode}`, dir: join(RENDERING_MODES_DIR, mode) }
}
