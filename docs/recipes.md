# Recipe 작성하기

Recipe는 하나의 기능 패턴을 Base에 독립적으로 넣고 뺄 수 있게 담은 단위다(GLOSSARY). 원본은 Base와 각 Recipe이고, Starter는 Base에 고른 Rendering Mode와 Recipe를 덧입혀 조립한다(ADR-0002). 이 문서는 새 Recipe를 Generator(`packages/devc-frontend-generator`)에 더하는 방법과, Recipe를 바꿀 때마다 함께 다시 만드는 Showcase를 적는다. 예시는 첫 Recipe인 `recipes/dark-mode/`다.

## Starter를 조립하는 순서

`dcgen new`는 다음 순서로 Starter를 만든다. 뒤의 단계는 앞 단계의 결과 위에 덧입혀진다.

1. `base/`를 복사한다.
2. 고른 Rendering Mode의 overlay(`rendering-modes/<mode>/`)를 덧입힌다. `server`는 Base 그대로라 overlay가 없다.
3. 고른 Recipe와 그 Recipe가 필요로 하는 Recipe를 덧입힌다. 필요한 Recipe가 먼저 오고, 나머지는 이름순이다. 고른 순서와 상관없이 같은 Starter가 나온다.
4. Starter의 `package.json`에 Starter 이름을 적고, Starter를 만든 Generator를 정확한 버전으로 `devDependencies`에 고정한다(`npm run g`가 이 Generator를 쓴다). overlay를 모두 덧입힌 뒤에 정하므로 Recipe가 바꿀 수 없다.
5. `npm install`로 의존성을 설치한다(`--skip-install`이면 건너뛴다).

고른 조합에 알 수 없는 Recipe가 있거나, 고른 Rendering Mode를 지원하지 않는 Recipe(함께 넣을 Recipe 포함)가 있으면 아무것도 만들기 전에 이유와 함께 거부한다.

## 디렉터리 구조

Recipe는 `packages/devc-frontend-generator/recipes/<이름>/` 디렉터리 하나다. 이름은 kebab-case로 짓고, 그대로 `dcgen new --recipe <이름>`의 값이 된다. 디렉터리 안의 경로는 Starter 최상위 기준이다.

```
recipes/<이름>/
├── recipe.json      선언: 설명, 필요한 Recipe, 지원하는 Rendering Mode (필수)
├── package.json     Starter의 package.json에 합칠 내용: 의존성, 스크립트
├── README.md        Starter의 README.md에 덧입힐 절
├── remove.txt       Starter에서 지울 경로
├── <경로>.patch     Starter의 기존 파일 <경로>를 고치는 unified diff (설정 패치)
└── <경로>           그 밖의 파일: Starter의 <경로>에 더한다 (Recipe의 코드, 스토리, 테스트)
```

`recipe.json` 말고는 모두 필요할 때만 둔다. Rendering Mode overlay(`rendering-modes/<mode>/`)도 `recipe.json`이 없을 뿐 같은 형식이다.

### recipe.json

```json
{
  "description": "디자인 토큰 값만 바꾸는 다크 모드와 테마 전환 UI. 운영체제 설정을 따르고 고른 테마를 저장한다",
  "requires": [],
  "renderingModes": ["server", "static-export"]
}
```

| 항목                   | 필수 | 뜻                                                                                                     |
| ---------------------- | ---- | ------------------------------------------------------------------------------------------------------ |
| `description`          | 예   | 한 줄 설명. `dcgen new`의 대화형 선택지에 보인다.                                                      |
| `requires`             |      | 함께 넣어야 하는 다른 Recipe의 이름. 사용자가 고르지 않았으면 Generator가 알리고 함께 넣는다.          |
| `renderingModes`       | 예   | 이 Recipe를 쓸 수 있는 Starter 단위 Rendering Mode(`server`, `static-export`).                         |
| `renderingModesReason` |      | 빠진 Rendering Mode에서 쓸 수 없는 이유. 조합을 거부할 때 보여 준다(예: BFF Route Handler가 필요하다). |

`requires`의 Recipe가 지원하지 않는 Rendering Mode도 거부된다. 예를 들어 `server`만 지원하는 Recipe를 필요로 하는 Recipe는 `static-export`에서 고를 수 없다.

### 파일 더하기

Recipe의 코드와 테스트는 Starter의 같은 경로에 새 파일로 더한다. 같은 경로에 Base 파일이 있으면 통째로 대신하지만, 그러면 Base가 그 파일을 고칠 때마다 Recipe의 사본이 낡고 같은 파일을 대신하는 다른 Recipe와 부딪친다. 기존 파일의 일부만 바꾸려면 아래의 패치를 쓴다.

### 설정 패치(`<경로>.patch`)

Base의 기존 파일(레이아웃, 설정 파일 등)을 고칠 때는 그 파일에 대한 unified diff를 `<경로>.patch`로 둔다. 예: `src/app/layout.tsx.patch`, `.storybook/preview.tsx.patch`. 패치 하나는 파일 하나만 고친다. 사본 대신 패치를 쓰는 이유는 ADR-0007에 있다.

- 패치는 덧입히는 시점의 Starter 파일, 곧 Base에 Rendering Mode와 앞서 덧입힌 Recipe가 적용된 파일에 적용된다. 줄 번호가 달라도 맥락 줄이 맞는 곳을 찾아 적용하지만, 맥락 줄이 맞지 않으면 생성이 어느 패치인지 알리며 실패하고 만들던 Starter를 지운다.
- Recipe가 지원하는 모든 Rendering Mode에서 맞아야 한다. Rendering Mode가 대신하는 파일(`rendering-modes/<mode>/`에 있는 파일)은 되도록 고치지 않는다.
- 맥락 줄은 꼭 필요한 만큼만 둔다. 다른 Recipe가 같은 파일의 가까운 곳을 고치면 맥락 줄이 어긋날 수 있다. 부딪치면 하네스의 조합 매트릭스가 잡는다.

패치는 이렇게 만든다.

```sh
npm run build -w devc-frontend-generator
node packages/devc-frontend-generator/dist/cli.js new /tmp/try --skip-install   # 필요하면 --rendering-mode, --recipe
cd /tmp/try && git init -q && git add -A && git commit -qm base
# /tmp/try/src/app/layout.tsx를 고친 뒤
git diff -- src/app/layout.tsx > <레포>/packages/devc-frontend-generator/recipes/<이름>/src/app/layout.tsx.patch
```

`diff -u --label a/<경로> --label b/<경로> <원래 파일> <고친 파일>`로 만들어도 된다. 편집기가 맥락 줄의 끝 공백을 지워도 적용된다.

### package.json

Starter의 `package.json`에 합친다. 객체(`dependencies`, `scripts` 등)는 키별로 합치고, 그 밖의 값은 덮어쓴다. 의존성은 Base처럼 정확한 버전으로 고정한다(`^`, `~`를 쓰지 않는다). 의존성 목록은 이름순으로 다시 정렬된다. Base의 `g` 스크립트(`npm run g`)는 바꾸지 않는다.

### README.md

`## ` 제목으로 시작하는 절만 담는다. Starter의 README에 같은 제목의 절이 있으면 그 절을 바꾸고, 없으면 끝에 덧붙인다. Recipe가 무엇을 더했는지, 어떻게 쓰고 바꾸는지, 어떤 테스트가 들어 있는지 적는다.

### remove.txt

Starter에서 지울 경로를 한 줄에 하나씩 적는다. `#`으로 시작하는 줄은 주석이다. 적힌 경로가 Starter에 없으면 생성이 실패한다.

### dotfile

npm은 패키지를 만들 때 `.gitignore`와 `.npmrc`를 뺀다. 특히 `.gitignore`는 그 디렉터리의 파일을 빼는 규칙으로 쓰이므로 Recipe에 두지 않는다. Starter의 `.gitignore`를 고치려면 `.gitignore.patch`를 쓴다. `.storybook/`, `.env.*`, `.gitlab-ci.yml` 같은 다른 dotfile은 그대로 담긴다.

## 코드 규칙

Recipe가 더한 파일은 Starter의 일부로 검사된다. 생성 직후의 Starter가 `typecheck`, `lint`, `format:check`, `test`, `test:storybook`, `build`, `test:e2e`를 모두 통과해야 한다.

- import 방향(`app → features → queries → shared`)과 폴더 깊이(`src/<계층>/<이름>/<파일>`)를 지킨다(ADR-0005). 예: 테마 적용은 `src/shared/theme/`, 전환 UI는 `src/features/theme-switcher/`.
- 모양은 디자인 토큰으로 만든 유틸리티만 쓴다. 테마가 토큰 값만 바꿔 적용되도록 Tailwind 기본 팔레트나 임의의 색을 쓰지 않는다.
- 포맷은 Starter의 Prettier 설정(`base/.prettierrc.json`)을 따른다.
- 주석과 문서는 한국어로, 식별자는 영어로 쓰고 GLOSSARY의 용어를 쓴다.

## 테스트

Recipe는 자기 테스트를 Starter에 함께 넣는다. Starter의 스크립트와 GitLab CI가 그대로 실행하므로, Recipe의 동작은 Starter 안에서 검증된다.

| 종류                    | 위치                   | 실행                     |
| ----------------------- | ---------------------- | ------------------------ |
| 단위·컴포넌트 테스트    | `src/**/*.test.ts(x)`  | `npm test`               |
| 스토리(접근성·상호작용) | `src/**/*.stories.tsx` | `npm run test:storybook` |
| E2E                     | `e2e/*.spec.ts`        | `npm run test:e2e`       |

E2E는 모든 Rendering Mode에서 같은 spec이 돌아야 한다. `server`는 빌드 결과를 `next start`로, `static-export`는 다시 빌드한 `out/`을 정적 파일 서버로 띄운다. 모든 Recipe를 켠 Showcase에서도 다른 Recipe의 E2E와 함께 돌므로, 다른 Recipe가 더한 화면 요소(예: dark-mode의 머리글)가 있어도 통과하게 쓴다.

레포의 하네스(`harness/`)에는 Recipe마다 조합 매트릭스 테스트를 더한다. 지원하는 Rendering Mode마다 Recipe를 넣은 Starter를 만들고 Starter의 스크립트를 실행한다. `harness/dark-mode.test.ts`처럼 `useStarter({ prefix: 'dcgen-<이름>-', renderingMode, recipes: ['<이름>'], install: true, playwright: true })`를 쓴다(`playwright`는 `test:storybook`과 `test:e2e`가 쓰는 Chromium을 받는다). 지원하지 않는 조합의 거부와 `requires`는 `recipe.json`만으로 동작하므로 Recipe마다 따로 시험하지 않아도 된다(`harness/recipes.test.ts`가 시험용 Recipe로 검증한다).

```sh
npx vitest run harness/<이름>.test.ts   # 하네스는 Generator를 npm pack으로 묶어 설치한 dcgen으로 Starter를 만든다
```

## Showcase

Showcase(`apps/showcase/`)는 Base에 Rendering Mode `server`와 Generator에 담긴 모든 Recipe를 덧입혀 생성한 Starter다(ADR-0002). 생성 결과를 커밋해 두어 GitHub에서 CLI 없이 코드를 둘러볼 수 있고, 로컬에서는 명령 하나로 실행해 본다. Showcase는 직접 고치지 않는다. 주석을 달 수 있는 파일은 맨 위 주석이 고칠 원본(Base 파일, Recipe 파일, Recipe의 패치)을 알리고, 주석을 달 수 없는 파일(JSON 등)은 Showcase의 README 맨 위 안내가 알린다.

| 명령(레포 최상위)        | 하는 일                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run showcase`       | Generator를 빌드하고 Showcase를 다시 만들어 `apps/showcase/`를 그 결과와 같게 만든다. 바뀐 파일만 쓰고, 이제 생기지 않는 파일은 지운다                                            |
| `npm run showcase:check` | 다시 만든 결과가 `apps/showcase/`와 다르면 다른 파일을 알리고 실패한다. CI(GitHub Actions의 `Showcase drift`)가 실행한다                                                          |
| `npm run showcase:watch` | Generator의 Base, Recipe, Rendering Mode overlay, 소스가 바뀔 때마다 Showcase를 다시 만든다                                                                                       |
| `npm run showcase:dev`   | Showcase를 레포 밖(운영체제의 임시 디렉터리)에 복사·설치하고 MSW 목으로 개발 서버를 띄운다. Showcase가 바뀌면 개발 서버에 옮긴다. `-- --port 3001`처럼 `next dev`의 인자를 넘긴다 |

- 같은 원본에서는 늘 같은 Showcase가 나온다. 생성 결과에 시각이나 난수 같은 값을 넣지 않는다. Recipe의 파일도 마찬가지다.
- Showcase는 Rendering Mode `server`라서, Recipe는 `server`를 지원해야 Showcase에 들어간다(지원하지 않으면 생성이 실패한다).
- Showcase는 npm workspace가 아니고 레포 안에서 설치하지 않는다. 설치하면 Starter의 lefthook이 postinstall에서 이 레포에 git 훅과 `lefthook.yml`을 만들고, workspace로 두면 레포를 설치할 때마다 Showcase의 의존성까지 설치하게 된다. `showcase:dev`는 레포 밖에서 설치하고, Showcase가 고정한 Generator 대신 레포의 Generator를 쓴다.
- 하네스의 `harness/showcase.test.ts`가 생성·어긋남 검사·watch·dev를, `harness/showcase-starter.test.ts`가 Showcase를 설치해 Starter의 모든 스크립트를 검증한다. 후자가 조합 매트릭스의 "모든 Recipe를 켠 조합"이다.

### Recipe를 더하거나 고칠 때

Recipe 티켓은 Showcase에 반영된 것으로 완료를 확인한다.

1. Recipe를 고치는 동안 `npm run showcase:watch`와 `npm run showcase:dev`를 터미널 두 개에 띄워 두면, 고친 결과가 Showcase에 다시 생성되고 개발 서버에 바로 보인다.
2. 끝나면 `npm run showcase`로 다시 만들어 Recipe의 변경과 `apps/showcase/`의 변경을 같은 PR에 올린다. 생성 결과는 따로 커밋해 두면 리뷰하기 쉽다.
3. Showcase가 원본과 다르면 CI의 `showcase:check`가 실패한다. `apps/showcase/`를 직접 고쳐 맞추지 말고 원본을 고친 뒤 다시 만든다.
4. 다른 Recipe와 부딪치는 패치나 테스트는 `harness/showcase-starter.test.ts`(모든 Recipe를 켠 Showcase)에서 드러난다.

## 릴리스

Recipe를 더하거나 고친 PR에는 changeset(`npm run changeset`)을 함께 커밋한다. 다음 Generator 버전과 CHANGELOG에 실린다([릴리스와 배포](release.md)).

## 예: dark-mode

| 선언하는 것    | `recipes/dark-mode/`                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/shared/ui/tokens-dark.css`, `src/shared/theme/theme.ts`, `theme-script.tsx`, `src/features/theme-switcher/`       |
| 설정 패치      | `src/shared/ui/styles.css.patch`, `src/app/layout.tsx.patch`, `.storybook/preview.tsx.patch`, `vitest.config.ts.patch` |
| npm 의존성     | 없음(`package.json`을 두지 않는다)                                                                                     |
| 자기 테스트    | `src/shared/theme/theme.test.ts`, `theme-switcher.stories.tsx`, `e2e/dark-mode.spec.ts`                                |
| 필요한 Recipe  | 없음                                                                                                                   |
| Rendering Mode | `server`, `static-export`                                                                                              |
