import type { ReactNode } from 'react'

/** 시험용 Provider. 감싼 위치를 E2E(e2e/extension-points.spec.ts)가 data-fixture-provider로 확인한다. */
export function FixtureAProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <div data-fixture-provider="a">{children}</div>
}

/** 시험용 머리글 항목 */
export function FixtureAHeaderItem() {
  return <span data-fixture-header-item="a">fixture-a</span>
}
