---
"devc-frontend-generator": minor
---

Starter에 Storybook을 처음부터 넣지 않습니다. 스토리가 필요해지면 `npm run g -- story <컴포넌트 파일>`로 원하는 컴포넌트의 스토리를 만듭니다. Starter에 Storybook이 아직 없으면 이때 Storybook을 더하고 의존성을 설치합니다. 더하는 것은 `.storybook/` 설정, 의존성, `storybook`·`test:storybook` 스크립트, Vitest의 `storybook` 프로젝트, GitLab CI의 `test:storybook` 잡입니다. dark-mode Recipe가 들어 있으면 테마 툴바와 다크 모드 브라우저 검사도 함께 더합니다.

깨지는 변경입니다.

- `dcgen new`로 만든 Starter에는 Storybook과 미리 만든 스토리가 없습니다. Base·Recipe·Archetype의 스토리가 하던 검사는 컴포넌트 테스트로 옮겼습니다. 상호작용은 Testing Library로, 상태마다의 접근성은 새 `axeViolations`(`src/shared/a11y/axe-violations.ts`, `axe-core`)로 검사합니다. 실제 브라우저가 있어야 하는 명도 대비는 E2E가 검사합니다.
- `g component`와 `g form`은 스토리를 만들지 않습니다. 대신 생성한 테스트가 접근성(axe)도 검사합니다.

이미 만든 Starter는 Storybook을 그대로 쓸 수 있습니다. Generator를 올린 뒤 새 컴포넌트의 스토리는 `npm run g -- story <파일>`로 만듭니다. Storybook이 이미 있으면 스토리 파일만 만듭니다. 올린 Generator의 `g component`·`g form`이 만드는 테스트는 `@/shared/a11y/axe-violations`를 import하므로, 먼저 `npm install -D axe-core@4.14.0`을 실행하고 새로 만든 Starter의 `src/shared/a11y/axe-violations.ts`를 같은 경로에 복사합니다.
