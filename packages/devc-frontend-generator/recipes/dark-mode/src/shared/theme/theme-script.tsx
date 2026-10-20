import { THEME_SCRIPT } from './theme'

/**
 * 저장된 테마를 첫 화면을 그리기 전에 적용한다. 페이지 내용보다 앞에 두어야 하므로 ThemeProvider가 <body>의 맨 앞에 둔다.
 * 스크립트가 <html>에 data-theme을 붙이므로 <html>에 suppressHydrationWarning을 함께 적는다.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
}
