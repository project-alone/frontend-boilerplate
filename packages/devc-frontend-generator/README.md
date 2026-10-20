# devc-frontend-generator

팀 프론트엔드 프로젝트(Starter)를 만들고, 만든 Starter 안에서 OpenAPI 명세를 입력 삼아 코드를 생성하는 CLI입니다. 명령어는 `dcgen`입니다.

Starter는 React와 Next.js(App Router) 위에 엄격한 TypeScript, ESLint·Prettier, Vitest·Storybook·Playwright 테스트, TanStack Query와 OpenAPI 기반 API 계층, GitLab CI를 갖춘 새 프로젝트입니다. 패키지 매니저는 npm을 쓰고, 만든 직후부터 설치·타입 검사·린트·테스트·빌드가 통과합니다.

## Starter 만들기

Node.js 22.12 이상에서 실행합니다. 만들어진 Starter는 `.nvmrc`에 적힌 Node LTS 버전을 씁니다.

```sh
npx devc-frontend-generator new my-app
```

터미널에서 실행하면 Rendering Mode와 Recipe를 차례로 묻습니다. 고를 수 있는 Recipe는 설명과 함께 선택지에 나옵니다. 플래그로 정하면 묻지 않습니다.

```sh
npx devc-frontend-generator new my-app --rendering-mode static-export --recipe dark-mode
```

| 옵션                      | 뜻                                                                               |
| ------------------------- | -------------------------------------------------------------------------------- |
| `--rendering-mode <mode>` | Starter 전체의 Rendering Mode입니다. `server`(기본) 또는 `static-export`         |
| `--recipe <name>`         | 넣을 Recipe입니다. 여러 번 쓸 수 있고, Recipe에 필요한 다른 Recipe는 함께 넣습니다 |
| `--skip-install`          | Starter를 만든 뒤 `npm install`을 하지 않습니다                                  |

Starter는 자신을 만든 Generator를 정확한 버전으로 `devDependencies`에 고정합니다. 팀원 모두가 같은 Schematic 결과를 얻고, Starter가 Generator 업데이트를 저절로 받지는 않습니다.

## 코드 생성(Schematic)

Starter 안에서 실행합니다. `npm run g -- <schematic> ...`은 `npx dcgen g <schematic> ...`과 같습니다.

```sh
npm run g -- query listProducts   # listProducts operation의 쿼리 키와 queryOptions
npx dcgen g --help                # 쓸 수 있는 Schematic
```

Schematic은 Starter 최상위의 `openapi.yaml`을 읽어 코드를 만듭니다. 같은 이름의 코드가 이미 있으면 아무 파일도 바꾸지 않고 실패합니다. 만든 코드는 그 뒤로 프로젝트가 직접 소유하고 고칩니다. Schematic마다의 자세한 사용법은 만들어진 Starter의 README에 있습니다.

## 더 보기

- [소스와 문서](https://github.com/project-alone/frontend-boilerplate)
- [Recipe 작성하기](https://github.com/project-alone/frontend-boilerplate/blob/master/docs/recipes.md)
- [릴리스와 배포](https://github.com/project-alone/frontend-boilerplate/blob/master/docs/release.md)
- [변경 내역](https://github.com/project-alone/frontend-boilerplate/blob/master/packages/devc-frontend-generator/CHANGELOG.md)

## 라이선스

MIT
