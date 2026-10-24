# Storybook은 Starter에 처음부터 넣지 않고, 처음 `dcgen g story`를 실행할 때 더한다

Starter는 완성된 앱이 아니라 새 프로젝트의 시작점이다. 그런데 Starter를 만들면 아무도 고르지 않은 Storybook이 함께 들어 있었다. `.storybook/`, Storybook 의존성 다섯 개, `storybook`·`test:storybook` 스크립트, Vitest의 `storybook` 프로젝트, GitLab CI의 `test:storybook` 잡에 더해 Base·Recipe·Archetype이 미리 만든 스토리 25개였다(#122). 스토리가 필요해지는 때는 프로젝트마다 다르고, 대개 컴포넌트를 어느 정도 만든 뒤다. 그래서 Starter에는 Storybook을 넣지 않고, 사용자가 원하는 컴포넌트를 골라 `dcgen g story <컴포넌트 파일>`로 그 컴포넌트의 스토리를 만들게 한다. Starter에 Storybook이 아직 없으면(`.storybook/main.ts`가 없으면) 첫 `g story`가 Storybook을 함께 더하고 의존성을 설치한다.

- **Storybook 설정**: overlay 최상위의 `storybook/` 디렉터리에 둔다. Base는 `base/storybook/`, Rendering Mode·Recipe·Archetype은 각자의 `storybook/`이다. `dcgen new`는 이 디렉터리를 덧입히지 않는다. `g story`가 Storybook을 더할 때 Base의 것과 Starter에 들어 있는 Rendering Mode·Recipe·Archetype의 것을 `dcgen new`와 같은 순서와 형식(ADR-0007)으로 덧입힌다. 새 파일(`.storybook/`), `package.json` 병합(의존성과 스크립트), README 절, 그리고 방금 쓴 `.storybook/` 파일에 대한 패치다. dark-mode의 테마 툴바와 다크 모드 브라우저가 이 패치다.
- **사용자가 고쳤을 수 있는 파일**: `vitest.config.ts`, `tsconfig.json`, `.gitignore`, `.dockerignore`, `eslint.config.ts`, `.gitlab-ci.yml`은 Starter를 만든 뒤 프로젝트가 고쳤을 수 있다. 그래서 맥락 줄이 맞아야 하는 패치를 쓰지 않는다. 대신 Generator가 파일의 구조(TypeScript AST, JSON, YAML)를 읽고 Storybook에 필요한 항목만 더한다. Vitest의 `storybook` 프로젝트는 `.storybook/vitest-project.ts`에 두고, `vitest.config.ts`에는 그 프로젝트의 import와 `projects`의 한 항목만 더한다. 꼭 필요한 자리(`vitest.config.ts`의 `projects`, `tsconfig.json`의 `include`)를 찾지 못하면 아무 파일도 쓰지 않고 멈춘다. 나머지는 찾지 못하면 건너뛰고 그 사실을 알린다.
- **Recipe의 Storybook 조각을 넣을지**: Starter는 어떤 Recipe를 골랐는지 기록하지 않는다. 그래서 조각이 import하는 Starter 모듈(`@/...`)이 Starter에 모두 있을 때 그 조각을 덧입힌다. Recipe를 넣었고 그 코드가 남아 있으면 조각도 들어가고, 그 코드를 지웠으면 조각도 빠진다. Starter 모듈을 하나도 import하지 않는 조각은 넣을지 판단할 수 없으므로 Generator가 잘못된 선언으로 보고 실패한다.
- **스토리가 하던 검사**: 지금까지는 Recipe·Archetype의 스토리가 자기 테스트의 일부였다. 스토리가 하던 검사는 다음처럼 옮겨 검사 범위를 유지한다. 상호작용(키보드 조작, 검증 오류, 상태별 문구)과 상태마다의 접근성 구조 검사는 컴포넌트 테스트(Vitest·jsdom, Testing Library, axe-core)가 맡는다. 실제 브라우저가 있어야 하는 검사는 E2E(Playwright)가 맡는다. 렌더링된 색의 명도 대비, 다크 모드 토큰, 실제 스크롤과 IntersectionObserver가 여기에 해당한다.

## Considered Options

- **Storybook을 Recipe로 만든다**: `dcgen new`에서 고를 수 있지만, 고르는 시점이 Starter를 만들 때로 고정된다. 나중에 필요해지면 다른 Starter에서 설정을 손으로 옮겨야 한다.
- **Storybook 설정은 Base에 두고 미리 만든 스토리만 뺀다**: 구현은 가장 작지만, 고르지 않은 Storybook 의존성과 CI 잡이 모든 Starter에 그대로 남는다.
- **`dcgen new`가 고른 Rendering Mode·Recipe·Archetype을 Starter에 기록한다**(예: `package.json`): 무엇을 덧입힐지 판단하기는 가장 쉽다. 하지만 Starter에 Generator만 읽는 기록이 생기고, 프로젝트가 Recipe의 코드를 지우거나 바꾼 뒤에는 기록이 실제 코드와 어긋난다.
- **Recipe의 Storybook 설정을 확장 지점(ADR-0010)으로 조립한다**: 지금 Storybook 설정에 끼어드는 Recipe는 dark-mode 하나뿐이다. ADR-0010의 기준대로 둘 이상이 같은 자리를 고칠 때 확장 지점을 더한다.
- **스토리의 검사를 Vitest 브라우저 모드의 컴포넌트 테스트로 옮긴다**: 컴포넌트마다 실제 브라우저에서 명도 대비까지 볼 수 있다. 하지만 Storybook을 뺀 Starter에 브라우저 테스트 프로젝트와 그 의존성이 다시 남는다.

## Consequences

- `dcgen new`로 만든 Starter와 Showcase에는 Storybook이 없다. 이미 만든 Starter는 Storybook을 그대로 쓸 수 있다. Generator를 올리면 `g component`·`g form`이 스토리를 만들지 않으므로, 새 컴포넌트의 스토리는 `g story`로 만든다.
- Storybook을 더한 뒤의 `.storybook/`과 스토리는 프로젝트가 소유한다. Generator가 바뀌어도 이미 더한 Storybook 설정은 따라가지 않는다(Schematic의 결과와 같다).
- Storybook의 의존성 버전은 `base/storybook/package.json`에 있다. `@vitest/browser-playwright`는 Base의 `vitest`와 같은 버전이어야 한다. 하네스(`harness/tool-versions.test.ts`)가 이를 확인한다.
- 생성한 스토리는 필수 props에 타입에 맞는 값(문자열, 숫자, 리터럴, 함수는 `fn()`, 배열, 객체 등)을 넘기고, `children`을 받는 컴포넌트에는 글자를 넘긴다. 값을 정할 수 없는 타입의 필수 props가 있으면 아무 파일도 만들지 않고 알린다. 서버 컴포넌트(async 함수)는 Storybook이 그리지 못하므로 거절한다.
- Storybook에는 백엔드도 MSW도 없다. `.storybook/preview.tsx`는 스토리마다 새 QueryClient(다시 시도하지 않음)로 감싼다. 그래서 데이터를 직접 가져오는 컴포넌트는 요청이 실패한 화면을 보인다. 그런 컴포넌트의 스토리는 decorator에서 데이터를 넣은 QueryClient로 감싸 상태를 정한다(Starter README의 "Storybook").
- jsdom의 axe는 명도 대비를 계산하지 못한다. 그래서 상태마다의 명도 대비는 그 상태가 보이는 페이지를 E2E가 라이트·다크 테마에서 검사한다.
