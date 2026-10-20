## 다크 모드

`dark-mode` Recipe로 넣었습니다. 다크 테마는 디자인 토큰의 값만 바꾸므로 공통 컴포넌트와 화면 코드는 고치지 않습니다.

- 어두운 테마의 토큰 값은 `src/shared/ui/tokens-dark.css`에 있습니다. `<html data-theme="dark">`일 때 `tokens.css`의 같은 이름의 색 토큰을 덮어씁니다. `tokens.css`에 색 토큰을 더하면 `tokens-dark.css`에도 어두운 값을 더합니다. 지금 값은 무채색 자리표시 값이니 디자이너의 값으로 바꿉니다.
- 테마는 사용자가 고른 값(`localStorage`의 `theme`)을 따르고, 고르지 않았으면 운영체제 설정(`prefers-color-scheme`)을 따릅니다. 운영체제 설정이 바뀌거나 다른 탭에서 테마를 고르면 바로 따라 바뀝니다(`src/shared/theme/theme.ts`).
- 레이아웃(`src/app/layout.tsx`)의 머리글에 테마 전환 UI(`src/features/theme-switcher`, 시스템 설정·라이트·다크)가 있습니다. 다른 곳으로 옮겨도 됩니다.
- 첫 화면이 다른 테마로 깜빡이지 않도록 `<head>`의 inline script(`ThemeScript`)가 React보다 먼저 테마를 적용합니다. 그래서 `<html>`에 `suppressHydrationWarning`을 붙였습니다. Content-Security-Policy를 도입하면 이 스크립트에 nonce나 hash를 허용해야 합니다.
- Storybook 툴바의 "테마"로 스토리를 테마별로 볼 수 있습니다. `npm run test:storybook`은 모든 스토리를 라이트 모드 브라우저와 다크 모드 브라우저(`storybook (chromium, dark)`)에서 한 번씩 실행해 두 테마 모두 접근성 검사를 합니다.
- 테스트: `src/shared/theme/theme.test.ts`(테마 선택과 적용), `src/features/theme-switcher/theme-switcher.stories.tsx`(전환 UI), `e2e/dark-mode.spec.ts`(운영체제 설정, 저장한 선택, 깜빡임 없음, 두 테마의 접근성).
