// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/dark-mode/src/shared/theme/theme-script.tsx

import { THEME_SCRIPT } from './theme'

/**
 * 저장된 테마를 첫 화면을 그리기 전에 적용한다. 루트 레이아웃의 <head>에 둔다.
 * 스크립트가 <html>에 data-theme을 붙이므로 <html>에 suppressHydrationWarning을 함께 적는다.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
}
