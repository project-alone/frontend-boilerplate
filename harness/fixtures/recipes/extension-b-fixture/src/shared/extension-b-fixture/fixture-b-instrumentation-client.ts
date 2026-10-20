import type { RouterTransitionType } from 'next'

// 실행된 순서를 E2E(e2e/extension-points.spec.ts)가 읽는다.
const recorded = globalThis as { fixtureClientHooks?: string[] }

/** 시험용 instrumentation-client 조각 */
export const fixtureBClientInstrumentation = {
  register() {
    ;(recorded.fixtureClientHooks ??= []).push('b')
  },
  onRouterTransitionStart(_url: string, navigationType: RouterTransitionType) {
    ;(recorded.fixtureClientHooks ??= []).push(`b:${navigationType}`)
  },
}
