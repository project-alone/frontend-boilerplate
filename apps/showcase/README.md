> **생성된 Showcase입니다. 이 디렉터리의 파일은 직접 고치지 마세요.**
>
> Showcase는 Generator(`packages/devc-frontend-generator`)가 Base에 Rendering Mode `server`와 모든 Recipe를 덧입혀 만든 Starter입니다([ADR-0002](../../docs/adr/0002-recipes-are-source-of-truth.md)). 바꿀 것이 있으면 Base(`base/`)나 Recipe(`recipes/<이름>/`)를 고친 뒤 레포 최상위에서 `npm run showcase`로 다시 만들어 함께 커밋합니다. CI는 다시 만든 결과가 커밋된 Showcase와 다르면 실패합니다([Recipe 작성하기](../../docs/recipes.md)).
>
> - 켠 Recipe: `chart`, `dark-mode`, `multi-step-form`, `route-rendering`, `table`. Recipe가 더한 화면과 쓰는 법은 아래 README의 Recipe 절에 있습니다.
> - 주석을 달 수 있는 파일은 맨 위의 주석이 이 안내와 고칠 원본을 알립니다. 주석을 달 수 없는 파일: `.nvmrc`, `.prettierrc.json`, `package.json`
> - 실행: 레포 최상위에서 `npm run showcase:dev`. Showcase를 레포 밖의 디렉터리에 복사해 설치하고 MSW 목으로 개발 서버를 띄웁니다. 아래는 Starter의 README이고, 그 명령은 그 디렉터리에서 실행합니다.

# Starter

`devc-frontend-generator`로 만든 프로젝트입니다. 패키지 매니저는 npm을 쓰고, Node는 `.nvmrc`에 적힌 LTS 버전을 씁니다.

```sh
nvm use                     # .nvmrc의 Node 버전으로 전환
npm install
npm run playwright:install  # Storybook 테스트와 E2E가 쓰는 Chromium 설치(처음 한 번)
npm run dev                 # 개발 서버
npm run typecheck           # 타입 검사
npm run lint                # 린트(ESLint)
npm run format              # 포맷 적용(Prettier)
npm run format:check        # 포맷 검사
npm test                    # 단위·컴포넌트 테스트
npm run test:storybook      # 스토리마다 접근성 검사
npm run build               # 프로덕션 빌드
npm start                   # 빌드 결과로 서버 실행(build 다음에 실행)
npm run test:e2e            # 빌드 결과로 E2E 테스트(build 다음에 실행)
npm run storybook           # Storybook
npm run api:gen             # OpenAPI 명세(openapi.yaml)에서 API 계층 재생성(orval)
npm run g                   # Schematic으로 코드 생성(아래 "코드 생성(Schematic)")
```

## 실행과 배포

특정 배포 방식에 묶이지 않도록 Vercel 같은 플랫폼 전용 설정은 두지 않습니다. `npm run build`는 `next.config.ts`의 `output: 'standalone'`에 따라 `.next/standalone`에 Node 하나로 띄울 수 있는 서버도 함께 만듭니다.

- `npm start`(`next start`): 빌드 결과로 서버를 띄웁니다. Next.js가 `"next start" does not work with "output: standalone" configuration` 경고를 출력하지만 서버는 정상으로 동작합니다(Next.js 16.4 기준). E2E도 이 방법으로 서버를 띄웁니다.
- `node .next/standalone/server.js`: `node_modules` 없이 이 폴더만으로 실행됩니다. 포트와 주소는 `PORT`, `HOSTNAME` 환경 변수로 정합니다. 정적 파일(`.next/static`, `public`)은 standalone 폴더에 복사되지 않으므로 배포할 때 `.next/standalone/.next/static`, `.next/standalone/public`으로 함께 복사합니다.

## 앱 조립 파일

다음 파일은 Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 쓴 파일입니다. 이제는 이 프로젝트의 코드이므로 Provider나 래퍼를 더하고 뺄 때 직접 고칩니다.

| 파일                            | 내용                                                                                               |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/app/app-shell.tsx`         | 루트 레이아웃(`src/app/layout.tsx`)이 모든 페이지를 감싸는 Provider(위에 적힌 것이 바깥)와 머리글  |
| `next.config.plugins.ts`        | `next.config.ts`의 설정을 감싸는 래퍼(예: next-intl, Sentry의 플러그인). 위에 적힌 것이 바깥       |
| `src/instrumentation.ts`        | 서버가 뜰 때 실행할 코드(API 목킹이나 백엔드 주소 확인 등)와 서버가 요청을 처리하다 난 오류의 처리 |
| `src/instrumentation-client.ts` | 브라우저에서 앱 코드보다 먼저 실행할 코드와 페이지 이동 알림. 넣은 코드가 있을 때만 있음           |
| `src/proxy.ts`                  | 페이지 요청이 라우트에 닿기 전에 차례로 실행할 처리기(Next.js Proxy). 넣은 처리기가 있을 때만 있음 |

## GitLab CI

`.gitlab-ci.yml`이 들어 있어 사내 GitLab에 저장소를 올리면 바로 파이프라인이 돕니다. 잡은 모두 위의 npm 스크립트를 부르므로 실패한 잡은 로컬에서 같은 명령으로 재현할 수 있습니다.

- 단계: `check`(`lint`, `format:check`, `typecheck`, `test`, `test:storybook`) → `build` → `e2e`(`build` 잡의 빌드 결과로 `test:e2e`)
- 설치는 `npm ci`로 하므로 `package-lock.json`을 함께 커밋합니다. `dcgen new`가 Starter를 만들며 설치할 때 생기고, `--skip-install`로 만들었다면 처음 `npm install`할 때 생깁니다.
- Node는 `.nvmrc`와 같은 버전의 `node` 이미지를 씁니다. `.nvmrc`를 바꾸면 `.gitlab-ci.yml`의 `image`도 함께 바꿉니다. 이미지를 쓰므로 Docker(또는 Kubernetes) executor 러너가 필요합니다.
- npm 캐시(`.npm/`)는 `package-lock.json`이 바뀔 때까지, Next.js 빌드 캐시(`.next/cache/`)는 브랜치마다 캐시합니다. Playwright 브라우저(`.cache/ms-playwright/`)는 버전별 폴더로 받으므로 하나의 캐시를 계속 씁니다.
- E2E가 실패하면 Playwright trace가 담긴 `test-results/`를 잡 아티팩트로 내려받을 수 있습니다.

## 품질 기준

- 린트와 포맷은 나뉘어 있습니다. ESLint는 코드 규칙만, Prettier는 포맷만 맡습니다.
- import는 `app → features → queries → shared` 방향으로만 할 수 있고, 네 계층 밖의 `src` 파일은 import할 수 없습니다. `app` 밖의 파일은 `src/<계층>/<이름>/<파일>`보다 깊은 폴더에 둘 수 없습니다. 어기면 린트 오류가 납니다.
- `app`이 `queries`를 직접 쓰는 것은 서버 컴포넌트에서 prefetch할 때만입니다. 린트로는 용도까지 가리지 못하므로 리뷰에서 지킵니다.
- `process.env`에서 새 환경 변수를 읽으면 `process-env.d.ts`에 선언합니다. 선언하지 않은 이름은 `noPropertyAccessFromIndexSignature` 때문에 `process.env.<이름>`으로 읽을 수 없습니다. 배포 환경에 넣어야 하는 변수라면 `.env.example`에도 적습니다. 배포할 때 넣는 변수는 모두 `.env.example`에 모여 있습니다.
- 지원 브라우저는 Next.js 기본 범위(Chrome·Edge·Firefox 111+, Safari 16.4+)이며 `package.json`의 `browserslist`에 적혀 있습니다.

## 공통 UI와 디자인 토큰

공통 컴포넌트는 `src/shared/ui/`에 있습니다. 키보드 조작과 스크린 리더 지원은 [Base UI](https://base-ui.com)가 맡고, 모양은 디자인 토큰으로 만든 Tailwind CSS 유틸리티가 정합니다. 특정 디자인 시스템의 모양은 담겨 있지 않습니다.

| 컴포넌트                                                | 쓰는 법                                                                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                                | `variant`(`primary`, `secondary`, `danger`), `size`(`sm`, `md`). 링크를 버튼처럼 보이게 할 때는 `<a className={buttonVariants()}>` |
| `Field`, `FieldLabel`, `FieldDescription`, `FieldError` | 폼 컨트롤 하나에 레이블, 설명, 오류 메시지를 잇습니다.                                                                             |
| `Input`                                                 | `<Field><FieldLabel>이름</FieldLabel><Input /></Field>`                                                                            |
| `Checkbox`                                              | `<Field><FieldLabel><Checkbox />약관에 동의합니다</FieldLabel></Field>`                                                            |
| `Select`                                                | `<Select label="지역" options={[{ value: 'seoul', label: '서울' }]} />`                                                            |
| `Dialog` 등                                             | `Dialog`, `DialogTrigger`, `DialogPopup`, `DialogTitle`, `DialogDescription`, `DialogClose`                                        |
| `useToast`                                              | `useToast().add({ title: '저장했습니다' })`. `ToastProvider`는 레이아웃과 Storybook이 이미 감싸 두었습니다.                        |

컴포넌트마다 스토리(`<이름>.stories.tsx`)가 있어 Storybook에서 모양과 조작을 확인할 수 있습니다. 공통 컴포넌트는 서버 컴포넌트에서도 가져다 쓸 수 있습니다. 훅을 쓰거나 Base UI에 함수를 넘기는 파일(`checkbox.tsx`, `toast.tsx`)에만 `'use client'`를 붙였습니다.

### 디자인 반영하기

디자이너가 정한 값은 `src/shared/ui/tokens.css`의 값만 바꿔 반영합니다. 컴포넌트는 토큰으로 만든 유틸리티(`bg-primary`, `text-sm`, `rounded-md`, `h-control-md` 등)만 쓰므로 컴포넌트 코드는 고치지 않습니다. 토큰은 색, 타이포그래피(글꼴, 글자 크기와 줄 높이, 굵기), 간격과 크기, 반경, 포커스 링으로 나뉘며, 토큰 이름과 유틸리티의 대응은 `tokens.css` 머리말에 적혀 있습니다. 지금 값은 화면을 읽을 수 있게 둔 무채색 자리표시 값입니다.

Tailwind 기본 팔레트, 글자 크기, 반경, 그림자는 꺼 두었습니다. 그래서 `bg-red-500`처럼 토큰에 없는 값의 클래스는 아무 스타일도 만들지 않습니다. 토큰 밖의 값이 섞이면 다크 모드 같은 테마를 토큰 값만 바꿔 적용할 수 없기 때문입니다. 새 값이 필요하면 `tokens.css`에 토큰을 더합니다. 토큰은 `:root`의 CSS 변수로도 나가므로, 테마는 같은 이름의 변수 값만 덮어씁니다.

Tailwind는 `postcss.config.mjs`로 켜져 있어 `next dev`, `next build`, Storybook이 같은 설정을 씁니다. 스타일 진입점은 `src/shared/ui/styles.css`입니다.

### 변형 더하기

변형은 [`cva`](https://cva.style)로 정의합니다(예: `button.tsx`의 `buttonVariants`). 컴포넌트의 `className`은 바깥 여백이나 너비 같은 배치에만 씁니다. 같은 속성을 다루는 클래스가 겹치면 어느 쪽이 적용될지 보장되지 않으므로, 모양을 바꾸려면 `className`으로 덮어쓰지 말고 변형을 더합니다.

## 커밋 훅

git 저장소 안에서 `npm install`을 하면 lefthook이 훅을 설치합니다. 저장소를 `npm install` 뒤에 만들었다면 `npx lefthook install`을 한 번 실행하세요.

- pre-commit: 스테이징한 파일의 린트·포맷 검사와 전체 타입 검사
- commit-msg: [Conventional Commits](https://www.conventionalcommits.org/) 형식 검사(commitlint)

## 테스트

- 단위·컴포넌트 테스트: `src/` 안의 `*.test.ts(x)`. Vitest(jsdom)와 Testing Library로 작성합니다.
- 스토리: `src/` 안의 `*.stories.tsx`. `npm run test:storybook`이 스토리마다 axe로 WCAG 2.2 AA를 검사하고, 위반이 하나라도 있으면 실패합니다. 스토리의 `play` 함수에 적은 상호작용 검사(키보드 조작 등)도 함께 돕니다.
- E2E: `e2e/` 안의 `*.spec.ts`. Playwright가 빌드된 앱을 `npm run start`로 띄워 검사합니다.
- Linux CI에서 Chromium에 필요한 시스템 라이브러리가 없으면 `npx playwright install --with-deps chromium`으로 설치합니다.

## API 계층

백엔드의 OpenAPI 명세(`openapi.yaml`)가 원본입니다. 명세에서 다시 만드는 계층과 프로젝트가 직접 소유하는 계층이 나뉩니다.

| 위치                         | 내용                                                                         | 누가 고치나                                    |
| ---------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `src/shared/api/generated/`  | 타입, fetch 함수, Zod 스키마, MSW 핸들러                                     | `npm run api:gen`(orval)만. 손으로 고치지 않음 |
| `src/shared/api/`의 나머지   | fetch 클라이언트(`api-fetch.ts`), 요청 주소(`base-url.ts`), BFF 프록시       | 프로젝트                                       |
| `src/queries/<Query Domain>` | 쿼리 키(`<domain>.keys.ts`), queryOptions·뮤테이션 훅(`<domain>.queries.ts`) | 프로젝트                                       |
| `src/features/<Feature>`     | 쿼리를 써서 화면을 그리는 UI                                                 | 프로젝트                                       |
| `src/app`                    | 라우트. 서버 컴포넌트에서 prefetch                                           | 프로젝트                                       |

- `npm run api:gen`은 `orval.config.ts`대로 `src/shared/api/generated`를 지우고 다시 만듭니다. 같은 명세로 다시 실행하면 결과가 바뀌지 않으므로, 생성 결과는 git에 함께 올립니다. TanStack Query 훅은 만들지 않습니다.
- 생성 결과는 `lint`와 `format:check` 대상에서 빠집니다(`eslint.config.ts`, `.prettierignore`). 타입 검사는 받습니다.
- Query Domain 이름은 OpenAPI tag를 따르고, 쿼리 키는 `['products', 'listProducts', params]`처럼 계층으로 만듭니다. `src/queries`의 코드는 `npm run g -- query <operationId>`와 `npm run g -- mutation <operationId>`로 만들 수 있습니다(아래 "코드 생성(Schematic)").
- 샘플: `/products` 페이지(`src/app/products/page.tsx`)가 서버에서 `listProductsQueryOptions()`로 데이터를 가져오고(prefetch), `HydrationBoundary`로 넘긴 데이터를 `src/features/product-list`가 이어받습니다. 브라우저는 같은 데이터를 다시 요청하지 않습니다(`e2e/products.spec.ts`).

### 요청이 가는 곳

생성된 fetch 함수는 모두 `src/shared/api/api-fetch.ts`의 `apiFetch`를 거칩니다. `apiFetch`는 실행 환경에 따라 주소를 고르고, 응답을 명세의 Zod 스키마로 검증합니다. 2xx가 아닌 응답은 `ApiError`로 던집니다.

- 서버(서버 컴포넌트, Route Handler): `API_BASE_URL`의 백엔드를 직접 부릅니다. MSW를 끈 서버(`API_MOCKING`이 `enabled`가 아님)에 `API_BASE_URL`이 없으면 서버가 뜰 때 오류를 내고 요청을 처리하지 않습니다. 엉뚱한 주소로 조용히 요청하지 않도록 기본값은 두지 않습니다.
- 브라우저: BFF 프록시 `/api/proxy/*`(`src/app/api/proxy/[...path]/route.ts`)를 부르고, 프록시가 `API_BASE_URL`로 요청을 그대로 전달합니다. 토큰 첨부는 `auth` Recipe가 프록시에 더합니다.
- 브라우저가 프록시 대신 백엔드를 직접 불러야 하면(서버가 없는 `static-export` 등) `NEXT_PUBLIC_API_BASE_URL`에 백엔드 주소를 적습니다. 빌드할 때 코드에 박히므로 바꾸면 다시 빌드하고, 백엔드가 그 출처의 CORS 요청을 허용해야 합니다.

| 환경 변수                  | 읽는 곳                                       | 값                                                                        |
| -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| `API_BASE_URL`             | 서버(실행할 때)                               | 백엔드 주소. MSW를 끈 서버에는 꼭 넣습니다(배포 환경, 실제 백엔드 개발)   |
| `NEXT_PUBLIC_API_BASE_URL` | 브라우저(빌드할 때 박힘)                      | 비우면 BFF 프록시. 적으면 브라우저가 그 주소를 직접 부름                  |
| `API_MOCKING`              | 서버(`src/shared/api/api-instrumentation.ts`) | `enabled`이면 서버의 요청을 MSW가 받고, `API_BASE_URL`이 없어도 서버가 뜸 |

### 샘플 명세 바꾸기

`openapi.yaml`은 API 계층이 어떻게 이어지는지 보여 주는 가상의 샘플입니다. 실제 프로젝트에서는 다음 순서로 바꿉니다.

1. `openapi.yaml`을 백엔드의 명세로 바꿉니다. `npm run g`도 이 파일을 읽으므로, 백엔드가 명세를 URL로 내주면 내려받아 이 파일에 저장합니다.
2. 샘플 코드를 지웁니다: `src/app/products/`, `src/features/product-list/`, `src/queries/products/`, `e2e/products.spec.ts`
3. `npm run api:gen`을 실행하고 생성 결과를 커밋합니다.
4. `.env.development.local`과 배포 환경에 `API_BASE_URL`을 넣습니다.

## API 목킹(MSW)

MSW가 쓰는 핸들러 목록은 `src/shared/mocks/handlers.ts`이고, 명세에서 생성한 핸들러(`src/shared/api/generated/<tag>/<tag>.msw.ts`)를 모두 담습니다. 핸들러는 명세의 `example`을 돌려주고, `example`이 없으면 faker가 스키마에 맞는 값을 만듭니다. 늘 같은 값이 필요하면 명세에 `example`을 적습니다.

- Vitest: 모든 테스트에서 켜져 있고, 핸들러가 없는 요청은 테스트를 실패시킵니다. 테스트 하나에서만 응답을 바꾸려면 `@/shared/mocks/node`의 `server.use(...)`에 생성된 핸들러(예: `getListProductsMockHandler([])`)나 직접 만든 핸들러를 넘깁니다.
- 개발 서버: `.env.development`의 `API_MOCKING=enabled`로 켭니다.
- E2E: `playwright.config.ts`가 서버를 `API_MOCKING=enabled`로 띄웁니다.

MSW는 Next.js 서버(서버 컴포넌트, Route Handler)가 보내는 요청을 받습니다. 브라우저의 요청도 BFF 프록시를 거쳐 서버에서 나가므로 MSW가 받습니다. `NEXT_PUBLIC_API_BASE_URL`로 브라우저가 백엔드를 직접 부르면 MSW가 받지 않습니다.

실제 백엔드로 바꾸려면 `.env.development.local`에 다음 두 줄을 적고 개발 서버를 다시 띄웁니다. `API_MOCKING`만 끄고 `API_BASE_URL`을 빠뜨리면 개발 서버가 오류를 내고 요청을 처리하지 않습니다. 배포 환경에서는 `API_MOCKING`을 켜지 않습니다(MSW는 devDependency입니다).

```sh
API_MOCKING=disabled
API_BASE_URL=https://<백엔드 주소>
```

## 폼(React Hook Form과 Zod)

폼은 [React Hook Form](https://react-hook-form.com)으로 만들고, 검증은 재생성 계층의 Zod 스키마(`src/shared/api/generated/model`의 `<OperationId>Body` 등)가 맡습니다. 검증 규칙을 명세에서 손으로 옮기지 않으므로 명세가 바뀌면 `npm run api:gen`만으로 폼의 검증도 바뀝니다. `npm run g -- form`이 이 방식대로 폼을 만듭니다(아래 "코드 생성(Schematic)").

```tsx
const {
  register,
  handleSubmit,
  formState: { errors },
} = useForm({ resolver: formResolver(CreateProductBody) })
```

- `src/shared/form/form-resolver.ts`의 `formResolver(schema)`를 `useForm`의 `resolver`로 넘깁니다. 제출 핸들러(`handleSubmit`)는 검증을 통과한 값을 받습니다.
- 비워 둔 입력(빈 문자열, 고르지 않은 `Select`, 비운 숫자 입력)은 값을 넣지 않은 것으로 보고 검증 전에 뺍니다. 비워 둔 선택 필드는 요청에 담기지 않고, 비워 둔 필수 필드는 `REQUIRED_MESSAGE`("값을 입력해 주세요.")로 알립니다. 그 밖의 오류는 Zod의 한국어 메시지입니다.
- 숫자 입력은 `register(name, { valueAsNumber: true })`로 숫자로 바꿉니다.
- 입력 요소는 공통 UI를 씁니다. `Field`에 `invalid`를, `FieldError`에 `match`와 오류 메시지를 넘기면 입력 요소에 `aria-invalid`가 붙고 오류 메시지가 입력 요소의 설명(`aria-describedby`)으로 읽힙니다. `Select`, `Checkbox`처럼 값을 직접 다루는 컴포넌트는 React Hook Form의 `Controller`로 잇습니다.
- 폼 테스트는 `@testing-library/user-event`로 사람처럼 입력하고, 요청은 MSW가 받습니다.

## 코드 생성(Schematic)

`npm run g -- <schematic> ...`(`npx dcgen g <schematic> ...`과 같습니다)은 이 Starter를 만든 Generator(`devc-frontend-generator`)로 코드를 만듭니다. Generator는 `package.json`의 devDependencies에 정확한 버전으로 고정되어 있어 팀원 모두가 같은 결과를 얻습니다. 만든 코드는 그 뒤로 프로젝트가 직접 소유하고 고칩니다.

| Schematic   | 만드는 것                                                                | 넣는 곳                                                           |
| ----------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `query`     | 쿼리 키와 queryOptions(`--infinite`는 infiniteQueryOptions)              | Query Domain(`src/queries/<domain>/`)                             |
| `mutation`  | 뮤테이션 훅(`--optimistic`은 낙관적 업데이트 뼈대까지)                   | Query Domain(`src/queries/<domain>/`)                             |
| `form`      | 요청 본문을 입력받아 뮤테이션 훅으로 보내는 폼, Storybook 스토리, 테스트 | Feature(`src/features/<feature>/`)                                |
| `component` | 컴포넌트, Storybook 스토리, 테스트                                       | Feature(`src/features/<feature>/`) 또는 공통 UI(`src/shared/ui/`) |

- `query`, `mutation`, `form`은 Starter 최상위(`package.json`이 있는 디렉터리)의 `openapi.yaml`을 읽습니다. 만든 코드는 재생성 계층의 fetch 함수와 Zod 스키마를 쓰므로, 명세를 고쳤다면 먼저 `npm run api:gen`을 실행합니다.
- 만든 파일은 Starter의 Prettier로 포맷하므로 바로 `lint`, `format:check`, `typecheck`를 통과합니다.
- 같은 이름의 코드가 이미 있으면 아무 파일도 바꾸지 않고, 겹치는 이름을 알린 뒤 실패합니다. 명세에 없는 operationId도 실패합니다.

### query

```sh
npm run g -- query <operationId>                             # 쿼리 키와 queryOptions
npm run g -- query <operationId> --infinite                  # 목록형 operation의 infiniteQueryOptions
npm run g -- query <operationId> --infinite --page-param <이름>  # 페이지 번호 쿼리 파라미터가 page가 아닐 때
```

- operation의 첫 번째 OpenAPI tag를 kebab-case로 바꾼 이름이 Query Domain입니다(예: `Sales Stats` → `src/queries/sales-stats/`). 쿼리 키 모듈(`<domain>.keys.ts`)과 쿼리 모듈(`<domain>.queries.ts`)이 없으면 만들고, 있으면 그 안에 끼워 넣습니다. 있던 코드는 건드리지 않습니다.
- GET operation만 만들 수 있습니다. 쿼리 키는 `<domain>Keys.<operationId>(...인자)`이고 `['<domain>', '<operationId>', ...인자]`처럼 계층으로 만듭니다. 앞부분만 넘기면 아래 단계를 한꺼번에 무효화할 수 있습니다. 예를 들어 `<domain>Keys.all`은 Query Domain 전체를, `[...<domain>Keys.all, '<operationId>']`는 그 operation의 모든 인자를 무효화합니다.
- queryOptions(`<operationId>QueryOptions`)는 재생성 계층의 fetch 함수로 데이터를 가져옵니다. 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅이 같은 옵션을 씁니다.
- `--infinite`는 배열을 돌려주는 목록형 operation의 `<operationId>InfiniteQueryOptions`를 만듭니다. 페이지 번호 쿼리 파라미터(기본 `page`)를 명세의 기본값이나 최솟값(둘 다 없으면 1)부터 하나씩 늘리고, 빈 페이지를 받으면 멈춥니다. 백엔드의 페이지 규칙이 다르면 만든 뒤 고칩니다. 키에는 `'infinite'` 단계가 더해져 같은 operation의 queryOptions와 캐시가 섞이지 않습니다.

### mutation

```sh
npm run g -- mutation <operationId>                                  # 뮤테이션 훅
npm run g -- mutation <operationId> --optimistic <queryOperationId>  # 낙관적 업데이트 뼈대까지
```

- POST, PUT, PATCH, DELETE operation만 만들 수 있습니다. Query Domain은 `query`처럼 operation의 첫 번째 OpenAPI tag로 정하고, 쿼리 모듈(`<domain>.queries.ts`)에 `use<OperationId>Mutation` 훅을 끼워 넣습니다. 모듈이 없으면 쿼리 키 모듈과 함께 만듭니다.
- `mutate`에는 fetch 함수의 인자를 넘깁니다. 인자가 하나면 그 값(`mutate(newProduct)`), 여럿이면 인자 이름을 키로 한 객체(`mutate({ productId, newProduct })`)를 넘기고, 인자가 없으면 아무것도 넘기지 않습니다.
- 훅은 성공하면 Query Domain의 쿼리를 모두(`<domain>Keys.all`) 무효화해, 화면이 보고 있는 쿼리를 다시 가져옵니다. 뮤테이션이 어느 쿼리를 바꾸는지는 명세만으로 알 수 없어 범위를 넓게 잡았습니다. 좁히려면 만든 뒤 `[...<domain>Keys.all, '<operationId>']`처럼 operation의 쿼리 키를 넘깁니다.
- `--optimistic <queryOperationId>`는 같은 Query Domain의 쿼리 하나를 응답 전에 고치는 낙관적 업데이트 뼈대를 더합니다. 그 쿼리의 queryOptions가 먼저 있어야 합니다(`npm run g -- query <queryOperationId>`).
  - 훅은 그 쿼리의 인자를 받습니다(예: `useUpdateProductMutation(params)`). 화면이 보고 있는 쿼리와 같은 인자를 넘깁니다.
  - 요청을 보내기 전에 그 쿼리의 진행 중인 요청을 취소하고 캐시를 `apply<OperationId>`가 돌려준 값으로 고칩니다. 실패하면 고치기 전의 값으로 되돌리고, 성공하든 실패하든 끝나면 Query Domain의 쿼리를 모두 무효화해 서버의 값으로 맞춥니다.
  - 고치는 캐시는 훅에 넘긴 인자의 쿼리 하나입니다. 같은 쿼리를 고치는 뮤테이션이 겹쳐 실행되다 하나가 실패하면, 되돌린 값에서 다른 뮤테이션의 낙관적 값이 빠질 수 있습니다. 끝나면 다시 가져오므로 결국 서버의 값으로 맞춰집니다.
  - 응답 전에 보일 값은 비즈니스 판단이므로 `apply<OperationId>`를 직접 채웁니다. 만든 직후에는 캐시를 그대로 둡니다. 예를 들어 장바구니에 상품을 담는 뮤테이션이라면 `(current, cartItem) => ({ ...current, items: [...current.items, cartItem] })`처럼 고칩니다.

### form

```sh
npm run g -- mutation <operationId>                    # 폼이 요청을 보낼 뮤테이션 훅(먼저 만든다)
npm run g -- form <operationId> --feature <feature>    # Feature(src/features/<feature>/)에 폼, 스토리, 테스트
```

- JSON 요청 본문(`application/json`)이 있는 operation만 만들 수 있습니다. 폼(예: `registerMember`는 `register-member-form.tsx`의 `RegisterMemberForm`), 스토리(`.stories.tsx`), 테스트(`.test.tsx`)를 함께 만들고, Feature 폴더가 없으면 만듭니다.
- 폼은 재생성 계층의 요청 본문 Zod 스키마(`<OperationId>Body`)를 `formResolver`로 연결해 검증하고(위 "폼"), 제출하면 Query Domain의 `use<OperationId>Mutation` 훅으로 보냅니다. 훅이 없으면 아무 파일도 만들지 않고 `npm run g -- mutation <operationId>`를 먼저 실행하라고 알립니다.
- 요청 본문의 속성마다 공통 UI 입력 요소를 하나씩 만듭니다. 레이블은 명세의 `title`(없으면 속성 이름)이고, `description`은 입력 요소의 설명이 됩니다.

  | 명세의 속성                              | 입력 요소                                                                                |
  | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
  | `string`                                 | `Input`(`format: email`은 `type="email"`, `format: uri`는 `type="url"`)                  |
  | `string`의 `enum`                        | `Select`(선택지의 레이블은 enum 값)                                                      |
  | `integer`, `number`                      | `Input type="number"`. 입력한 값을 숫자로 바꿔 보냅니다                                  |
  | `boolean`                                | `Checkbox`. 체크하지 않으면 `false`를 보냅니다                                           |
  | 그 밖(배열, 객체, null 허용, `oneOf` 등) | 선택 필드면 빼고 폼 위의 주석과 명령 출력으로 알립니다. 필수 필드면 폼을 만들지 않습니다 |

- 경로 파라미터(`/products/{productId}`)는 폼의 props(`<UpdateProductForm productId={1} />`)로 받아 요청 본문과 함께 뮤테이션에 넘깁니다. 쿼리 파라미터 같은 선택 인자는 넘기지 않습니다.
- 성공하면 알림(토스트)으로 알리고 폼을 비우며, 실패하면 오류 알림을 띄웁니다. 문구와 성공한 뒤의 동작(목록으로 이동 등)은 화면에 맞게 고칩니다. 제출 버튼의 문구는 명세의 `summary`입니다.
- 테스트는 모든 입력 요소에 값을 넣어 제출하면 그 값이 요청 본문으로 가는지(MSW), 검증에 실패하면 보내지 않고 입력 요소에 오류를 알리는지 봅니다. 넣는 값은 명세의 `example`이고, 없으면 길이·범위·`format`을 지키는 값을 만듭니다. `pattern`이나 `multipleOf`가 있는 필수 필드는 값을 만들 수 없으므로 명세에 `example`을 적어야 폼을 만듭니다.
- 검증 실패는 비워 둔 필수 입력으로 확인합니다. 비워 두면 실패하는 필수 입력이 없으면 규칙(`maxLength`, 2 이상의 `minLength`, 검증하는 `format`, 범위, 정수)에 맞지 않는 값을 입력해 확인하고, 어길 규칙도 없으면 검증 실패 테스트와 스토리 대신 그 사실을 주석으로 남깁니다.
- 스토리는 폼과, 위의 검증 실패를 제출했을 때의 검증 오류를 보여 줍니다. `npm run test:storybook`이 두 화면의 접근성(axe)을 검사합니다. Storybook에는 MSW가 없으므로 제출 성공은 테스트에서 확인합니다.
- 세 파일 가운데 하나라도 이미 있으면 아무 파일도 만들지 않고, 있는 파일을 알린 뒤 실패합니다.

### component

```sh
npm run g -- component <이름> --feature <feature>  # Feature(src/features/<feature>/)에
npm run g -- component <이름> --shared             # 공통 UI(src/shared/ui/)에
```

- 컴포넌트(`<이름>.tsx`), 스토리(`<이름>.stories.tsx`), 테스트(`<이름>.test.tsx`)를 함께 만듭니다. 파일 이름은 kebab-case, 컴포넌트는 PascalCase입니다(예: `order-summary`와 `OrderSummary`는 모두 `order-summary.tsx`의 `OrderSummary`). 명세는 읽지 않습니다.
- 둘 곳은 `--feature`와 `--shared` 가운데 꼭 하나를 고릅니다. Feature 폴더가 없으면 만듭니다.
- 이름은 영문자로 시작하고 영문자, 숫자, 하이픈만 씁니다. 폴더 깊이 제한 때문에 하위 폴더(`orders/summary` 등)는 만들지 않습니다.
- Feature의 컴포넌트는 공통 UI와 Query Domain의 queryOptions를 조합하는 평범한 컴포넌트로, 제목 하나를 보여 주는 자리표시 내용으로 시작합니다.
- 공통 UI의 컴포넌트는 다른 공통 컴포넌트처럼 디자인 토큰 유틸리티와 `cva` 변형(`<이름>Variants`)으로 모양을 정하고, `className`은 배치에만 받습니다. 키보드 조작이나 스크린 리더 지원이 필요한 부품이면 `<div>` 대신 Base UI 부품을 감쌉니다(예: `button.tsx`).
- 만든 직후 스토리는 `npm run test:storybook`의 접근성(axe) 검사를, 테스트는 `npm test`를 통과합니다. 내용을 바꾸면 스토리의 `play`와 테스트도 함께 고칩니다.
- 세 파일 가운데 하나라도 이미 있으면 아무 파일도 만들지 않고, 있는 파일을 알린 뒤 실패합니다. 확장자만 다른 파일(`<이름>.ts` 등)도 같은 import 경로로 풀리므로 이미 있는 것으로 봅니다.

## 차트

`chart` Recipe로 넣었습니다. [Recharts](https://recharts.github.io/)로 대시보드용 차트를 그리는 패턴입니다. `/charts` 페이지가 샘플 통계로 시계열 차트(일별 방문 수, 선 차트)와 비교 차트(판매 채널별 이번 달·지난달 매출, 막대 차트)를 보여 줍니다.

| 위치                         | 내용                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/shared/chart/`          | 차트마다 쓰는 틀(`chart-figure.tsx`), 디자인 토큰으로 정한 차트 색(`chart-theme.ts`), 명도 대비 계산 |
| `src/features/stats-charts/` | 샘플 차트 두 개와 데이터를 가져오는 `StatsCharts`                                                    |
| `src/queries/stats/`         | `stats` Query Domain(`listDailyVisits`, `listChannelSales`의 queryOptions)                           |
| `src/app/charts/`            | `/charts` 라우트                                                                                     |

- 샘플 통계 API는 `openapi.yaml`의 `stats` tag(`GET /stats/daily-visits`, `GET /stats/channel-sales`)입니다. MSW 목은 명세의 `example`을 돌려줍니다.
- 색은 디자인 토큰만 씁니다. `src/shared/chart/chart-theme.ts`의 `CHART_COLORS`가 계열, 축, 눈금선, 툴팁의 색을 `var(--color-primary)` 같은 토큰으로 정하므로, 토큰 값을 바꾸거나 `dark-mode` Recipe가 어두운 테마의 토큰을 적용하면 차트도 따라 바뀝니다. 차트에만 쓰는 색(브랜드의 차트 팔레트 등)이 필요하면 `tokens.css`에 `--color-chart-1` 같은 토큰을 더하고(`dark-mode`를 쓰면 `tokens-dark.css`에도 어두운 값을 더합니다) `CHART_COLORS`를 그 토큰으로 바꿉니다. 계열의 선과 막대는 배경과 3:1, 축 글자는 4.5:1 이상의 명도 대비를 지켜야 합니다(아래 테스트가 잽니다). 계열끼리는 색만으로 구별하지 않습니다. 지금 두 계열 색은 서로 3:1이 안 되므로 비교 차트는 지난달을 테두리만 그린 막대로 그립니다.
- 차트마다 스크린 리더용 텍스트 대안이 있습니다. 새 차트도 `ChartFigure`로 감쌉니다. `ChartFigure`는 제목과 요점(예: 최고·최저, 합계)을 캡션으로 보여 주고, 차트 그림(SVG)은 보조 기술에서 숨긴 뒤(`aria-hidden`) 같은 값을 화면에는 보이지 않는 데이터 표(`sr-only`)로 함께 둡니다. 그래서 그림 안에 포커스를 받는 요소가 없도록 Recharts의 `accessibilityLayer`를 끕니다. 표를 화면에도 보이게 하려면 `chart-figure.tsx`에서 표의 `sr-only`를 지우거나 `<details>`로 감쌉니다.
- 차트는 브라우저에서 그리므로 데이터도 브라우저가 가져옵니다(`useQuery`, CSR). 서버가 보낸 HTML에는 불러오는 중 상태가 담기고, Rendering Mode `server`와 `static-export`에서 같은 코드로 동작합니다. 차트마다 따로 가져오므로 한 API가 실패해도 다른 차트는 보입니다.
- Recharts는 `react-is`를 peer dependency로 씁니다. `react`를 올릴 때 `react-is`도 같은 버전으로 올립니다.
- 샘플을 지우려면 `src/app/charts/`, `src/features/stats-charts/`, `src/queries/stats/`, `e2e/chart.spec.ts`와 `openapi.yaml`의 `stats` tag·경로·스키마(`DailyVisits`, `ChannelSales`)를 지우고 `npm run api:gen`을 실행합니다. 새 차트에 쓸 `src/shared/chart/`는 남겨 둡니다.
- 테스트: `src/features/stats-charts/stats-charts.test.tsx`(두 차트의 데이터 표·캡션, 불러오는 중·실패 상태), `src/shared/chart/chart-contrast.test.ts`(명도 대비 계산), `daily-visits-chart.stories.tsx`·`channel-sales-chart.stories.tsx`(axe 검사, 그림을 숨기고 표를 둠, 선·막대·축 글자의 명도 대비. `dark-mode`가 있으면 다크 모드 브라우저에서도 실행), `e2e/chart.spec.ts`(빌드한 앱에서 두 차트와 데이터 표, 운영체제가 라이트·다크 모드일 때의 명도 대비와 axe 검사).

## 다크 모드

`dark-mode` Recipe로 넣었습니다. 다크 테마는 디자인 토큰의 값만 바꾸므로 공통 컴포넌트와 화면 코드는 고치지 않습니다.

- 어두운 테마의 토큰 값은 `src/shared/ui/tokens-dark.css`에 있습니다. `<html data-theme="dark">`일 때 `tokens.css`의 같은 이름의 색 토큰을 덮어씁니다. `tokens.css`에 색 토큰을 더하면 `tokens-dark.css`에도 어두운 값을 더합니다. 지금 값은 무채색 자리표시 값이니 디자이너의 값으로 바꿉니다.
- 테마는 사용자가 고른 값(`localStorage`의 `theme`)을 따르고, 고르지 않았으면 운영체제 설정(`prefers-color-scheme`)을 따릅니다. 운영체제 설정이 바뀌거나 다른 탭에서 테마를 고르면 바로 따라 바뀝니다(`src/shared/theme/theme.ts`).
- 모든 페이지 위의 머리글(`src/app/app-shell.tsx`)에 테마 전환 UI(`src/features/theme-switcher`, 시스템 설정·라이트·다크)가 있습니다. 다른 곳으로 옮겨도 됩니다.
- 첫 화면이 다른 테마로 깜빡이지 않도록 `<body>` 맨 앞의 inline script(`ThemeScript`)가 페이지 내용과 React보다 먼저 테마를 적용합니다. 앱 전체를 가장 바깥에서 감싸는 `ThemeProvider`(`src/shared/theme/theme-provider.tsx`, `src/app/app-shell.tsx`)가 이 스크립트를 둡니다. 스크립트가 `<html>`의 속성을 바꾸므로 루트 레이아웃의 `<html>`에는 `suppressHydrationWarning`이 있습니다. Content-Security-Policy를 도입하면 이 스크립트에 nonce나 hash를 허용해야 합니다.
- Storybook 툴바의 "테마"로 스토리를 테마별로 볼 수 있습니다. `npm run test:storybook`은 모든 스토리를 라이트 모드 브라우저와 다크 모드 브라우저(`storybook (chromium, dark)`)에서 한 번씩 실행해 두 테마 모두 접근성 검사를 합니다.
- 테스트: `src/shared/theme/theme.test.ts`(테마 선택과 적용), `src/features/theme-switcher/theme-switcher.stories.tsx`(전환 UI), `e2e/dark-mode.spec.ts`(운영체제 설정, 저장한 선택, 깜빡임 없음, 두 테마의 접근성).

## 다단계 폼

`multi-step-form` Recipe로 넣었습니다. `/partners/apply` 페이지가 입점 신청서를 사업자 정보 → 담당자 정보 → 판매 계획 → 신청 내용 확인의 네 단계로 나눠 입력받고, 확인 단계에서 모든 입력을 한 번에 보냅니다. 가입, 주문서처럼 긴 입력을 나눠 받는 화면의 틀로 씁니다.

| 위치                                | 내용                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/shared/multi-step-form/`       | 다른 다단계 폼에도 쓰는 부품: 단계 상태(`use-form-steps.ts`), 단계 폼(`step-form.tsx`), 단계 표시, 저장소 |
| `src/features/partner-application/` | 샘플 입점 신청서(단계마다의 필드, 확인 단계)                                                              |
| `src/queries/partners/`             | `partners` Query Domain(`npm run g -- mutation submitPartnerApplication`이 만든 코드 그대로)              |
| `src/app/partners/apply/`           | `/partners/apply` 라우트                                                                                  |

- 명세: `openapi.yaml`의 `submitPartnerApplication`(`POST /partner-applications`, tag `partners`)이 세 단계의 입력을 요청 본문(`PartnerApplication`) 하나로 받습니다. MSW 목은 명세의 `example`(접수 번호 `PA-0001`)을 돌려줍니다.
- 단계마다 검증: 단계마다 재생성 계층의 요청 본문 스키마(`SubmitPartnerApplicationBody`)에서 그 단계의 필드만 고른 스키마(`.pick({ ... })`)로 검증합니다. 그래서 검증 규칙은 명세에서만 오고, 아직 입력하지 않은 다음 단계의 필드는 오류로 알리지 않습니다. 단계마다 `StepForm`이 React Hook Form 폼을 하나씩 만들고, 입력 요소와 오류 표시는 `npm run g -- form`이 만드는 폼과 같습니다(Base의 "폼").
- 값 유지: "다음"은 그 단계의 검증을 통과한 뒤, "이전"은 검증하지 않고 지금 입력한 그대로를 모든 단계의 값(`useFormSteps`의 `draft`)에 담습니다. 단계를 오가도 입력한 값이 남습니다. 확인 단계의 "수정"은 그 단계로 돌아가고, "다음"을 눌러 다시 확인 단계로 옵니다.
- 한 번에 제출: 확인 단계의 "신청하기"가 모든 단계의 값을 요청 본문 스키마 전체로 한 번 더 검증한 뒤 `useSubmitPartnerApplicationMutation`으로 한 번 보냅니다. 성공하든 실패하든 알림(토스트)으로 알리고, 성공하면 처음 단계로 돌아가 비웁니다. 실패하면 확인 단계에 값을 그대로 둬 다시 신청할 수 있습니다. 성공한 뒤의 동작(완료 페이지로 이동 등)은 화면에 맞게 고칩니다.
- 새로 고침: 단계와 입력한 값을 `sessionStorage`(`partner-application-draft`)에 둬, 페이지를 새로 고치면 이어서 입력합니다. 탭을 닫거나 신청에 성공하면 지워지고, 다른 탭과는 나누지 않습니다. 저장한 값은 그린 뒤에 읽으므로 서버가 보낸 첫 단계가 잠깐 보였다가 이어 갑니다. 저장한 값은 지금 명세의 규칙에 맞지 않을 수 있으므로(다른 버전의 앱이 저장 등) 신청할 때 맞지 않는 값이 있는 첫 단계로 돌아가 오류를 알립니다. 비밀번호, 카드 번호 같은 비밀 값을 받는 폼에서는 그 값을 저장하지 않도록 `useFormSteps`의 `save`, `next`, `back`에 넘기기 전에 빼거나 저장을 끕니다.
- 접근성: 단계 표시(`StepIndicator`)는 지금 단계를 `aria-current="step"`으로, 끝낸 단계를 "완료"로 알립니다. 단계를 옮기면 포커스가 그 단계의 제목("담당자 정보 (4단계 중 2단계)")으로 가서 스크린 리더가 지금 단계를 읽고, 검증에 실패하면 첫 오류 필드로 갑니다. 처음 열 때와 새로 고쳐 이어 갈 때는 포커스를 옮기지 않습니다. 브라우저의 뒤로 가기는 단계가 아니라 이전 페이지로 갑니다.
- Rendering Mode: 페이지 뼈대(첫 단계)는 빌드할 때 미리 만들고, 단계와 값은 브라우저가 들고 있다가 신청할 때만 요청합니다(`server`는 BFF 프록시, `static-export`는 백엔드 주소로 직접). 그래서 두 Rendering Mode에서 같은 코드로 동작합니다.
- 다른 다단계 폼 만들기: 명세에 요청 본문이 있는 operation을 더하고 `npm run api:gen`, `npm run g -- mutation <operationId>`를 실행한 뒤, `partner-application-form.tsx`를 복사해 단계(`.pick`으로 고른 필드와 제목), 입력 요소, 확인 단계의 문구, 저장소 키를 바꿉니다.
- 테스트: `src/features/partner-application/partner-application-form.test.tsx`(단계마다 그 단계만 검증, 첫 오류 필드와 단계 제목으로 포커스, 이전·다음과 수정 뒤에도 값 유지, 한 번에 보내는 요청 본문, 실패, 새로 고침과 맞지 않는 저장 값), `src/shared/multi-step-form/draft-storage.test.ts`(저장소를 읽고 쓰지 못할 때와 모양이 다른 값), `partner-application-form.stories.tsx`(첫 단계, 검증 오류, 확인 단계의 axe 검사. `dark-mode`가 있으면 다크 모드 브라우저에서도 실행), `e2e/multi-step-form.spec.ts`(빌드한 앱에서 끝까지 신청, 검증 오류와 키보드 입력, 이전·다음과 새로 고침, 운영체제가 라이트·다크 모드일 때의 axe 검사).
- 샘플을 지우려면 `src/app/partners/`, `src/features/partner-application/`, `src/queries/partners/`, `e2e/multi-step-form.spec.ts`와 `openapi.yaml`의 `partners` tag·경로·스키마(`PartnerApplication`, `PartnerCategory`, `PartnerApplicationReceipt`)를 지우고 `npm run api:gen`을 실행합니다. 새 다단계 폼에 쓸 `src/shared/multi-step-form/`은 남겨 둡니다.

## 라우트별 Rendering Mode

`route-rendering` Recipe로 넣었습니다. server Starter에서 라우트마다 고르는 Rendering Mode를 `/rendering` 아래에 데모 페이지 하나씩으로 나란히 보여 줍니다. 데모 페이지는 서버가 그 HTML을 렌더링한 시각을 보여 주므로, 새로고침하며 언제 다시 렌더링하는지 비교할 수 있습니다. 라우트마다 쓸 Rendering Mode를 정했으면 데모(`src/app/rendering/`, `src/features/rendering-demo/`, `e2e/route-rendering.spec.ts`)는 지워도 됩니다.

| 라우트                 | Rendering Mode | 정하는 방법                                                                | 쓰는 곳                                      |
| ---------------------- | -------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| `/rendering/ssr`       | SSR            | `await connection()`(또는 `cookies()`, `headers()`, `searchParams`를 읽음) | 사용자나 요청에 따라 달라지는 화면           |
| `/rendering/ssg`       | SSG            | 요청마다 달라지는 값을 읽지 않음. `dynamic = 'error'`로 지킴               | 배포할 때만 바뀌는 화면                      |
| `/rendering/isr`       | ISR            | `export const revalidate = 10`                                             | 조금 늦게 반영돼도 되는 목록·상세            |
| `/rendering/streaming` | 스트리밍       | SSR 라우트에서 느린 부분만 `<Suspense>`로 감쌈                             | 느린 데이터가 섞인 화면                      |
| `/rendering/csr`       | CSR            | 클라이언트 컴포넌트에서 `useQuery`                                         | 사용자마다 다르고 검색 노출이 필요 없는 화면 |

- 스트리밍과 CSR 데모는 샘플 명세의 상품 목록(`listProducts`)을 씁니다. 스트리밍은 느린 백엔드를 흉내 내려고 2초 기다린 뒤 서버에서 가져와(prefetch) `/products`처럼 hydration으로 넘기고, CSR은 브라우저가 BFF 프록시로 가져옵니다. 샘플 명세를 바꿀 때 두 데모도 함께 지우거나 고칩니다.
- ISR이 다시 렌더링한 HTML은 서버 인스턴스마다 따로 캐시됩니다(Next.js 기본 캐시). 서버를 여러 대 띄우면 인스턴스마다 다른 HTML을 보낼 수 있으므로, 배포 대상을 정할 때 공유 캐시(`next.config.ts`의 `cacheHandler`)도 함께 정합니다.
- `static-export` Starter에는 넣을 수 없습니다. SSR, ISR, 스트리밍은 요청을 받는 Next.js 서버가 있어야 합니다.
- 테스트: `src/features/rendering-demo/browser-product-list.test.tsx`(CSR 목록의 상태), `e2e/route-rendering.spec.ts`(빌드한 앱에서 SSR은 요청마다 렌더링, SSG는 빌드할 때 만든 HTML을 보냄, ISR은 시간이 지나면 다시 렌더링, 스트리밍은 대체 UI를 먼저 보냄, CSR은 브라우저가 BFF 프록시로 요청, 모든 데모 페이지의 접근성).

## 테이블

`table` Recipe로 넣었습니다. `/members` 페이지가 [TanStack Table](https://tanstack.com/table)로 회원 목록을 보여 주고, 열 머리글로 정렬하고, 검색어와 역할로 거르고, 페이지를 넘깁니다. 정렬·필터·페이지는 백엔드가 처리합니다. 테이블은 그 상태만 들고 있다가 쿼리 파라미터로 바꿔 보내므로, 목록이 길어져도 브라우저가 모든 행을 받지 않습니다.

- 명세: `openapi.yaml`의 `listMembers`(`GET /members`, tag `members`)가 `q`(이름·이메일 검색어), `role`, `sort`(`name`, `email`, `joinedAt`), `order`(`asc`, `desc`), `page`, `pageSize`를 받아 한 페이지(`MemberPage`: `items`, `total`, `page`, `pageSize`)를 돌려줍니다.
- Query Domain: `src/queries/members/`는 `npm run g -- query listMembers`가 만든 코드 그대로입니다. 테이블의 상태가 `listMembersQueryOptions(params)`의 인자가 되므로 쿼리 키(`['members', 'listMembers', params]`)와 요청 파라미터가 늘 같습니다. 상태가 바뀌면 새로 요청하고, 다음 결과를 받는 동안에는 지금 결과를 보여 줍니다(`keepPreviousData`).
- 테이블: `src/features/member-table/member-table.tsx`. 행을 정렬·필터·페이지로 나누는 일은 백엔드에 맡기고(`manualSorting`, `manualFiltering`, `manualPagination`), 정렬(`sorting`), 역할 열 필터(`columnFilters`), 검색어(`globalFilter`), 페이지(`pagination`) 상태를 `toListMembersParams`가 쿼리 파라미터로 바꿉니다. 정렬이나 필터를 바꾸면 첫 페이지로 돌아갑니다. 다른 목록에 쓰려면 이 파일을 복사해 열 정의(`columns`)와 이 함수, 쓰는 queryOptions를 바꿉니다.
- 키보드와 스크린 리더: 정렬은 열 머리글 안의 버튼(Enter·Space, 오름차순 → 내림차순 → 정렬 없음)이고, 정렬한 열의 머리글에 `aria-sort`가 붙습니다. 검색어는 입력한 뒤 Enter로 보내고, 역할은 공통 `Select`(화살표 키)로 고릅니다. 결과("회원 24명 중 1–10번째")는 상태 문구(`role="status"`)로 알립니다.
- Rendering Mode: 두 Rendering Mode 모두 페이지 뼈대만 미리 만들고 목록은 브라우저가 가져옵니다(`server`는 BFF 프록시, `static-export`는 백엔드 주소로 직접). 정렬·필터를 바꿀 때마다 브라우저가 다시 요청하므로 서버에서 미리 가져오지(prefetch) 않습니다.
- MSW: 생성된 핸들러는 명세의 `example`을 그대로 돌려주므로, `src/shared/mocks/members.ts`의 핸들러가 고정된 회원 24명을 파라미터대로 거르고 정렬해 돌려줍니다. `src/shared/mocks/handlers.ts`에서 생성된 핸들러보다 앞에 둡니다. 실제 백엔드로 바꾸면 이 파일과 `handlers.ts`의 `membersHandlers`를 지웁니다.
- 테스트: `src/features/member-table/member-table.test.tsx`(정렬·검색·역할 필터·페이지가 요청 파라미터와 쿼리 키로 이어짐, `aria-sort`, 키보드 정렬, 빈 결과, 실패), `e2e/table.spec.ts`(빌드한 앱에서 키보드로 정렬·검색·필터, 페이지 이동, 접근성).
- 샘플을 지우려면 `src/app/members/`, `src/features/member-table/`, `src/queries/members/`, `src/shared/mocks/members.ts`(와 `handlers.ts`의 `membersHandlers`), `e2e/table.spec.ts`를 지우고 `openapi.yaml`에서 `listMembers`를 뺀 뒤 `npm run api:gen`을 실행합니다.
