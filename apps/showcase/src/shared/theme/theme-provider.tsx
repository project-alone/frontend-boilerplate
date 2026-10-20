// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/dark-mode/src/shared/theme/theme-provider.tsx

import type { ReactNode } from 'react'
import { ThemeScript } from './theme-script'

/**
 * 저장된 테마를 첫 화면을 그리기 전에 적용하는 스크립트(ThemeScript)를 앱의 맨 앞에 둔다. 앱 전체를 감싸는 가장 바깥
 * Provider로 쓴다(src/app/app-shell.tsx). 스크립트가 <html>에 data-theme을 붙이므로 루트 레이아웃의 <html>에는
 * suppressHydrationWarning이 있어야 한다.
 */
export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <ThemeScript />
      {children}
    </>
  )
}
