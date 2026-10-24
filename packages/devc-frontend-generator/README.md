# devc-frontend-generator

팀 프론트엔드 프로젝트(Starter)를 만들고, 만든 Starter 안에서 OpenAPI 명세를 입력 삼아 코드를 생성하는 CLI입니다. 명령어는 `dcgen`입니다.

Starter는 React와 Next.js(App Router) 위에 엄격한 TypeScript, ESLint·Prettier, Vitest·Playwright 테스트(접근성 검사 포함), TanStack Query와 OpenAPI 기반 API 계층, GitLab CI를 갖춘 새 프로젝트입니다. 패키지 매니저는 npm을 쓰고, 만든 직후부터 설치·타입 검사·린트·테스트·빌드가 통과합니다.

## Starter 만들기

Node.js 22.12 이상에서 실행합니다. 만들어진 Starter는 `.nvmrc`에 적힌 Node LTS 버전을 씁니다.

```sh
npx devc-frontend-generator new my-app
```

터미널에서 실행하면 Rendering Mode, Archetype, Recipe를 차례로 묻습니다. 고를 수 있는 Archetype과 Recipe는 설명과 함께 선택지에 나옵니다. 플래그로 정하면 묻지 않습니다.

```sh
npx devc-frontend-generator new my-app --rendering-mode static-export --recipe dark-mode
npx devc-frontend-generator new my-admin --archetype dashboard   # 관리자 대시보드. auth, chart, table Recipe가 함께 들어간다
```

Archetype은 여러 Recipe를 조합해 만든 완성된 앱 유형입니다(예: 관리자 대시보드). 고르면 그 Archetype이 쓰는 Recipe가 함께 들어가고, 쓰는 Recipe가 지원하지 않는 Rendering Mode와는 만들기 전에 이유와 함께 거부됩니다.

| 옵션                      | 뜻                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `--rendering-mode <mode>` | Starter 전체의 Rendering Mode입니다. `server`(기본) 또는 `static-export`           |
| `--archetype <name>`      | 넣을 Archetype입니다. 여러 번 쓸 수 있고, 그 Archetype이 쓰는 Recipe도 넣습니다    |
| `--recipe <name>`         | 넣을 Recipe입니다. 여러 번 쓸 수 있고, Recipe에 필요한 다른 Recipe는 함께 넣습니다 |
| `--skip-git`              | Starter에 git 저장소를 만들지 않습니다(`git init`)                                 |
| `--skip-install`          | Starter를 만든 뒤 `npm install`을 하지 않습니다                                    |

`new`는 Starter를 만든 뒤 Starter 디렉터리에 git 저장소를 만들고(`git init`) 의존성을 설치합니다. 설치하면서 lefthook이 커밋 훅(pre-commit의 린트·포맷·타입 검사, commit-msg의 Conventional Commits 검사)을 설치합니다. 첫 커밋은 만들지 않으니 직접 만드세요. 이미 git 저장소 안(모노레포 등)에 만들면 새 저장소를 만들지 않습니다. git 저장소 밖에서 `--skip-git`으로 만들었거나 git을 찾지 못해 저장소 없이 만들었으면, 끝에 나오는 다음 단계대로 `git init` 뒤 `npx lefthook install`(설치 전이면 `npm install`)을 실행해 훅을 설치합니다.

Starter는 자신을 만든 Generator를 정확한 버전으로 `devDependencies`에 고정합니다. 팀원 모두가 같은 Schematic 결과를 얻고, Starter가 Generator 업데이트를 저절로 받지는 않습니다.

## 코드 생성(Schematic)

Starter 안에서 실행합니다. `npm run g -- <schematic> ...`은 `npx dcgen g <schematic> ...`과 같습니다.

```sh
npm run g -- query listProducts                        # listProducts operation의 쿼리 키와 queryOptions
npm run g -- mutation createProduct                    # createProduct operation의 뮤테이션 훅
npm run g -- form createProduct --feature products     # Feature에 요청 본문을 입력받아 뮤테이션 훅으로 보내는 폼과 테스트
npm run g -- page catalog --query listProducts --feature catalog  # 목록 페이지와 목록을 보여 줄 컴포넌트, 테스트
npm run g -- component order-summary --feature orders  # Feature에 컴포넌트와 테스트
npm run g -- story src/features/orders/order-summary.tsx  # 컴포넌트의 스토리(처음이면 Storybook도 더한다)
npx dcgen g --help                                     # 쓸 수 있는 Schematic
```

| Schematic   | 만드는 것                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `query`     | 쿼리 키와 queryOptions(`--infinite`는 infiniteQueryOptions)                                                                                |
| `mutation`  | 뮤테이션 훅(`--optimistic`은 낙관적 업데이트 뼈대까지)                                                                                     |
| `form`      | 요청 본문의 Zod 스키마로 검증하고 뮤테이션 훅으로 보내는 폼과 테스트(Feature)                                                              |
| `page`      | 라우트의 페이지(메타데이터, `--mode`의 Rendering Mode), 로딩·오류 상태. `--query`의 결과를 보여 줄 컴포넌트(Feature), `--form`의 폼을 넣음 |
| `component` | 컴포넌트와 테스트(Feature 또는 공통 UI)                                                                                                    |
| `story`     | 컴포넌트의 Storybook 스토리(컴포넌트 옆). Starter에 Storybook이 없으면 Storybook을 더하고 의존성을 설치한다                                |

`query`, `mutation`, `form`, `page`는 Starter 최상위의 `openapi.yaml`을 읽어 코드를 만듭니다. 같은 이름의 코드가 이미 있으면 아무 파일도 바꾸지 않고 실패합니다. `page`만은 `--query`의 결과를 보여 줄 컴포넌트가 그 Feature에 이미 있으면 새로 만들지 않고 씁니다. 만든 코드는 그 뒤로 프로젝트가 직접 소유하고 고칩니다. Schematic마다의 자세한 사용법은 만들어진 Starter의 README에 있습니다.

## 더 보기

- [소스와 문서](https://github.com/project-alone/frontend-boilerplate)
- [Recipe 작성하기](https://github.com/project-alone/frontend-boilerplate/blob/master/docs/recipes.md)
- [Archetype 작성하기](https://github.com/project-alone/frontend-boilerplate/blob/master/docs/archetypes.md)
- [릴리스와 배포](https://github.com/project-alone/frontend-boilerplate/blob/master/docs/release.md)
- [변경 내역](https://github.com/project-alone/frontend-boilerplate/blob/master/packages/devc-frontend-generator/CHANGELOG.md)

## 라이선스

MIT
