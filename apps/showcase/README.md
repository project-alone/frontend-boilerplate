> **생성된 Showcase입니다. 이 디렉터리의 파일은 직접 고치지 마세요.**
>
> Showcase는 Generator(`packages/devc-frontend-generator`)가 Base에 Rendering Mode `server`와 모든 Recipe를 덧입혀 만든 Starter입니다([ADR-0002](../../docs/adr/0002-recipes-are-source-of-truth.md)). 바꿀 것이 있으면 Base(`base/`)나 Recipe(`recipes/<이름>/`)를 고친 뒤 레포 최상위에서 `npm run showcase`로 다시 만들어 함께 커밋합니다. CI는 다시 만든 결과가 커밋된 Showcase와 다르면 실패합니다([Recipe 작성하기](../../docs/recipes.md)).
>
> - 켠 Recipe: `auth`, `chart`, `dark-mode`, `i18n`, `route-rendering`, `table`. Recipe가 더한 화면과 쓰는 법은 아래 README의 Recipe 절에 있습니다.
> - 주석을 달 수 있는 파일은 맨 위의 주석이 이 안내와 고칠 원본을 알립니다. 주석을 달 수 없는 파일: `.nvmrc`, `.prettierrc.json`, `package.json`, `src/shared/i18n/en.json`, `src/shared/i18n/ko.json`
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
npm run build               # 프로덕션 빌드(배포용 빌드와 목 빌드는 아래 "실행과 배포")
npm start                   # 빌드 결과로 서버 실행(build 다음에 실행)
npm run test:e2e            # 빌드 결과로 E2E 테스트(목 빌드 다음에 실행)
npm run storybook           # Storybook
npm run api:gen             # OpenAPI 명세(openapi.yaml)에서 API 계층 재생성(orval)
npm run g                   # Schematic으로 코드 생성(아래 "코드 생성(Schematic)")
```

## 실행과 배포

특정 배포 방식에 묶이지 않도록 Vercel 같은 플랫폼 전용 설정은 두지 않습니다. `npm run build`는 `next.config.ts`의 `output: 'standalone'`에 따라 `.next/standalone`에 Node 하나로 띄울 수 있는 서버도 함께 만듭니다.

- `npm start`(`next start`): 빌드 결과로 서버를 띄웁니다. Next.js가 `"next start" does not work with "output: standalone" configuration` 경고를 출력하지만 서버는 정상으로 동작합니다(Next.js 16.4 기준). E2E도 이 방법으로 서버를 띄웁니다.
- `node .next/standalone/server.js`: `node_modules` 없이 이 폴더만으로 실행됩니다. 포트와 주소는 `PORT`, `HOSTNAME` 환경 변수로 정합니다. 정적 파일(`.next/static`, `public`)은 standalone 폴더에 복사되지 않으므로 배포할 때 `.next/standalone/.next/static`, `.next/standalone/public`으로 함께 복사합니다.

### 배포용 빌드와 목 빌드

`npm run build`는 SSG·ISR 페이지를 빌드할 때 미리 렌더링합니다. 그 페이지가 데이터를 가져오면(예: `npm run g -- page <route> --mode ssg --query <operationId>`) 서버 컴포넌트가 빌드할 때 백엔드를 부르므로, 빌드는 그 요청을 어디로 보내느냐에 따라 둘로 나뉩니다.

```sh
API_BASE_URL=https://<백엔드 주소> npm run build      # 배포용 빌드: 실제 백엔드를 부른다
API_MOCKING=enabled npm run build && npm run test:e2e  # 목 빌드: MSW가 응답한다. GitLab CI의 build 잡과 E2E가 쓴다
```

- 배포용 빌드는 MSW를 끕니다(`.env.production`의 `API_MOCKING=disabled`). 빌드할 때 데이터를 가져오는 페이지가 있는데 `API_BASE_URL`이 없으면, 엉뚱한 곳을 부르지 않도록 그 페이지를 렌더링할 때 무엇을 넣어야 하는지 알리며 빌드가 실패합니다. 빌드 결과를 띄우는 서버에도 `API_BASE_URL`을 넣습니다(아래 "API 계층").
- 목 빌드는 실제 백엔드 없이 빌드가 깨지지 않는지 확인하고 E2E를 돌릴 때 씁니다. Next.js는 빌드할 때 instrumentation(`src/instrumentation.ts`)을 실행하지 않으므로, 서버의 `apiFetch`가 첫 요청을 보내기 전에 MSW를 켜고(`src/shared/api/api-mocking.ts`) 빌드 출력에 경고를 남깁니다. MSW는 빌드 프로세스 안에서만 돌아 빌드 결과를 띄운 서버에는 남지 않고, 브라우저 번들에는 들어가지 않습니다.
- **목 빌드의 결과는 배포하지 않습니다.** 미리 렌더링한 페이지의 HTML과 Next.js의 데이터 캐시(`.next/cache/fetch-cache`)에 목 응답이 담기기 때문입니다. GitLab CI의 `build` 잡이 만든 `.next/`도 E2E에만 씁니다. 배포용 빌드는 목 빌드의 `.next/`를 지운 깨끗한 상태에서 따로 만듭니다.

## 앱 조립 파일

다음 파일은 Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 쓴 파일입니다. 이제는 이 프로젝트의 코드이므로 Provider나 래퍼를 더하고 뺄 때 직접 고칩니다.

| 파일                              | 내용                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/app/app-shell.tsx`           | 루트 레이아웃(`src/app/layout.tsx`)이 모든 페이지를 감싸는 Provider(위에 적힌 것이 바깥)와 머리글                           |
| `next.config.plugins.ts`          | `next.config.ts`의 설정을 감싸는 래퍼(예: next-intl, Sentry의 플러그인). 위에 적힌 것이 바깥                                |
| `src/instrumentation.ts`          | 서버가 뜰 때 실행할 코드(API 목킹이나 백엔드 주소 확인 등)와 서버가 요청을 처리하다 난 오류의 처리                          |
| `src/instrumentation-client.ts`   | 브라우저에서 앱 코드보다 먼저 실행할 코드와 페이지 이동 알림. 넣은 코드가 있을 때만 있음                                    |
| `src/proxy.ts`                    | 페이지 요청이 라우트에 닿기 전에 차례로 실행할 처리기(Next.js Proxy). 넣은 처리기가 있을 때만 있음                          |
| `src/shared/api/backend-fetch.ts` | 서버가 백엔드로 보내는 요청(서버의 `apiFetch`, BFF 프록시)이 차례로 거칠 처리기(예: 토큰 첨부). 처리기가 없으면 그대로 보냄 |
| `src/shared/mocks/handlers.ts`    | MSW가 쓰는 핸들러 목록. Recipe가 직접 만든 핸들러(위에 적힌 것이 먼저 응답)와 명세에서 생성한 핸들러                        |

## GitLab CI

`.gitlab-ci.yml`이 들어 있어 사내 GitLab에 저장소를 올리면 바로 파이프라인이 돕니다. 잡은 모두 위의 npm 스크립트를 부르므로 실패한 잡은 로컬에서 같은 명령으로 재현할 수 있습니다.

- 단계: `check`(`lint`, `format:check`, `typecheck`, `test`, `test:storybook`) → `build` → `e2e`(`build` 잡의 빌드 결과로 `test:e2e`)
- `build` 잡은 `API_MOCKING=enabled`로 목 빌드를 만들어 실제 백엔드 없이 돕니다(위 "배포용 빌드와 목 빌드"). 이 결과는 배포하지 않고, 빌드 캐시에 목 응답이 남지 않도록 `.next/cache/fetch-cache`를 지웁니다. 배포 파이프라인을 더할 때는 `API_MOCKING`을 켜지 않고 `API_BASE_URL`을 CI/CD 변수로 넣은 잡에서 배포용 빌드를 따로 만듭니다.
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
- E2E: `e2e/` 안의 `*.spec.ts`. Playwright가 빌드된 앱을 `npm run start`로 띄워 검사합니다. 목 빌드(`API_MOCKING=enabled npm run build`)의 결과로 돌립니다(위 "배포용 빌드와 목 빌드").
- Linux CI에서 Chromium에 필요한 시스템 라이브러리가 없으면 `npx playwright install --with-deps chromium`으로 설치합니다.

## API 계층

백엔드의 OpenAPI 명세(`openapi.yaml`)가 원본입니다. 명세에서 다시 만드는 계층과 프로젝트가 직접 소유하는 계층이 나뉩니다.

| 위치                         | 내용                                                                                               | 누가 고치나                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `src/shared/api/generated/`  | 타입, fetch 함수, Zod 스키마, MSW 핸들러                                                           | `npm run api:gen`(orval)만. 손으로 고치지 않음 |
| `src/shared/api/`의 나머지   | fetch 클라이언트(`api-fetch.ts`), 요청 주소(`base-url.ts`), BFF 프록시, MSW 켜기(`api-mocking.ts`) | 프로젝트                                       |
| `src/queries/<Query Domain>` | 쿼리 키(`<domain>.keys.ts`), queryOptions·뮤테이션 훅(`<domain>.queries.ts`)                       | 프로젝트                                       |
| `src/features/<Feature>`     | 쿼리를 써서 화면을 그리는 UI                                                                       | 프로젝트                                       |
| `src/app`                    | 라우트. 서버 컴포넌트에서 prefetch                                                                 | 프로젝트                                       |

- `npm run api:gen`은 `orval.config.ts`대로 `src/shared/api/generated`를 지우고 다시 만듭니다. 같은 명세로 다시 실행하면 결과가 바뀌지 않으므로, 생성 결과는 git에 함께 올립니다. TanStack Query 훅은 만들지 않습니다.
- 생성 결과는 `lint`와 `format:check` 대상에서 빠집니다(`eslint.config.ts`, `.prettierignore`). 타입 검사는 받습니다.
- Query Domain 이름은 OpenAPI tag를 따르고, 쿼리 키는 `['products', 'listProducts', params]`처럼 계층으로 만듭니다. `src/queries`의 코드는 `npm run g -- query <operationId>`와 `npm run g -- mutation <operationId>`로 만들 수 있습니다(아래 "코드 생성(Schematic)").
- 샘플: `/products` 페이지(`src/app/products/page.tsx`)가 서버에서 `listProductsQueryOptions()`로 데이터를 가져오고(prefetch), `HydrationBoundary`로 넘긴 데이터를 `src/features/product-list`가 이어받습니다. 브라우저는 같은 데이터를 다시 요청하지 않습니다(`e2e/products.spec.ts`).

### 요청이 가는 곳

생성된 fetch 함수는 모두 `src/shared/api/api-fetch.ts`의 `apiFetch`를 거칩니다. `apiFetch`는 실행 환경에 따라 주소를 고르고, 응답을 명세의 Zod 스키마로 검증합니다. 2xx가 아닌 응답은 `ApiError`로 던집니다.

- 서버(서버 컴포넌트, Route Handler): `API_BASE_URL`의 백엔드를 직접 부릅니다. MSW를 끈 서버(`API_MOCKING`이 `enabled`가 아님)에 `API_BASE_URL`이 없으면 서버가 뜰 때 오류를 내고 요청을 처리하지 않습니다. 엉뚱한 주소로 조용히 요청하지 않도록 기본값은 두지 않습니다. 빌드할 때 SSG·ISR 페이지를 렌더링하는 서버 컴포넌트도 같아서, MSW를 끈 빌드에 `API_BASE_URL`이 없으면 빌드가 실패합니다(위 "배포용 빌드와 목 빌드").
- 브라우저: BFF 프록시 `/api/proxy/*`(`src/app/api/proxy/[...path]/route.ts`)를 부르고, 프록시가 `API_BASE_URL`로 요청을 그대로 전달합니다.
- 서버의 요청과 프록시가 전달하는 요청은 `src/shared/api/backend-fetch.ts`의 처리기를 차례로 거쳐 나갑니다. 예를 들어 `auth` Recipe를 넣으면 이 처리기가 로그인 세션의 토큰을 붙입니다.
- 브라우저가 프록시 대신 백엔드를 직접 불러야 하면(서버가 없는 `static-export` 등) `NEXT_PUBLIC_API_BASE_URL`에 백엔드 주소를 적습니다. 빌드할 때 코드에 박히므로 바꾸면 다시 빌드하고, 백엔드가 그 출처의 CORS 요청을 허용해야 합니다.

| 환경 변수                  | 읽는 곳                                                                              | 값                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `API_BASE_URL`             | 서버(실행할 때, 빌드할 때)                                                           | 백엔드 주소. MSW를 끈 서버와 배포용 빌드에는 꼭 넣습니다(배포 환경, 실제 백엔드 개발)                      |
| `NEXT_PUBLIC_API_BASE_URL` | 브라우저(빌드할 때 박힘)                                                             | 비우면 BFF 프록시. 적으면 브라우저가 그 주소를 직접 부름                                                   |
| `API_MOCKING`              | 서버(`src/shared/api/api-instrumentation.ts`), 빌드(`src/shared/api/api-mocking.ts`) | `enabled`이면 서버와 빌드의 요청을 MSW가 받고, `API_BASE_URL`이 없어도 됨. 배포용은 `.env.production`이 끔 |

### 샘플 명세 바꾸기

`openapi.yaml`은 API 계층이 어떻게 이어지는지 보여 주는 가상의 샘플입니다. 실제 프로젝트에서는 다음 순서로 바꿉니다.

1. `openapi.yaml`을 백엔드의 명세로 바꿉니다. `npm run g`도 이 파일을 읽으므로, 백엔드가 명세를 URL로 내주면 내려받아 이 파일에 저장합니다.
2. 샘플 코드를 지웁니다: `src/app/products/`, `src/features/product-list/`, `src/queries/products/`, `e2e/products.spec.ts`
3. `npm run api:gen`을 실행하고 생성 결과를 커밋합니다.
4. `.env.development.local`과 배포 환경(배포용 빌드를 만드는 환경 포함)에 `API_BASE_URL`을 넣습니다.

## API 목킹(MSW)

MSW가 쓰는 핸들러 목록은 `src/shared/mocks/handlers.ts`이고, 명세에서 생성한 핸들러(`src/shared/api/generated/<tag>/<tag>.msw.ts`)를 모두 담습니다. 핸들러는 명세의 `example`을 돌려주고, `example`이 없으면 faker가 스키마에 맞는 값을 만듭니다. 늘 같은 값이 필요하면 명세에 `example`을 적습니다. 요청에 따라 다른 값을 돌려줘야 하면(파라미터대로 거르기, 실패 흉내 등) 직접 만든 핸들러를 이 목록의 생성된 핸들러 앞에 둡니다. 앞의 핸들러가 먼저 응답합니다.

- Vitest: 모든 테스트에서 켜져 있고, 핸들러가 없는 요청은 테스트를 실패시킵니다. 테스트 하나에서만 응답을 바꾸려면 `@/shared/mocks/node`의 `server.use(...)`에 생성된 핸들러(예: `getListProductsMockHandler([])`)나 직접 만든 핸들러를 넘깁니다.
- 개발 서버: `.env.development`의 `API_MOCKING=enabled`로 켭니다.
- E2E: `playwright.config.ts`가 서버를 `API_MOCKING=enabled`로 띄웁니다.
- 빌드: `API_MOCKING=enabled`로 빌드하면(목 빌드) 빌드할 때 서버 컴포넌트가 보내는 요청을 MSW가 받습니다. 목 빌드의 결과는 배포하지 않습니다(위 "배포용 빌드와 목 빌드").

MSW는 Next.js 서버(서버 컴포넌트, Route Handler)가 보내는 요청을 받습니다. 브라우저의 요청도 BFF 프록시를 거쳐 서버에서 나가므로 MSW가 받습니다. `NEXT_PUBLIC_API_BASE_URL`로 브라우저가 백엔드를 직접 부르면 MSW가 받지 않습니다. 서버의 MSW(`msw/node`)는 번들에 넣지 않고 `node_modules`에서 불러옵니다(`next.config.ts`의 `serverExternalPackages`).

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

| Schematic   | 만드는 것                                                                                                    | 넣는 곳                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `query`     | 쿼리 키와 queryOptions(`--infinite`는 infiniteQueryOptions)                                                  | Query Domain(`src/queries/<domain>/`)                             |
| `mutation`  | 뮤테이션 훅(`--optimistic`은 낙관적 업데이트 뼈대까지)                                                       | Query Domain(`src/queries/<domain>/`)                             |
| `form`      | 요청 본문을 입력받아 뮤테이션 훅으로 보내는 폼, Storybook 스토리, 테스트                                     | Feature(`src/features/<feature>/`)                                |
| `page`      | 라우트의 페이지(메타데이터, Rendering Mode), 로딩·오류 상태. `--query`의 결과를 보여 줄 컴포넌트와 그 테스트 | 라우트(`src/app/<route>/`), Feature(`src/features/<feature>/`)    |
| `component` | 컴포넌트, Storybook 스토리, 테스트                                                                           | Feature(`src/features/<feature>/`) 또는 공통 UI(`src/shared/ui/`) |

Schematic을 차례로 실행하면 화면 하나가 됩니다. 예를 들어 상품 목록과 등록 폼이 있는 화면은 이렇게 만듭니다.

```sh
npm run g -- query listProducts                                # 목록의 queryOptions
npm run g -- mutation createProduct                            # 등록의 뮤테이션 훅
npm run g -- form createProduct --feature product-admin        # 등록 폼
npm run g -- page catalog --query listProducts --form createProduct --feature catalog
```

- `query`, `mutation`, `form`, `page`는 Starter 최상위(`package.json`이 있는 디렉터리)의 `openapi.yaml`을 읽습니다. 만든 코드는 재생성 계층의 fetch 함수와 Zod 스키마를 쓰므로, 명세를 고쳤다면 먼저 `npm run api:gen`을 실행합니다.
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

### page

```sh
npm run g -- page <route>                                             # 페이지, 로딩·오류 상태(Rendering Mode는 기본값)
npm run g -- page <route> --mode <ssr|ssg|isr|streaming|csr>          # 라우트의 Rendering Mode를 고른다
npm run g -- page <route> --query <operationId> --feature <feature>   # queryOptions로 가져온 결과를 보여 준다
npm run g -- page <route> --form <operationId>                        # form Schematic이 만든 폼을 넣는다
```

- `src/app/<route>/`에 페이지(`page.tsx`), 로딩 상태(`loading.tsx`), 오류 상태(`error.tsx`)를 만듭니다. 페이지는 메타데이터(`metadata`의 `title`)와 제목을 담고, 제목은 `--query`(없으면 `--form`) operation의 `summary`, 둘 다 없으면 라우트의 경로입니다. 오류 상태의 "다시 시도"는 이 라우트를 서버에서 다시 가져와 렌더링합니다. 문구는 화면에 맞게 고칩니다.
- 라우트는 `/`로 나눈 세그먼트입니다. 세그먼트는 kebab-case(`products/new`)이고, 동적 세그먼트(`products/[productId]`)와 경로 그룹(`(admin)/reports`)을 쓸 수 있습니다. catch-all(`[...slug]`), 병렬·가로채기 라우트, `generateMetadata`는 만들지 않으므로 직접 고칩니다. `src/app`은 Next.js 라우트 구조가 폴더 깊이를 정하므로 폴더 깊이 제한을 받지 않습니다.
- `--mode`로 라우트의 Rendering Mode를 고릅니다. 고르지 않으면 server Starter에서는 `ssr`, static-export Starter에서는 `csr`입니다. static-export Starter에는 요청을 받는 서버가 없으므로 `ssg`, `csr`만 고를 수 있고, 다른 모드나 동적 세그먼트가 있는 라우트(빌드할 때 모든 경로를 `generateStaticParams`로 정해야 합니다)는 아무 파일도 만들지 않고 거부합니다.

  | `--mode`    | 페이지에 넣는 것                                 | `--query`의 데이터                                                                           |
  | ----------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
  | `ssr`       | `await connection()`                             | 요청마다 서버에서 가져와 hydration으로 넘깁니다. 기다리는 동안 `loading.tsx`를 먼저 보냅니다 |
  | `ssg`       | `export const dynamic = 'error'`                 | 빌드할 때 서버에서 가져와 HTML에 담습니다                                                    |
  | `isr`       | `export const revalidate = 60`                   | 빌드할 때, 그 뒤로는 60초가 지나 요청이 오면 다시 렌더링할 때 서버에서 가져옵니다            |
  | `streaming` | `await connection()`, 데이터 부분의 `<Suspense>` | 요청마다 서버에서 가져오되, 제목 같은 나머지와 데이터 자리의 대체 UI를 먼저 보냅니다         |
  | `csr`       | 없음(페이지 뼈대는 빌드할 때 렌더링)             | 브라우저가 가져옵니다. 서버가 보낸 HTML에는 불러오는 중 상태만 있습니다                      |

  `ssr`과 `streaming` 모두 같은 응답에 이어 보내지만, `ssr`은 데이터를 기다리는 동안 페이지 전체 대신 로딩 상태를 보내고 `streaming`은 데이터 자리만 대체 UI로 두고 나머지를 먼저 그립니다. `--query` 없이 만든 `streaming` 페이지는 `ssr`과 같으므로, 느린 데이터를 가져오는 서버 컴포넌트를 만들어 `<Suspense>`로 감쌉니다.

- `--query <operationId>`는 그 GET operation의 queryOptions로 데이터를 가져옵니다. queryOptions가 없으면 아무 파일도 만들지 않고 `npm run g -- query <operationId>`를 먼저 실행하라고 알립니다. infiniteQueryOptions(`--infinite`)는 끼워 넣지 않으므로 페이지를 만든 뒤 직접 바꿉니다.
  - 결과는 `--feature`에 만드는 클라이언트 컴포넌트(예: `listProducts`는 `list-products-view.tsx`의 `ListProductsView`)가 `useQuery`로 보여 주고, 컴포넌트 테스트(응답 표시, 빈 목록, 실패)를 함께 만듭니다. `app`은 라우팅만 맡으므로 화면은 Feature에 둡니다. 같은 Feature에 그 컴포넌트가 이미 있으면 다시 만들지 않고 씁니다. 배열 응답은 항목마다 `name`(또는 `title`, `label`, 첫 번째 필수 문자열 속성)을 보여 주는 목록이고 `id`가 있으면 key로 씁니다. 객체 응답은 속성마다 이름과 값을 보여 줍니다. 보여 줄 값과 모양은 화면에 맞게 고칩니다. Storybook에는 MSW가 없으므로 스토리는 만들지 않습니다.
  - 서버에서 렌더링하는 모드는 위 `/products`처럼 페이지가 `queryClient.query()`로 가져와 `HydrationBoundary`로 넘기므로 브라우저가 다시 요청하지 않습니다(SSG·ISR은 가져온 지 `staleTime`(1분)이 지나면 브라우저가 다시 가져옵니다). 가져오지 못하면 오류 상태가 보입니다.
  - SSG·ISR 페이지는 빌드할 때 서버 컴포넌트가 백엔드를 부르므로, 배포용 빌드에는 `API_BASE_URL`을 넣습니다. GitLab CI의 `build` 잡과 E2E는 목 빌드(`API_MOCKING=enabled`)라 MSW가 응답합니다(위 "배포용 빌드와 목 빌드"). 동적 세그먼트가 있는 SSG·ISR 라우트는 `generateStaticParams`가 빈 목록을 돌려줘 빌드할 때는 렌더링하지 않고, 처음 요청이 온 경로를 렌더링해 둡니다. 빌드할 때 만들 경로가 있으면 `generateStaticParams`를 고칩니다.
  - 경로 파라미터는 같은 이름의 동적 세그먼트에서 읽어 넘깁니다(`products/[productId]`에서 `getProductQueryOptions(productId)`). 라우트에 그 세그먼트가 없으면 거부합니다. 숫자 파라미터는 숫자로 바꾸고, 바꿀 수 없으면 없는 페이지(`notFound()`)로 봅니다. 쿼리 파라미터(`searchParams`)는 넘기지 않으므로, 필수 쿼리 파라미터가 있는 operation은 거부합니다.
- `--form <operationId>`는 `npm run g -- form`이 Feature에 만든 폼(`<operation-id>-form.tsx`의 `<OperationId>Form`)을 넣습니다. 폼이 없으면 아무 파일도 만들지 않고 `npm run g -- form <operationId> --feature <feature>`를 먼저 실행하라고 알립니다. 같은 폼이 여러 Feature에 있으면 `--feature`로 고릅니다. `--feature`는 `--query`의 컴포넌트를 둘 곳이기도 하므로, 여러 Feature에 있는 폼을 `--query`의 컴포넌트와 다른 Feature에서 가져오려면 페이지를 만든 뒤 import를 고칩니다. 폼이 받는 경로 파라미터는 `--query`처럼 동적 세그먼트에서 넘깁니다. `--query`와 함께 쓰면 결과 아래에 폼을 두고, 제출에 성공하면 뮤테이션 훅이 Query Domain의 쿼리를 무효화해 결과를 다시 가져옵니다.
- 만들 파일(페이지, 로딩·오류 상태, `--query`의 컴포넌트와 테스트) 가운데 하나라도 이미 있으면 아무 파일도 만들지 않고, 있는 파일을 알린 뒤 실패합니다.

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

## 인증

`auth` Recipe로 넣었습니다. 백엔드가 발급한 accessToken·refreshToken으로 로그인하고, 토큰은 서버만 읽는 암호화한 httpOnly 쿠키에 보관합니다(ADR-0006). 프론트엔드는 DB를 쓰지 않고, Auth.js·Better Auth도 쓰지 않습니다. 백엔드에는 쿠키 기반 refresh 같은 추가 기능을 요구하지 않습니다.

| 요청                                 | 하는 곳                                                   | 토큰                                                                                     |
| ------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 로그인·로그아웃(`/api/session`)      | Route Handler(`src/shared/auth/session-routes.ts`)        | 백엔드에 중계하고 받은 토큰을 세션 쿠키에 담거나 지운다. 브라우저에는 사용자 정보만 준다 |
| 브라우저의 API 요청(`/api/proxy/*`)  | BFF 프록시 + backendFetch 처리기(`auth-backend-fetch.ts`) | 쿠키의 accessToken을 붙이고, 401이면 refresh한 뒤 다시 보내고 새 쿠키를 싣는다           |
| 서버 컴포넌트의 API 요청(`apiFetch`) | backendFetch 처리기                                       | `getServerSession()`으로 읽은 세션의 accessToken을 붙인다                                |
| 페이지 요청                          | proxy(`auth-proxy.ts`, `src/proxy.ts`)                    | accessToken이 곧 만료되면 미리 refresh한다. 보호된 라우트와 역할을 거른다                |

- 세션(`src/shared/auth/session.ts`): 두 토큰, accessToken의 만료 시각, 사용자(역할 포함)를 [iron-session](https://github.com/vvo/iron-session)으로 암호화해 쿠키 `auth_session` 하나에 담습니다. 쿠키는 `HttpOnly`, `SameSite=Lax`, 배포한 서버에서는 `Secure`입니다. 브라우저는 쿠키 하나에 4KB까지만 담으므로, 세션이 그보다 커지면 로그인이 실패합니다. 토큰이 길면 세션에 담는 사용자 정보를 줄입니다.
- 보호된 라우트와 역할(`src/shared/auth/access-rules.ts`): `PROTECTED_ROUTES`에 경로와 역할을 적습니다. 로그인하지 않았으면 돌아올 주소를 담아 `/login?next=...`로 보내고, 역할이 맞지 않으면 주소는 그대로 둔 채 `/forbidden`을 403으로 보여 줍니다. 샘플은 로그인한 사용자의 `/account`와 `admin` 역할의 `/admin`입니다. 역할은 세션의 사용자 정보를 보고, 사용자 정보는 로그인하거나 refresh할 때마다 백엔드(`getMe`)에서 다시 받습니다. 돌아올 주소는 이 앱 안의 경로만 받습니다.
- 서버 컴포넌트에서 인증이 필요한 API를 부르려면 데이터를 가져오기 전에 `getServerSession()`이나 `requireServerSession()`(`src/shared/auth/server-session.ts`)을 먼저 부릅니다. 그 렌더링의 `apiFetch` 요청에만 accessToken이 붙습니다. 모든 서버 요청이 쿠키를 읽으면 SSG·ISR 페이지까지 요청마다 렌더링되기 때문입니다. 서버 컴포넌트는 쿠키를 고칠 수 없어 refresh하지 않고, 대신 proxy가 페이지를 렌더링하기 전에 refresh해 둡니다. 예: `src/app/account/page.tsx`.
- Route Handler나 Server Action은 렌더링이 아니라서 토큰이 저절로 붙지 않습니다. `sessionOf(await cookies())`(`session.ts`)로 읽은 세션의 accessToken을 생성된 fetch 함수의 옵션으로 넘깁니다(``{ headers: { authorization: `Bearer ${session.accessToken}` } }``).
- 브라우저에서 생성된 `login`, `refreshTokens`를 부르지 않습니다. BFF 프록시는 백엔드의 응답을 그대로 돌려주므로 응답의 토큰이 브라우저의 JavaScript로 갑니다. 로그인은 `/api/session`으로 합니다(`src/shared/auth/auth-client.ts`).
- refresh(`src/shared/auth/refresh-session.ts`): 동시에 여러 요청이 401을 받아도 같은 refreshToken의 refresh는 백엔드에 한 번만 보내고 결과를 나눠 씁니다. 백엔드가 쓴 refreshToken을 다시 받지 않는(rotation) 경우에도 로그아웃되지 않도록, 끝난 refresh의 결과도 10초 동안 남겨 이전 쿠키로 늦게 온 요청에 줍니다. 묶는 범위는 서버 프로세스 하나라서, 서버를 여러 대 띄우면 백엔드가 같은 refreshToken을 잠시 다시 받아 주게 하거나(reuse interval) 같은 사용자의 요청을 한 서버로 보냅니다.
- 머리글의 사용자 메뉴(`src/features/user-menu`)는 로그인했으면 이름과 로그아웃 버튼을, 아니면 로그인 링크를 보여 줍니다. 로그인 여부는 브라우저가 `/api/session`에 물어봅니다. 루트 레이아웃이 쿠키를 읽으면 모든 페이지가 요청마다 렌더링되기 때문입니다. 로그인 폼은 `src/features/login-form`, 로그인 페이지는 `src/app/login/page.tsx`입니다.
- 다른 사이트에서 보낸 POST·DELETE 요청에는 세션 쿠키가 실리지 않으므로(`SameSite=Lax`) 다른 사이트가 BFF 프록시와 로그아웃을 대신 보낼 수 없습니다. 쿠키가 필요 없는 로그인(`POST /api/session`)은 JSON 본문만 받아, 다른 사이트의 HTML 폼(JSON을 보낼 수 없음)이나 fetch(CORS 사전 요청에서 막힘)가 공격자의 계정으로 로그인시키지 못하게 합니다. 상태를 바꾸는 API를 GET으로 만들지 않습니다. 같은 사이트(하위 도메인)의 다른 앱은 막지 못하므로 그런 앱과 도메인을 나눠 쓰면 따로 막습니다.
- 로그아웃하면 백엔드에 로그아웃을 중계하고 세션 쿠키를 지웁니다. accessToken이 만료되어 백엔드가 받지 않으면 refresh한 뒤 다시 중계해 refreshToken까지 끝냅니다.

### 환경 변수

| 환경 변수        | 읽는 곳                                       | 값                                                                                                                                                                                                         |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET` | 서버(`src/shared/auth/session.ts`, 실행할 때) | 세션 쿠키를 암호화하는 32자 이상의 비밀 값(예: `openssl rand -base64 32`의 출력). 배포하는 서버에는 꼭 넣고, 서버가 여러 대면 같은 값을 넣습니다. 없으면 서버가 뜰 때 오류를 내고 요청을 처리하지 않습니다 |

개발 서버는 `.env.development`의 값을, E2E 대상 서버는 `playwright.config.ts`의 값을 씁니다. 둘 다 배포 환경에 쓰지 않습니다. 값을 바꾸면 로그인한 사용자가 모두 로그아웃됩니다.

### 목 백엔드와 실제 백엔드

- 샘플 명세(`openapi.yaml`)에 `auth` tag의 `login`, `refreshTokens`, `getMe`, `logout`이 있습니다. 서버(BFF)만 이 operation을 부릅니다(`src/shared/auth/auth-backend.ts`).
- MSW를 켜면(`API_MOCKING=enabled`) 발급한 토큰을 기억하는 목 백엔드(`src/shared/auth/auth-mock-handlers.ts`)가 받습니다. 계정은 `user@example.com`(사용자)과 `admin@example.com`(관리자), 비밀번호는 모두 `password`입니다. accessToken은 10초 뒤에 만료되어 refresh가 일어나는 것을 볼 수 있고, refreshToken은 한 번만 쓸 수 있습니다.
- 실제 백엔드로 바꿀 때는 백엔드의 명세로 `openapi.yaml`의 auth operation을 바꾸고 `npm run api:gen`을 실행한 뒤, 경로나 응답 모양이 다르면 `src/shared/auth/auth-backend.ts`를 맞춥니다. 백엔드가 accessToken의 수명(`expiresIn`)을 주지 않으면 proxy가 미리 refresh하지 못하므로 `createSession`(`session.ts`)에서 정합니다.

### 테스트

`src/shared/auth/session.test.ts`(쿠키 암호화, 비밀 값 확인), `auth-backend-fetch.test.ts`(BFF 프록시의 토큰 첨부, 401이면 refresh 후 다시 보냄, 동시에 여러 요청이 401을 받아도 refresh는 한 번), `auth-proxy.test.ts`(보호된 라우트, 역할, 미리 refresh), `access-rules.test.ts`(로그인한 뒤 돌아갈 주소는 이 앱 안의 경로만), `refresh-session.test.ts`(따로 번들된 proxy와 BFF 프록시도 refresh는 한 번), `session-routes.test.ts`(로그인·로그아웃 중계와 쿠키), `src/features/login-form/login-form.test.tsx`, 로그인 폼과 사용자 메뉴의 스토리, `e2e/auth.spec.ts`(로그인, 보호된 라우트, 역할, 토큰 만료 후 자동 refresh, 로그아웃, 접근성).

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

## 다국어(i18n)

`i18n` Recipe로 넣었습니다. [next-intl](https://next-intl.dev)로 한국어(기본 locale `ko`)와 영어(`en`)를 지원합니다.

- 번역한 페이지는 `src/app/[locale]/` 아래에 둡니다. 주소 앞에 늘 locale이 붙고(`/ko`, `/en/i18n`), 페이지는 locale마다 빌드할 때 렌더링합니다(`src/app/[locale]/layout.tsx`의 `generateStaticParams`). 지원하지 않는 locale의 주소(`/fr`)는 404입니다. 예로 홈(`/ko`, `/en`, 화면은 `src/features/home`)과 다국어 예시(`/ko/i18n`, `/en/i18n`: 날짜·통화 형식, 복수형, 클라이언트 컴포넌트의 번역)가 있습니다. 예시는 지워도 됩니다(`src/app/[locale]/i18n/`, `src/features/i18n-example/`, 카탈로그의 `I18nExample`과 `CartCounter`, `e2e/i18n.spec.ts`의 해당 테스트).
- `[locale]` 밖의 페이지(`/products`, 다른 Recipe가 더한 페이지)는 번역하지 않은 페이지로, 주소와 화면이 그대로이고 locale 전환 UI에는 기본 locale로 보입니다. 번역하려면 페이지를 `src/app/[locale]/` 아래로 옮기고 문장을 메시지 카탈로그로 옮깁니다.
- 메시지 카탈로그는 `src/shared/i18n/ko.json`(키의 기준)과 `en.json`이고, 메시지는 ICU 형식(`{count, plural, ...}`, `{date, date, full}`)으로 씁니다. 메시지 키는 `ko.json`의 타입으로 검사하므로(`src/shared/i18n/messages.ts`) 없는 키를 쓰면 `npm run typecheck`가 실패합니다. `en.json`에 키가 빠지면 타입 오류가 나고, 남는 키는 `npm test`(`messages.test.tsx`)가 잡습니다.
- 서버 컴포넌트는 params의 locale을 넘겨 번역합니다: `const locale = await requireLocale(props)`(`src/shared/i18n/require-locale.ts`, 지원하지 않는 locale이면 404) 다음에 `getTranslations({ locale, namespace })`, `getFormatter({ locale })`. 루트 레이아웃(`src/app/layout.tsx`)이 `[locale]` 밖에 있어 next-intl이 요청의 locale을 스스로 알 수 없기 때문입니다. locale 없이 부르면 기본 locale로 조용히 그리지 않고 오류로 알립니다(`src/shared/i18n/request.ts`). params만 읽으므로 페이지는 빌드할 때 렌더링할 수 있습니다. 모든 페이지를 `[locale]` 아래로 옮겨 `src/app/[locale]/layout.tsx`가 루트 레이아웃이 되면 next-intl 문서의 `next/root-params` 방식으로 바꿀 수 있습니다.
- 클라이언트 컴포넌트는 `useTranslations`, `useFormatter`를 씁니다. 앱 전체를 감싼 `I18nProvider`(`src/shared/i18n/i18n-provider.tsx`, `src/app/app-shell.tsx`)가 주소의 locale과 그 카탈로그를 넘깁니다. 어느 페이지가 올지 모르는 루트 레이아웃에서 넘기므로 모든 locale의 카탈로그가 브라우저 번들에 들어갑니다. 카탈로그가 커지면 클라이언트 컴포넌트가 쓰는 namespace만 넘기도록 나눕니다.
- 링크와 이동은 `@/shared/i18n/navigation`의 `Link`, `useRouter`, `usePathname`을 씁니다. 지금 locale을 주소 앞에 붙입니다(`<Link href="/i18n">` → `/en/i18n`). 이 `Link`는 서버 컴포넌트에서도 씁니다.
- 머리글의 locale 전환 UI(`src/features/locale-switcher`)는 번역한 페이지에서는 같은 페이지의 다른 locale 주소로 가고(`/ko/i18n` → `/en/i18n`), 번역하지 않은 페이지에서는 고른 locale의 홈으로 갑니다. 고른 locale은 `NEXT_LOCALE` 쿠키(브라우저를 닫으면 지워짐)에 저장됩니다.
- 홈(`/`): server Starter에서는 proxy 처리기(`src/shared/i18n/i18n-proxy.ts`, `src/proxy.ts`)가 저장한 locale, 브라우저 언어(`Accept-Language`), 기본 locale 순으로 고른 locale의 홈으로 보냅니다. 브라우저 언어를 따르지 않으려면 `src/shared/i18n/routing.ts`에 `localeDetection: false`를 적습니다. static-export Starter에는 요청을 받는 서버가 없어 `/`가 기본 locale의 홈을 보여 줍니다(`src/app/page.tsx`).
- 문서의 언어: 루트 레이아웃은 locale을 모르므로 `<html lang="ko">`로 그리고, `[locale]` 레이아웃이 페이지 내용을 `<div lang>`으로 감싸며, `I18nProvider`가 브라우저에서 `<html lang>`을 지금 locale로 바꿉니다. 기본 locale을 바꾸면 루트 레이아웃의 `lang`도 함께 바꿉니다.
- 검색 엔진에 locale별 주소(hreflang)를 알리는 링크는 넣지 않았습니다(`routing.ts`의 `alternateLinks: false`). 필요하면 페이지의 metadata에 `alternates.languages`로 적습니다.
- 날짜·시각은 `Asia/Seoul` 시간대로 보여 줍니다(`src/shared/i18n/messages.ts`의 `TIME_ZONE`). locale을 더하려면 `routing.ts`의 `locales`와 `LOCALE_NAMES`, 카탈로그(`<locale>.json`)와 `messages.ts`의 `MESSAGES`에 더합니다.
- 다른 Recipe가 더한 화면(예: 머리글의 테마 전환)은 번역하지 않았습니다.
- 테스트: `src/shared/i18n/messages.test.tsx`(locale마다 같은 키, 없는 키의 타입 오류), `request.test.ts`(서버 컴포넌트가 locale을 넘기지 않으면 실패), `i18n-proxy.test.ts`(홈에서 locale 고르기, 고른 locale 저장, 번역하지 않은 페이지), `src/features/i18n-example/cart-counter.test.tsx`(locale별 복수형), `src/features/locale-switcher/locale-switcher.stories.tsx`(locale 전환), `e2e/i18n.spec.ts`(locale이 붙은 주소, 빌드할 때 번역한 HTML, locale 전환, 번역하지 않은 페이지, 홈에서 locale 고르기, 접근성).

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
- MSW: 생성된 핸들러는 명세의 `example`을 그대로 돌려주므로, `src/shared/mocks/members.ts`의 핸들러가 고정된 회원 24명을 파라미터대로 거르고 정렬해 돌려줍니다. Starter를 만들 때 Generator가 `src/shared/mocks/handlers.ts`에서 생성된 핸들러보다 앞에 두었습니다. 실제 백엔드로 바꾸면 이 파일과 `handlers.ts`의 `membersHandlers`를 지웁니다.
- 테스트: `src/features/member-table/member-table.test.tsx`(정렬·검색·역할 필터·페이지가 요청 파라미터와 쿼리 키로 이어짐, `aria-sort`, 키보드 정렬, 빈 결과, 실패), `e2e/table.spec.ts`(빌드한 앱에서 키보드로 정렬·검색·필터, 페이지 이동, 접근성).
- 샘플을 지우려면 `src/app/members/`, `src/features/member-table/`, `src/queries/members/`, `src/shared/mocks/members.ts`(와 `handlers.ts`의 `membersHandlers`), `e2e/table.spec.ts`를 지우고 `openapi.yaml`에서 `listMembers`를 뺀 뒤 `npm run api:gen`을 실행합니다.
