# Recipe 작성하기

Recipe는 하나의 기능 패턴을 Base에 독립적으로 넣고 뺄 수 있게 담은 단위다(GLOSSARY). 원본은 Base와 각 Recipe이고, Starter는 Base에 고른 Rendering Mode와 Recipe를 덧입혀 조립한다(ADR-0002). 이 문서는 새 Recipe를 Generator(`packages/devc-frontend-generator`)에 더하는 방법, 여러 Recipe가 같은 Base 파일에 끼어드는 자리인 [확장 지점](#확장-지점), Recipe를 바꿀 때마다 함께 다시 만드는 Showcase를 적는다. 예시는 첫 Recipe인 `recipes/dark-mode/`이고, 문서 끝에 `server`에서만 쓸 수 있는 `recipes/route-rendering/`도 적는다.

## Starter를 조립하는 순서

`dcgen new`는 다음 순서로 Starter를 만든다. 뒤의 단계는 앞 단계의 결과 위에 덧입혀진다.

1. `base/`를 복사한다(`base/extensions.json`은 빼고).
2. 고른 Rendering Mode의 overlay(`rendering-modes/<mode>/`)를 덧입힌다. `server`는 Base 그대로라 overlay가 없다.
3. 고른 Recipe와 그 Recipe가 필요로 하는 Recipe를 덧입힌다. 필요한 Recipe가 먼저 오고, 나머지는 이름순이다. 고른 순서와 상관없이 같은 Starter가 나온다.
4. overlay의 OpenAPI 명세 조각을 Base 명세(`openapi.yaml`)에 병합하고, 병합한 명세로 재생성 API 계층을 다시 만든다(명세 조각이 있을 때만).
5. Base, Rendering Mode, Recipe가 확장 지점에 선언한 조각(`extensions.json`)을 모아 조립 파일(`src/app/app-shell.tsx` 등)을 쓴다.
6. Starter의 `package.json`에 Starter 이름을 적고, Starter를 만든 Generator를 정확한 버전으로 `devDependencies`에 고정한다(`npm run g`가 이 Generator를 쓴다). overlay를 모두 덧입힌 뒤에 정하므로 Recipe가 바꿀 수 없다.
7. `npm install`로 의존성을 설치한다(`--skip-install`이면 건너뛴다).

고른 조합에 알 수 없는 Recipe가 있거나, 고른 Rendering Mode를 지원하지 않는 Recipe(함께 넣을 Recipe 포함)가 있으면 아무것도 만들기 전에 이유와 함께 거부한다. 확장 지점의 선언이 잘못되었거나 명세 조각이 Base나 다른 Recipe의 명세와 겹쳐도 아무것도 만들기 전에 실패한다.

## 디렉터리 구조

Recipe는 `packages/devc-frontend-generator/recipes/<이름>/` 디렉터리 하나다. 이름은 kebab-case로 짓고, 그대로 `dcgen new --recipe <이름>`의 값이 된다. 디렉터리 안의 경로는 Starter 최상위 기준이다.

```
recipes/<이름>/
├── recipe.json      선언: 설명, 필요한 Recipe, 지원하는 Rendering Mode (필수)
├── extensions.json  확장 지점에 더할 조각: Provider, 머리글, proxy, next.config, instrumentation
├── openapi.yaml     Base 명세에 병합할 명세 조각
├── .env.<이름>      Starter의 같은 dotenv 파일에 변수 단위로 병합할 변수(.env.example, .env.development 등)
├── package.json     Starter의 package.json에 합칠 내용: 의존성, 스크립트
├── README.md        Starter의 README.md에 덧입힐 절
├── remove.txt       Starter에서 지울 경로
├── <경로>.patch     Starter의 기존 파일 <경로>를 고치는 unified diff (설정 패치)
└── <경로>           그 밖의 파일: Starter의 <경로>에 더한다 (Recipe의 코드, 스토리, 테스트)
```

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

Base의 기존 파일(설정 파일 등)을 고칠 때는 그 파일에 대한 unified diff를 `<경로>.patch`로 둔다. 예: `.storybook/preview.tsx.patch`, `vitest.config.ts.patch`. 패치 하나는 파일 하나만 고친다. 사본 대신 패치를 쓰는 이유는 ADR-0007에 있다. 확장 지점이 있는 자리(루트 레이아웃의 Provider와 머리글, proxy, `next.config`의 래퍼, instrumentation, OpenAPI 명세, 환경 변수 파일)는 패치하지 않는다. 같은 자리를 패치하는 Recipe끼리는 Showcase에서 함께 켤 수 없다(ADR-0010).

- 패치는 덧입히는 시점의 Starter 파일, 곧 Base에 Rendering Mode와 앞서 덧입힌 Recipe가 적용된 파일에 적용된다. 줄 번호가 달라도 맥락 줄이 맞는 곳을 찾아 적용하지만, 맥락 줄이 맞지 않으면 생성이 어느 패치인지 알리며 실패하고 만들던 Starter를 지운다.
- Recipe가 지원하는 모든 Rendering Mode에서 맞아야 한다. Rendering Mode가 대신하는 파일(`rendering-modes/<mode>/`에 있는 파일)은 되도록 고치지 않는다.
- 맥락 줄은 꼭 필요한 만큼만 둔다. 다른 Recipe가 같은 파일의 가까운 곳을 고치면 맥락 줄이 어긋날 수 있다. 부딪치면 하네스의 조합 매트릭스가 잡는다.

패치는 이렇게 만든다.

```sh
npm run build -w devc-frontend-generator
node packages/devc-frontend-generator/dist/cli.js new /tmp/try --skip-install   # 필요하면 --rendering-mode, --recipe
cd /tmp/try && git init -q && git add -A && git commit -qm base
# /tmp/try/.storybook/preview.tsx를 고친 뒤
git diff -- .storybook/preview.tsx > <레포>/packages/devc-frontend-generator/recipes/<이름>/.storybook/preview.tsx.patch
```

`diff -u --label a/<경로> --label b/<경로> <원래 파일> <고친 파일>`로 만들어도 된다. 편집기가 맥락 줄의 끝 공백을 지워도 적용된다.

### package.json

Starter의 `package.json`에 합친다. 객체(`dependencies`, `scripts` 등)는 키별로 합치고, 그 밖의 값은 덮어쓴다. 의존성은 Base처럼 정확한 버전으로 고정한다(`^`, `~`를 쓰지 않는다). 의존성 목록은 이름순으로 다시 정렬된다. Base의 `g` 스크립트(`npm run g`)는 바꾸지 않는다.

### README.md

`## ` 제목으로 시작하는 절만 담는다. Starter의 README에 같은 제목의 절이 있으면 그 절을 바꾸고, 없으면 끝에 덧붙인다. Recipe가 무엇을 더했는지, 어떻게 쓰고 바꾸는지, 어떤 테스트가 들어 있는지 적는다.

### remove.txt

Starter에서 지울 경로를 한 줄에 하나씩 적는다. `#`으로 시작하는 줄은 주석이다. 적힌 경로가 Starter에 없으면 생성이 실패한다.

### dotfile

npm은 패키지를 만들 때 `.gitignore`와 `.npmrc`를 뺀다. 특히 `.gitignore`는 그 디렉터리의 파일을 빼는 규칙으로 쓰이므로 Recipe에 두지 않는다. Starter의 `.gitignore`를 고치려면 `.gitignore.patch`를 쓴다. `.storybook/`, `.env.*`, `.gitlab-ci.yml` 같은 다른 dotfile은 그대로 담긴다. `.env.*`는 Starter의 같은 파일을 대신하지 않고 변수 단위로 병합된다([환경 변수](#환경-변수)).

## 확장 지점

여러 Recipe가 Base의 같은 파일, 같은 자리에 끼어들어야 하는 곳이다. 이 자리를 패치로 고치면 Recipe끼리 맥락 줄이 어긋나 모든 Recipe를 켜는 Showcase를 만들 수 없으므로, Recipe는 자기 조각만 더하고 Generator가 모든 overlay를 덧입힌 뒤 한꺼번에 조립한다(ADR-0010). Base와 Rendering Mode overlay도 같은 방법으로 자기 조각을 더한다.

| 확장 지점                                       | overlay에 두는 것                                                | Starter에 생기는 파일                           | Rendering Mode                       |
| ----------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------ |
| Provider(`providers`), 머리글(`header`)         | `extensions.json` + 컴포넌트                                     | `src/app/app-shell.tsx`(루트 레이아웃이 씀)     | 둘 다                                |
| proxy(`proxy`)                                  | `extensions.json` + 요청 처리기                                  | `src/proxy.ts`                                  | `server`만                           |
| next.config(`nextConfig`)                       | `extensions.json` + 설정 래퍼                                    | `next.config.plugins.ts`(`next.config.ts`가 씀) | 둘 다                                |
| instrumentation(`instrumentation`)              | `extensions.json` + 서버 조각                                    | `src/instrumentation.ts`                        | 둘 다(`static-export`는 개발 서버만) |
| instrumentation-client(`instrumentationClient`) | `extensions.json` + 브라우저 조각                                | `src/instrumentation-client.ts`                 | 둘 다                                |
| OpenAPI 명세                                    | `openapi.yaml`(명세 조각)                                        | `openapi.yaml`, `src/shared/api/generated/`     | 둘 다                                |
| 환경 변수                                       | `.env.example`, `.env.development` 등, `process-env.<이름>.d.ts` | 같은 이름의 dotenv 파일                         | 둘 다                                |

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
  ]
}
```

| 항목     | 뜻                                                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path`   | Starter 최상위 기준의 `.ts`·`.tsx` 모듈. 보통 그 Recipe가 더한 파일이다. 모든 overlay를 덧입힌 뒤의 Starter에 없으면 생성이 실패한다.                                          |
| `export` | 그 모듈이 내보내는 이름. 조립 파일이 이 이름으로 import한다. 한 조립 파일에서 다른 조각과 이름이 겹치면 생성이 실패하므로 Recipe 이름을 담아 짓는다.                           |
| `order`  | 같은 지점의 조각 사이의 순서(정수). 작은 것이 먼저이고, 감싸는 지점(Provider, proxy, next.config)에서는 바깥이다. 같으면 덧입힌 순서(Base → Rendering Mode → Recipe)를 따른다. |

- 조립 파일은 Generator가 모든 overlay를 덧입힌 뒤 매번 새로 쓴다. 패치하거나 대신할 수 없다. 조립 파일의 틀(머리글의 모양, proxy의 matcher 등)은 Generator 코드(`src/extensions.ts`)가 정한다.
- 조각의 모양은 조립 파일의 타입이 정하므로 Starter의 `typecheck`가 검사한다. 모듈은 ADR-0005의 계층과 폴더 깊이를 지킨다. `src/app/app-shell.tsx`는 `app` 계층이라 `features`와 `shared`의 컴포넌트를 모두 쓸 수 있다.
- 알 수 없는 지점이나 항목은 오타로 보고 생성이 실패한다.
- Base의 조각은 `base/extensions.json`에 있다: `QueryProvider`(100), `ToastProvider`(200), 서버 `apiInstrumentation`(100, MSW나 백엔드 주소 확인). Rendering Mode `static-export`는 브라우저 `browserMockingInstrumentation`(100)을 더한다.

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

`(config: NextConfig) => NextConfig` 래퍼다. `next.config.ts`가 Base의 설정을 `next.config.plugins.ts`의 `withPlugins`에 넘기고, Provider처럼 `order`가 작은 래퍼가 바깥을 감싼다(큰 것부터 씌운다). 예: 가장 바깥이어야 하는 Sentry의 `withSentryConfig`는 작은 `order`로, next-intl의 플러그인은 그보다 큰 `order`로 둔다. 래퍼 모듈은 Next.js가 설정을 읽을 때 Node.js에서 바로 실행되므로 브라우저 코드를 import하지 않는다. Rendering Mode `static-export`의 `output: 'export'`는 Base 설정의 값 자체를 바꾸는 것이라 래퍼 대신 `next.config.ts`의 패치다. Recipe는 이 패치보다 뒤에 덧입혀지고 `next.config.ts`를 패치하지 않으므로 부딪치지 않는다.

#### instrumentation(`instrumentation`)

서버가 뜰 때 실행할 조각이다. Next.js의 `instrumentation.ts`와 같은 이름의 함수를 담은 객체를 내보낸다.

```ts
export const someInstrumentation = {
  async register() {}, // 서버 런타임(nodejs, edge)마다 한 번. 앞의 조각이 끝난 뒤 실행된다.
  onRequestError: (error, request, context) => {}, // 선택. Instrumentation.onRequestError
}
```

Node.js 전용 코드는 `process.env.NEXT_RUNTIME === 'nodejs'`를 확인한 뒤 동적 import로 불러온다(Base의 `src/shared/api/api-instrumentation.ts` 참고). `static-export` Starter에서는 개발 서버에서만 실행된다. 예: Sentry의 서버 초기화와 `captureRequestError`.

#### instrumentation-client(`instrumentationClient`)

브라우저에서 앱 코드와 hydration보다 먼저 실행할 조각이다. `{ register?(): void; onRouterTransitionStart?(url, navigationType): void }` 객체를 내보낸다. `register`는 `order` 순으로 한 번, `onRouterTransitionStart`는 App Router가 페이지를 옮기기 시작할 때마다 실행된다(예: Sentry 초기화, 분석의 페이지뷰). 모듈 최상위에서는 일을 하지 않고 `register` 안에서 한다(import 순서는 `order`와 다르다). 개발·목 빌드에서만 쓸 코드는 `if (process.env.NEXT_PUBLIC_<값> === 'enabled') { ... }`로 감싸야 배포용 빌드에서 빠진다. 앞에서 `return`하면 빌드가 덜어 내지 못한다(`static-export`의 `browser-instrumentation.ts` 참고).

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
- 병합한 명세는 Starter의 `openapi.yaml`이 되고, Generator가 이 명세로 재생성 계층(`src/shared/api/generated`)을 다시 만든다(`npm run api:gen`과 같은 결과. Generator는 Base와 같은 버전의 orval을 담고 있다). `npm run g -- query`·`mutation`도 이 `openapi.yaml`을 읽는다.
- MSW 목이 늘 같은 값을 돌려주도록 응답에 `example`을 적는다.

### 환경 변수

overlay의 dotenv 파일(`.env`, `.env.<이름>`)은 Starter의 같은 파일을 대신하지 않고 변수 단위로 병합된다.

- 변수 한 줄과 그 바로 위에 빈 줄 없이 붙은 주석이 한 항목이다. Starter에 같은 변수가 있으면 그 항목을 그 자리에서 바꾸고, 새 변수는 overlay의 문단 그대로 끝에 덧붙인다. 변수에 붙지 않은 주석 문단도 덧붙는다. Starter에 그 파일이 없으면 새로 만든다.
- 같은 파일의 같은 변수는 같은 값으로만 다시 적을 수 있다(주석은 바꿔도 된다). Base, Rendering Mode, Recipe 가운데 둘이 같은 변수에 다른 값을 적으면 어느 값이 맞는지 정할 수 없으므로, 무엇을 만들기 전에 그런 변수와 두 곳의 값을 모두 알리며 실패한다. 예: `- .env.development의 API_MOCKING: Base에서 'enabled', Recipe <이름>에서 'disabled'`. 값은 dotenv가 읽는 값으로 비교하므로 감싼 따옴표나 값 뒤의 주석만 다른 것(`X=`, `X=""`, `X= # 설명`)은 같은 값이다. 다른 파일(`.env.development`와 `.env.production`)의 같은 변수는 비교하지 않는다. 다른 값이 필요하면 Recipe 이름을 담은 새 변수를 쓰고, Base의 값을 바꿔야 하면 Base를 고친다. `harness/extension-points.test.ts`가 시험용 Recipe `dotenv-conflict-fixture`로 검증한다.
- `.env.example`: 배포 환경에 넣을 변수의 목록이다. Next.js는 읽지 않으므로 값은 비우고, 주석에 무엇을 넣는지 적는다. 운영에 필요한 변수(비밀 값, DSN 등)는 여기에 더한다.
- `.env.development`: `npm run dev`가 읽는 기본값. 개발 서버가 바로 뜨는 데 필요한, 비밀이 아닌 값만 둔다.
- 변수의 타입은 Recipe의 `process-env.<Recipe 이름>.d.ts`(Starter 최상위)에 `declare namespace NodeJS { interface ProcessEnv { readonly <이름>?: string } }`로 선언한다. TypeScript가 Base의 `process-env.d.ts`와 합치므로 Base 파일을 고치지 않는다.
- 변수의 쓰임은 Recipe의 README 절에 적는다.

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

레포의 하네스(`harness/`)에는 Recipe마다 조합 매트릭스 테스트를 더한다. 지원하는 Rendering Mode마다 Recipe를 넣은 Starter를 만들고 Starter의 스크립트를 실행한다. `harness/dark-mode.test.ts`처럼 `useStarter({ prefix: 'dcgen-<이름>-', renderingMode, recipes: ['<이름>'], install: true, playwright: true })`를 쓴다(`playwright`는 `test:storybook`과 `test:e2e`가 쓰는 Chromium을 받는다). 지원하지 않는 조합의 거부와 `requires`는 `recipe.json`만으로 동작하므로 Recipe마다 따로 시험하지 않아도 된다(`harness/recipes.test.ts`가 시험용 Recipe로 검증한다). 확장 지점의 조립과 병합도 마찬가지다(`harness/extension-points.test.ts`). Recipe의 하네스는 자기 조각이 Starter에서 동작하는지만 본다.

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
- Showcase의 `package.json`은 다른 Starter처럼 Generator를 정확한 버전으로 고정한다. 그래서 Generator 버전을 올리는 Version PR(`npm run release:version`)도 Showcase를 다시 만든다([릴리스와 배포](release.md)).
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

| 선언하는 것    | `recipes/dark-mode/`                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 추가 파일      | `src/shared/ui/tokens-dark.css`, `src/shared/theme/theme.ts`, `theme-script.tsx`, `theme-provider.tsx`, `src/features/theme-switcher/` |
| 확장 지점      | `extensions.json`: Provider `ThemeProvider`(order 0, 테마 스크립트), 머리글 `ThemeSwitcher`(order 100)                                 |
| 설정 패치      | `src/shared/ui/styles.css.patch`, `.storybook/preview.tsx.patch`, `vitest.config.ts.patch`                                             |
| npm 의존성     | 없음(`package.json`을 두지 않는다)                                                                                                     |
| 자기 테스트    | `src/shared/theme/theme.test.ts`, `theme-switcher.stories.tsx`, `e2e/dark-mode.spec.ts`                                                |
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
