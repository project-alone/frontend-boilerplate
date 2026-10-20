import type { ReactNode } from 'react'

/** 시험용 Provider. 감싼 위치를 E2E(e2e/extension-points.spec.ts)가 data-fixture-provider로 확인한다. */
export function FixtureBProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <div data-fixture-provider="b">{children}</div>
}

/** 시험용 머리글 항목 */
export function FixtureBHeaderItem() {
  return <span data-fixture-header-item="b">fixture-b</span>
}
