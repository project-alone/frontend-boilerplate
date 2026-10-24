# Recipe 작성하기

Recipe는 하나의 기능 패턴을 Base에 독립적으로 넣고 뺄 수 있게 담은 단위다(GLOSSARY). 원본은 Base와 각 Recipe이고, Starter는 Base에 고른 Rendering Mode와 Recipe를 덧입혀 조립한다(ADR-0002). 이 문서는 새 Recipe를 Generator(`packages/devc-frontend-generator`)에 더하는 방법, 여러 Recipe가 같은 Base 파일에 끼어드는 자리인 [확장 지점](#확장-지점), Recipe를 바꿀 때마다 함께 다시 만드는 Showcase를 적는다. 예시는 첫 Recipe인 `recipes/dark-mode/`이고, 문서 끝에 `server`에서만 쓸 수 있는 `recipes/route-rendering/`, 명세 조각으로 목록 operation을 더하는 `recipes/table/`, 디자인 토큰으로만 색을 정하는 `recipes/chart/`, 다른 Recipe의 라우트를 옮기지 않고 locale별 라우팅을 더하는 `recipes/i18n/`, 확장 지점을 여럿 쓰는 `recipes/auth/`, 요청 본문 스키마를 단계마다 나눠 검증하는 `recipes/multi-step-form/`, `mutation --optimistic`의 뼈대를 채워 쓰는 `recipes/optimistic-update/`, infiniteQueryOptions로 페이지를 이어 붙이는 `recipes/infinite-list/`, 배포용 컨테이너 이미지와 상태 확인 주소를 더하는 `recipes/docker/`, 다른 Recipe의 페이지도 저절로 sitemap에 넣는 `recipes/seo/`, 확장 지점 세 곳(`next.config`, instrumentation, instrumentation-client)에 조각을 더하는 `recipes/sentry/`, 그와 같은 instrumentation-client에 페이지뷰 조각을 더하는 `recipes/analytics/`, 진행률을 알려 주는 요청으로 파일을 올리는 `recipes/file-upload/`, 이벤트 스트림으로 쿼리 캐시를 고치는 `recipes/realtime/`도 적는다. 여러 Recipe를 조합한 완성된 앱 유형인 Archetype은 같은 overlay 형식을 쓰며 [Archetype 작성하기](archetypes.md)에 따로 적는다.

## Starter를 조립하는 순서

`dcgen new`는 다음 순서로 Starter를 만든다. 뒤의 단계는 앞 단계의 결과 위에 덧입혀진다.

1. `base/`를 복사한다(`base/extensions.json`은 빼고).
2. 고른 Rendering Mode의 overlay(`rendering-modes/<mode>/`)를 덧입힌다. `server`는 Base 그대로라 overlay가 없다.
3. 고른 Recipe, 고른 Archetype이 쓰는 Recipe, 그 Recipe들이 필요로 하는 Recipe를 덧입힌다. 필요한 Recipe가 먼저 오고, 나머지는 이름순이다. 고른 순서와 상관없이 같은 Starter가 나온다.
4. 고른 Archetype의 overlay(`archetypes/<이름>/`)를 이름순으로 덧입힌다. Recipe를 모두 덧입힌 뒤이므로 Archetype은 Recipe의 파일을 패치로 고칠 수 있다([Archetype 작성하기](archetypes.md)).
5. overlay의 OpenAPI 명세 조각을 Base 명세(`openapi.yaml`)에 병합하고, 병합한 명세로 재생성 API 계층을 다시 만든다(명세 조각이 있을 때만).
6. Base, Rendering Mode, Recipe, Archetype이 확장 지점에 선언한 조각(`extensions.json`)을 모아 조립 파일(`src/app/app-shell.tsx` 등)을 쓴다.
7. Starter의 `package.json`에 Starter 이름을 적고, Starter를 만든 Generator를 정확한 버전으로 `devDependencies`에 고정한다(`npm run g`가 이 Generator를 쓴다). overlay를 모두 덧입힌 뒤에 정하므로 Recipe가 바꿀 수 없다.
8. Starter 디렉터리에 git 저장소를 만든다(`git init`, 첫 커밋은 만들지 않는다). 설치보다 먼저 만들어야 lefthook이 설치하면서 커밋 훅을 설치한다. 이미 git 저장소 안이거나 `--skip-git`이면 건너뛴다.
9. `npm install`로 의존성을 설치한다(`--skip-install`이면 건너뛴다).

고른 조합에 알 수 없는 Recipe나 Archetype이 있거나, 고른 Rendering Mode를 지원하지 않는 Archetype이나 Recipe(함께 넣을 Recipe 포함)가 있으면 아무것도 만들기 전에 이유와 함께 거부한다. 확장 지점의 선언이 잘못되었거나 명세 조각이 Base나 다른 Recipe의 명세와 겹쳐도 아무것도 만들기 전에 실패한다.

## 디렉터리 구조

Recipe는 `packages/devc-frontend-generator/recipes/<이름>/` 디렉터리 하나다. 이름은 kebab-case로 짓고, 그대로 `dcgen new --recipe <이름>`의 값이 된다. 디렉터리 안의 경로는 Starter 최상위 기준이다.

```
recipes/<이름>/
├── recipe.json      선언: 설명, 필요한 Recipe, 지원하는 Rendering Mode (필수)
├── extensions.json  확장 지점에 더할 조각: Provider, 머리글, proxy, next.config, instrumentation, 백엔드 요청, MSW 핸들러, sitemap 규칙
├── openapi.yaml     Base 명세에 병합할 명세 조각
├── .env.<이름>      Starter의 같은 dotenv 파일에 변수 단위로 병합할 변수(.env.example, .env.development 등)
├── package.json     Starter의 package.json에 합칠 내용: 의존성, 스크립트
├── README.md        Starter의 README.md에 덧입힐 절
├── remove.txt       Starter에서 지울 경로
├── <경로>.patch     Starter의 기존 파일 <경로>를 고치는 unified diff (설정 패치)
├── storybook/       Storybook을 더할 때(dcgen g story) 덧입힐 overlay. Starter를 만들 때는 덧입히지 않는다
└── <경로>           그 밖의 파일: Starter의 <경로>에 더한다 (Recipe의 코드, 테스트)
```

Starter의 도구 설정(Vitest, Playwright, orval)은 `config/`에, 환경 변수의 타입 선언은 `types/`에 있으므로, 그 파일을 고치는 패치와 Recipe의 선언 파일도 같은 경로에 둔다(예: `config/vitest.config.ts.patch`, `types/process-env.<이름>.d.ts`). Starter 최상위에는 도구가 최상위에서만 찾는 설정(`next.config.ts`, `postcss.config.mjs`, `eslint.config.ts`, `tsconfig.json`)만 둔다.

`recipe.json` 말고는 모두 필요할 때만 둔다. Rendering Mode overlay(`rendering-modes/<mode>/`)도 `recipe.json`이 없을 뿐 같은 형식이다. `extensions.json`, `openapi.yaml`, dotenv 파일을 쓰는 방법은 [확장 지점](#확장-지점)에 있다.

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

Recipe의 코드와 테스트는 Starter의 같은 경로에 새 파일로 더한다. 같은 경로에 Base 파일이 있으면 통째로 대신하지만, 그러면 Base가 그 파일을 고칠 때마다 Recipe의 사본이 낡고 같은 파일을 대신하는 다른 Recipe와 부딪친다. 기존 파일의 일부만 바꾸려면 먼저 [확장 지점](#확장-지점)이 있는지 보고, 없으면 아래의 패치를 쓴다.

### 설정 패치(`<경로>.patch`)

Base의 기존 파일(설정 파일 등)을 고칠 때는 그 파일에 대한 unified diff를 `<경로>.patch`로 둔다. 예: `src/shared/ui/styles.css.patch`, `config/vitest.config.ts.patch`. 패치 하나는 파일 하나만 고친다. 사본 대신 패치를 쓰는 이유는 ADR-0007에 있다. 확장 지점이 있는 자리(루트 레이아웃의 Provider와 머리글, proxy, `next.config`의 래퍼, instrumentation, 서버가 백엔드로 보내는 요청, MSW 핸들러 목록, OpenAPI 명세, 환경 변수 파일)는 패치하지 않는다. 같은 자리를 패치하는 Recipe끼리는 Showcase에서 함께 켤 수 없다(ADR-0010).

- 패치는 덧입히는 시점의 Starter 파일, 곧 Base에 Rendering Mode와 앞서 덧입힌 Recipe가 적용된 파일에 적용된다. 줄 번호가 달라도 맥락 줄이 맞는 곳을 찾아 적용하지만, 맥락 줄이 맞지 않으면 생성이 어느 패치인지 알리며 실패하고 만들던 Starter를 지운다.
- Recipe가 지원하는 모든 Rendering Mode에서 맞아야 한다. Rendering Mode가 패치로 고치는 파일(`rendering-modes/<mode>/`의 `<경로>.patch`)은 Rendering Mode마다 내용이 다르므로 되도록 고치지 않는다.
- 맥락 줄은 꼭 필요한 만큼만 둔다. 다른 Recipe가 같은 파일의 가까운 곳을 고치면 맥락 줄이 어긋날 수 있다. 부딪치면 하네스의 조합 매트릭스가 잡는다.

패치는 이렇게 만든다.

```sh
npm run build -w devc-frontend-generator
node packages/devc-frontend-generator/dist/cli.js new /tmp/try --skip-install   # 필요하면 --rendering-mode, --recipe
cd /tmp/try && git add -A && git commit -qm base   # dcgen new가 만든 git 저장소에 처음 상태를 커밋한다
# /tmp/try/src/shared/ui/styles.css를 고친 뒤
git diff -- src/shared/ui/styles.css > <레포>/packages/devc-frontend-generator/recipes/<이름>/src/shared/ui/styles.css.patch
```

`diff -u --label a/<경로> --label b/<경로> <원래 파일> <고친 파일>`로 만들어도 된다. 편집기가 맥락 줄의 끝 공백을 지워도 적용된다.

### package.json

Starter의 `package.json`에 합친다. 객체(`dependencies`, `scripts` 등)는 키별로 합치고, 그 밖의 값은 덮어쓴다. 의존성은 Base처럼 정확한 버전으로 고정한다(`^`, `~`를 쓰지 않는다). 의존성 목록은 이름순으로 다시 정렬된다. Base의 `g` 스크립트(`npm run g`)는 바꾸지 않는다.

### README.md

`## ` 제목으로 시작하는 절만 담는다. Starter의 README에 같은 제목의 절이 있으면 그 절을 바꾸고, 없으면 끝에 덧붙인다. Recipe가 무엇을 더했는지, 어떻게 쓰고 바꾸는지, 어떤 테스트가 들어 있는지 적는다.

### Storybook 설정(`storybook/`)

Starter에는 Storybook이 없고, 사용자가 `dcgen g story`로 처음 스토리를 만들 때 더해진다(ADR-0014). 그때 Recipe가 Storybook 설정에 끼어들어야 하면(예: dark-mode의 테마 툴바) overlay 최상위의 `storybook/` 아래에 같은 overlay 형식으로 둔다. `dcgen new`는 이 디렉터리를 덧입히지 않는다.

- `g story`는 Base의 `base/storybook/`(`.storybook/`의 설정, `package.json`의 의존성과 스크립트, README의 "Storybook" 절)을 덧입힌 뒤, Starter에 들어 있는 Rendering Mode·Recipe·Archetype의 `storybook/`을 `dcgen new`와 같은 순서로 덧입힌다. 그래서 Recipe의 패치는 `base/storybook/`의 파일을 기준으로 만든다(예: `recipes/dark-mode/storybook/.storybook/preview.tsx.patch`).
- Starter는 고른 Recipe를 기록하지 않으므로, Recipe의 `storybook/`은 그 안의 파일(패치는 더하는 줄)이 import하는 Starter 모듈(`@/...`)이 Starter에 모두 있을 때만 덧입힌다. Starter 모듈을 하나도 import하지 않으면 Generator가 잘못된 선언으로 보고 실패한다.
- `config/vitest.config.ts`, `tsconfig.json`, `.gitlab-ci.yml` 같은 프로젝트가 고쳤을 수 있는 파일에는 패치를 두지 않는다. Storybook에 필요한 항목은 Generator가 구조를 읽어 더한다(`src/storybook.ts`).
- 스토리는 Recipe에 두지 않는다. 컴포넌트의 상호작용과 상태마다의 접근성은 컴포넌트 테스트가, 실제 브라우저가 있어야 하는 검사는 E2E가 맡는다([테스트](#테스트)).

### remove.txt

Starter에서 지울 경로를 한 줄에 하나씩 적는다. `#`으로 시작하는 줄은 주석이다. 적힌 경로가 Starter에 없으면 생성이 실패한다.

### dotfile

npm은 패키지를 만들 때 `.gitignore`와 `.npmrc`를 뺀다. 특히 `.gitignore`는 그 디렉터리의 파일을 빼는 규칙으로 쓰이므로 Recipe에 두지 않는다. Starter의 `.gitignore`를 고치려면 `.gitignore.patch`를 쓴다. `.env.*`, `.gitlab-ci.yml` 같은 다른 dotfile은 그대로 담긴다. `.env.*`는 Starter의 같은 파일을 대신하지 않고 변수 단위로 병합된다([환경 변수](#환경-변수)).

## 확장 지점

여러 Recipe가 Base의 같은 파일, 같은 자리(또는 sitemap처럼 한 Recipe가 더한 파일에 다른 Recipe가 알려야 하는 자리)에 끼어들어야 하는 곳이다. 이 자리를 패치로 고치면 Recipe끼리 맥락 줄이 어긋나 모든 Recipe를 켜는 Showcase를 만들 수 없으므로, Recipe는 자기 조각만 더하고 Generator가 모든 overlay를 덧입힌 뒤 한꺼번에 조립한다(ADR-0010). Base와 Rendering Mode overlay도 같은 방법으로 자기 조각을 더한다.

| 확장 지점                                       | overlay에 두는 것                                                      | Starter에 생기는 파일                                           | Rendering Mode                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| Provider(`providers`), 머리글(`header`)         | `extensions.json` + 컴포넌트                                           | `src/app/app-shell.tsx`(루트 레이아웃이 씀)                     | 둘 다                                            |
| proxy(`proxy`)                                  | `extensions.json` + 요청 처리기                                        | `src/proxy.ts`                                                  | `server`만                                       |
| next.config(`nextConfig`)                       | `extensions.json` + 설정 래퍼                                          | `config/next.config.plugins.ts`(`next.config.ts`가 씀)          | 둘 다                                            |
| instrumentation(`instrumentation`)              | `extensions.json` + 서버 조각                                          | `src/instrumentation.ts`                                        | 둘 다(`static-export`는 개발 서버만)             |
| instrumentation-client(`instrumentationClient`) | `extensions.json` + 브라우저 조각                                      | `src/instrumentation-client.ts`                                 | 둘 다                                            |
| 백엔드 요청(`backendFetch`)                     | `extensions.json` + 요청 처리기                                        | `src/shared/api/backend-fetch.ts`(`apiFetch`와 BFF 프록시가 씀) | 둘 다(`static-export`는 빌드할 때와 개발 서버만) |
| MSW 핸들러(`mockHandlers`)                      | `extensions.json` + 직접 만든 MSW 핸들러의 배열                        | `src/shared/mocks/handlers.ts`(MSW가 씀)                        | 둘 다                                            |
| sitemap 규칙(`sitemap`)                         | `extensions.json` + 규칙 객체                                          | `src/app/sitemap-rules.ts`(`src/app/sitemap.ts`가 있을 때만)    | 둘 다                                            |
| OpenAPI 명세                                    | `openapi.yaml`(명세 조각)                                              | `openapi.yaml`, `src/shared/api/generated/`                     | 둘 다                                            |
| 환경 변수                                       | `.env.example`, `.env.development` 등, `types/process-env.<이름>.d.ts` | 같은 이름의 dotenv 파일                                         | 둘 다                                            |

시험용 Recipe 둘(`harness/fixtures/recipes/extension-a-fixture`, `extension-b-fixture`)이 모든 확장 지점을 함께 쓰는 예다. `harness/extension-points.test.ts`가 두 Recipe를 함께 켠 Starter를 Rendering Mode마다 만들어 검증한다.

### extensions.json

overlay 최상위에 두고, 확장 지점마다 조각의 배열을 적는다. Starter에는 덧입히지 않는다.

```json
{
  "providers": [{ "path": "src/shared/<이름>/<이름>-provider.tsx", "export": "SomeProvider", "order": 300 }],
  "header": [{ "path": "src/features/<이름>/<이름>-switcher.tsx", "export": "SomeSwitcher", "order": 200 }],
  "proxy": [{ "path": "src/shared/<이름>/<이름>-proxy.ts", "export": "someProxy", "order": 100 }],
  "nextConfig": [{ "path": "src/shared/<이름>/next-config.ts", "export": "withSome", "order": 100 }],
  "instrumentation": [
    { "path": "src/shared/<이름>/<이름>-instrumentation.ts", "export": "someInstrumentation", "order": 50 }
  ],
  "instrumentationClient": [
    { "path": "src/shared/<이름>/<이름>-instrumentation-client.ts", "export": "someClientInstrumentation", "order": 50 }
  ],
  "backendFetch": [{ "path": "src/shared/<이름>/<이름>-backend-fetch.ts", "export": "someBackendFetch", "order": 100 }],
  "mockHandlers": [{ "path": "src/shared/<이름>/<이름>-mock-handlers.ts", "export": "someMockHandlers", "order": 100 }],
  "sitemap": [{ "path": "src/shared/<이름>/<이름>-routes.ts", "export": "someSitemapRules", "order": 100 }]
}
```

| 항목     | 뜻                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path`   | Starter 최상위 기준의 `.ts`·`.tsx` 모듈. 보통 그 Recipe가 더한 파일이다. 모든 overlay를 덧입힌 뒤의 Starter에 없으면 생성이 실패한다.                                          |
| `export` | 그 모듈이 내보내는 이름. 조립 파일이 이 이름으로 import한다. 짓는 법은 아래 목록에 있다.                                                                                       |
| `order`  | 같은 지점의 조각 사이의 순서(정수). 작은 것이 먼저이고, 감싸는 지점(Provider, proxy, next.config)에서는 바깥이다. 같으면 덧입힌 순서(Base → Rendering Mode → Recipe)를 따른다. |

- 조립 파일은 Generator가 모든 overlay를 덧입힌 뒤 매번 새로 쓴다. 패치하거나 대신할 수 없다. 조립 파일의 틀(머리글의 모양, proxy의 matcher 등)은 Generator 코드(`src/extensions.ts`)가 정한다.
- 조각의 모양은 조립 파일의 타입이 정하므로 Starter의 `typecheck`가 검사한다. 모듈은 ADR-0005의 계층과 폴더 깊이를 지킨다. `src/app/app-shell.tsx`는 `app` 계층이라 `features`와 `shared`의 컴포넌트를 모두 쓸 수 있다.
- 알 수 없는 지점이나 항목은 오타로 보고 생성이 실패한다.
- `export` 이름이 한 조립 파일에서 다른 조각과 겹치면 생성이 실패한다. 조각이 하는 일이나 다루는 리소스를 드러내 짓고(`authProxy`, `ThemeProvider`, `membersHandlers`), 다른 Recipe도 쓸 만한 흔한 이름이면 Recipe 이름을 담는다. Showcase가 모든 Recipe와 Archetype을 함께 켜므로 겹친 이름은 CI에서 드러난다.
- Base의 조각은 `base/extensions.json`에 있다: `QueryProvider`(100), `ToastProvider`(200), 서버 `apiInstrumentation`(100, MSW나 백엔드 주소 확인), MSW 핸들러 `pageNavigationHandlers`(0, 페이지 탐색 요청은 목 응답 없이 보냄). Rendering Mode `static-export`는 브라우저 `browserMockingInstrumentation`(100)을 더한다.

#### Provider와 머리글(`providers`, `header`)

루트 레이아웃(`src/app/layout.tsx`)은 `<AppShell>`로 모든 페이지를 감싼다. `src/app/app-shell.tsx`의 `AppShell`은 Provider를 `order` 순으로 겹쳐 감싸고(작은 것이 바깥), 머리글 항목이 있으면 가장 안쪽 Provider 안의 페이지 앞에 `<header>`를 두고 항목을 `order` 순으로 놓는다.

- Provider: `children`만 받는 컴포넌트. 서버 컴포넌트, 클라이언트 컴포넌트(`'use client'`), async 서버 컴포넌트 모두 된다. 다른 값이 필요하면 그 값을 채운 컴포넌트를 Recipe가 만들어 선언한다. Base의 `QueryProvider`(100)와 `ToastProvider`(200) 안에서 TanStack Query나 알림을 쓰려면 200보다 크게, 앱의 가장 바깥이어야 하면 100보다 작게 정한다. 예: dark-mode의 `ThemeProvider`(0)는 첫 화면 전에 테마를 적용하는 스크립트를 `<body>` 맨 앞에 둔다.
- 머리글 항목: props 없는 컴포넌트(예: 테마 전환, locale 전환, 사용자 메뉴). 다른 Recipe의 항목과 나란히 놓이므로 자기 영역만 그린다.
- `<html>`, `<head>`, `metadata`는 확장 지점이 아니다. 첫 화면 전에 `<html>`의 속성을 바꾸는 스크립트를 위해 Base의 `<html>`에는 `suppressHydrationWarning`이 있다.

#### proxy(`proxy`)

Next.js 16은 middleware를 proxy(`src/proxy.ts`, Node.js 런타임)로 바꿨다. 요청 처리기는 다음 모양이고, `order`가 작은 처리기부터 이어진다.

```ts
type ProxyHandler = (
  request: NextRequest,
  next: (request?: NextRequest) => Promise<NextResponse>,
) => NextResponse | Promise<NextResponse>
```

- 응답을 직접 돌려주면 요청이 거기서 끝난다(예: 로그인 페이지로 redirect). 뒤의 처리기와 라우트는 실행되지 않는다.
- `next()`를 부르면 다음 처리기에 넘기고, 받은 응답을 고쳐(헤더, 쿠키) 돌려줄 수 있다. 마지막 `next()`는 `NextResponse.next()`다.
- 헤더나 쿠키를 고친 요청(예: refresh한 토큰 쿠키)을 뒤로 넘기려면 `next(new NextRequest(request, { headers }))`처럼 고친 요청을 넘긴다. 뒤의 처리기는 그 요청을 받고, 라우트(서버 컴포넌트, Route Handler)도 그 헤더로 실행된다(`NextResponse.next({ request: { headers } })`).
- proxy는 페이지 요청에만 실행된다(`/api`, `/_next`, 확장자가 있는 경로는 빼는 matcher). 처리기는 `request.nextUrl.pathname`으로 자기가 다룰 경로를 고르고 나머지는 `next()`로 넘긴다. 예: 인증 보호(로그인하지 않았으면 redirect)를 앞에, locale 라우팅을 뒤에 둔다.
- `static-export` Starter에는 요청을 받는 서버가 없어 `src/proxy.ts`를 만들지 않는다. `static-export`도 지원하는 Recipe는 처리기 없이도 동작해야 한다.

#### next.config(`nextConfig`)

`(config: NextConfig) => NextConfig` 래퍼다. `next.config.ts`가 Base의 설정을 `config/next.config.plugins.ts`의 `withPlugins`에 넘기고, Provider처럼 `order`가 작은 래퍼가 바깥을 감싼다(큰 것부터 씌운다). 예: 가장 바깥이어야 하는 Sentry의 `withSentryConfig`는 작은 `order`로, next-intl의 플러그인은 그보다 큰 `order`로 둔다. 래퍼 모듈은 Next.js가 설정을 읽을 때 Node.js에서 바로 실행되므로 브라우저 코드를 import하지 않는다. Rendering Mode `static-export`의 `output: 'export'`는 Base 설정의 값 자체를 바꾸는 것이라 래퍼 대신 `next.config.ts`의 패치다. Recipe는 이 패치보다 뒤에 덧입혀지고 `next.config.ts`를 패치하지 않으므로 부딪치지 않는다.

#### instrumentation(`instrumentation`)

서버가 뜰 때 실행할 조각이다. Next.js의 `instrumentation.ts`와 같은 이름의 함수를 담은 객체를 내보낸다.

```ts
export const someInstrumentation = {
  async register() {}, // 서버 런타임(nodejs, edge)마다 한 번. 앞의 조각이 끝난 뒤 실행된다.
  onRequestError: (error, request, context) => {}, // 선택. Instrumentation.onRequestError
}
```

Node.js 전용 코드는 `process.env.NEXT_RUNTIME === 'nodejs'`를 확인한 뒤 동적 import로 불러온다(Base의 `src/shared/api/api-instrumentation.ts` 참고). `static-export` Starter에서는 개발 서버에서만 실행된다. 예: Sentry의 서버 초기화와 `captureRequestError`.

Next.js는 `next build`에서 instrumentation을 실행하지 않는다. 빌드할 때 SSG·ISR 페이지를 렌더링하는 서버 코드에도 필요한 준비는 그 코드가 처음 쓰일 때 한다. 예를 들어 Base의 서버 조각이 켜는 MSW는 빌드할 때 켜지지 않으므로, 목 빌드(`API_MOCKING=enabled`로 실행한 `next build`)에서는 서버의 `apiFetch`가 요청을 보내기 전에 켠다(`src/shared/api/api-mocking.ts`). 두 곳이 켜는 MSW는 같은 핸들러 목록(`src/shared/mocks/handlers.ts`)을 쓰므로, Recipe가 [MSW 핸들러](#msw-핸들러mockhandlers) 확장 지점에 더한 핸들러는 빌드할 때도 응답한다.

#### instrumentation-client(`instrumentationClient`)

브라우저에서 앱 코드와 hydration보다 먼저 실행할 조각이다. `{ register?(): void; onRouterTransitionStart?(url, navigationType): void }` 객체를 내보낸다. `register`는 `order` 순으로 한 번, `onRouterTransitionStart`는 App Router가 페이지를 옮기기 시작할 때마다 실행된다(예: Sentry 초기화, 분석의 페이지뷰). 모듈 최상위에서는 일을 하지 않고 `register` 안에서 한다(import 순서는 `order`와 다르다). 개발·목 빌드에서만 쓸 코드는 `if (process.env.NEXT_PUBLIC_<값> === 'enabled') { ... }`로 감싸야 배포용 빌드에서 빠진다. 앞에서 `return`하면 빌드가 덜어 내지 못한다(`static-export`의 `browser-instrumentation.ts` 참고).

#### 백엔드 요청(`backendFetch`)

서버가 백엔드로 보내는 요청, 곧 서버(서버 컴포넌트, Route Handler, proxy)에서 부른 `apiFetch`와 BFF 프록시(`/api/proxy/*`)가 전달하는 브라우저의 요청을 감싸는 처리기다. 예: auth Recipe가 세션 쿠키의 accessToken을 붙이고 401이면 refresh한 뒤 다시 보낸다. 백엔드에 locale 헤더를 붙이는 것도 이 자리다. 처리기는 `fetch`와 같은 인자를 받고, `order`가 작은 처리기부터 이어진다.

```ts
type BackendFetchHandler = (
  url: string,
  init: RequestInit,
  next: (url: string, init: RequestInit) => Promise<Response>,
) => Promise<Response>
```

- `next(url, init)`로 다음 처리기에 넘긴다. 마지막 `next`는 `fetch`다. 요청을 고칠 때는 `init`을 고치지 않고 새 객체를 넘긴다(`{ ...init, headers }`).
- 받은 응답을 고치거나 같은 요청을 다시 보낼 수 있다. 응답은 `order`의 거꾸로 거쳐 돌아간다. `fetch`가 돌려준 응답의 헤더는 고칠 수 없으므로 헤더를 복사한 새 `Response`를 만든다. BFF 프록시는 처리기가 더한 응답 헤더(예: `set-cookie`)도 브라우저에 넘긴다. 다시 보낼 때 쓰지 않을 응답 본문은 끝까지 읽어 버린다. Next.js의 `fetch`는 본문을 둘로 나눠(tee) 쓰므로 `body.cancel()`은 끝나지 않을 수 있다.
- 요청 본문은 BFF 프록시에서는 `ArrayBuffer`, `apiFetch`에서는 문자열이라 다시 보낼 수 있다.
- 처리기는 서버에서만 실행되므로 처리기 모듈은 `import 'server-only'`로 시작한다([코드 규칙](#코드-규칙)). 조립 파일(`backend-fetch.ts`)을 불러오는 것은 서버 전용 모듈(`api-fetch.server.ts`, `bff-proxy.ts`)뿐이다.
- 모든 요청에서 `cookies()`나 `headers()`를 읽으면 그 요청을 보낸 페이지가 모두 요청마다 렌더링되어(SSR) SSG·ISR 페이지를 미리 만들 수 없다. BFF 프록시가 전달하는 요청은 브라우저의 헤더(쿠키 포함)를 그대로 싣고 있으므로 요청 헤더에서 읽는다. 서버 컴포넌트의 요청에 사용자별 값을 붙이려면 auth Recipe처럼 페이지가 먼저 읽은 값을 그 렌더링 동안만 기억해 두고 쓴다(`src/shared/auth/session-scope.ts`).
- Base에는 처리기가 없다. 처리기가 없으면 `fetch`로 그대로 보낸다.

#### MSW 핸들러(`mockHandlers`)

명세에서 생성한 MSW 핸들러(`src/shared/api/generated/<tag>/<tag>.msw.ts`)는 늘 명세의 `example`을 돌려준다. 요청의 파라미터대로 거르고 정렬하거나(table), 발급한 토큰을 기억하거나(auth), 일부 요청을 실패시키는 목 백엔드가 필요하면 Recipe가 직접 만든 MSW 핸들러의 배열을 내보내고 이 지점에 선언한다.

```ts
import { http, HttpResponse } from 'msw'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'

export const someMockHandlers = [http.get(`${MOCK_API_BASE_URL}/some-resources`, () => HttpResponse.json([]))]
```

- Generator는 MSW의 핸들러 목록 `src/shared/mocks/handlers.ts`를 Recipe의 배열을 `order` 순으로 펼친 뒤 생성된 핸들러를 모두 붙여 쓴다. MSW는 앞의 핸들러가 먼저 응답하므로 Recipe의 핸들러는 같은 요청을 받는 생성된 핸들러(다른 Recipe의 명세 조각에서 생성된 것도)를 덮어쓴다. Recipe끼리 같은 요청을 받으면 `order`가 작은 Recipe의 핸들러가 응답한다. 핸들러가 응답을 돌려주지 않으면(`undefined`) 뒤의 핸들러가 그 요청을 받는다.
- 이 목록은 Vitest(`src/shared/mocks/node.ts`), 개발 서버와 E2E 대상 서버(instrumentation), 목 빌드(`apiFetch`), `static-export`의 브라우저(서비스 워커)가 함께 쓴다. 그래서 핸들러 모듈은 Node.js와 브라우저에서 모두 불러올 수 있어야 한다(Node.js 전용 모듈을 import하지 않는다).
- 핸들러는 목 백엔드 주소(`src/shared/api/base-url.ts`의 `MOCK_API_BASE_URL`, `https://mock.api.test`)로 가는 요청만 받게 `` `${MOCK_API_BASE_URL}/<경로>` ``로 쓴다. MSW가 켜져 있고 백엔드 주소(`API_BASE_URL`, 브라우저는 `NEXT_PUBLIC_API_BASE_URL`)가 없으면 서버와 `static-export`의 브라우저가 이 주소를 부르고, 명세에서 생성한 핸들러도 이 주소만 받는다(`config/orval.config.ts`). 앱과 다른 출처라 페이지 주소와 겹치지 않는다. `*/<경로>`처럼 주소를 가리지 않으면 브라우저의 MSW(서비스 워커)가 같은 경로의 페이지를 열거나 새로 고치는 요청에 페이지 대신 목 응답을 돌려줄 수 있다. Base의 `pageNavigationHandlers`(order 0)가 맨 앞에서 페이지 탐색 요청을 한 번 더 걸러 그대로 보낸다(ADR-0013).
- `static-export`의 브라우저 MSW(서비스 워커)는 준비되기 전에 나간 요청을 받지 못한다. fetch는 Rendering Mode의 `browser-instrumentation.ts`가 준비될 때까지 붙잡아 두지만 XMLHttpRequest, EventSource, WebSocket은 붙잡을 수 없으므로, 페이지를 연 직후에 그런 요청을 보낼 수 있는 Recipe 코드는 Base의 `waitForMocks()`(`src/shared/mocks/mock-readiness.ts`)를 기다린 뒤 보낸다(예: file-upload의 `apiUpload`, realtime의 이벤트 스트림). 목을 끈 빌드와 `server`에서는 바로 끝난다.
- 테스트 하나에서만 응답을 바꾸려면 이 지점 대신 테스트에서 `server.use(...)`를 쓴다. 테스트의 핸들러는 서비스 워커에 들어가지 않으므로 `*/<경로>`로 써도 된다. Vitest에서는 브라우저 코드(jsdom)의 요청도 목 백엔드 주소로 간다(`server`는 `src/shared/api/base-url.ts`가 `VITEST=true`를 보고, `static-export`는 `config/vitest.setup.ts`가 `NEXT_PUBLIC_API_BASE_URL`에 넣는다).
- Base는 페이지 탐색 요청을 거르는 `pageNavigationHandlers`(order 0, `src/shared/mocks/page-navigation.ts`)를 더한다. Base의 `src/shared/mocks/node.ts`가 이 파일을 쓰므로 늘 만든다.

#### sitemap 규칙(`sitemap`)

seo Recipe의 sitemap(`src/app/sitemap.ts`)은 `src/app`의 페이지 파일을 찾아 저절로 넣지만, 페이지를 더한 Recipe만 아는 것이 있다. 로그인해야 들어가는 페이지는 검색 엔진에 알리지 않아야 하고(auth), 값을 아는 동적 세그먼트 아래 페이지는 그 값마다 알려야 한다(i18n의 `[locale]`). 그런 Recipe는 자기 페이지의 규칙을 이 지점에 선언하고, sitemap과 robots.txt(`src/app/robots.ts`)는 조립 파일 `src/app/sitemap-rules.ts`의 `sitemapRules`를 읽는다. seo가 이 Recipe들의 모듈을 import하지 않고, 이 Recipe들도 seo에 기대지 않는다.

```ts
export const someSitemapRules = {
  exclude: ['/login'], // sitemap에 넣지 않는다. 그 아래 주소도 뺀다(`/`는 홈만). 검색 결과에서 빼려면 그 페이지의 metadata에 robots: { index: false }를 적는다
  disallow: ['/internal'], // robots.txt가 막는다. 그 아래 주소도 막고 sitemap에도 넣지 않는다. robots.txt는 누구나 읽으므로 숨길 주소는 적지 않는다
  locales: { param: 'locale', values: ['ko', 'en'], defaultValue: 'ko' }, // [locale] 아래 페이지를 locale마다 넣고 서로를 언어별 주소(hreflang)로, defaultValue의 주소를 x-default로 알린다
}
```

- 세 항목 모두 선택이다. 규칙은 모두 합쳐 쓰므로 `order`는 결과를 바꾸지 않는다. `locales`는 한 Recipe만 적는다.
- 조립 파일은 Starter에 sitemap(`src/app/sitemap.ts`)이 있을 때만 만든다. sitemap이 있으면 조각이 없어도 만들고(`sitemapRules`가 빈 배열), sitemap이 없으면 조각을 선언한 Recipe가 있어도 쓸 곳이 없어 만들지 않는다. 그래서 조각은 새 파일 대신 그 Recipe의 기존 모듈(예: auth의 `access-rules.ts`)에 두어, sitemap이 없는 Starter에 쓰이지 않는 파일이 생기지 않게 한다.
- 조각의 모양은 조립 파일의 `SitemapRules`가 정하고 Starter의 `typecheck`가 검사한다. `src/app` 계층의 파일이라 `src/app/sitemap.ts`, `robots.ts`만 import한다.

### OpenAPI 명세 조각(`openapi.yaml`)

overlay 최상위의 `openapi.yaml`은 Base 명세를 대신하지 않고, Base 명세에 병합할 명세 조각이다. `paths`, `components`, `tags`만 담는다(`openapi`, `info`, `servers`, `security`는 Base만 정한다).

```yaml
tags:
  - name: auth
    description: 인증
paths:
  /sessions:
    post:
      operationId: login
      tags: [auth]
      # ...
components:
  schemas:
    Credentials:
      type: object
      # ...
```

- 조각의 경로, 컴포넌트(`components.schemas` 등), tag는 Base와 앞선 조각 뒤에 덧붙는다. 주석과 표기는 그대로 남는다.
- 같은 경로, 같은 컴포넌트 이름, 같은 tag, 같은 operationId가 Base나 다른 Recipe에 이미 있으면 무엇을 만들기 전에 겹친 것을 모두 알리며 실패한다. Base의 operation을 고칠 수는 없으므로 새 경로를 더한다. Base의 tag(예: `products`)에 operation을 더하는 것은 된다.
- 병합한 명세는 Starter의 `openapi.yaml`이 되고, Generator가 이 명세로 재생성 계층(`src/shared/api/generated`)을 다시 만든다(`npm run api:gen`과 같은 결과. Generator는 Base와 같은 버전의 orval을 담고 있다. [의존성 버전 올리기](release.md#의존성-버전-올리기)). `npm run g -- query`·`mutation`도 이 `openapi.yaml`을 읽는다.
- MSW 목이 늘 같은 값을 돌려주도록 응답에 `example`을 적는다.
- 응답 스키마의 선택 속성(`required`에 없는 속성)은 실제 명세처럼 그대로 둔다. 생성된 타입과 Zod 스키마는 선택 속성을 빠질 수 있는 키로 다루고(`exactOptionalPropertyTypes`), `example`이 없는 응답의 목은 선택 속성을 응답마다 넣거나 키째 뺀다(Base의 `config/orval.config.ts`). typecheck를 통과하려고 속성을 모두 `required`로 바꾸지 않는다.
- 응답 스키마도 실제 명세처럼 그 자리에 적은 `oneOf`·`anyOf`(스키마 둘 중 하나, 스키마 또는 `null` 등)로 둬도 된다. 재생성 계층은 이런 응답의 Zod 스키마를 `<operationId><상태 코드>` 이름(예: `GetPayment200`)으로 만들어 fetch 함수가 응답을 검증한다(Base의 `config/orval.config.ts`의 `aliasCombinedTypes`). 이름 있는 스키마로 옮기지 않아도 된다.

### 환경 변수

overlay의 dotenv 파일(`.env`, `.env.<이름>`)은 Starter의 같은 파일을 대신하지 않고 변수 단위로 병합된다.

- 변수 한 줄과 그 바로 위에 빈 줄 없이 붙은 주석이 한 항목이다. Starter에 같은 변수가 있으면 그 항목을 그 자리에서 바꾸고, 새 변수는 overlay의 문단 그대로 끝에 덧붙인다. 변수에 붙지 않은 주석 문단도 덧붙는다. Starter에 그 파일이 없으면 새로 만든다.
- 같은 파일의 같은 변수는 같은 값으로만 다시 적을 수 있다(주석은 바꿔도 된다). Base, Rendering Mode, Recipe 가운데 둘이 같은 변수에 다른 값을 적으면 어느 값이 맞는지 정할 수 없으므로, 무엇을 만들기 전에 그런 변수와 두 곳의 값을 모두 알리며 실패한다. 예: `- .env.development의 API_MOCKING: Base에서 'enabled', Recipe <이름>에서 'disabled'`. 값은 dotenv가 읽는 값으로 비교하므로 감싼 따옴표나 값 뒤의 주석만 다른 것(`X=`, `X=""`, `X= # 설명`)은 같은 값이다. 다른 파일(`.env.development`와 `.env.production`)의 같은 변수는 비교하지 않는다. 다른 값이 필요하면 Recipe 이름을 담은 새 변수를 쓰고, Base의 값을 바꿔야 하면 Base를 고친다. `harness/extension-points.test.ts`가 시험용 Recipe `dotenv-conflict-fixture`로 검증한다.
- `.env.example`: 배포 환경에 넣을 변수의 목록이다. Next.js는 읽지 않으므로 값은 비우고, 주석에 무엇을 넣는지 적는다. 운영에 필요한 변수(비밀 값, DSN 등)는 여기에 더한다.
- `.env.development`: `npm run dev`가 읽는 기본값. 개발 서버가 바로 뜨는 데 필요한, 비밀이 아닌 값만 둔다.
- 변수의 타입은 Recipe의 `types/process-env.<Recipe 이름>.d.ts`에 `declare namespace NodeJS { interface ProcessEnv { readonly <이름>?: string } }`로 선언한다. TypeScript가 Base의 `types/process-env.d.ts`와 합치므로 Base 파일을 고치지 않는다.
- 변수의 쓰임은 Recipe의 README 절에 적는다.

## 코드 규칙

Recipe가 더한 파일은 Starter의 일부로 검사된다. 생성 직후의 Starter가 `typecheck`, `lint`, `format:check`, `test`, `build`, `test:e2e`를 모두 통과해야 한다. dark-mode처럼 Storybook 설정에 끼어드는 Recipe는 `g story`로 Storybook을 더한 Starter의 `test:storybook`도 통과해야 한다. `build`는 Starter의 GitLab CI처럼 목 빌드(`API_MOCKING=enabled`, ADR-0011)를 말한다. 배포할 때만 정해지는 값(seo의 사이트 주소 등)이 없으면 배포용 빌드는 실패해도 되지만, 목 빌드는 그 값 없이도 통과해야 한다.

- import 방향(`app → features → queries → shared`)과 폴더 깊이(`src/<계층>/<이름>/<파일>`)를 지킨다(ADR-0005). 예: 테마 적용은 `src/shared/theme/`, 전환 UI는 `src/features/theme-switcher/`.
- 서버에서만 실행되는 모듈은 `import 'server-only'`로, 컴포넌트가 아니면서 브라우저에서만 실행되는 모듈(instrumentation-client 조각 등)은 `import 'client-only'`로 시작한다. 쿠키·`next/headers`, 세션 암호화, 서버 전용 환경 변수의 비밀 값, `msw/node`, Node.js 내장 모듈을 쓰거나 백엔드를 직접 부르는 모듈이 서버 전용이다. `src/app`의 파일, proxy·instrumentation 조립 파일은 Next.js가 위치로 구분하므로 표시하지 않는다. `'use server'`는 Server Function을 여는 지시어이므로 서버 전용 표시로 쓰지 않는다. 표시한 모듈은 Next.js 밖(E2E, `next.config` 래퍼, `config/`의 설정)에서 import할 수 없으므로, 그런 곳이 쓰는 값은 표시하지 않은 모듈에 둔다(예: auth의 `SESSION_COOKIE`는 `auth-client.ts`). `client-only`를 쓰는 Recipe는 `package.json`에 의존성으로 더한다(`server-only`는 Base에 있다). 하네스 `harness/server-only.test.ts`가 표시를 검사한다.
- 모양은 디자인 토큰으로 만든 유틸리티만 쓴다. 테마가 토큰 값만 바꿔 적용되도록 Tailwind 기본 팔레트나 임의의 색을 쓰지 않는다.
- 포맷은 Starter의 Prettier 설정(`base/.prettierrc.json`)을 따른다.
- 주석과 문서는 한국어로, 식별자는 영어로 쓰고 GLOSSARY의 용어를 쓴다.

## 테스트

Recipe는 자기 테스트를 Starter에 함께 넣는다. Starter의 스크립트와 GitLab CI가 그대로 실행하므로, Recipe의 동작은 Starter 안에서 검증된다.

| 종류                                                                 | 위치                  | 실행               |
| -------------------------------------------------------------------- | --------------------- | ------------------ |
| 단위·컴포넌트 테스트(상호작용, 상태마다의 접근성)                    | `src/**/*.test.ts(x)` | `npm test`         |
| E2E(실제 브라우저: 페이지의 접근성과 명도 대비, 라이트·다크 모드 등) | `e2e/*.spec.ts`       | `npm run test:e2e` |

컴포넌트가 보일 수 있는 상태(변형, 비활성, 검증 오류, 불러오는 중, 실패 등)마다 컴포넌트 테스트에서 `axeViolations`(`src/shared/a11y/axe-violations.ts`)로 접근성을 검사한다. jsdom은 화면을 그리지 않아 색을 계산하지 못하므로, 명도 대비(dark-mode의 토큰, chart의 선·막대 등)는 그 상태가 보이는 페이지를 E2E가 `@axe-core/playwright`와 직접 잰 값으로 검사한다. 실제 스크롤처럼 jsdom에 없는 브라우저 동작도 E2E가 본다. Recipe는 스토리를 두지 않는다(ADR-0014).

E2E는 모든 Rendering Mode에서 같은 spec이 돌아야 한다. `server`는 빌드 결과를 `next start`로, `static-export`는 다시 빌드한 `out/`을 정적 파일 서버로 띄운다. 모든 Recipe·Archetype을 켠 Showcase에서도 다른 Recipe와 Archetype의 E2E와 함께 돌므로, 다른 Recipe가 더한 화면 요소(예: dark-mode의 머리글)가 있어도 통과하게 쓴다.

레포의 하네스(`harness/`)에는 Recipe마다 조합 매트릭스 테스트를 더한다. 지원하는 Rendering Mode마다 Recipe를 넣은 Starter를 만들고 Starter의 스크립트를 실행한다. `harness/dark-mode.test.ts`처럼 `useStarter({ prefix: 'dcgen-<이름>-', renderingMode, recipes: ['<이름>'], install: true, playwright: true })`를 쓴다(`playwright`는 `test:e2e`가 쓰는 Chromium을 받는다). 지원하지 않는 조합의 거부와 `requires`는 `recipe.json`만으로 동작하므로 Recipe마다 따로 시험하지 않아도 된다(`harness/recipes.test.ts`가 시험용 Recipe로 검증한다). 확장 지점의 조립과 병합도 마찬가지다(`harness/extension-points.test.ts`). Recipe의 하네스는 자기 조각이 Starter에서 동작하는지만 본다. Starter의 스크립트로 검사할 수 없는 조각(예: Docker가 있어야 만드는 `docker` Recipe의 이미지)은 Recipe의 하네스가 대신 검사하고, Starter의 README에 사람이 확인하는 방법을 적는다.

```sh
npx vitest run harness/<이름>.test.ts   # 하네스는 Generator를 npm pack으로 묶어 설치한 dcgen으로 Starter를 만든다
```

## Showcase

Showcase(`apps/showcase/`)는 Base에 Rendering Mode `server`와 Generator에 담긴 모든 Recipe, 모든 Archetype을 덧입혀 생성한 Starter다(ADR-0002). 생성 결과를 커밋해 두어 GitHub에서 CLI 없이 코드를 둘러볼 수 있고, 로컬에서는 명령 하나로 실행해 본다. Showcase는 직접 고치지 않는다. 주석을 달 수 있는 파일은 맨 위 주석이 고칠 원본(Base 파일, Recipe 파일, Recipe의 패치)을 알리고, 주석을 달 수 없는 파일(JSON 등)은 Showcase의 README 맨 위 안내가 알린다.

| 명령(레포 최상위)        | 하는 일                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run showcase`       | Generator를 빌드하고 Showcase를 다시 만들어 `apps/showcase/`를 그 결과와 같게 만든다. 바뀐 파일만 쓰고, 이제 생기지 않는 파일은 지운다                                            |
| `npm run showcase:check` | 다시 만든 결과가 `apps/showcase/`와 다르면 다른 파일을 알리고 실패한다. CI(GitHub Actions의 `Showcase drift`)가 실행한다                                                          |
| `npm run showcase:watch` | Generator의 Base, Recipe, Archetype, Rendering Mode overlay, 소스가 바뀔 때마다 Showcase를 다시 만든다                                                                            |
| `npm run showcase:dev`   | Showcase를 레포 밖(운영체제의 임시 디렉터리)에 복사·설치하고 MSW 목으로 개발 서버를 띄운다. Showcase가 바뀌면 개발 서버에 옮긴다. `-- --port 3001`처럼 `next dev`의 인자를 넘긴다 |

- 같은 원본에서는 늘 같은 Showcase가 나온다. 생성 결과에 시각이나 난수 같은 값을 넣지 않는다. Recipe의 파일도 마찬가지다.
- Showcase는 Rendering Mode `server`라서, Recipe와 Archetype은 `server`를 지원해야 Showcase에 들어간다(지원하지 않으면 생성이 실패한다).
- Showcase는 npm workspace가 아니고 레포 안에서 설치하지 않는다. 설치하면 Starter의 lefthook이 postinstall에서 이 레포에 git 훅과 `lefthook.yml`을 만들고, workspace로 두면 레포를 설치할 때마다 Showcase의 의존성까지 설치하게 된다. `showcase:dev`는 레포 밖에서 설치하고, Showcase가 고정한 Generator 대신 레포의 Generator를 쓴다.
- Showcase의 `package.json`은 다른 Starter처럼 Generator를 정확한 버전으로 고정한다. 그래서 Generator 버전을 올리는 Version PR(`npm run release:version`)도 Showcase를 다시 만든다([릴리스와 배포](release.md)).
- 하네스의 `harness/showcase.test.ts`가 생성·어긋남 검사·watch·dev를, `harness/showcase-starter.test.ts`가 Showcase를 설치해 Starter의 모든 스크립트를 검증한다. 후자가 조합 매트릭스의 "모든 Recipe·Archetype을 켠 조합"이다.

### Recipe를 더하거나 고칠 때

Recipe 티켓은 Showcase에 반영된 것으로 완료를 확인한다.

1. Recipe를 고치는 동안 `npm run showcase:watch`와 `npm run showcase:dev`를 터미널 두 개에 띄워 두면, 고친 결과가 Showcase에 다시 생성되고 개발 서버에 바로 보인다.
2. 끝나면 `npm run showcase`로 다시 만들어 Recipe의 변경과 `apps/showcase/`의 변경을 같은 PR에 올린다. 생성 결과는 따로 커밋해 두면 리뷰하기 쉽다.
3. Showcase가 원본과 다르면 CI의 `showcase:check`가 실패한다. `apps/showcase/`를 직접 고쳐 맞추지 말고 원본을 고친 뒤 다시 만든다.
4. 다른 Recipe와 부딪치는 패치나 테스트는 `harness/showcase-starter.test.ts`(모든 Recipe·Archetype을 켠 Showcase)에서 드러난다.

## 릴리스

Recipe를 더하거나 고친 PR에는 changeset(`npm run changeset`)을 함께 커밋한다. 다음 Generator 버전과 CHANGELOG에 실린다([릴리스와 배포](release.md)).

## 예: dark-mode

| 선언하는 것    | `recipes/dark-mode/`                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/shared/ui/tokens-dark.css`, `src/shared/theme/theme.ts`, `theme-script.tsx`, `theme-provider.tsx`, `src/features/theme-switcher/` |
| 확장 지점      | `extensions.json`: Provider `ThemeProvider`(order 0, 테마 스크립트), 머리글 `ThemeSwitcher`(order 100)                                 |
| 설정 패치      | `src/shared/ui/styles.css.patch`                                                                                                       |
| Storybook 조각 | `storybook/.storybook/preview.tsx.patch`(테마 툴바), `storybook/.storybook/vitest-project.ts.patch`(다크 모드 브라우저)                |
| npm 의존성     | 없음(`package.json`을 두지 않는다)                                                                                                     |
| 자기 테스트    | `src/shared/theme/theme.test.ts`, `e2e/dark-mode.spec.ts`(전환 UI, 두 테마의 접근성)                                                   |
| 필요한 Recipe  | 없음                                                                                                                                   |
| Rendering Mode | `server`, `static-export`                                                                                                              |

## 예: route-rendering

`server` 안에서 라우트마다 고르는 Rendering Mode(SSR, SSG, ISR, 스트리밍, CSR)를 `/rendering` 아래 데모 페이지로 나란히 보여 주는 Recipe다. 요청을 받는 Next.js 서버가 있어야 하므로 `server`만 지원하고, `renderingModesReason`으로 `static-export`에서 고를 수 없는 이유를 알린다. Showcase(Rendering Mode `server`)에는 들어간다.

| 선언하는 것    | `recipes/route-rendering/`                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/app/rendering/`(목록과 `ssr`, `ssg`, `isr`, `streaming`, `csr` 데모 라우트), `src/features/rendering-demo/` |
| 설정 패치      | 없음                                                                                                             |
| npm 의존성     | 없음                                                                                                             |
| 자기 테스트    | `src/features/rendering-demo/browser-product-list.test.tsx`, `e2e/route-rendering.spec.ts`                       |
| 필요한 Recipe  | 없음                                                                                                             |
| Rendering Mode | `server`                                                                                                         |

## 예: table

TanStack Table로 정렬·필터·페이지를 백엔드가 처리하는 목록 테이블(`/members`)을 보여 주는 Recipe다. Base 명세의 operation은 고칠 수 없으므로 명세 조각으로 정렬·필터·페이지 파라미터를 받는 목록 operation `listMembers`(tag `members`)를 더하고, Query Domain(`src/queries/members/`)은 `npm run g -- query listMembers`가 만든 코드를 그대로 담는다. 테이블의 상태를 쿼리 파라미터로 바꿔 쿼리 키(ADR-0008)와 요청에 함께 담으므로, 브라우저가 상태가 바뀔 때마다 다시 요청한다. 그래서 서버에서 미리 가져오지 않고 두 Rendering Mode에서 같은 코드로 동작한다.

생성된 MSW 핸들러는 명세의 `example`만 돌려주므로, 파라미터대로 거르고 정렬하는 핸들러(`src/shared/mocks/members.ts`)를 확장 지점 [MSW 핸들러](#msw-핸들러mockhandlers)로 생성된 핸들러 앞에 둔다.

| 선언하는 것    | `recipes/table/`                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/app/members/page.tsx`, `src/features/member-table/`, `src/queries/members/`, `src/shared/mocks/members.ts`, `src/shared/ui/sort-icon.tsx`              |
| 확장 지점      | `openapi.yaml`(명세 조각): `GET /members`(`listMembers`), 스키마 `Member`, `MemberRole`, `MemberPage`. `extensions.json`: MSW 핸들러 `membersHandlers`(100) |
| 설정 패치      | 없음                                                                                                                                                        |
| npm 의존성     | `@tanstack/react-table`                                                                                                                                     |
| 자기 테스트    | `src/features/member-table/member-table.test.tsx`, `e2e/table.spec.ts`                                                                                      |
| 필요한 Recipe  | 없음                                                                                                                                                        |
| Rendering Mode | `server`, `static-export`                                                                                                                                   |

## 예: chart

Recharts로 대시보드용 시계열 차트(일별 방문 수)와 비교 차트(판매 채널별 이번 달·지난달 매출)를 `/charts`에 보여 주는 Recipe다. table처럼 명세 조각으로 통계 operation `listDailyVisits`, `listChannelSales`(tag `stats`)를 더하고, Query Domain(`src/queries/stats/`)은 `npm run g -- query`가 두 operation으로 만든 코드를 그대로 담는다. 차트는 브라우저에서 그리므로 데이터도 브라우저가 가져온다(`useQuery`). 그래서 두 Rendering Mode에서 같은 코드로 동작한다.

차트의 색은 Base 토큰을 더하거나 고치지 않고, `src/shared/chart/chart-theme.ts`가 이미 있는 디자인 토큰(`var(--color-*)`)으로만 정한다. 그래서 `dark-mode`에 기대지 않으면서도 `dark-mode`와 함께 넣으면 고치지 않아도 어두운 테마의 토큰을 따른다. 새 차트도 감쌀 `ChartFigure`는 차트 그림을 보조 기술에서 숨기고(`aria-hidden`) 같은 값을 데이터 표(`sr-only`)로 둔다. axe는 SVG의 선을 보지 않으므로 E2E가 선·막대·축 글자의 명도 대비를 라이트·다크 모드에서 직접 잰다.

| 선언하는 것    | `recipes/chart/`                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/app/charts/page.tsx`, `src/features/stats-charts/`, `src/queries/stats/`, `src/shared/chart/`                                                            |
| 확장 지점      | `openapi.yaml`(명세 조각): `GET /stats/daily-visits`(`listDailyVisits`), `GET /stats/channel-sales`(`listChannelSales`), 스키마 `DailyVisits`, `ChannelSales` |
| 설정 패치      | 없음                                                                                                                                                          |
| npm 의존성     | `recharts`, 그 peer dependency인 `react-is`                                                                                                                   |
| 자기 테스트    | `src/features/stats-charts/stats-charts.test.tsx`, `src/shared/chart/chart-contrast.test.ts`, `e2e/chart.spec.ts`                                             |
| 필요한 Recipe  | 없음                                                                                                                                                          |
| Rendering Mode | `server`, `static-export`                                                                                                                                     |

## 예: i18n

next-intl로 한국어(기본 locale `ko`)와 영어(`en`)를 지원하는 Recipe다. 번역한 페이지는 `src/app/[locale]/` 아래에 두어 주소 앞에 늘 locale이 붙고(`/ko`, `/en/i18n`), Base의 홈은 이 아래로 옮긴다. 머리글의 locale 전환 UI, `ko.json`의 타입으로 검사하는 메시지 키, 홈(`/`)에서 locale을 고르는 proxy 처리기를 더한다.

다른 Recipe는 i18n을 모르고 `src/app/<경로>`에 라우트를 더하므로, i18n이 그 라우트를 옮기거나 바꾸지 않고 함께 켜지는 라우팅을 골랐다(ADR-0012).

- **next-intl의 기본 구성(모든 페이지를 `app/[locale]/` 아래로)을 쓰지 않는다.** 그 구성은 `[locale]` 레이아웃을 루트 레이아웃으로 두고 `next/root-params`로 locale을 읽는다. Recipe가 그렇게 하면 Base와 다른 Recipe의 페이지를 모두 `[locale]` 아래로 옮겨야 해서 Showcase처럼 함께 켤 수 없다.
- **proxy의 rewrite와 헤더·쿠키로 locale을 넘기지 않는다.** proxy가 `/en/<경로>`를 `/<경로>`로 rewrite하고 locale을 요청 헤더나 쿠키로 넘기는 방식, 그리고 next-intl의 "i18n 라우팅 없이" 쿠키로 locale을 정하는 방식은 라우트를 옮기지 않지만, 서버 컴포넌트가 요청마다 헤더·쿠키를 읽어야 한다. 앱 전체를 감싸는 Provider에서 읽으면 모든 페이지가 요청마다 렌더링되어, route-rendering의 SSG 라우트(`dynamic = 'error'`)는 빌드가 실패하고 ISR은 의미를 잃으며, 랜딩 Archetype(SSG)과 `static-export`에서도 쓸 수 없다.
- **번역한 페이지만 `[locale]` 세그먼트 아래에 둔다.** `src/app/[locale]/`은 Base의 루트 레이아웃 아래 중첩 세그먼트이고, 정적 세그먼트가 동적 세그먼트보다 먼저 맞춰지므로 `/products`, `/rendering` 같은 다른 라우트와 부딪치지 않는다. 그 밖의 페이지는 번역하지 않은 페이지로 주소와 화면이 그대로다. locale은 주소의 `[locale]` params에서만 읽는다(서버 컴포넌트는 `getTranslations({ locale, namespace })`, 클라이언트 컴포넌트는 `useParams()`로 locale을 정하는 앱 전체의 `I18nProvider`). 요청마다 달라지는 값을 읽지 않으므로 번역한 페이지는 locale마다 빌드할 때 렌더링하고, 다른 Recipe 라우트의 Rendering Mode도 그대로다(`harness/i18n-combinations.test.ts`가 route-rendering과 함께 켜 확인한다).
- **proxy 처리기는 홈(`/`)과 locale이 붙은 주소만 다룬다.** 홈은 저장한 locale(`NEXT_LOCALE` 쿠키), 브라우저 언어, 기본 locale 순으로 고른 locale의 홈으로 보내고, locale이 붙은 주소에서는 그 locale을 저장한다. 나머지 요청은 손대지 않고 넘긴다. proxy가 없는 `static-export`에서는 Recipe의 `src/app/page.tsx`가 홈(`/`)에 기본 locale의 홈을 보여 주므로, Recipe는 두 Rendering Mode를 모두 지원한다.

검색 엔진에는 번역한 페이지가 metadata의 `alternates: localeAlternates(<locale을 뺀 주소>)`로 자기 주소(canonical)와 같은 페이지의 locale별 주소(hreflang), 지원하지 않는 언어의 사용자에게 보일 기본 locale의 주소(`x-default`)를 알린다. 공유 카드의 언어(og:locale)는 `[locale]` 레이아웃의 `generateMetadata`가 locale마다(`ko_KR`, `en_US`) 알린다. Next.js는 `openGraph`를 통째로 덮어쓰므로 위 레이아웃이 정한 OpenGraph(seo의 og:url, 사이트 이름, 공유 이미지)를 그대로 받아 locale만 바꾼다(`localeOpenGraph`). Next.js는 `alternates`를 통째로 덮어쓰므로 루트 레이아웃이 정한 canonical(seo의 `./`)도 함께 적는다. seo처럼 sitemap을 만드는 Recipe와 함께 넣으면 확장 지점 [sitemap 규칙](#sitemap-규칙sitemap)의 `i18nSitemapRules`(`routing.ts`)가 `[locale]` 아래 페이지를 locale마다 sitemap에 넣고 기본 locale의 주소를 `x-default`로 알리게 하며, 고른 locale의 홈으로 보내는 홈(`/`)을 뺀다. i18n은 seo를 모르고, sitemap이 없는 Starter에서 이 규칙은 쓰이지 않는다.

그 대가로 다음을 받아들인다. 루트 레이아웃은 locale을 모르므로 `<html lang="ko">`로 그리고, `[locale]` 레이아웃이 내용을 `<div lang>`으로 감싸며 `I18nProvider`가 브라우저에서 `<html lang>`을 바꾼다. 루트 레이아웃에서 메시지를 넘기므로 모든 locale의 카탈로그가 브라우저 번들에 들어간다. 서버 컴포넌트는 next-intl에 locale을 직접 넘겨야 하고, 넘기지 않으면 기본 locale로 조용히 그리는 대신 오류가 난다(`src/shared/i18n/request.ts`). 다른 Recipe의 페이지는 번역하지 않은 채 기본 locale로 보이고, 거기서 다른 locale을 고르면 그 locale의 홈으로 간다. Starter가 모든 페이지를 `[locale]` 아래로 옮기면 next-intl의 기본 구성으로 바꿀 수 있다(Starter README의 "다국어(i18n)").

| 선언하는 것    | `recipes/i18n/`                                                                                                                                                                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 추가 파일      | `src/shared/i18n/`(라우팅, 메시지 카탈로그 `ko.json`·`en.json`, next-intl 설정, Provider, proxy 처리기, navigation, locale별 주소), `src/app/[locale]/`(레이아웃, 홈, 다국어 예시 `/[locale]/i18n`), `src/features/home/`(홈 화면), `src/features/locale-switcher/`, `src/features/i18n-example/`, Base의 홈을 대신하는 `src/app/page.tsx` |
| 확장 지점      | `extensions.json`: Provider `I18nProvider`(order 50), 머리글 `LocaleSwitcher`(order 200), proxy `i18nProxy`(order 200), next.config `withI18n`(order 200, next-intl 플러그인), sitemap 규칙 `i18nSitemapRules`(order 200, locale마다 넣고 기본 locale을 x-default로 알리며 홈 `/`는 뺌)                                                    |
| 설정 패치      | `config/vitest.config.ts.patch`(next-intl의 proxy를 Vitest가 변환해 불러오게 한다)                                                                                                                                                                                                                                                         |
| 지우는 경로    | Base 홈의 `src/app/page.test.tsx`(`remove.txt`. 홈은 `[locale]` 아래로 옮겼다)                                                                                                                                                                                                                                                             |
| npm 의존성     | `next-intl`                                                                                                                                                                                                                                                                                                                                |
| 자기 테스트    | `src/shared/i18n/messages.test.tsx`, `request.test.ts`, `i18n-proxy.test.ts`, `locale-alternates.test.ts`, `src/features/i18n-example/cart-counter.test.tsx`, `e2e/i18n.spec.ts`(locale 전환 UI 포함)                                                                                                                                      |
| 필요한 Recipe  | 없음                                                                                                                                                                                                                                                                                                                                       |
| Rendering Mode | `server`, `static-export`(proxy가 없어 홈 `/`는 기본 locale의 홈)                                                                                                                                                                                                                                                                          |

## 예: auth

백엔드가 발급한 토큰으로 로그인하는 BFF 세션(ADR-0006)을 담은 Recipe다. 확장 지점 여섯과 명세 조각, 환경 변수로 끼어들고, 확장 지점이 없는 Base 파일 하나(E2E 설정)만 패치한다. 로그인·로그아웃 Route Handler와 BFF 프록시, proxy가 요청을 받는 서버에서 돌아야 하므로 `server`만 지원한다.

로그인, 내 정보, 관리자, 접근 권한 없음 페이지는 metadata의 `robots: { index: false }`로 검색 결과에서 빠진다. seo처럼 sitemap을 만드는 Recipe와 함께 넣으면 [sitemap 규칙](#sitemap-규칙sitemap)의 `authSitemapRules`(`access-rules.ts`)가 `PROTECTED_ROUTES`의 경로와 로그인·접근 권한 없음 페이지를 sitemap에서 뺀다. robots.txt로는 막지 않는다. 보호된 라우트는 로그인하지 않은 요청을 로그인 페이지로 보내 공개된 내용이 없고 모두 `noindex`이므로, 누구나 읽는 robots.txt에 적으면 보호된 주소를 알려 줄 뿐이다. 로그인 페이지까지 막으면 검색 엔진이 `noindex`를 읽지 못해, 다른 곳의 링크만으로 주소가 검색 결과에 남을 수 있다.

| 선언하는 것    | `recipes/auth/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/shared/auth/`(세션 쿠키, refresh, 처리기, 목 백엔드와 테스트의 목 로그인 `mock-session.ts`), `src/app/api/session/route.ts`, `src/app/login`, `account`, `admin`, `forbidden` 페이지, `src/features/login-form/`, `user-menu/`, `account-profile/`, `src/queries/auth/`                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 확장 지점      | `extensions.json`: 머리글 `UserMenu`(200), proxy `authProxy`(100, 보호된 라우트와 미리 refresh), instrumentation `authInstrumentation`(200, `SESSION_SECRET` 확인), 백엔드 요청 `authBackendFetch`(100, 토큰 첨부와 401 뒤 refresh, 토큰을 발급하는 operation은 BFF 프록시로 전달하지 않음), MSW 핸들러 `authMockHandlers`(100, 발급한 토큰을 기억하는 목 백엔드. 로그인해야 쓰는 다른 목 핸들러는 `mockUserOf`로 요청한 사용자를 확인하고, 사용자를 더하고 고치는 목 핸들러는 사용자를 따로 두지 않고 목 백엔드의 사용자 저장소 `mockUsers`·`saveMockUser`를 쓴다), sitemap 규칙 `authSitemapRules`(100, 보호된 라우트와 로그인·접근 권한 없음 페이지를 sitemap에서 뺌. robots.txt로는 막지 않음). 명세 조각 `openapi.yaml`(`auth` tag) |
| 환경 변수      | `SESSION_SECRET`(`.env.example`, `.env.development`, `types/process-env.auth.d.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 설정 패치      | `config/playwright.config.ts.patch`(E2E 대상 서버의 `SESSION_SECRET`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| npm 의존성     | `iron-session`, `cookie`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 자기 테스트    | `src/shared/auth/*.test.ts`(테스트의 목 로그인 포함), `src/features/login-form/login-form.test.tsx`, `src/features/user-menu/user-menu.test.tsx`, `e2e/auth.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 필요한 Recipe  | 없음                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Rendering Mode | `server`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## 예: multi-step-form

입점 신청서(`/partners/apply`)를 사업자 정보 → 담당자 정보 → 판매 계획 → 신청 내용 확인의 네 단계로 나눠 입력받고, 확인 단계에서 한 번에 보내는 Recipe다. table처럼 명세 조각으로 요청 본문이 큰 operation `submitPartnerApplication`(tag `partners`)을 더하고, Query Domain(`src/queries/partners/`)은 `npm run g -- mutation submitPartnerApplication`이 만든 뮤테이션 훅을 그대로 담는다. 검증 규칙을 명세에서만 가져오도록(ADR-0003) 단계마다 재생성 계층의 요청 본문 스키마에서 그 단계의 필드만 고른 스키마(`.pick`)로 검증하고, 확인 단계에서 요청 본문 스키마 전체로 한 번 더 검증한 뒤 보낸다. 입력 요소와 오류 표시, 알림은 `form` Schematic이 만드는 폼을 따른다(선택지의 이름만 화면에 맞게 적고, 약관 동의는 명세의 `const: true`대로 `MUST_CHECK_MESSAGE`로 알린다). 단계마다의 제목, 스키마, 입력 요소, 확인 단계에 보일 값은 `partner-application-steps.tsx`의 단계 목록 한 곳에 모아, 단계를 더하거나 순서를 바꿀 때 그 목록만 고친다.

다른 다단계 폼에도 쓸 부품은 `src/shared/multi-step-form/`에 둔다. `useFormSteps`가 단계와 모든 단계의 값(검증하기 전의 값)을 들고 단계를 옮길 때 포커스를 단계 제목으로 옮기며, `StepForm`이 단계마다 React Hook Form 폼을 하나씩 만들어 "다음"은 그 단계의 스키마로 검증하고 "이전"은 검증 없이 값을 넘긴다. 단계와 값은 `sessionStorage`에 둬 새로 고쳐도 이어 가고, 그린 뒤에 읽으므로 hydration이 어긋나지 않는다. 페이지 뼈대는 미리 렌더링하고 값은 브라우저가 들고 있다가 신청할 때만 요청하므로 두 Rendering Mode에서 같은 코드로 동작한다. MSW 목은 명세의 `example`만으로 충분해 직접 만든 핸들러가 없다.

| 선언하는 것    | `recipes/multi-step-form/`                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/app/partners/apply/page.tsx`, `src/features/partner-application/`, `src/queries/partners/`, `src/shared/multi-step-form/`                                   |
| 확장 지점      | `openapi.yaml`(명세 조각): `POST /partner-applications`(`submitPartnerApplication`), 스키마 `PartnerApplication`, `PartnerCategory`, `PartnerApplicationReceipt` |
| 설정 패치      | 없음                                                                                                                                                             |
| npm 의존성     | 없음(Base의 React Hook Form과 Zod를 쓴다)                                                                                                                        |
| 자기 테스트    | `src/features/partner-application/partner-application-form.test.tsx`, `src/shared/multi-step-form/draft-storage.test.ts`, `e2e/multi-step-form.spec.ts`          |
| 필요한 Recipe  | 없음                                                                                                                                                             |
| Rendering Mode | `server`, `static-export`                                                                                                                                        |

## 예: optimistic-update

할 일 목록(`/todos`)에서 완료 여부를 바꾸면 서버의 응답 전에 화면을 바꾸고(낙관적 업데이트), 서버가 거절하면 되돌린 뒤 알림(Toast)으로 알리는 Recipe다. 명세 조각으로 목록 operation `listTodos`와 할 일 하나를 고치는 `updateTodo`(tag `todos`)를 더하고, Query Domain(`src/queries/todos/`)은 `npm run g -- query listTodos`와 `npm run g -- mutation updateTodo --optimistic listTodos`가 만든 코드에 응답 전에 보일 값을 만드는 `applyUpdateTodo`만 채워 담는다. 캐시를 고치고(`onMutate`), 되돌리고(`onError`), 끝나면 `todosKeys.all`을 무효화하는(`onSettled`) 뼈대는 Schematic이 만든 그대로다(ADR-0008). 무엇을 왜 되돌렸는지 알리는 일은 화면의 일이므로 Feature(`src/features/todo-list/`)가 `mutate`의 `onError`에서 공통 `useToast()`로 한다. table처럼 할 일은 브라우저가 가져오고 고치므로 두 Rendering Mode에서 같은 코드로 동작한다.

생성된 MSW 핸들러는 명세의 `example`만 돌려주어, 저장한 뒤 목록을 다시 가져오면 바꾼 값이 사라진다. 그래서 바뀐 값을 기억하는 핸들러(`src/shared/mocks/todos.ts`)를 table처럼 확장 지점 [MSW 핸들러](#msw-핸들러mockhandlers)로 생성된 핸들러 앞에 둔다. 다른 Recipe의 핸들러와 받는 경로(`/todos`)가 겹치지 않으므로 `order`는 같은 100이다. 이 핸들러는 저장에 1초 뒤에 답하고 정해 둔 할 일 하나(4번)를 늘 403으로 거절한다. 그래서 개발 서버에서도 응답 전에 바뀌는 모습과 되돌리기가 보이고, E2E는 Playwright에서 핸들러를 바꾸지 않고도 실패를 늘 같은 할 일로 재현한다. Playwright가 브라우저에서 요청을 가로채는 방법(`page.route`, 그 위에서 동작하는 `@msw/playwright`)은 쓰지 않는다. `server`에서는 BFF 프록시로 가는 요청을 브라우저에서 가로채 프록시와 Next.js 서버의 MSW를 거치지 않는 다른 경로를 시험하게 되고, `static-export`에서는 MSW 서비스 워커가 받은 요청을 보지 못해 두 Rendering Mode에 같은 spec을 쓸 수 없다. E2E는 브라우저가 저장 응답을 받기 전에 체크가 바뀌었는지를 응답 이벤트로 확인한다.

| 선언하는 것    | `recipes/optimistic-update/`                                                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/app/todos/page.tsx`, `src/features/todo-list/`, `src/queries/todos/`, `src/shared/mocks/todos.ts`                                                                                    |
| 확장 지점      | `openapi.yaml`(명세 조각): `GET /todos`(`listTodos`), `PATCH /todos/{todoId}`(`updateTodo`), 스키마 `Todo`, `TodoUpdate`, `TodoError`. `extensions.json`: MSW 핸들러 `todosHandlers`(100) |
| 설정 패치      | 없음                                                                                                                                                                                      |
| npm 의존성     | 없음                                                                                                                                                                                      |
| 자기 테스트    | `src/features/todo-list/todo-list.test.tsx`, `e2e/optimistic-update.spec.ts`                                                                                                              |
| 필요한 Recipe  | 없음                                                                                                                                                                                      |
| Rendering Mode | `server`, `static-export`                                                                                                                                                                 |

## 예: infinite-list

긴 목록을 나눠 불러오는 두 패턴을 같은 게시글로 보여 주는 Recipe다. `/articles`는 목록 끝이 화면에 들어오면(`IntersectionObserver`) 다음 페이지를 불러와 이어 붙이는 무한 스크롤 목록이고, `/articles/pagination`은 같은 게시글을 쪽 번호로 넘겨 보는 번호형 페이지네이션이다. 명세 조각으로 페이지 번호를 받아 게시글 한 페이지를 배열로 돌려주는 `listArticles`와 전체 개수를 돌려주는 `countArticles`(tag `articles`)를 더하고, Query Domain(`src/queries/articles/`)은 `npm run g -- query listArticles --infinite`, `npm run g -- query listArticles`, `npm run g -- query countArticles`가 만든 코드를 그대로 담는다. `query --infinite`는 배열을 돌려주는 operation에만 쓸 수 있고 빈 페이지를 받으면 멈추므로, `listArticles`는 마지막 페이지 뒤의 페이지에 빈 배열을 돌려준다. table, chart처럼 데이터는 브라우저가 가져오므로 두 Rendering Mode에서 같은 코드로 동작한다.

스크롤하지 않는 키보드·스크린 리더 사용자를 위해 목록 끝에 더 보기 버튼을 둔다. 버튼으로 불러오면 새로 불러온 첫 항목으로 포커스를 옮기고, 버튼에 포커스가 있는 동안에는 스크롤로 불러오지 않는다. 무한 스크롤 목록과 쪽 번호의 틀(`src/shared/paging/`)은 쿼리를 직접 부르지 않고 불러온 항목과 상태(useInfiniteQuery의 `hasNextPage` 등, 지금 쪽과 쪽 수)만 props로 받으므로 다른 Query Domain의 목록에도 쓴다. jsdom에는 `IntersectionObserver`가 없어 컴포넌트 테스트는 가짜 observer로 스크롤을 흉내 내고, 실제 브라우저의 동작은 E2E가 본다.

table처럼 페이지 번호대로 나눠 돌려주는 MSW 핸들러(`src/shared/mocks/articles.ts`)를 확장 지점 [MSW 핸들러](#msw-핸들러mockhandlers)로 생성된 핸들러 앞에 둔다. 다른 Recipe의 핸들러와 받는 경로(`/articles`, `/articles/count`)가 겹치지 않으므로 `order`는 같은 100이다.

| 선언하는 것    | `recipes/infinite-list/`                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/app/articles/page.tsx`, `src/app/articles/pagination/page.tsx`, `src/features/article-list/`, `src/queries/articles/`, `src/shared/paging/`, `src/shared/mocks/articles.ts`            |
| 확장 지점      | `openapi.yaml`(명세 조각): `GET /articles`(`listArticles`), `GET /articles/count`(`countArticles`), 스키마 `Article`, `ArticleCount`. `extensions.json`: MSW 핸들러 `articlesHandlers`(100) |
| 설정 패치      | 없음                                                                                                                                                                                        |
| npm 의존성     | 없음                                                                                                                                                                                        |
| 자기 테스트    | `src/features/article-list/article-infinite-list.test.tsx`, `article-paged-list.test.tsx`, `src/shared/paging/infinite-list.test.tsx`, `pagination.test.tsx`, `e2e/infinite-list.spec.ts`   |
| 필요한 Recipe  | 없음                                                                                                                                                                                        |
| Rendering Mode | `server`, `static-export`                                                                                                                                                                   |

## 예: docker

`standalone` 출력(Base의 `next.config.ts`)으로 Next.js 서버만 담은 이미지를 만드는 멀티스테이지 `Dockerfile`과 상태 확인 주소 `GET /api/health`를 넣는 Recipe다. 배포 대상은 정하지 않았으므로(spec #1) 이미지를 만들고 띄우는 데까지만 갖추고, 레지스트리에 올리는 GitLab CI 잡은 Starter의 README에 예로만 적는다. 이미지를 만들려면 privileged 러너나 Buildah 같은 도구가 필요해, 기본으로 넣으면 사내 GitLab에 올리자마자 돌던 파이프라인이 러너에 따라 실패하기 때문이다. 요청을 받는 서버를 담으므로 `server`만 지원한다.

- 단계: `deps`(`package.json`과 `package-lock.json`만 복사해 `npm ci`) → `build`(배포용 빌드) → `runtime`(`.next/standalone`, `.next/static`, `public`만 복사). 기반 이미지는 `ARG NODE_IMAGE`에 `.nvmrc`와 같은 메이저 버전을 정확한 버전으로 고정하고, 실행 사용자는 node 이미지의 `node`를 숫자(`USER 1000:1000`)로 적는다. Kubernetes의 `runAsNonRoot`는 숫자 사용자만 확인할 수 있다.
- 빌드 인자: 빌드할 때 페이지와 번들에 박히는 값은 build 단계의 `ARG`로 받는다. Base의 `API_BASE_URL`, seo Recipe의 사이트 주소 `NEXT_PUBLIC_SITE_URL`, sentry Recipe의 브라우저 DSN `NEXT_PUBLIC_SENTRY_DSN`이다. seo를 넣은 Starter의 배포용 이미지는 `--build-arg NEXT_PUBLIC_SITE_URL=<사이트 주소>` 없이 만들면 seo가 빌드를 멈추고, 목 이미지는 seo가 개발 서버의 주소를 쓰므로 넣지 않아도 된다. sentry의 DSN은 빠져도 빌드되지만 브라우저가 오류를 보내지 않는다(서버의 `SENTRY_DSN`은 실행할 때 넣는다). 그 Recipe를 넣지 않은 Starter에서 이 `ARG`는 쓰이지 않는다. Dockerfile은 확장 지점이 아니고 seo와 sentry가 docker에 기대지 않도록 docker가 이 `ARG`를 둔다.
- 목 빌드(ADR-0011): 배포용 이미지는 `ARG API_MOCKING=disabled`로 빌드하고 다른 값은 거부한다. 백엔드 없이 띄워 볼 목 이미지는 `--target mock`으로만 만든다. 마지막 단계가 배포용 이미지라 `--target` 없이 빌드하면 목 이미지가 나오지 않는다.
- 비밀 값: `ARG`와 `ENV`에 넣지 않는다. 빌드할 때의 npm 토큰은 `--secret id=npmrc`로 `npm ci` 동안에만 마운트한다. 프로젝트의 `.npmrc`와 로컬 환경 변수 파일(`.env*.local`)은 `.dockerignore`가 뺀다. `.env*.local`은 `next build`가 읽어 번들과 미리 렌더링한 페이지, 빌드 캐시의 층에 남길 수 있다(standalone 출력은 `.env`와 `.env.production`만 이미지에 복사한다).
- Showcase는 생성 안내를 Dockerfile의 맨 위 주석으로 붙인다. 그 주석 뒤의 parser directive(`# syntax=`)는 읽히지 않으므로 Dockerfile에 directive를 쓰지 않는다.
- 하네스(`harness/docker.test.ts`)는 Docker가 있으면 Starter로 이미지를 만들어 컨테이너가 상태 확인 주소, 페이지, 정적 파일에 응답하는지, root가 아닌 사용자로 도는지, `HEALTHCHECK`가 healthy가 되는지, 로컬 환경 변수 파일의 값이 이미지에 없는지, 목을 켠 배포용 빌드를 거부하는지 보고 hadolint로 Dockerfile을 검사한다. seo, sentry와 함께 넣은 Starter로는 배포용 이미지가 사이트 주소 빌드 인자 없이는 만들어지지 않고, 넣으면 그 주소로 sitemap과 canonical을 만들며 빌드 인자로 넣은 Sentry DSN을 브라우저 번들에 담고 글꼴과 그 라이선스를 담는지 본다. Docker가 없으면 이유를 알리고 건너뛰지만 CI에서는 실패한다. 빌드 컨텍스트에서는 아직 npm에 없는 Generator를 `package.json`과 `package-lock.json`에서 빼고(`unlinkPackedGenerator`) 빌드한다.

| 선언하는 것    | `recipes/docker/`                                                                 |
| -------------- | --------------------------------------------------------------------------------- |
| 추가 파일      | `Dockerfile`, `.dockerignore`, `src/app/api/health/route.ts`                      |
| 설정 패치      | 없음                                                                              |
| npm 의존성     | 없음                                                                              |
| 자기 테스트    | `e2e/health.spec.ts`(이미지 자체는 하네스가 `docker build`·`docker run`으로 검사) |
| 필요한 Recipe  | 없음                                                                              |
| Rendering Mode | `server`                                                                          |

## 예: seo

검색 엔진과 공유 카드에 보이는 메타데이터, 페이지별 공유 이미지(OG 이미지), `/sitemap.xml`, `/robots.txt`를 만드는 Recipe다. 사이트 주소(`NEXT_PUBLIC_SITE_URL`)는 환경 변수 확장 지점으로 `.env.development`에 개발 서버의 주소를, `.env.example`에 빈 값을 더한다. 배포용 빌드에 값이 없으면 루트 레이아웃과 sitemap이 빌드를 멈추고, 배포하지 않는 목 빌드(`API_MOCKING=enabled`, ADR-0011)만 개발 서버의 주소를 쓰므로 GitLab CI와 E2E 설정은 고치지 않는다.

- 메타데이터의 기본값은 루트 레이아웃의 `metadata` 한 곳(`siteMetadata()`)이 정한다. canonical과 og:url을 `./`로 두면 Next.js가 페이지마다 그 페이지의 경로로 풀고, 공유 이미지는 Next.js가 가장 가까운 폴더의 `opengraph-image`를 물려주므로, 다른 Recipe와 Schematic의 페이지는 `title`과 `description`만 적어도 자기 주소와 공유 이미지를 알린다. 페이지가 `openGraph`, `twitter`, `alternates`를 적으면 그 항목의 기본값이 통째로 사라지므로 적지 않는다. 루트 레이아웃의 `metadata`는 확장 지점이 아니어서 패치(`src/app/layout.tsx.patch`)로 바꾼다.
- sitemap은 빌드할 때 `src/app`의 페이지 파일을 찾아 만든다(`src/shared/seo/page-routes.ts`). 다른 Recipe나 `npm run g -- page`가 더한 페이지는 sitemap을 고치거나 확장 지점에 선언하지 않아도 들어가고, 동적 세그먼트가 있는 페이지는 빠진다. 페이지 목록을 모으는 확장 지점은 두지 않았다. 페이지를 더하는 Recipe가 seo에 기대지 않아도 되고, Starter를 만든 뒤 더한 페이지도 같은 규칙으로 들어간다.
- 페이지를 더한 Recipe만 아는 규칙은 확장 지점 [sitemap 규칙](#sitemap-규칙sitemap)(`src/app/sitemap-rules.ts`)으로 받는다. sitemap은 규칙이 뺀 주소와 robots.txt가 막는 주소를 넣지 않고, locale을 받는 세그먼트 아래 페이지는 locale마다 넣는다. locale마다 넣은 페이지는 sitemap에서 같은 페이지의 locale별 주소(`alternates.languages`, hreflang)를 서로 알리고, 규칙에 기본 locale(`defaultValue`)이 있으면 그 주소를 `x-default`로도 알린다. 로그인해야 들어가는 페이지는 robots.txt로 막지 않고 sitemap에서만 뺀다(auth). sitemap에 넣은 페이지는 모두 다른 주소로 보내지 않고 200으로 응답해야 하므로 E2E가 하나씩 받아 본다.
- 공유 이미지는 `opengraph-image.tsx`가 `generateImageMetadata`로 `opengraph-image/image.png`처럼 확장자가 붙은 주소 하나로 만든다. 확장자가 없으면 static-export가 내보낸 파일(`out/opengraph-image`)을 정적 파일 서버가 이미지로 알리지 못한다. `next/og`는 기본 글꼴에 없는 글자를 빌드 중에 Google Fonts에서 받으므로, 한글 11,172자를 담은 글꼴(Pretendard Bold, SIL Open Font License 1.1)을 함께 넣어 네트워크 없이 같은 이미지를 만든다. 라이선스는 글꼴을 나눠 줄 때 라이선스를 함께 담게 하므로 글꼴 옆에 라이선스 전문(`pretendard-license.txt`)을 두고, 글꼴이 담기는 server Starter의 빌드 결과(`.next/standalone`과 그것으로 만든 컨테이너 이미지)에도 next.config 래퍼 `withSeo`가 라이선스 파일을 담는다(`outputFileTracingIncludes`).
- i18n Recipe의 `[locale]` 아래 페이지는 페이지 폴더에 `opengraph-image.tsx`를 두어도 locale마다 미리 만들어지지 않는다. Next.js가 이미지 라우트에는 `[locale]` 레이아웃의 `generateStaticParams`를 쓰지 않기 때문이다(`static-export`는 빌드가 실패한다). 그런 페이지의 공유 이미지는 `<경로>.png/route.tsx`처럼 확장자가 붙은 Route Handler가 `generateStaticParams`로 locale을 스스로 정해 `ogImage`로 그리고(`dynamic = 'force-static'`), 페이지의 metadata가 위 레이아웃의 OpenGraph를 그대로 둔 채 그 주소를 `openGraph.images`로 알린다(예: [랜딩 Archetype](archetypes.md#예-landing)의 `og-image.png`).

| 선언하는 것    | `recipes/seo/`                                                                                                                                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/opengraph-image.tsx`, `src/app/products/opengraph-image.tsx`, `src/shared/seo/`(글꼴과 라이선스 포함)                                                                                                               |
| 확장 지점      | 환경 변수: `.env.development`, `.env.example`의 `NEXT_PUBLIC_SITE_URL`, `types/process-env.seo.d.ts`. `extensions.json`: next.config `withSeo`(order 300, 빌드 결과에 글꼴의 라이선스를 담음). sitemap과 robots.txt가 sitemap 규칙(`src/app/sitemap-rules.ts`)을 읽는다 |
| 설정 패치      | `src/app/layout.tsx.patch`(루트 레이아웃의 metadata)                                                                                                                                                                                                                    |
| npm 의존성     | 없음(`next/og`는 Next.js에 들어 있다)                                                                                                                                                                                                                                   |
| 자기 테스트    | `src/shared/seo/site.test.ts`, `page-routes.test.ts`, `metadata.test.ts`, `og-image.test.tsx`, `src/app/sitemap.test.ts`, `robots.test.ts`, `e2e/seo.spec.ts`                                                                                                           |
| 필요한 Recipe  | 없음                                                                                                                                                                                                                                                                    |
| Rendering Mode | `server`, `static-export`                                                                                                                                                                                                                                               |

## 예: sentry

Sentry의 Next.js SDK(`@sentry/nextjs`)로 브라우저와 서버의 오류를 보고하는 Recipe다. 확장 지점 세 곳에 조각을 더하고, Base의 앱 수준 오류 화면(`src/app/error.tsx`)만 패치한다. Next.js는 오류 경계가 잡은 브라우저의 렌더링 오류를 콘솔에만 남겨 SDK가 받지 못하므로, 그 화면이 받은 오류를 `Sentry.captureException`으로 보낸다(루트 레이아웃의 오류를 받는 `global-error.tsx`도 이 화면을 그린다). `withSentryConfig`는 다른 래퍼보다 바깥이어야 하므로 next.config의 `order`가 0이고, SDK가 다른 조각보다 먼저 초기화되도록 instrumentation과 instrumentation-client의 `order`도 0이다. `static-export`에는 서버가 없어 브라우저의 오류만 보낸다.

SDK는 `NODE_ENV`가 `production`이고 목 빌드가 아니며 DSN이 있을 때만 초기화하므로, 개발 서버와 테스트, 목 빌드(E2E, GitLab CI의 `build` 잡. ADR-0011)는 DSN이 있어도 아무것도 보내지 않는다. 브라우저 코드는 `API_MOCKING`을 읽을 수 없으므로, 목 빌드인지는 `withSentry`가 빌드할 때 `next.config`의 `env`로 코드에 박는다(`SENTRY_MOCK_BUILD`). 소스맵은 Sentry 인증 토큰이 있는 빌드에서만 만들어 올린다. 그대로 두면 `withSentryConfig`가 Turbopack 빌드에서 브라우저용 소스맵을 켜므로, 토큰 없이 만든 배포 결과에 올리지 못한 소스맵이 남아 소스가 드러난다. 빌드 도구가 Sentry에 사용 통계를 보내는 기능(`telemetry`)도 끈다. 하네스(`harness/sentry.test.ts`)는 DSN을 하네스가 띄운 가짜 수집 서버(로컬)로 가리켜 만든 배포용 빌드가 브라우저와 서버의 오류를 보내는지, 목 빌드와 개발 서버는 DSN이 있어도 보내지 않는지 본다. 진짜 Sentry로는 보내지 않는다.

| 선언하는 것    | `recipes/sentry/`                                                                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/shared/sentry/`(SDK를 초기화하는 조건과 설정, 세 조각)                                                                                                                                                                                                                              |
| 확장 지점      | `extensions.json`: next.config `withSentry`(order 0), instrumentation `sentryInstrumentation`(order 0), instrumentation-client `sentryClientInstrumentation`(order 0). 환경 변수: `.env.example`(`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, 소스맵 업로드), `types/process-env.sentry.d.ts` |
| 설정 패치      | `src/app/error.tsx.patch`(앱 수준 오류 화면이 받은 브라우저의 오류를 보냄. 서버 컴포넌트의 오류는 `onRequestError`가 보내므로 빼고 보냄)                                                                                                                                                 |
| npm 의존성     | `@sentry/nextjs`                                                                                                                                                                                                                                                                         |
| 자기 테스트    | `src/shared/sentry/sentry.test.ts`, `sentry-instrumentation.test.ts`, `e2e/sentry.spec.ts`                                                                                                                                                                                               |
| 필요한 Recipe  | 없음                                                                                                                                                                                                                                                                                     |
| Rendering Mode | `server`, `static-export`                                                                                                                                                                                                                                                                |

## 예: analytics

특정 분석 서비스에 묶이지 않는 페이지뷰·이벤트 인터페이스(`trackPageView`, `trackEvent`)와, 아무 데도 보내지 않는 기본 공급자를 담는 Recipe다. 분석 서비스의 SDK는 담지 않고, 프로젝트가 `src/shared/analytics/analytics-provider.ts`의 공급자만 바꿔 붙인다. 기본 공급자는 개발 서버에서는 브라우저 콘솔에만 남기고, 배포용 빌드와 테스트에서는 아무것도 하지 않는다.

페이지뷰는 instrumentation-client 조각이 남긴다. 브라우저가 페이지를 새로 불러오면 `register`가, App Router로 옮겨 가면 `onRouterTransitionStart`가 남긴다. 루트 레이아웃의 Provider에서 `usePathname`·`useSearchParams`로 남기지 않는 것은, `useSearchParams`를 Suspense 경계로 감싸지 않으면 미리 렌더링하는 페이지가 브라우저 렌더링으로 바뀌어 빌드가 실패하기 때문이다. sentry와 같은 확장 지점에 조각을 더하지만 서로 기대지 않으므로 따로도 함께도 켤 수 있다. 하네스(`harness/analytics.test.ts`)는 개발자가 하듯 공급자를 바꿔 빌드한 앱에서 페이지뷰와 이벤트가 그 공급자로 가는지도 본다.

| 선언하는 것    | `recipes/analytics/`                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| 추가 파일      | `src/shared/analytics/`(인터페이스, 공급자, 페이지뷰 조각)                            |
| 확장 지점      | `extensions.json`: instrumentation-client `analyticsClientInstrumentation`(order 200) |
| 설정 패치      | 없음                                                                                  |
| npm 의존성     | 없음                                                                                  |
| 자기 테스트    | `src/shared/analytics/analytics.test.ts`, `e2e/analytics.spec.ts`                     |
| 필요한 Recipe  | 없음                                                                                  |
| Rendering Mode | `server`, `static-export`                                                             |

## 예: file-upload

진행률, 취소, 실패 후 재시도를 갖춘 파일 업로드(`/upload`)를 보여 주는 Recipe다. 명세 조각으로 파일 하나를 `multipart/form-data`로 받는 업로드 operation `uploadFile`(tag `files`)을 더하고, 받는 형식은 `encoding.file.contentType`에, 크기 제한(5MB)은 OpenAPI에 정해진 표기가 없어 `file` 필드의 확장 필드 `x-max-bytes`에 적는다. 재생성 계층이 이 기준을 만들지 않으므로 `src/shared/upload/upload-policy.ts`에 같은 값을 두고(명세와 다르면 `upload-policy.test.ts`가 실패한다), 업로더가 올리기 전에 검사하고 목 백엔드도 같은 기준으로 413·415를 돌려준다.

fetch는 보낸 본문의 양을 알려 주지 않으므로, 진행률이 필요한 업로드는 `src/shared/upload/api-upload.ts`의 `apiUpload`가 XMLHttpRequest로 보낸다. 보내는 곳과 결과는 Base의 `apiFetch`와 같다. 브라우저의 `apiFetch`처럼 `base-url.ts`의 `browserBaseUrl`(`server`는 BFF 프록시, `static-export`는 백엔드)로 보내고, 2xx가 아니면 `ApiError`로 실패하며, 응답을 명세의 Zod 스키마로 검증한다. Query Domain(`src/queries/files/`)은 `npm run g -- mutation uploadFile`이 만든 훅에서 요청만 `apiUpload`로 바꾸고 진행률과 취소(`signal`)를 `mutate`의 값으로 받는다. Base의 BFF 프록시는 multipart를 포함한 본문을 바이트 그대로 넘기므로 고치지 않는다. 다만 본문을 다 받은 뒤 넘기므로, 훨씬 큰 파일을 받게 되면 프록시를 거치지 않는 방식을 검토한다(Recipe의 README 절).

실패와 취소를 E2E와 개발 서버에서 늘 같게 재현하도록, 직접 만든 MSW 핸들러(`src/shared/mocks/files.ts`)가 파일 이름으로 응답을 고른다(`slow`는 늦게 답하고, `flaky`는 그 이름으로 처음 올릴 때 실패한다). table처럼 확장 지점 [MSW 핸들러](#msw-핸들러mockhandlers)로 생성된 핸들러 앞에 둔다. 다른 Recipe의 핸들러와 받는 경로(`/files`)가 겹치지 않으므로 `order`는 같은 100이다.

`static-export`에서는 브라우저가 다른 출처의 백엔드를 직접 부르고, XMLHttpRequest에 `upload` 이벤트를 달면 브라우저가 CORS preflight를 먼저 보낸다. 그래서 목 백엔드는 preflight에 답하고 응답에 CORS 헤더를 붙인다(Vitest의 jsdom도 CORS를 검사한다). 브라우저의 MSW(서비스 워커)는 본문을 네트워크로 보내지 않고 받아 진행률이 중간값 없이 끝나므로, E2E는 Chromium의 네트워크 흉내로 업로드를 늦추고 중간값은 요청이 네트워크를 지나는 `server`에서만 본다.

| 선언하는 것    | `recipes/file-upload/`                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/app/upload/page.tsx`, `src/features/file-uploader/`, `src/queries/files/`, `src/shared/upload/`, `src/shared/mocks/files.ts`, `src/shared/lib/multipart.ts` |
| 확장 지점      | `openapi.yaml`(명세 조각): `POST /files`(`uploadFile`), 스키마 `FileUpload`, `UploadedFile`, `UploadError`. `extensions.json`: MSW 핸들러 `filesHandlers`(100) |
| 설정 패치      | 없음                                                                                                                                                           |
| npm 의존성     | 없음(진행 막대는 Base의 `@base-ui/react`의 Progress)                                                                                                           |
| 자기 테스트    | `src/shared/upload/api-upload.test.ts`, `upload-policy.test.ts`, `src/features/file-uploader/file-uploader.test.tsx`, `e2e/file-upload.spec.ts`                |
| 필요한 Recipe  | 없음                                                                                                                                                           |
| Rendering Mode | `server`, `static-export`                                                                                                                                      |

## 예: realtime

백엔드가 Server-Sent Events(SSE)로 보내는 이벤트로 TanStack Query의 캐시를 고치는 실시간 배송 현황(`/realtime`)을 보여 주는 Recipe다. 캐시를 고치는 이벤트는 백엔드에서 브라우저로만 흐르므로 WebSocket 대신 SSE를 쓴다. SSE는 보통의 HTTP 응답이라 `server`에서는 브라우저가 다른 API 요청처럼 BFF 프록시(`/api/proxy`)를 거쳐 연결하고(프록시가 토큰을 붙이는 ADR-0006을 그대로 따른다. Route Handler는 WebSocket을 넘겨주지 못한다), `static-export`에서는 백엔드 주소로 직접 연결하며, MSW가 보통의 HTTP 핸들러로 흉내 낸다. 그래서 두 Rendering Mode에서 같은 코드로 동작한다.

명세 조각은 목록 operation `listDeliveries`와 이벤트 스트림 `streamDeliveryEvents`(tag `deliveries`)를 더하고, Query Domain(`src/queries/deliveries/`)의 쿼리 키와 queryOptions는 `npm run g -- query listDeliveries`가 만든 코드 그대로다. 같은 Query Domain의 `deliveries.events.ts`가 이벤트를 받아 `setQueryData`로 캐시의 배송을 고치고(목록을 다시 요청하지 않는다), 고칠 수 없는 이벤트를 받거나 연결될 때마다(처음 연결 포함, 끊긴 동안 놓친 이벤트를 맞춘다) Query Domain을 무효화한다(ADR-0008). 목록을 가져오는 중에 온 이벤트는 그 요청이 끝난 뒤 한 번만 다시 가져와 맞추므로 이벤트가 몰려도 요청이 되풀이되지 않는다. 이벤트 스트림 클라이언트(`src/shared/realtime/event-stream.ts`)는 `EventSource` 대신 `fetch`로 스트림을 읽어, 2xx가 아닌 응답에도 다시 연결하고 지수 백오프로 기다린다. 이벤트 없이 곧바로 끊긴 연결은 실패로 세어, 연결을 받자마자 닫는 백엔드에 다시 연결하며 목록을 거듭 가져오지 않는다. 연결 상태는 `ConnectionStatus`(`role="status"`)가 글자로 알린다.

MSW의 `sse()`는 핸들러를 만들 때 전역 `EventSource`가 있어야 해서 Node.js(Vitest, Next.js 서버의 MSW)에서 쓸 수 없으므로, 응답 본문을 흘려보내는 보통의 HTTP 핸들러(`src/shared/mocks/event-stream.ts`)로 흉내 낸다. 목 백엔드(`src/shared/mocks/deliveries.ts`)는 테스트마다 새로 만들어 이벤트와 연결을 직접 다루고(`createMockDeliveryBackend`), 개발 서버와 E2E에서는 새로 연 화면마다 정해진 순서로 이벤트를 보낸 뒤 연결을 끊는다. 목 백엔드의 핸들러는 table처럼 확장 지점 [MSW 핸들러](#msw-핸들러mockhandlers)로 생성된 핸들러 앞에 둔다. 다른 Recipe의 핸들러와 받는 경로(`/deliveries`, `/deliveries/events`)가 겹치지 않으므로 `order`는 같은 100이다.

| 선언하는 것    | `recipes/realtime/`                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/app/realtime/page.tsx`, `src/features/delivery-board/`, `src/queries/deliveries/`, `src/shared/realtime/`, `src/shared/mocks/deliveries.ts`, `src/shared/mocks/event-stream.ts`                                                |
| 확장 지점      | `openapi.yaml`(명세 조각): `GET /deliveries`(`listDeliveries`), `GET /deliveries/events`(`streamDeliveryEvents`, `text/event-stream`), 스키마 `Delivery`, `DeliveryStatus`. `extensions.json`: MSW 핸들러 `deliveriesHandlers`(100) |
| 설정 패치      | 없음                                                                                                                                                                                                                                |
| npm 의존성     | 없음                                                                                                                                                                                                                                |
| 자기 테스트    | `src/shared/realtime/event-stream.test.ts`, `src/features/delivery-board/delivery-board.test.tsx`, `src/shared/realtime/connection-status.test.tsx`, `e2e/realtime.spec.ts`                                                         |
| 필요한 Recipe  | 없음                                                                                                                                                                                                                                |
| Rendering Mode | `server`, `static-export`                                                                                                                                                                                                           |
