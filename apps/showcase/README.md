> **생성된 Showcase입니다. 이 디렉터리의 파일은 직접 고치지 마세요.**
>
> Showcase는 Generator(`packages/devc-frontend-generator`)가 Base에 Rendering Mode `server`와 모든 Recipe, Archetype을 덧입혀 만든 Starter입니다([ADR-0002](../../docs/adr/0002-recipes-are-source-of-truth.md)). 바꿀 것이 있으면 Base(`base/`), Recipe(`recipes/<이름>/`), Archetype(`archetypes/<이름>/`)을 고친 뒤 레포 최상위에서 `npm run showcase`로 다시 만들어 함께 커밋합니다. CI는 다시 만든 결과가 커밋된 Showcase와 다르면 실패합니다([Recipe 작성하기](../../docs/recipes.md), [Archetype 작성하기](../../docs/archetypes.md)).
>
> - 켠 Recipe: `analytics`, `auth`, `chart`, `dark-mode`, `docker`, `file-upload`, `i18n`, `infinite-list`, `multi-step-form`, `optimistic-update`, `realtime`, `route-rendering`, `sentry`, `seo`, `table`. Recipe가 더한 화면과 쓰는 법은 아래 README의 Recipe 절에 있습니다.
> - 켠 Archetype: `dashboard`. Archetype이 더한 화면과 쓰는 법은 아래 README의 Archetype 절에 있습니다.
> - 주석을 달 수 있는 파일은 맨 위의 주석이 이 안내와 고칠 원본을 알립니다. 주석을 달 수 없는 파일: `.nvmrc`, `.prettierrc.json`, `package.json`, `src/shared/i18n/en.json`, `src/shared/i18n/ko.json`, `src/shared/seo/pretendard-bold.woff`, `src/shared/seo/pretendard-license.txt`
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

| 파일                              | 내용                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/app-shell.tsx`           | 루트 레이아웃(`src/app/layout.tsx`)이 모든 페이지를 감싸는 Provider(위에 적힌 것이 바깥)와 머리글                                |
| `next.config.plugins.ts`          | `next.config.ts`의 설정을 감싸는 래퍼(예: next-intl, Sentry의 플러그인). 위에 적힌 것이 바깥                                     |
| `src/instrumentation.ts`          | 서버가 뜰 때 실행할 코드(API 목킹이나 백엔드 주소 확인 등)와 서버가 요청을 처리하다 난 오류의 처리                               |
| `src/instrumentation-client.ts`   | 브라우저에서 앱 코드보다 먼저 실행할 코드와 페이지 이동 알림. 넣은 코드가 있을 때만 있음                                         |
| `src/proxy.ts`                    | 페이지 요청이 라우트에 닿기 전에 차례로 실행할 처리기(Next.js Proxy). 넣은 처리기가 있을 때만 있음                               |
| `src/shared/api/backend-fetch.ts` | 서버가 백엔드로 보내는 요청(서버의 `apiFetch`, BFF 프록시)이 차례로 거칠 처리기(예: 토큰 첨부). 처리기가 없으면 그대로 보냄      |
| `src/shared/mocks/handlers.ts`    | MSW가 쓰는 핸들러 목록. Recipe가 직접 만든 핸들러(위에 적힌 것이 먼저 응답)와 명세에서 생성한 핸들러                             |
| `src/app/sitemap-rules.ts`        | sitemap과 robots.txt가 따르는 규칙(예: 로그인해야 들어가는 페이지는 알리지 않음). sitemap(`src/app/sitemap.ts`)이 있을 때만 있음 |

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

| 컴포넌트                                                | 쓰는 법                                                                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                                | `variant`(`primary`, `secondary`, `danger`), `size`(`sm`, `md`). 링크를 버튼처럼 보이게 할 때는 `<a className={buttonVariants()}>`                   |
| `Field`, `FieldLabel`, `FieldDescription`, `FieldError` | 폼 컨트롤 하나에 레이블, 설명, 오류 메시지를 잇습니다.                                                                                               |
| `Input`                                                 | `<Field><FieldLabel>이름</FieldLabel><Input /></Field>`                                                                                              |
| `Checkbox`                                              | `<Field><FieldLabel><Checkbox />약관에 동의합니다</FieldLabel></Field>`                                                                              |
| `Select`                                                | `<Select label="지역" options={[{ value: 'seoul', label: '서울' }]} />`. 고른 값을 다시 비울 수 있게 하려면 `clearLabel="선택 안 함"`(비우면 `null`) |
| `Dialog` 등                                             | `Dialog`, `DialogTrigger`, `DialogPopup`, `DialogTitle`, `DialogDescription`, `DialogClose`                                                          |
| `useToast`                                              | `useToast().add({ title: '저장했습니다' })`. `ToastProvider`는 레이아웃과 Storybook이 이미 감싸 두었습니다.                                          |

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

목 백엔드는 앱과 다른 출처의 주소(`src/shared/api/base-url.ts`의 `MOCK_API_BASE_URL`, `https://mock.api.test`)에 둡니다. MSW를 켜고 `API_BASE_URL`을 넣지 않으면 서버가 이 주소로 요청하고, 생성된 핸들러는 이 주소로 가는 요청만 받습니다(`orval.config.ts`). 그래서 핸들러가 `/products` 같은 페이지 주소와 겹치지 않고, 목록 맨 앞의 `src/shared/mocks/page-navigation.ts`는 페이지를 열거나 새로 고치는 요청을 목 응답 없이 그대로 보냅니다. 직접 만든 핸들러도 ``http.get(`${MOCK_API_BASE_URL}/<경로>`, ...)``처럼 이 주소만 받게 씁니다. 테스트 하나에서 응답을 바꾸는 `server.use`에는 `*/<경로>`를 써도 됩니다. MSW를 켜 둬도 `API_BASE_URL`을 넣으면 그 백엔드를 부르고, MSW는 그 요청을 받지 않습니다.

- Vitest: 모든 테스트에서 켜져 있고, 핸들러가 없는 요청은 테스트를 실패시킵니다. 브라우저 코드(jsdom)의 요청도 BFF 프록시 대신 목 백엔드로 보냅니다(`vitest.setup.ts`). 테스트 하나에서만 응답을 바꾸려면 `@/shared/mocks/node`의 `server.use(...)`에 생성된 핸들러(예: `getListProductsMockHandler([])`)나 직접 만든 핸들러를 넘깁니다.
- 개발 서버: `.env.development`의 `API_MOCKING=enabled`로 켭니다.
- E2E: `playwright.config.ts`가 서버를 `API_MOCKING=enabled`로 띄웁니다.
- 빌드: `API_MOCKING=enabled`로 빌드하면(목 빌드) 빌드할 때 서버 컴포넌트가 보내는 요청을 MSW가 받습니다. 목 빌드의 결과는 배포하지 않습니다(위 "배포용 빌드와 목 빌드").

MSW는 Next.js 서버(서버 컴포넌트, Route Handler)가 보내는 요청을 받습니다. 브라우저의 요청도 BFF 프록시를 거쳐 서버에서 나가므로 MSW가 받습니다. 브라우저의 MSW(서비스 워커)를 쓰는 Rendering Mode(`static-export`)에서 fetch를 쓰지 않는 요청(XMLHttpRequest 등)은 `src/shared/mocks/mock-readiness.ts`의 `waitForMocks()`로 서비스 워커가 준비되기를 기다린 뒤 보냅니다. 이 Rendering Mode에서는 바로 끝나므로 두 Rendering Mode에서 같은 코드를 씁니다. `NEXT_PUBLIC_API_BASE_URL`로 브라우저가 백엔드를 직접 부르면 MSW가 받지 않습니다. 서버의 MSW(`msw/node`)는 번들에 넣지 않고 `node_modules`에서 불러옵니다(`next.config.ts`의 `serverExternalPackages`).

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
} = useSchemaForm(CreateProductBody)
```

- `src/shared/form/use-schema-form.ts`의 `useSchemaForm(schema, { defaultValues })`은 스키마로 검증하는 `useForm`입니다. `src/shared/form/form-resolver.ts`의 `formResolver(schema)`를 `resolver`로 두고, 처음 값(`defaultValues`)을 `useForm`과 `formResolver`에 함께 넘깁니다. `mode` 같은 `useForm`의 다른 옵션도 함께 넘기고, 돌려주는 값은 `useForm`과 같습니다. 제출 핸들러(`handleSubmit`)는 검증을 통과한 값을 받습니다.
- 비워 둔 입력(빈 문자열, 고르지 않은 `Select`, 비운 숫자 입력)은 명세에 따라 검증 전에 바꿉니다. "비우기"(`null`)와 "보내지 않기"(키를 뺌)를 이렇게 나눕니다.

  | 비워 둔 필드                                                                                | 요청 본문                                                                                |
  | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
  | 선택 필드                                                                                   | 보내지 않습니다                                                                          |
  | 필수 필드                                                                                   | 보내지 않고 `REQUIRED_MESSAGE`("값을 입력해 주세요.")로 알립니다                         |
  | null을 받는 필수 필드(`type: [string, 'null']`, `nullable: true`, `anyOf`의 `type: 'null'`) | `null`을 보냅니다                                                                        |
  | null을 받는 선택 필드                                                                       | 처음 값이 있던 입력을 비웠으면 `null`(값을 지움), 처음부터 비어 있었으면 보내지 않습니다 |

- 기본값(`default`)이 있는 필드는 필수 필드여도 선택 필드처럼 다룹니다. 보내지 않는 입력에는 재생성 계층의 스키마가 기본값을 넣습니다.
- null을 받는 선택 필드의 "처음 값"은 `useSchemaForm`의 `defaultValues`입니다. 현재 값을 채운 수정 폼은 그 값을 `useSchemaForm`에 한 번만 넘기면 `useForm`과 `formResolver`가 함께 받습니다. 넘기지 않으면 처음 값이 없는 것으로 보므로 비워 둔 입력을 보내지 않습니다. 사용자가 손대지 않은 필드까지 `null`로 지우지 않도록(PATCH) 이렇게 정했습니다. `reset(values)`로 처음 값을 바꾸면 `formResolver`는 바뀐 값을 모르므로, 새 처음 값으로 폼을 다시 만듭니다(컴포넌트의 `key`를 바꿉니다). `useForm`에 `resolver`를 직접 넘길 때는 같은 값을 `formResolver(schema, { defaultValues })`에도 넘깁니다.

  ```tsx
  const form = useSchemaForm(UpdateProfileBody, {
    defaultValues: { nickname: profile.nickname, bio: profile.bio },
  })
  ```

- 반드시 체크해야 하는 체크박스(약관 동의 등)는 명세에 `const: true`나 `enum: [true]`로 적습니다. 재생성 계층의 스키마가 `true`만 받으므로, 체크하지 않으면 `MUST_CHECK_MESSAGE`("반드시 체크해야 합니다.")로 알리고 보내지 않습니다. 선택 필드면 체크하지 않았을 때 보내지 않습니다. `type: boolean`만 적은 필드는 체크하지 않으면 `false`를 보내고 검증을 통과합니다.

  ```yaml
  agreed:
    type: boolean
    const: true # 또는 enum: [true]
    title: 약관에 동의합니다
  ```

- 그 밖의 오류는 Zod의 한국어 메시지입니다.
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
- 폼은 재생성 계층의 요청 본문 Zod 스키마(`<OperationId>Body`)를 `useSchemaForm`으로 연결해 검증하고(위 "폼"), 제출하면 Query Domain의 `use<OperationId>Mutation` 훅으로 보냅니다. 훅이 없으면 아무 파일도 만들지 않고 `npm run g -- mutation <operationId>`를 먼저 실행하라고 알립니다.
- 요청 본문의 속성마다 공통 UI 입력 요소를 하나씩 만듭니다. 레이블은 명세의 `title`(없으면 속성 이름)이고, `description`은 입력 요소의 설명이 됩니다.

  | 명세의 속성                               | 입력 요소                                                                                                                                     |
  | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
  | `string`                                  | `Input`(`format: email`은 `type="email"`, `format: uri`는 `type="url"`)                                                                       |
  | `string`의 `enum`                         | `Select`(선택지의 레이블은 enum 값)                                                                                                           |
  | `integer`, `number`                       | `Input type="number"`. 입력한 값을 숫자로 바꿔 보냅니다                                                                                       |
  | `boolean`                                 | `Checkbox`. 체크하지 않으면 `false`를 보냅니다                                                                                                |
  | `boolean`의 `const: true`, `enum: [true]` | `Checkbox`. 체크하지 않으면 보내지 않고 `MUST_CHECK_MESSAGE`로 알립니다(필수 필드)                                                            |
  | 위 타입에 null을 더한 것                  | 같은 입력 요소. 비워 두면 위 "폼"의 표대로 `null`을 보내거나 보내지 않습니다. `enum`의 `null`은 선택지 대신 값을 비우는 "선택 안 함"이 됩니다 |
  | 그 밖(배열, 객체, `oneOf` 등)             | 선택 필드면 빼고 폼 위의 주석과 명령 출력으로 알립니다. 필수 필드면 폼을 만들지 않습니다                                                      |

- null을 더하는 방법은 3.1의 `type: [string, 'null']`, 3.0의 `nullable: true`, 스키마 하나와 `{ type: 'null' }`을 묶은 `anyOf`·`oneOf`, `enum`에 넣은 `null`을 모두 받습니다. 체크박스는 null을 받는 필드여도 늘 `true`나 `false`를 보냅니다. null을 받는 필드의 `Select`는 목록 맨 앞에 "선택 안 함"(`clearLabel`)을 두어 고른 값을 다시 비울 수 있고, 비우면 위 "폼"의 표대로 `null`을 보내거나 보내지 않습니다. 그 밖의 `Select`는 고른 값을 다시 비울 수 없으므로, 비울 수 있어야 하면 `clearLabel`을 더합니다.

- 경로 파라미터(`/products/{productId}`)는 폼의 props(`<UpdateProductForm productId={1} />`)로 받아 요청 본문과 함께 뮤테이션에 넘깁니다. 쿼리 파라미터 같은 선택 인자는 넘기지 않습니다.
- 성공하면 알림(토스트)으로 알리고 폼을 비우며, 실패하면 오류 알림을 띄웁니다. 문구와 성공한 뒤의 동작(목록으로 이동 등)은 화면에 맞게 고칩니다. 제출 버튼의 문구는 명세의 `summary`입니다.
- 테스트는 모든 입력 요소에 값을 넣어 제출하면 그 값이 요청 본문으로 가는지(MSW), 검증에 실패하면 보내지 않고 입력 요소에 오류를 알리는지 봅니다. 넣는 값은 명세의 `example`이고, 없으면 길이·범위·`format`을 지키는 값을 만듭니다. `pattern`이나 `multipleOf`가 있는 필수 필드(null을 받는 필드는 빼고)는 값을 만들 수 없으므로 명세에 `example`을 적어야 폼을 만듭니다.
- null을 받는 입력(체크박스와 기본값이 있는 필드는 빼고)이 있으면 필수 입력만 채워 제출했을 때 비워 둔 입력이 `null`로 가거나 빠지는지도 봅니다. 폼은 처음 값 없이 시작하므로, 처음 값이 있던 선택 필드를 비우는 경우(`useSchemaForm`의 `defaultValues`)는 `form-resolver.test.ts`와 `use-schema-form.test.ts`가 확인합니다. 수정 폼으로 쓰려면 현재 값을 `useSchemaForm`의 `defaultValues`에 더합니다.
- 검증 실패는 비워 둔 필수 입력(반드시 true여야 하는 체크박스는 체크하지 않은 것)으로 확인합니다. 비워 두면 실패하는 필수 입력이 없으면 규칙(`maxLength`, 2 이상의 `minLength`, 검증하는 `format`, 범위, 정수)에 맞지 않는 값을 입력해 확인하고, 어길 규칙도 없으면 검증 실패 테스트와 스토리 대신 그 사실을 주석으로 남깁니다.
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

## 분석(analytics)

`analytics` Recipe로 넣었습니다. 특정 분석 서비스에 묶이지 않는 페이지뷰·이벤트 인터페이스와, 아무 데도 보내지 않는 기본 구현입니다. 분석 서비스의 SDK는 들어 있지 않습니다.

| 위치                                                       | 내용                                                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/analytics/analytics.ts`                        | 앱 코드가 부르는 `trackEvent(name, properties)`, `trackPageView(url)`과 공급자의 모양(`AnalyticsProvider`)                                   |
| `src/shared/analytics/analytics-provider.ts`               | 페이지뷰와 이벤트를 실제로 보낼 곳(`analyticsProvider`). 분석 서비스를 붙일 때는 이 파일만 바꿉니다                                          |
| `src/shared/analytics/analytics-instrumentation-client.ts` | 페이지뷰. 브라우저가 페이지를 새로 불러오면 앱 코드보다 먼저, App Router로 옮겨 가면 옮겨 가기 시작할 때(`onRouterTransitionStart`) 남깁니다 |

페이지뷰 조각은 `src/instrumentation-client.ts`에 들어가 있습니다(위 "앱 조립 파일").

- 이벤트: 브라우저 코드(예: 버튼의 `onClick`)에서 `trackEvent('signup_completed', { plan: 'pro' })`처럼 부릅니다. 이름은 snake_case로 짓고, 속성에는 문자열·숫자·불리언만 담습니다. 이메일, 이름 같은 개인정보는 담지 않습니다. 페이지뷰는 저절로 남으므로 부르지 않습니다.
- 페이지뷰의 주소는 경로와 쿼리 문자열입니다(예: `/products?page=2`). 쿼리 문자열에 개인정보가 담기는 화면이 있으면 공급자에서 빼고 보냅니다. App Router로 옮겨 갈 때는 옮겨 가기 시작할 때 요청한 주소로 남기므로, 도중에 redirect되면(예: proxy가 로그인 페이지로 보냄) 처음 요청한 주소가 남고 도중에 취소된 이동도 남습니다.
- 기본 구현: 개발 서버(`npm run dev`)에서는 브라우저 콘솔에 `[analytics] page_view /products` 같은 줄만 남기고, 배포용 빌드와 테스트에서는 아무것도 하지 않습니다. 그래서 공급자를 붙이기 전에는 어디에도 보내지 않습니다.
- 분석 서비스 붙이기: `analytics-provider.ts`의 `analyticsProvider`를 그 서비스로 보내는 공급자로 바꿉니다. 측정 ID 같은 값은 `NEXT_PUBLIC_` 환경 변수로 받아 `.env.example`과 `process-env.d.ts`에 적고, 개발과 테스트에서 보내지 않도록 배포용 빌드(`NODE_ENV`가 `production`)에 그 값이 있을 때만 붙입니다. E2E와 GitLab CI의 목 빌드도 `production`이므로 그 값은 배포용 빌드를 만드는 곳에만 넣습니다(GitLab CI/CD 변수라면 배포 잡의 environment로 범위를 정하고, `.env.production.local`에 두지 않습니다). 이 모듈은 instrumentation-client가 앱 코드보다 먼저 불러오고 클라이언트 컴포넌트를 서버에서 렌더링할 때도 불러오므로, 모듈 최상위에서는 SDK를 불러오거나 초기화하지 않고 처음 보낼 때 브라우저(`typeof window !== 'undefined'`)에서 한 번 합니다. GA4라면 다음과 같습니다. `gtag.js`는 `src/app/layout.tsx`에서 `next/script`로 불러오고, 페이지뷰를 두 번 남기지 않도록 `gtag('config', <측정 ID>, { send_page_view: false })`로 GA4의 자동 페이지뷰를 끕니다. Amplitude라면 `@amplitude/analytics-browser`의 `init`을 처음 보낼 때 한 번 부르고 `track(name, properties)`로 보냅니다.

  ```ts
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const gtag = (...args: unknown[]) => {
    ;(window as { gtag?: (...args: unknown[]) => void }).gtag?.(...args)
  }

  const ga4Provider: AnalyticsProvider = {
    trackPageView: (url) => {
      gtag('event', 'page_view', { page_location: new URL(url, window.location.origin).href })
    },
    trackEvent: (name, properties) => {
      gtag('event', name, properties)
    },
  }

  export const analyticsProvider: AnalyticsProvider =
    process.env.NODE_ENV === 'production' && measurementId !== undefined && measurementId !== ''
      ? ga4Provider
      : process.env.NODE_ENV === 'development'
        ? consoleProvider
        : noopProvider
  ```

- 테스트: `src/shared/analytics/analytics.test.ts`(개발 서버에서 콘솔에 남기는 페이지뷰와 이벤트, 배포용 빌드와 테스트에서는 아무것도 하지 않음), `e2e/analytics.spec.ts`(공급자를 붙이지 않은 앱은 페이지를 열고 옮겨도 앱 밖으로 요청을 보내지 않고 콘솔에도 남기지 않음). 공급자를 바꾸면 `analytics.test.ts`의 기본 구현 테스트도 그 공급자에 맞게 고칩니다.

## 인증

`auth` Recipe로 넣었습니다. 백엔드가 발급한 accessToken·refreshToken으로 로그인하고, 토큰은 서버만 읽는 암호화한 httpOnly 쿠키에 보관합니다(ADR-0006). 프론트엔드는 DB를 쓰지 않고, Auth.js·Better Auth도 쓰지 않습니다. 백엔드에는 쿠키 기반 refresh 같은 추가 기능을 요구하지 않습니다.

| 요청                                 | 하는 곳                                                   | 토큰                                                                                     |
| ------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 로그인·로그아웃(`/api/session`)      | Route Handler(`src/shared/auth/session-routes.ts`)        | 백엔드에 중계하고 받은 토큰을 세션 쿠키에 담거나 지운다. 브라우저에는 사용자 정보만 준다 |
| 브라우저의 API 요청(`/api/proxy/*`)  | BFF 프록시 + backendFetch 처리기(`auth-backend-fetch.ts`) | 쿠키의 accessToken을 붙이고, 401이면 refresh한 뒤 다시 보내고 새 쿠키를 싣는다           |
| 서버 컴포넌트의 API 요청(`apiFetch`) | backendFetch 처리기                                       | `getServerSession()`으로 읽은 세션의 accessToken을 붙인다                                |
| 페이지 요청                          | proxy(`auth-proxy.ts`, `src/proxy.ts`)                    | accessToken이 곧 만료되면 미리 refresh한다. 보호된 라우트와 역할을 거른다                |

- 세션(`src/shared/auth/session.ts`): 두 토큰, accessToken의 만료 시각, 사용자(역할 포함)를 [iron-session](https://github.com/vvo/iron-session)으로 암호화해 쿠키 `auth_session` 하나에 담습니다. 쿠키는 `HttpOnly`, `SameSite=Lax`, 배포한 서버에서는 `Secure`입니다. 브라우저는 쿠키 하나에 4KB까지만 담으므로, 세션이 그보다 커지면 로그인이 실패합니다. 토큰이 길면 세션에 담는 사용자 정보를 줄입니다.
- 보호된 라우트와 역할(`src/shared/auth/access-rules.ts`): `PROTECTED_ROUTES`에 경로와 역할을 적습니다. 규칙은 그 경로와 아래 경로를 보호하고, `/teams/[teamId]/settings`처럼 대괄호로 감싼 단계는 라우트의 동적 세그먼트처럼 아무 값 하나와 맞습니다. 위에 적은 규칙부터 보므로 더 구체적인 경로를 위에 둡니다. 로그인하지 않았으면 돌아올 주소를 담아 `/login?next=...`로 보내고, 역할이 맞지 않으면 주소는 그대로 둔 채 `/forbidden`을 403으로 보여 줍니다. 샘플은 로그인한 사용자의 `/account`와 `admin` 역할의 `/admin`입니다. 역할은 세션의 사용자 정보를 보고, 사용자 정보는 로그인하거나 refresh할 때마다 백엔드(`getMe`)에서 다시 받습니다. 돌아올 주소는 이 앱 안의 경로만 받습니다.
- 서버 컴포넌트에서 인증이 필요한 API를 부르려면 데이터를 가져오기 전에 `getServerSession()`이나 `requireServerSession()`(`src/shared/auth/server-session.ts`)을 먼저 부릅니다. 그 렌더링의 `apiFetch` 요청에만 accessToken이 붙습니다. 모든 서버 요청이 쿠키를 읽으면 SSG·ISR 페이지까지 요청마다 렌더링되기 때문입니다. 서버 컴포넌트는 쿠키를 고칠 수 없어 refresh하지 않고, 대신 proxy가 페이지를 렌더링하기 전에 refresh해 둡니다. 예: `src/app/account/page.tsx`.
- Route Handler나 Server Action은 렌더링이 아니라서 토큰이 저절로 붙지 않습니다. `sessionOf(await cookies())`(`session.ts`)로 읽은 세션의 accessToken을 생성된 fetch 함수의 옵션으로 넘깁니다(``{ headers: { authorization: `Bearer ${session.accessToken}` } }``).
- 응답에 토큰이 담기는 `login`, `refreshTokens`는 BFF(`src/shared/auth/auth-backend.ts`)만 부릅니다. BFF 프록시는 백엔드의 응답을 그대로 돌려주므로, 브라우저가 `/api/proxy/*`로 이 둘을 부르면(브라우저에서 생성된 `login`을 부르는 등) 백엔드로 보내지 않고 무엇을 쓰면 되는지 알리는 403으로 답합니다. 경로의 대소문자, 끝의 슬래시, 퍼센트 인코딩이 달라도 막습니다(`src/shared/auth/token-operations.ts`). 로그인은 `/api/session`으로 합니다(`src/shared/auth/auth-client.ts`). 백엔드에 토큰을 발급하는 operation을 더하면 `token-operations.ts`의 목록에 더합니다.
- refresh(`src/shared/auth/refresh-session.ts`): 동시에 여러 요청이 401을 받아도 같은 refreshToken의 refresh는 백엔드에 한 번만 보내고 결과를 나눠 씁니다. 백엔드가 쓴 refreshToken을 다시 받지 않는(rotation) 경우에도 로그아웃되지 않도록, 끝난 refresh의 결과도 10초 동안 남겨 이전 쿠키로 늦게 온 요청에 줍니다. 묶는 범위는 서버 프로세스 하나라서, 서버를 여러 대 띄우면 백엔드가 같은 refreshToken을 잠시 다시 받아 주게 하거나(reuse interval) 같은 사용자의 요청을 한 서버로 보냅니다.
- 머리글의 사용자 메뉴(`src/features/user-menu`)는 로그인했으면 이름과 로그아웃 버튼을, 아니면 로그인 링크를 보여 줍니다. 로그인 여부는 브라우저가 `/api/session`에 물어봅니다. 루트 레이아웃이 쿠키를 읽으면 모든 페이지가 요청마다 렌더링되기 때문입니다. 로그인 폼은 `src/features/login-form`, 로그인 페이지는 `src/app/login/page.tsx`입니다.
- 다른 사이트에서 보낸 POST·DELETE 요청에는 세션 쿠키가 실리지 않으므로(`SameSite=Lax`) 다른 사이트가 BFF 프록시와 로그아웃을 대신 보낼 수 없습니다. 쿠키가 필요 없는 로그인(`POST /api/session`)은 JSON 본문만 받아, 다른 사이트의 HTML 폼(JSON을 보낼 수 없음)이나 fetch(CORS 사전 요청에서 막힘)가 공격자의 계정으로 로그인시키지 못하게 합니다. 상태를 바꾸는 API를 GET으로 만들지 않습니다. 같은 사이트(하위 도메인)의 다른 앱은 막지 못하므로 그런 앱과 도메인을 나눠 쓰면 따로 막습니다.
- 검색 엔진: 로그인, 내 정보, 관리자, 접근 권한 없음 페이지는 metadata의 `robots: { index: false }`로 검색 결과에서 뺍니다. 새 보호된 라우트의 페이지에도 적습니다. sitemap을 만드는 Recipe(`seo` 등)와 함께 넣으면 `PROTECTED_ROUTES`의 경로와 로그인·접근 권한 없음 페이지를 sitemap에서 뺍니다(`access-rules.ts`의 `authSitemapRules`, 확장 지점 sitemap 규칙). robots.txt(`Disallow`)로는 막지 않습니다. 보호된 라우트는 로그인하지 않은 요청을 로그인 페이지로 보내고 모두 `noindex`이므로, robots.txt에 적으면 누구나 읽는 파일에 보호된 주소를 알려 줄 뿐입니다. 로그인 페이지도 막지 않아야 검색 엔진이 `noindex`를 읽습니다.
- 로그아웃하면 백엔드에 로그아웃을 중계하고 세션 쿠키를 지웁니다. accessToken이 만료되어 백엔드가 받지 않으면 refresh한 뒤 다시 중계해 refreshToken까지 끝냅니다.

### 환경 변수

| 환경 변수        | 읽는 곳                                       | 값                                                                                                                                                                                                         |
| ---------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SESSION_SECRET` | 서버(`src/shared/auth/session.ts`, 실행할 때) | 세션 쿠키를 암호화하는 32자 이상의 비밀 값(예: `openssl rand -base64 32`의 출력). 배포하는 서버에는 꼭 넣고, 서버가 여러 대면 같은 값을 넣습니다. 없으면 서버가 뜰 때 오류를 내고 요청을 처리하지 않습니다 |

개발 서버는 `.env.development`의 값을, E2E 대상 서버는 `playwright.config.ts`의 값을 씁니다. 둘 다 배포 환경에 쓰지 않습니다. 값을 바꾸면 로그인한 사용자가 모두 로그아웃됩니다.

### 목 백엔드와 실제 백엔드

- 샘플 명세(`openapi.yaml`)에 `auth` tag의 `login`, `refreshTokens`, `getMe`, `logout`이 있습니다. 서버(BFF)만 이 operation을 부릅니다(`src/shared/auth/auth-backend.ts`).
- MSW를 켜면(`API_MOCKING=enabled`) 발급한 토큰을 기억하는 목 백엔드(`src/shared/auth/auth-mock-handlers.ts`)가 받습니다. 계정은 `user@example.com`(사용자)과 `admin@example.com`(관리자), 비밀번호는 모두 `password`입니다. accessToken은 10초 뒤에 만료되어 refresh가 일어나는 것을 볼 수 있고, refreshToken은 한 번만 쓸 수 있습니다.
- 로그인해야 쓰는 API의 목 핸들러를 더하면 실제 백엔드처럼 accessToken을 확인합니다. `mockUserOf(request)`(`auth-mock-handlers.ts`)가 요청의 accessToken이 가리키는 사용자(역할 포함)를 돌려주므로, 없으면 401, 역할이 맞지 않으면 403으로 답합니다.
- Vitest의 브라우저 코드는 BFF 프록시 없이 목 백엔드를 바로 부르므로 accessToken이 붙지 않습니다(로그인하지 않은 요청). 로그인한 사용자의 요청을 시험하려면 `signInAsMockUser(email)`(`src/shared/auth/mock-session.ts`)을 `beforeEach(() => signInAsMockUser('user@example.com'))`나 `onTestFinished(signInAsMockUser('admin@example.com'))`처럼 부릅니다. BFF 프록시 대신 그 계정의 accessToken을 목 백엔드로 가는 요청에 붙이고, 돌려준 함수로 되돌립니다.
- 실제 백엔드로 바꿀 때는 백엔드의 명세로 `openapi.yaml`의 auth operation을 바꾸고 `npm run api:gen`을 실행한 뒤, 경로나 응답 모양이 다르면 `src/shared/auth/auth-backend.ts`를 맞춥니다. 백엔드가 accessToken의 수명(`expiresIn`)을 주지 않으면 proxy가 미리 refresh하지 못하므로 `createSession`(`session.ts`)에서 정합니다.

### 테스트

`src/shared/auth/session.test.ts`(쿠키 암호화, 비밀 값 확인), `auth-backend-fetch.test.ts`(BFF 프록시의 토큰 첨부, 401이면 refresh 후 다시 보냄, 동시에 여러 요청이 401을 받아도 refresh는 한 번, 토큰을 발급하는 operation은 전달하지 않음), `auth-proxy.test.ts`(보호된 라우트, 역할, 미리 refresh), `access-rules.test.ts`(규칙의 경로와 동적 세그먼트, 로그인한 뒤 돌아갈 주소는 이 앱 안의 경로만, sitemap 규칙), `refresh-session.test.ts`(따로 번들된 proxy와 BFF 프록시도 refresh는 한 번), `session-routes.test.ts`(로그인·로그아웃 중계와 쿠키), `mock-session.test.ts`(테스트에서 목 계정으로 로그인한 요청), `src/features/login-form/login-form.test.tsx`, 로그인 폼과 사용자 메뉴의 스토리, `e2e/auth.spec.ts`(로그인, 보호된 라우트, 역할, 토큰 만료 후 자동 refresh, 로그아웃, 브라우저가 BFF 프록시로 토큰을 받지 못함, 접근성).

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

## 컨테이너 이미지(Docker)

`docker` Recipe로 넣었습니다. `Dockerfile`이 `standalone` 출력(`next.config.ts`의 `output: 'standalone'`)으로 Next.js 서버만 담은 이미지를 만듭니다. 배포 대상(Kubernetes, 사내 컨테이너 플랫폼 등)이 정해지면 이 이미지를 레지스트리에 올려 띄웁니다.

```sh
docker build -t my-app .                                              # 배포용 이미지(목을 끈 빌드)
docker run -p 3000:3000 -e API_BASE_URL=https://<백엔드 주소> my-app  # 실행할 때 백엔드 주소를 넣는다
curl http://localhost:3000/api/health                                 # {"status":"ok"}
```

- 단계: `deps`(`package.json`과 `package-lock.json`으로 `npm ci`. 두 파일이 그대로면 캐시를 씀) → `build`(배포용 빌드) → `runtime`(실행). 실행 이미지에는 빌드 도구와 소스 없이 `.next/standalone`, `.next/static`, `public`만 들어갑니다.
- 실행 사용자: node 이미지에 있는 `node`(uid 1000)입니다. Kubernetes의 `runAsNonRoot`가 root가 아닌지 확인할 수 있도록 `USER 1000:1000`처럼 숫자로 적었습니다. 서버가 ISR 페이지와 캐시를 `.next` 아래에 다시 쓰므로 앱 파일은 이 사용자가 소유합니다.
- Node: `ARG NODE_IMAGE`가 `.nvmrc`와 같은 메이저 버전의 이미지를 정확한 버전으로 고정합니다. `.nvmrc`를 바꾸면 함께 바꿉니다. 사내 레지스트리의 사본을 쓰려면 `--build-arg NODE_IMAGE=<레지스트리>/node:<버전>`으로 바꿉니다.
- 상태 확인: `GET /api/health`(`src/app/api/health/route.ts`)가 `{"status":"ok"}`를 캐시하지 않고 돌려줍니다. 이미지의 `HEALTHCHECK`가 30초마다 부르고, Kubernetes의 liveness·readiness probe에도 같은 주소를 씁니다. 백엔드를 부르지 않으므로 백엔드가 잠시 응답하지 않아도 컨테이너를 다시 시작하지 않습니다. `API_BASE_URL`이 빠진 서버는 모든 요청에 500으로 응답하므로 상태 확인도 실패합니다.
- 여러 컨테이너: ISR이 다시 렌더링한 페이지와 Next.js의 데이터 캐시는 컨테이너마다 따로 남습니다. 컨테이너를 여러 개 띄우면 공유 캐시(`next.config.ts`의 `cacheHandler`)를 배포 대상과 함께 정합니다.

### 빌드 인자와 환경 변수

| 이름                       | 넣는 곳                                                 | 값                                                                                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `API_BASE_URL`             | 실행(`docker run -e`), 빌드(`docker build --build-arg`) | 서버가 부르는 백엔드 주소. 실행할 때는 꼭 넣습니다. 빌드할 때는 데이터를 가져오는 SSG·ISR 페이지가 있을 때만 필요하고, 그런 페이지가 있는데 빠지면 빌드가 실패합니다.                                                                                  |
| `NEXT_PUBLIC_SITE_URL`     | 빌드(`--build-arg`)                                     | 사이트의 공개 주소(`seo` Recipe의 sitemap, robots.txt, canonical, 공유 이미지의 주소). `seo` Recipe를 넣었으면 꼭 넣고, 빠지면 빌드가 실패합니다. 페이지와 번들에 박히므로 바꾸면 이미지를 다시 만듭니다. 그 Recipe가 없으면 쓰이지 않습니다.          |
| `NEXT_PUBLIC_SENTRY_DSN`   | 빌드(`--build-arg`)                                     | 브라우저가 오류를 보낼 Sentry DSN(`sentry` Recipe). 브라우저 번들에 박히므로 바꾸면 이미지를 다시 만들고, 빠지면 브라우저의 오류는 보내지 않습니다. 서버의 DSN `SENTRY_DSN`은 실행할 때(`docker run -e`) 넣습니다. 그 Recipe가 없으면 쓰이지 않습니다. |
| `NEXT_PUBLIC_API_BASE_URL` | 빌드(`--build-arg`)                                     | 브라우저가 BFF 프록시 대신 직접 부를 백엔드 주소. 브라우저 번들에 박히므로 바꾸면 이미지를 다시 만듭니다.                                                                                                                                              |
| `API_MOCKING`              | 빌드(`--build-arg`)                                     | `disabled`(기본값)만 됩니다. 다른 값이면 빌드를 거부합니다(아래 "목 이미지").                                                                                                                                                                          |
| `NODE_IMAGE`               | 빌드(`--build-arg`)                                     | 기반 Node 이미지. 기본값은 `Dockerfile`에 고정한 버전입니다.                                                                                                                                                                                           |
| `PORT`                     | 실행(`docker run -e`)                                   | 서버의 포트(기본 `3000`). 서버는 `HOSTNAME=0.0.0.0`으로 모든 주소에서 받고, `HEALTHCHECK`가 `127.0.0.1`로 부르므로 `HOSTNAME`은 바꾸지 않습니다.                                                                                                       |

- 비밀 값은 `ARG`나 `ENV`로 이미지에 넣지 않습니다. 그 값은 이미지의 설정과 빌드 기록에 남습니다. 실행할 때 쓰는 비밀 값은 배포 환경이 컨테이너의 환경 변수로 넣고(Kubernetes Secret 등), 빌드할 때 필요한 비밀 값(사내 npm 레지스트리의 토큰 등)은 `docker build --secret id=npmrc,src=$HOME/.npmrc`로 넘깁니다. 이 파일은 `npm ci`를 실행하는 동안에만 마운트되고 이미지에는 남지 않습니다.
- `.dockerignore`가 `node_modules`, 빌드 결과, 로컬 환경 변수 파일(`.env*.local`), 프로젝트의 `.npmrc`(토큰이 있을 수 있음)를 빌드 컨텍스트에서 뺍니다. 로컬 파일을 받으면 `next build`가 그 값을 읽어 브라우저 번들(`NEXT_PUBLIC_*`)과 미리 렌더링한 페이지에 담을 수 있고, 빌드 단계의 층(빌드 캐시)에도 남기 때문입니다. standalone 출력은 커밋하는 `.env.production`을 이미지에 함께 복사하므로 그 파일에도 비밀 값을 적지 않습니다.

### 목 이미지

배포용 이미지는 목을 끈 빌드로만 만들고(위 "배포용 빌드와 목 빌드"), `--build-arg API_MOCKING=enabled`는 거부합니다. 백엔드 없이 컨테이너를 띄워 보려면 로컬에서 목 이미지를 따로 만듭니다.

```sh
docker build --target mock -t my-app:mock .
docker run -p 3000:3000 my-app:mock  # 빌드와 서버의 API 요청을 MSW가 받는다
```

목 이미지는 미리 렌더링한 페이지에 목 응답이 담기고 서버도 MSW로 응답하므로 레지스트리에 올리거나 배포하지 않습니다. 이미지의 `org.opencontainers.image.description` 라벨에도 목 이미지라고 적혀 있습니다.

### GitLab CI에서 이미지 만들기

`.gitlab-ci.yml`에는 이미지를 만드는 잡을 넣지 않았습니다. 이미지를 만들려면 privileged 러너(Docker-in-Docker)나 Buildah 같은 도구가 필요하고, 이미지를 올릴 레지스트리와 배포 방식은 아직 정하지 않았기 때문입니다. 정해지면 다음과 같은 잡을 더합니다. GitLab Container Registry에 올리는 예이고, 러너 설정은 GitLab 문서의 "Use Docker to build Docker images"를 따릅니다. Buildah로 만들 때는 `--format docker`를 붙입니다. 기본 형식(OCI)은 `HEALTHCHECK`를 담지 않습니다. `API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`(`seo` Recipe), `NEXT_PUBLIC_SENTRY_DSN`(`sentry` Recipe)은 CI/CD 변수로 넣습니다.

```yaml
docker:
  stage: build
  image: docker:29-cli
  services:
    - docker:29-dind
  variables:
    DOCKER_TLS_CERTDIR: /certs
  # 이 잡은 npm을 쓰지 않으므로 default의 npm 캐시를 끈다. default의 npm ci는 아래 before_script가 대신한다.
  cache: []
  before_script:
    - echo "$CI_REGISTRY_PASSWORD" | docker login --username "$CI_REGISTRY_USER" --password-stdin "$CI_REGISTRY"
  script:
    - docker build --build-arg API_BASE_URL="$API_BASE_URL" --build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" --build-arg NEXT_PUBLIC_SENTRY_DSN="$NEXT_PUBLIC_SENTRY_DSN" --tag "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA" .
    - docker push "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### 테스트

- `e2e/health.spec.ts`: 빌드한 앱에서 상태 확인 주소가 캐시하지 않는 200 응답을 돌려준다.
- 이미지 자체(빌드, root가 아닌 사용자, `HEALTHCHECK`, 정적 파일과 `public`, 목을 켠 빌드의 거부, 목 이미지)는 Docker가 필요해 이 프로젝트의 스크립트로는 검사하지 않습니다. Generator를 배포하기 전에 Generator의 하네스가 같은 `Dockerfile`로 검사했습니다. `Dockerfile`을 고친 뒤에는 위의 `docker build`와 `docker run`으로 이미지를 만들어 띄우고 `/api/health`와 페이지가 응답하는지 확인합니다.

## 파일 업로드

`file-upload` Recipe로 넣었습니다. `/upload` 페이지에서 파일을 고르거나 끌어 놓아 올리고, 파일마다 진행률을 보여 주며, 올리는 중에 취소하고, 실패하거나 취소한 업로드를 다시 시도합니다. 받지 않는 크기·형식의 파일은 보내기 전에 이유를 알립니다.

| 위치                          | 내용                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/shared/upload/`          | 진행률을 알려 주는 요청(`api-upload.ts`의 `apiUpload`), 업로드 operation이 받는 크기·형식(`upload-policy.ts`) |
| `src/queries/files/`          | `files` Query Domain(`uploadFile`의 뮤테이션 훅 `useUploadFileMutation`)                                      |
| `src/features/file-uploader/` | 업로더 화면(`file-uploader.tsx`)과 파일마다의 업로드 상태(`use-uploads.ts`)                                   |
| `src/app/upload/`             | `/upload` 라우트                                                                                              |
| `src/shared/mocks/files.ts`   | 업로드를 흉내 내는 MSW 핸들러                                                                                 |

- 명세: `openapi.yaml`의 `uploadFile`(`POST /files`, tag `files`)이 `multipart/form-data`의 `file` 필드로 파일 하나를 받아 `UploadedFile`(`id`, `name`, `size`, `contentType`)을 돌려줍니다. 5MB보다 크면 413, PNG·JPEG·PDF·텍스트가 아니면 415로 거절하고, 이유는 `UploadError`(`message`)에 담깁니다. 받는 형식은 `encoding.file.contentType`에, 크기 제한은 OpenAPI에 정해진 표기가 없어 `file` 필드의 확장 필드 `x-max-bytes`에 적었습니다. 재생성 계층이 이 기준을 만들지 않으므로 `src/shared/upload/upload-policy.ts`에 같은 값을 두고, 업로더와 목 백엔드가 함께 씁니다. 백엔드의 기준이 바뀌면 명세와 이 파일을 함께 고칩니다. 둘이 다르면 `upload-policy.test.ts`가 실패합니다.
- 진행률: 생성된 fetch 함수(`uploadFile`)는 fetch로 보내는데, fetch는 보낸 본문의 양을 알려 주지 않습니다(요청 본문 스트림은 Chromium의 HTTP/2에서만 됩니다). 그래서 `useUploadFileMutation`은 `npm run g -- mutation uploadFile`이 만든 훅에서 요청만 `apiUpload`로 바꿨습니다. `apiUpload`는 같은 요청(operation의 경로, `file` 필드를 담은 `FormData`, 응답 스키마)을 XMLHttpRequest로 보내고 `upload`의 `progress` 이벤트로 보낸 바이트 수를 알립니다. 보내는 곳과 결과는 `apiFetch`와 같습니다. 브라우저의 `apiFetch`처럼 `server`는 BFF 프록시(`/api/proxy`)를, `static-export`는 `NEXT_PUBLIC_API_BASE_URL`의 백엔드를 부르고, 2xx가 아니면 `ApiError`로 실패하며, 응답은 명세의 Zod 스키마로 검증합니다. 다른 파일 업로드 operation에도 `apiUpload(get<Operation>Url(), { body, schema, onProgress, signal })`로 씁니다. `onProgress`를 넘길 때만 `upload` 이벤트를 듣습니다(아래의 CORS preflight).
- 목 준비: 브라우저의 MSW(`static-export`의 서비스 워커)를 켠 빌드에서는 `apiUpload`가 Base의 `waitForMocks()`(`src/shared/mocks/mock-readiness.ts`)로 서비스 워커가 준비될 때까지 기다린 뒤 보냅니다. fetch와 달리 XMLHttpRequest는 준비되는 동안 붙잡아 둘 수 없어, 페이지를 열자마자 올리면 MSW를 거치지 않고 나가기 때문입니다. 목을 끈 빌드와 `server`에서는 기다리지 않습니다.
- 취소: 뮤테이션에 `signal`을 넘기고, 업로더가 항목마다 `AbortController`로 취소합니다. 취소한 업로드는 `AbortError`로 실패하고, 업로더는 이를 실패 대신 취소로 보여 줍니다. 업로더가 화면에서 사라지면 올리던 업로드를 모두 취소합니다. 뮤테이션은 `networkMode: 'always'`라서 브라우저가 오프라인이라고 알려도 멈춰 기다리지 않고 보냅니다. 기본값(`online`)이면 보내기 전에 멈춰 취소도, 실패 뒤의 다시 시도도 할 수 없습니다.
- 업로더: 파일 선택 버튼(Tab·Enter·Space)으로 파일 고르기 창을 열고, 놓는 곳에 파일을 끌어 놓아도 됩니다. 끌어 놓기는 마우스로만 할 수 있으므로 같은 일을 하는 버튼을 안에 둡니다. 여러 파일을 한꺼번에 더하면 파일마다 따로 올립니다. 진행률은 진행 막대(`role="progressbar"`, 이름 "<파일 이름> 업로드 진행률", 값 `aria-valuenow`·`aria-valuetext`)로 보여 주고, 항목마다 상태 문구(올리는 중, 올림, 실패와 그 이유, 취소, 거절)를 둡니다. 업로드가 끝나거나 거절되면 업로더의 알림 영역(`role="status"`, 화면에는 보이지 않음)이 "<파일 이름>: <상태 문구>"를 읽어 줍니다. 알림 영역은 내용이 바뀌어야 읽히므로 항목과 함께 생기지 않도록 처음부터 둡니다. 진행률 숫자는 바뀔 때마다 읽으면 다른 내용을 들을 수 없으므로 알리지 않고, 진행 막대의 값으로 언제든 읽을 수 있습니다. 취소 버튼과 다시 시도 버튼은 같은 자리의 같은 버튼이라 누른 뒤에도 포커스가 남고(더블 클릭의 두 번째 클릭은 무시합니다), 항목을 지우면 파일 선택 버튼으로 포커스를 옮깁니다.
- BFF 프록시(`server`): Base의 프록시는 multipart를 포함한 모든 본문을 바이트 그대로 백엔드에 넘깁니다(경계가 담긴 `content-type`도 그대로). 다만 본문을 다 받은 뒤 넘기므로 파일 크기만큼 서버 메모리를 쓰고, 진행률은 브라우저가 프록시에 보낸 양입니다. 지금 기준(5MB)에서는 문제없지만 훨씬 큰 파일을 받게 되면 프록시를 거치지 않고 백엔드나 저장소로 바로 올리는 방식(미리 서명한 URL 등)을 검토합니다.
- 다른 출처의 백엔드(`static-export`): 진행률을 받으려고 `upload` 이벤트를 들으면 브라우저가 업로드 전에 CORS preflight(`OPTIONS /files`)를 보냅니다. 백엔드는 preflight에 답하고(`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods: POST`), 업로드 응답에도 `Access-Control-Allow-Origin`을 붙여야 합니다. 목 백엔드도 그렇게 답합니다. 개발 서버와 E2E에서 브라우저의 MSW(서비스 워커)는 Base가 fetch만 준비될 때까지 붙잡아 두므로(`src/shared/mocks/browser-instrumentation.ts`), 페이지를 연 직후 서비스 워커가 준비되기 전에 올린 업로드는 MSW를 거치지 않고 실패할 수 있습니다. 다시 시도하면 됩니다. E2E는 fetch 하나로 준비를 기다린 뒤 올립니다.
- MSW: `src/shared/mocks/files.ts`의 핸들러가 올린 파일의 이름·크기·형식을 담아 답하고, 명세처럼 413·415로 거절합니다. `src/shared/mocks/handlers.ts`(확장 지점 MSW 핸들러의 조립 파일)가 생성된 핸들러보다 앞에 둡니다. 실패와 취소를 직접 해 보려면 파일 이름을 바꿉니다. 이름에 `slow`가 들면 3초 뒤에 답하고(그동안 취소해 봅니다), `flaky`가 들면 그 이름으로 처음 올릴 때 503으로 실패합니다(다시 시도하면 받습니다). 실제 백엔드로 바꾸면 이 파일과 `handlers.ts`의 `filesHandlers`를 지웁니다.
- Rendering Mode: 페이지 뼈대는 빌드할 때 미리 만들고 업로드는 브라우저가 보내므로 `server`와 `static-export`에서 같은 코드로 동작합니다. `apiUpload`는 브라우저에서만 씁니다. 서버 코드에서 올려야 하면 생성된 fetch 함수를 씁니다.
- 테스트: `src/shared/upload/api-upload.test.ts`(`apiFetch`와 같은 주소, multipart 본문, 진행률, `onProgress`가 없으면 preflight 없음, `ApiError`, 응답 스키마 검증, 취소), `src/shared/upload/upload-policy.test.ts`(기준이 명세와 같음), `src/features/file-uploader/file-uploader.test.tsx`(고르기·끌어 놓기, 진행 막대와 상태 문구, 알림 영역, 크기·형식 검사, 취소 후 다시 시도와 포커스, 더블 클릭, 오프라인, 거절 후 다시 시도, 여러 파일, 키보드로 고르기 창 열기), `file-uploader.stories.tsx`(axe 검사, 키보드 포커스, 거절한 항목. `dark-mode`가 있으면 다크 모드 브라우저에서도 실행), `e2e/file-upload.spec.ts`(빌드한 앱에서 진행률, 끌어 놓기, 크기·형식 검사와 알림, 취소와 다시 시도, 실패와 다시 시도, 운영체제가 라이트·다크 모드일 때의 axe 검사). E2E의 진행률 검사는 Chromium의 네트워크 흉내로 업로드를 늦추고, `static-export`의 E2E처럼 브라우저의 MSW(서비스 워커)가 요청을 받으면 본문이 네트워크를 지나지 않아 중간값 없이 끝나므로 중간값은 `server`에서만 봅니다.
- 샘플을 지우려면 `src/app/upload/`, `src/features/file-uploader/`, `src/queries/files/`, `src/shared/mocks/files.ts`(와 `handlers.ts`의 `filesHandlers`), `e2e/file-upload.spec.ts`와 샘플 operation의 기준·테스트(`src/shared/upload/upload-policy.ts`, `upload-policy.test.ts`, `api-upload.test.ts`)를 지우고 `openapi.yaml`에서 `files` tag·경로·스키마(`FileUpload`, `UploadedFile`, `UploadError`)를 뺀 뒤 `npm run api:gen`을 실행합니다. 다른 업로드에 쓸 `src/shared/upload/api-upload.ts`는 남겨 두고, 새 operation으로 테스트를 다시 씁니다.

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
- 검색 엔진: 번역한 페이지는 metadata에 `alternates: localeAlternates('<locale을 뺀 주소>')`(`src/shared/i18n/locale-alternates.ts`)를 적어 자기 주소를 canonical로, 같은 페이지의 locale별 주소를 hreflang(`<link rel="alternate" hreflang>`)으로, 기본 locale의 주소를 지원하지 않는 언어의 사용자에게 보일 주소(`hreflang="x-default"`)로 알립니다. 새 번역 페이지에도 적습니다. 공유 카드의 언어(og:locale)는 `[locale]` 레이아웃이 locale마다(`ko_KR`, `en_US`, `OPEN_GRAPH_LOCALES`) 알립니다. 위 레이아웃이 정한 OpenGraph(예: `seo` Recipe의 og:url, 공유 이미지)는 그대로 두고 locale만 바꿉니다(`localeOpenGraph`). 주소는 사이트 주소(metadataBase, 예: `seo` Recipe)가 있으면 절대 주소가 됩니다. next-intl proxy가 응답 헤더로 보내는 hreflang 링크는 locale이 없는 주소도 가리키므로 끕니다(`routing.ts`의 `alternateLinks: false`).
- sitemap: sitemap을 만드는 Recipe(`seo` 등)와 함께 넣으면 `[locale]` 아래 페이지가 locale마다 sitemap에 들어가 서로를 언어별 주소로 알리고, locale을 골라 보내는 홈(`/`)은 빠집니다(`routing.ts`의 `i18nSitemapRules`, 확장 지점 sitemap 규칙).
- 날짜·시각은 `Asia/Seoul` 시간대로 보여 줍니다(`src/shared/i18n/messages.ts`의 `TIME_ZONE`). locale을 더하려면 `routing.ts`의 `locales`와 `LOCALE_NAMES`, 카탈로그(`<locale>.json`)와 `messages.ts`의 `MESSAGES`에 더합니다.
- 다른 Recipe가 더한 화면(예: 머리글의 테마 전환)은 번역하지 않았습니다.
- 테스트: `src/shared/i18n/messages.test.tsx`(locale마다 같은 키, 없는 키의 타입 오류), `request.test.ts`(서버 컴포넌트가 locale을 넘기지 않으면 실패), `locale-alternates.test.ts`(번역한 페이지의 locale별 주소와 x-default, og:locale), `i18n-proxy.test.ts`(홈에서 locale 고르기, 고른 locale 저장, 번역하지 않은 페이지), `src/features/i18n-example/cart-counter.test.tsx`(locale별 복수형), `src/features/locale-switcher/locale-switcher.stories.tsx`(locale 전환), `e2e/i18n.spec.ts`(locale이 붙은 주소, 빌드할 때 번역한 HTML, canonical과 hreflang, locale 전환, 번역하지 않은 페이지, 홈에서 locale 고르기, 접근성).

## 무한 스크롤과 페이지네이션

`infinite-list` Recipe로 넣었습니다. 긴 목록을 나눠 불러오는 두 가지 패턴을 같은 게시글로 보여 줍니다. `/articles`는 목록 끝까지 스크롤하면 다음 페이지를 불러와 이어 붙이는 무한 스크롤 목록이고, `/articles/pagination`은 쪽 번호로 넘겨 보는 번호형 페이지네이션입니다.

| 위치                           | 내용                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `src/shared/paging/`           | 어느 목록에나 쓰는 무한 스크롤 목록(`infinite-list.tsx`)과 번호형 페이지네이션(`pagination.tsx`)         |
| `src/features/article-list/`   | 게시글 목록 두 가지(`article-infinite-list.tsx`, `article-paged-list.tsx`)와 게시글 항목, 보기 방식 링크 |
| `src/queries/articles/`        | `articles` Query Domain(`listArticles`의 infiniteQueryOptions·queryOptions, `countArticles`)             |
| `src/shared/mocks/articles.ts` | 게시글 46개를 페이지 번호대로 나눠 돌려주는 MSW 핸들러                                                   |
| `src/app/articles/`            | `/articles`, `/articles/pagination` 라우트                                                               |

- 명세: `openapi.yaml`의 `listArticles`(`GET /articles`, tag `articles`)는 `page`(1부터)와 `pageSize`(기본 10)를 받아 게시글 한 페이지를 배열로 돌려주고, 마지막 페이지 뒤의 페이지는 빈 배열입니다. `countArticles`(`GET /articles/count`)는 전체 게시글 수(`total`)를 돌려줍니다.
- Query Domain: `src/queries/articles/`는 `npm run g -- query listArticles --infinite`, `npm run g -- query listArticles`, `npm run g -- query countArticles`가 만든 코드 그대로입니다. infiniteQueryOptions는 첫 페이지(`page=1`)부터 페이지 번호를 하나씩 늘려 가져오고, 빈 페이지를 받으면 다음 페이지가 없다고 봅니다(`getNextPageParam`). 그래서 마지막 페이지 뒤의 빈 페이지를 한 번 더 요청합니다. 백엔드가 다음 페이지가 있는지(`hasNext`)나 다음 커서를 함께 주면 `getNextPageParam`을 그 값으로 고칩니다. 무한 스크롤의 쿼리 키(`['articles', 'listArticles', 'infinite', { pageSize }]`)는 쪽마다 가져오는 쿼리 키(`['articles', 'listArticles', { page, pageSize }]`)와 달라 캐시가 섞이지 않습니다.
- 무한 스크롤 목록(`InfiniteList`): 목록 끝 바로 아래의 빈 요소를 `IntersectionObserver`로 지켜보다가 화면 아래 200px 안에 들어오면 `fetchNextPage`를 부릅니다. 불러오는 동안과 실패한 뒤에는 지켜보지 않으므로 같은 페이지를 두 번 요청하지 않고, 실패한 페이지를 계속 다시 요청하지도 않습니다. 목록이 화면보다 짧으면 화면이 찰 때까지 이어서 불러옵니다.
- 키보드와 스크린 리더: 목록 끝에 더 보기 버튼이 있어 스크롤하지 않아도 다음 페이지를 불러옵니다. 버튼으로 불러오면 새로 불러온 첫 게시글로 포커스를 옮겨 이어서 읽게 하고, 버튼에 포커스가 있는 동안에는 스크롤로 불러오지 않습니다. 불러온 개수, 불러오는 중, 모두 불러옴은 목록 끝의 상태 문구(`role="status"`)로, 첫 페이지나 다음 페이지를 받지 못하면 `role="alert"`로 알리고 같은 자리의 버튼이 다시 시도 버튼이 됩니다(받아 둔 페이지를 창에 돌아왔을 때 다시 가져오다 실패한 것은 목록을 그대로 둡니다). 번호형 페이지네이션은 지금 쪽을 `aria-current="page"`로 알리고, 쪽 번호 버튼은 "3 쪽"으로 읽힙니다.
- 번호형 페이지네이션(`Pagination`): 첫 쪽, 마지막 쪽, 지금 쪽과 앞뒤 쪽을 보여 주고 나머지는 줄임표로 줄입니다. 쪽 수는 `countArticles`로 정하고, 쪽을 바꾸면 다음 쪽을 받는 동안 지금 쪽을 그대로 보여 줍니다(`keepPreviousData`). 쪽은 컴포넌트 상태로 들고 있으므로, 주소(`?page=3`)로 공유하거나 뒤로 가기로 돌아오게 하려면 `useSearchParams`로 읽고 쪽 버튼을 `next/link`로 바꿉니다.
- 다른 목록에 쓰려면: `src/features/article-list/`의 두 컴포넌트를 복사해, 쓰는 queryOptions와 항목 컴포넌트(`ArticleSummary`)를 바꿉니다. `InfiniteList`와 `Pagination`은 그대로 씁니다. 백엔드가 배열 대신 `{ items, total }` 같은 객체를 돌려주면 infiniteQueryOptions의 `getNextPageParam`과 `pages.flat()`을 그 모양에 맞게 고칩니다.
- Rendering Mode: 두 Rendering Mode 모두 페이지 뼈대만 미리 만들고 게시글은 브라우저가 가져옵니다(`server`는 BFF 프록시, `static-export`는 백엔드 주소로 직접). 서버에서 첫 페이지를 미리 가져오려면(`server`만) Base의 `src/app/products/page.tsx`처럼 페이지에서 `getQueryClient().infiniteQuery(listArticlesInfiniteQueryOptions({ pageSize: 10 }))`로 가져와 `HydrationBoundary`로 넘깁니다. Feature가 같은 infiniteQueryOptions를 쓰므로 브라우저는 둘째 페이지부터 요청합니다.
- MSW: 생성된 핸들러는 명세의 `example`을 그대로 돌려주므로, `src/shared/mocks/articles.ts`의 핸들러가 고정된 규칙으로 만든 게시글 46개(한 페이지 10개씩 다섯 페이지, 마지막 페이지는 6개)를 페이지 번호대로 나눠 돌려줍니다. Starter를 만들 때 Generator가 `src/shared/mocks/handlers.ts`에서 생성된 핸들러보다 앞에 두었습니다. 실제 백엔드로 바꾸면 이 파일과 `handlers.ts`의 `articlesHandlers`를 지웁니다.
- 테스트: `src/features/article-list/article-infinite-list.test.tsx`(스크롤로 다음 페이지, 빈 페이지에서 멈춤, 더 보기 버튼과 포커스, 버튼에 포커스가 있을 때 멈춤, 첫 페이지·다음 페이지 실패와 다시 시도, 받아 둔 페이지를 다시 가져오다 실패해도 목록 유지, 빈 목록), `article-paged-list.test.tsx`(쪽 수, 쪽 번호·이전·다음과 요청 파라미터, 한 쪽이 실패해도 다른 쪽으로 이동, 게시글 수 실패와 다시 시도), `src/shared/paging/pagination.test.tsx`(줄임표로 줄이는 쪽 번호), `infinite-list.stories.tsx`·`pagination.stories.tsx`(실제 브라우저의 IntersectionObserver, 키보드, 상태마다 axe 검사. `dark-mode`가 있으면 다크 모드 브라우저에서도 실행), `e2e/infinite-list.spec.ts`(빌드한 앱에서 스크롤로 마지막 페이지까지, 키보드로 더 보기, 브라우저의 fetch를 감싸 둘째 페이지를 실패시킨 뒤 다시 시도, 번호형 페이지네이션, 운영체제가 라이트·다크 모드일 때의 axe 검사).
- 샘플을 지우려면 `src/app/articles/`, `src/features/article-list/`, `src/queries/articles/`, `src/shared/mocks/articles.ts`(와 `src/shared/mocks/handlers.ts`의 `articlesHandlers`), `e2e/infinite-list.spec.ts`를 지우고 `openapi.yaml`에서 `articles` tag·경로·스키마(`Article`, `ArticleCount`)를 뺀 뒤 `npm run api:gen`을 실행합니다. 다른 목록에 쓸 `src/shared/paging/`은 남겨 둡니다.

## 다단계 폼

`multi-step-form` Recipe로 넣었습니다. `/partners/apply` 페이지가 입점 신청서를 사업자 정보 → 담당자 정보 → 판매 계획 → 신청 내용 확인의 네 단계로 나눠 입력받고, 확인 단계에서 모든 입력을 한 번에 보냅니다. 가입, 주문서처럼 긴 입력을 나눠 받는 화면의 틀로 씁니다.

| 위치                                | 내용                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/shared/multi-step-form/`       | 다른 다단계 폼에도 쓰는 부품: 단계 상태(`use-form-steps.ts`), 단계 폼(`step-form.tsx`), 단계 표시, 저장소 |
| `src/features/partner-application/` | 샘플 입점 신청서. 단계(`partner-application-steps.tsx`), 확인 단계, 단계를 잇는 폼                        |
| `src/queries/partners/`             | `partners` Query Domain(`npm run g -- mutation submitPartnerApplication`이 만든 코드 그대로)              |
| `src/app/partners/apply/`           | `/partners/apply` 라우트                                                                                  |

- 명세: `openapi.yaml`의 `submitPartnerApplication`(`POST /partner-applications`, tag `partners`)이 세 단계의 입력을 요청 본문(`PartnerApplication`) 하나로 받습니다. MSW 목은 명세의 `example`(접수 번호 `PA-0001`)을 돌려줍니다.
- 단계마다 검증: 단계마다 재생성 계층의 요청 본문 스키마(`SubmitPartnerApplicationBody`)에서 그 단계의 필드만 고른 스키마(`.pick({ ... })`)로 검증합니다. 그래서 검증 규칙은 명세에서만 오고, 아직 입력하지 않은 다음 단계의 필드는 오류로 알리지 않습니다. 단계마다 `StepForm`이 React Hook Form 폼을 하나씩 만들고, 입력 요소와 오류 표시는 `npm run g -- form`이 만드는 폼을 따릅니다(Base의 "폼"). 다만 판매 분야의 선택지는 enum 값 대신 화면에 보일 이름(`CATEGORY_LABELS`)으로 보입니다. 약관 동의는 명세에 `const: true`로 적어 체크하지 않으면 `formResolver`가 다른 폼처럼 `MUST_CHECK_MESSAGE`("반드시 체크해야 합니다.")로 알립니다. 단계 폼은 앞뒤 단계에서 입력한 값을 `useSchemaForm`의 처음 값으로 넘깁니다.
- 값 유지: "다음"은 그 단계의 검증을 통과한 뒤, "이전"은 검증하지 않고 지금 입력한 그대로를 모든 단계의 값(`useFormSteps`의 `draft`)에 담습니다. 단계를 오가도 입력한 값이 남습니다. 확인 단계의 "수정"은 그 단계로 돌아가고, "다음"으로 뒤 단계를 차례로 지나(값은 남아 있습니다) 다시 확인 단계로 옵니다.
- 한 번에 제출: 확인 단계의 "신청하기"가 모든 단계의 값을 요청 본문 스키마 전체로 한 번 더 검증한 뒤 `useSubmitPartnerApplicationMutation`으로 한 번 보냅니다. 성공하든 실패하든 알림(토스트)으로 알리고, 성공하면 처음 단계로 돌아가 비웁니다. 실패하면 확인 단계에 값을 그대로 둬 다시 신청할 수 있습니다. 보내는 동안에는 "이전", "수정", "신청하기"를 끕니다(돌아가 고친 값은 보낸 요청에 담기지 않으므로). 성공한 뒤의 동작(완료 페이지로 이동 등)은 화면에 맞게 고칩니다.
- 새로 고침: 단계와 입력한 값을 `sessionStorage`(`partner-application-draft`)에 둬, 페이지를 새로 고치면 이어서 입력합니다. 탭을 닫거나 신청에 성공하면 지워지고, 다른 탭과는 나누지 않습니다. 저장한 값은 그린 뒤에 읽으므로 서버가 보낸 첫 단계가 잠깐 보였다가 이어 갑니다. 저장한 값은 지금 명세의 규칙에 맞지 않을 수 있으므로(다른 버전의 앱이 저장 등) 신청할 때 맞지 않는 값이 있는 첫 단계로 돌아가 오류를 알립니다. 비밀번호, 카드 번호 같은 비밀 값을 받는 폼에서는 그 값을 저장하지 않도록 `useFormSteps`의 `save`, `next`, `back`에 넘기기 전에 빼거나 저장을 끕니다.
- 접근성: 단계 표시(`StepIndicator`)는 지금 단계를 `aria-current="step"`으로, 끝낸 단계를 "(완료)"로 알립니다. 단계를 옮기면 포커스가 그 단계의 제목("담당자 정보 (4단계 중 2단계)")으로 가서 스크린 리더가 지금 단계를 읽고, 검증에 실패하면 첫 오류 필드로 갑니다. 처음 열 때와 새로 고쳐 이어 갈 때는 포커스를 옮기지 않습니다. 브라우저의 뒤로 가기는 단계가 아니라 이전 페이지로 갑니다.
- Rendering Mode: 페이지 뼈대(첫 단계)는 빌드할 때 미리 만들고, 단계와 값은 브라우저가 들고 있다가 신청할 때만 요청합니다(`server`는 BFF 프록시, `static-export`는 백엔드 주소로 직접). 그래서 두 Rendering Mode에서 같은 코드로 동작합니다.
- 다른 다단계 폼 만들기: 명세에 요청 본문이 있는 operation을 더하고 `npm run api:gen`, `npm run g -- mutation <operationId>`를 실행한 뒤, `src/features/partner-application/`을 복사해 `partner-application-steps.tsx`의 단계(제목, `.pick`으로 고른 스키마, 입력 요소, 확인 단계에 보일 값)와 폼의 요청 본문 스키마, 뮤테이션 훅, 저장소 키를 바꿉니다. 단계를 더하거나 순서를 바꿀 때도 단계 목록(`PARTNER_APPLICATION_STEPS`)만 고칩니다.
- 테스트: `src/features/partner-application/partner-application-form.test.tsx`(단계마다 그 단계만 검증, 첫 오류 필드와 단계 제목으로 포커스, 이전·다음과 수정 뒤에도 값 유지, 한 번에 보내는 요청 본문, 실패, 보내는 동안 끈 버튼, 새로 고침과 맞지 않는 저장 값), `src/shared/multi-step-form/draft-storage.test.ts`(저장소를 읽고 쓰지 못할 때와 모양이 다른 값), `partner-application-form.stories.tsx`(첫 단계, 검증 오류, 확인 단계의 axe 검사. `dark-mode`가 있으면 다크 모드 브라우저에서도 실행), `e2e/multi-step-form.spec.ts`(빌드한 앱에서 끝까지 신청, 검증 오류와 키보드 입력, 이전·다음과 새로 고침, 운영체제가 라이트·다크 모드일 때의 axe 검사).
- 샘플을 지우려면 `src/app/partners/`, `src/features/partner-application/`, `src/queries/partners/`, `e2e/multi-step-form.spec.ts`와 `openapi.yaml`의 `partners` tag·경로·스키마(`PartnerApplication`, `PartnerCategory`, `PartnerApplicationReceipt`)를 지우고 `npm run api:gen`을 실행합니다. 새 다단계 폼에 쓸 `src/shared/multi-step-form/`은 남겨 둡니다.

## 낙관적 업데이트

`optimistic-update` Recipe로 넣었습니다. `/todos` 페이지의 할 일 목록에서 완료 여부를 바꾸면 서버의 응답을 기다리지 않고 바로 보여 주고(낙관적 업데이트), 서버가 거절하면 이전 상태로 되돌린 뒤 알림(Toast)으로 무엇을 왜 되돌렸는지 알립니다.

- 명세: `openapi.yaml`의 `listTodos`(`GET /todos`)가 할 일 목록을, `updateTodo`(`PATCH /todos/{todoId}`, 본문 `TodoUpdate`의 `done`)가 할 일 하나의 완료 여부를 바꿉니다(tag `todos`). 거절할 때는 이유를 `TodoError`(`message`)로 알립니다.
- Query Domain: `src/queries/todos/`는 `npm run g -- query listTodos`와 `npm run g -- mutation updateTodo --optimistic listTodos`가 만든 코드에, 응답 전에 보일 값을 만드는 `applyUpdateTodo`만 채운 것입니다. `useUpdateTodoMutation`은 `onMutate`에서 진행 중인 목록 요청을 취소하고 지금 값을 남긴 뒤 `applyUpdateTodo`로 목록 쿼리의 캐시를 고치고, `onError`에서 남긴 값으로 되돌리고, `onSettled`에서 `todosKeys.all`을 무효화해 서버의 값으로 맞춥니다. 다른 뮤테이션에 쓰려면 같은 명령으로 뼈대를 만들고 `apply<OperationId>`를 채웁니다.
- 화면: `src/features/todo-list/todo-list.tsx`. 할 일마다 뮤테이션 훅을 따로 써서, 저장하는 동안 그 할 일에 "저장 중"을 붙입니다(`aria-busy`). 실패하면 `mutate`의 `onError`에서 `useToast()`로 알립니다. 캐시를 되돌리는 일은 Query Domain이, 알리는 일은 화면이 맡습니다. 뮤테이션은 목록을 다시 가져온 뒤에 끝나므로 "저장 중"과 알림도 그때 바뀝니다. 끝낸 개수는 상태 문구(`role="status"`)로 알립니다.
- Rendering Mode: 두 Rendering Mode 모두 페이지 뼈대만 미리 만들고, 할 일은 브라우저가 가져와 고칩니다(`server`는 BFF 프록시, `static-export`는 백엔드 주소로 직접).
- MSW: `src/shared/mocks/todos.ts`의 핸들러가 바뀐 완료 여부를 기억해 돌려줍니다(처음 값은 명세의 `example`). 저장에는 1초 뒤에 답하고, 보안 점검 할 일(4번)은 바꿀 권한이 없다며 늘 403으로 거절합니다. 그래서 개발 서버에서도 응답 전에 바뀌는 모습과 되돌리기를 눈으로 볼 수 있고, E2E가 테스트만을 위한 코드 없이 실패를 재현합니다. Starter를 만들 때 Generator가 `src/shared/mocks/handlers.ts`에서 생성된 핸들러보다 앞에 두었습니다. 바뀐 값은 메모리에만 있어 `server`에서는 서버를 다시 띄울 때, `static-export`에서는 페이지를 새로 불러올 때 처음으로 돌아갑니다. 실제 백엔드로 바꾸면 이 파일과 `handlers.ts`의 `todosHandlers`를 지웁니다.
- 테스트: `src/features/todo-list/todo-list.test.tsx`(응답 전에 화면이 바뀌고 응답 뒤 서버의 값으로 맞춤, 거절하면 목록을 다시 가져오기 전에 되돌리고 알림, 이유 없는 실패, 목록을 못 불러옴), `e2e/optimistic-update.spec.ts`(빌드한 앱에서 응답 전에 바뀜, 거절된 할 일의 되돌리기와 알림, 키보드 조작, 접근성).
- 샘플을 지우려면 `src/app/todos/`, `src/features/todo-list/`, `src/queries/todos/`, `src/shared/mocks/todos.ts`(와 `src/shared/mocks/handlers.ts`의 `todosHandlers`), `e2e/optimistic-update.spec.ts`를 지우고 `openapi.yaml`에서 `listTodos`, `updateTodo`를 뺀 뒤 `npm run api:gen`을 실행합니다.

## 실시간 이벤트

`realtime` Recipe로 넣었습니다. 백엔드가 Server-Sent Events(SSE, `text/event-stream`)로 보내는 이벤트를 받아 TanStack Query의 캐시를 고치는 패턴입니다. `/realtime` 페이지가 샘플 배송 현황을 보여 주고, 배송이 바뀌거나 접수될 때마다 목록을 다시 요청하지 않고 표가 바뀝니다.

| 위치                                                | 내용                                                                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/shared/realtime/event-stream.ts`               | 이벤트 스트림 클라이언트(`connectEventStream`). 연결, 이벤트 읽기, 끊기면 기다렸다가 다시 연결                       |
| `src/shared/realtime/use-event-stream.ts`           | 컴포넌트가 화면에 있는 동안 연결하고 연결 상태를 돌려주는 훅                                                         |
| `src/shared/realtime/connection-status.tsx`         | 연결 상태 표시(`role="status"`)                                                                                      |
| `src/queries/deliveries/`                           | `deliveries` Query Domain. 쿼리 키와 queryOptions(`listDeliveries`), 이벤트를 캐시에 반영하는 `deliveries.events.ts` |
| `src/features/delivery-board/`                      | 배송 현황 표와 연결 상태                                                                                             |
| `src/app/realtime/`                                 | `/realtime` 라우트                                                                                                   |
| `src/shared/mocks/deliveries.ts`, `event-stream.ts` | 배송 목록과 이벤트 스트림을 흉내 내는 목 백엔드                                                                      |

### 왜 WebSocket이 아니라 SSE인가

캐시를 고치는 이벤트는 백엔드에서 브라우저로만 흐르고, 브라우저가 바꾸는 것은 지금처럼 REST 요청과 뮤테이션 훅으로 보냅니다. 그래서 양방향인 WebSocket이 필요하지 않고, SSE는 보통의 HTTP 응답이라 다음이 그대로 됩니다.

- Rendering Mode `server`에서 브라우저는 다른 API 요청처럼 BFF 프록시(`/api/proxy/deliveries/events`)를 거쳐 연결하고, 프록시가 백엔드의 스트림을 그대로 흘려보냅니다. 프록시가 토큰을 붙이면(ADR-0006, `auth` Recipe) 이 연결에도 붙으므로 토큰이 브라우저에 나오지 않습니다. Next.js의 Route Handler는 WebSocket 연결을 넘겨주지 못해, WebSocket이면 브라우저가 백엔드에 직접 연결하고 인증도 따로 풀어야 합니다.
- `static-export`에서는 다른 API 요청처럼 `NEXT_PUBLIC_API_BASE_URL`의 백엔드에 직접 연결합니다. 백엔드는 CORS로 이 앱의 출처와 `Last-Event-ID` 요청 헤더를 허용해야 합니다.
- MSW가 보통의 HTTP 핸들러로 흉내 냅니다. Vitest, Next.js 서버(`server`의 BFF 프록시가 부르는 요청), 브라우저의 서비스 워커(`static-export`)가 같은 핸들러를 씁니다.

WebSocket이 꼭 필요하면 `event-stream.ts`를 WebSocket으로 바꾸되 `connectEventStream`의 모양(`onEvent`, `onOpen`, 연결 상태)을 지키면 Query Domain과 화면은 고치지 않아도 됩니다.

### 이벤트가 캐시를 고치는 방식

`useDeliveryEvents()`(`src/queries/deliveries/deliveries.events.ts`)가 이벤트 스트림에 연결하고, 받은 이벤트로 캐시를 고칩니다. 이벤트를 받는 컴포넌트는 쿼리를 그리기만 합니다.

- 이벤트(`delivery.created`, `delivery.updated`)는 바뀐 배송 전체를 담고 오므로 `setQueryData`로 캐시의 목록에서 그 배송만 바꾸거나 맨 앞에 더합니다. 목록을 다시 요청하지 않습니다. 캐시에 있는 것보다 오래된(`updatedAt`이 이른) 이벤트는 반영하지 않습니다.
- 이벤트의 데이터는 명세의 Zod 스키마(`Delivery`)로 검증합니다. 명세와 다르면 캐시를 고칠 수 없으므로 Query Domain(`deliveriesKeys.all`, ADR-0008)을 무효화해 다시 가져옵니다. 모르는 이름의 이벤트는 무시합니다.
- 연결될 때마다(처음 연결 포함) Query Domain을 다시 가져옵니다. 끊긴 동안이나, 처음 연결되기 전에 보낸 목록 요청 뒤에 일어난 변경은 이벤트로 받지 못하기 때문입니다. 가져오는 중이던 요청은 연결되기 전에 보낸 것이라 그 응답을 기다리지 않고 다시 보냅니다.
- 목록을 가져오는 중에 이벤트가 오면, 그 응답은 이벤트보다 먼저 만들어졌을 수 있어 도착하면 방금 고친 캐시를 덮어씁니다. 그래서 그 요청이 끝난 뒤 한 번 더 가져옵니다. 그 사이 이벤트가 몇 번 오든 한 번만 가져오고, 가져오던 요청을 취소하지 않으므로 이벤트가 몰려도 목록을 끝내 받지 못하는 일은 없습니다(덮어쓴 응답이 잠깐 보일 수는 있습니다).

다른 Query Domain에 쓰려면 `deliveries.events.ts`를 복사해 이벤트 이름, 데이터 스키마, 고칠 쿼리 키를 바꿉니다. 이벤트가 바뀐 것 전체를 담지 않고 "무엇이 바뀌었다"만 알리면 `setQueryData` 대신 그 쿼리 키를 무효화합니다.

### 연결과 다시 연결

- `connectEventStream`은 브라우저의 `EventSource` 대신 `fetch`로 스트림을 읽습니다. `EventSource`는 2xx가 아닌 응답을 받으면 다시 연결하지 않고, 다시 연결하는 간격을 정할 수 없기 때문입니다.
- 백엔드가 스트림을 닫거나 연결하지 못하면(2xx가 아닌 응답, `text/event-stream`이 아닌 응답, 네트워크 오류) 기다렸다가 다시 연결합니다. 기다리는 시간은 연달아 실패할 때마다 두 배로 늘고(1초, 2초, 4초, … 최대 30초) 그 절반부터 전부까지에서 무작위로 고릅니다. 백엔드가 다시 뜰 때 브라우저들이 한꺼번에 몰리지 않게 하려는 것입니다. 이벤트를 받았거나 30초 넘게 이어진 연결이 끊기면 처음 대기 시간부터 다시 세고, 연결되자마자 이벤트 없이 끊긴 연결은 실패로 셉니다. 연결을 받자마자 닫는 백엔드나 프록시에 빠르게 다시 연결하며 그때마다 목록을 다시 가져오지 않게 하려는 것입니다. 기다리는 시간을 바꾸려면 `connectEventStream`에 `retryDelay`를 넘깁니다(`useEventStream`이 부르는 곳).
- 다시 연결할 때 마지막으로 받은 이벤트 id를 `Last-Event-ID` 헤더로 보냅니다. 백엔드가 그 뒤의 이벤트를 이어서 보낼 수 있으면 씁니다. 이어서 보내지 않아도 위처럼 다시 가져와 맞춥니다.
- 연결 상태(`실시간 연결 중`, `실시간 연결됨`, `연결이 끊겨 다시 연결하는 중`)는 `ConnectionStatus`가 글자와 점으로 보여 주고, 상태 문구(`role="status"`)라 스크린 리더가 바뀐 상태를 알립니다.

### 백엔드에 바라는 것

- `GET /deliveries/events`처럼 `Accept: text/event-stream` 요청에 `Content-Type: text/event-stream`으로 답하고, 이벤트마다 `event`, `data`(JSON), `id`를 보냅니다(`openapi.yaml`의 `streamDeliveryEvents`).
- 연결하자마자 주석 한 줄(`:`로 시작하는 줄)을 보냅니다. BFF 프록시(Next.js)는 본문의 첫 바이트가 올 때 응답 헤더를 브라우저로 보내므로, 이 줄이 없으면 첫 이벤트가 올 때까지 브라우저가 연결되었는지 알 수 없습니다. 연결을 오래 두는 프록시나 로드 밸런서가 끊지 않도록 주기적으로(예: 15초마다) 주석을 보내고, 앞단의 프록시(nginx 등)가 응답을 모아 두지 않게 합니다(nginx는 `X-Accel-Buffering: no`).

### MSW와 실제 백엔드

- 생성된 MSW 핸들러는 명세의 `example`을 돌려줄 뿐이므로, `src/shared/mocks/deliveries.ts`의 목 백엔드가 `src/shared/mocks/handlers.ts`(확장 지점 MSW 핸들러의 조립 파일)에서 생성된 핸들러보다 앞에 들어가 이벤트로 바뀐 목록을 돌려줍니다. 개발 서버와 E2E에서는 새로 연 화면마다(`Last-Event-ID` 없이 연결하면) 처음 목록으로 되돌리고, 그 화면이 연결한 뒤 목록을 받은 때부터 1.5초 뒤 D-1002가 배송 중으로 바뀌고, 2.5초 뒤 D-1004가 접수되고, 3.5초 뒤 D-1001이 배송 완료로 바뀌지만 그 이벤트를 보내기 전에 연결이 끊깁니다(다시 연결한 뒤 목록을 다시 가져와야 보입니다). `server`에서는 Next.js 서버의 목 백엔드 하나를 모든 화면이 함께 쓰므로, 화면을 새로 열면 이미 열린 화면도 새 순서의 이벤트를 받습니다.
- MSW의 `sse()`는 핸들러를 만들 때 전역 `EventSource`가 있어야 해서 Node.js(Vitest, Next.js 서버)에서는 쓸 수 없습니다. 그래서 응답 본문을 흘려보내는 보통의 HTTP 핸들러로 흉내 냅니다(`src/shared/mocks/event-stream.ts`). 테스트에서 이벤트를 직접 보내려면 `createMockDeliveryBackend()`로 새 목 백엔드를 만들어 `server.use(...backend.handlers)`로 쓰고 `publish`, `changeSilently`, `disconnect`를 부릅니다.
- 브라우저의 MSW(`static-export`의 서비스 워커)를 켠 빌드에서는 `connectEventStream`이 Base의 `waitForMocks()`(`src/shared/mocks/mock-readiness.ts`)로 서비스 워커가 준비될 때까지 기다린 뒤 연결합니다. 페이지를 열자마자 연결해도 MSW를 거치지 않고 나가지 않습니다. 목을 끈 빌드와 `server`에서는 기다리지 않습니다.
- 실제 백엔드로 바꾸면 `src/shared/mocks/deliveries.ts`와 `handlers.ts`의 `deliveriesHandlers`를 지웁니다.

### 테스트와 샘플 지우기

- 테스트: `src/shared/realtime/event-stream.test.ts`(이벤트 형식 읽기, 다시 연결과 `Last-Event-ID`, 실패할 때마다 늘어나는 대기 시간, 연결 끊기), `src/features/delivery-board/delivery-board.test.tsx`(이벤트가 목록을 다시 요청하지 않고 캐시를 고침, 오래된 이벤트와 명세와 다른 이벤트, 다시 연결한 뒤 놓친 변경 맞추기, 가져오는 중에 온 이벤트), `connection-status.stories.tsx`(axe 검사), `e2e/realtime.spec.ts`(빌드한 앱에서 실시간 반영, 끊긴 뒤 다시 연결해 맞추기, 운영체제가 라이트·다크 모드일 때의 axe 검사).
- 샘플을 지우려면 `src/app/realtime/`, `src/features/delivery-board/`, `src/queries/deliveries/`, `src/shared/mocks/deliveries.ts`(와 `handlers.ts`의 `deliveriesHandlers`), `e2e/realtime.spec.ts`를 지우고 `openapi.yaml`에서 `deliveries` tag·경로·스키마(`Delivery`, `DeliveryStatus`)를 뺀 뒤 `npm run api:gen`을 실행합니다. 다른 이벤트 스트림에 쓸 `src/shared/realtime/`과 `src/shared/mocks/event-stream.ts`는 남겨 둡니다.

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

## 오류 보고(Sentry)

`sentry` Recipe로 넣었습니다. [Sentry](https://sentry.io)의 Next.js SDK(`@sentry/nextjs`)로 브라우저와 서버에서 난 오류를 Sentry에 보냅니다. **DSN이 없거나 개발 서버·테스트·목 빌드에서는 SDK를 초기화하지 않으므로 아무것도 보내지 않습니다.**

| 위치                                                 | 내용                                                                                                                                                      |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/sentry/sentry-instrumentation-client.ts` | 브라우저의 SDK 초기화(`NEXT_PUBLIC_SENTRY_DSN`). 처리하지 못한 오류와 Promise 거부를 보냅니다                                                             |
| `src/shared/sentry/sentry-instrumentation.ts`        | 서버(nodejs, edge 런타임)의 SDK 초기화(`SENTRY_DSN`)와, 서버가 요청을 처리하다 난 오류를 보내는 `onRequestError`                                          |
| `src/shared/sentry/sentry-options.ts`                | 초기화 조건(`NODE_ENV`가 `production`이고 목 빌드가 아니며 DSN이 있을 때)과 두 SDK가 함께 쓰는 설정                                                       |
| `src/shared/sentry/sentry-next-config.ts`            | `next.config.ts`의 설정을 감싸는 `withSentryConfig`(소스맵 업로드 등 빌드 설정)와 목 빌드 표시(`SENTRY_MOCK_BUILD`). 다른 래퍼보다 바깥에 씌워져 있습니다 |

세 조각은 `src/instrumentation-client.ts`, `src/instrumentation.ts`, `next.config.plugins.ts`에 들어가 있습니다(위 "앱 조립 파일").

- 켜기: 배포 환경에 DSN을 넣습니다(`.env.example`). 서버의 `SENTRY_DSN`은 서버를 띄울 때 읽고, 브라우저의 `NEXT_PUBLIC_SENTRY_DSN`은 빌드할 때 코드에 박히므로 배포용 빌드를 만드는 환경에 넣습니다. 보통 두 값은 같은 DSN입니다. `static-export`에는 서버가 없어 `NEXT_PUBLIC_SENTRY_DSN`만 씁니다. 컨테이너 이미지(`docker` Recipe)는 `docker build --build-arg NEXT_PUBLIC_SENTRY_DSN=<DSN>`으로 만들고 `docker run -e SENTRY_DSN=<DSN>`으로 띄웁니다. DSN은 브라우저에 드러나도 되는 값이지만 아래의 인증 토큰은 비밀 값입니다.
- 개발과 테스트: SDK는 `NODE_ENV`가 `production`일 때만 초기화하므로 개발 서버(`npm run dev`)와 단위 테스트는 DSN을 넣어도 보내지 않습니다. 목 빌드(`API_MOCKING=enabled`로 실행한 `next build`. E2E와 GitLab CI의 `build` 잡)도 배포하지 않는 빌드라 빌드하는 환경에 DSN이 있어도 초기화하지 않습니다. `sentry-next-config.ts`가 빌드할 때 목 빌드인지를 코드에 박아 두기 때문입니다(`SENTRY_MOCK_BUILD`). 실제로 보내지는지 확인하려면 목을 끈 배포용 빌드를 DSN과 함께 만들고 `npm start`로 띄워 오류를 냅니다.
- 소스맵: 빌드하는 환경에 Sentry 인증 토큰(`SENTRY_AUTH_TOKEN`)과 `SENTRY_ORG`, `SENTRY_PROJECT`가 있을 때만 브라우저 소스맵을 만들어 Sentry에 올리고, 올린 뒤에는 빌드 결과에서 지웁니다. 토큰이 없으면 소스맵을 만들지도 올리지도 않으므로 개발과 CI의 빌드는 토큰 없이 통과하고 Sentry에 접속하지 않습니다. 토큰은 GitLab CI/CD 변수(masked)로 배포용 빌드를 만드는 잡에만 넣습니다. 빌드 도구가 Sentry에 사용 통계를 보내는 기능(`telemetry`)은 꺼 두었습니다.
- 개인정보: `sendDefaultPii: false`(Sentry의 기본값)라 IP 주소, 쿠키, 요청 헤더 같은 정보는 이벤트에 담지 않습니다. 성능 추적(`tracesSampleRate`)과 Session Replay는 켜지 않았습니다. 켜려면 `sentry-options.ts`의 `SENTRY_OPTIONS`에 더합니다(Replay의 `Sentry.replayIntegration()`은 브라우저 쪽 `sentry-instrumentation-client.ts`에만). 페이지 이동은 `onRouterTransitionStart`가 이미 SDK에 알리므로 성능 추적을 켜면 함께 남습니다.
- 광고 차단기: 브라우저가 Sentry에 바로 보내는 요청은 광고 차단기에 막힐 수 있습니다. `server` Starter라면 `sentry-next-config.ts`의 `withSentryConfig` 옵션에 `tunnelRoute`를 더해 Next.js 서버를 거쳐 보낼 수 있습니다(기본은 꺼 두었습니다). proxy(`src/proxy.ts`)가 있으면 그 경로가 proxy 처리기에 막히지 않도록 proxy의 matcher가 빼는 `/api` 아래 경로(예: `/api/monitoring`)를 씁니다. `static-export`에는 서버가 없어 쓸 수 없습니다.
- 오류 경계: 오류 경계가 잡지 않은 오류는 SDK가 그대로 받습니다. 라우트에 `error.tsx`(예: `npm run g -- page`가 만든 오류 상태)나 `global-error.tsx`가 있으면, Next.js는 그 경계가 잡은 브라우저의 렌더링 오류를 콘솔에만 남깁니다. 서버 컴포넌트의 오류는 서버의 `onRequestError`가 보내지만, 브라우저에서 렌더링하다 난 오류도 보내려면 그 경계에서 `useEffect(() => { Sentry.captureException(error) }, [error])`를 부릅니다.
- 테스트: `src/shared/sentry/sentry.test.ts`(개발·테스트 환경, 목 빌드이거나 DSN이 없으면 브라우저와 서버의 조각이 SDK를 초기화하지 않음), `sentry-instrumentation.test.ts`(DSN이 있으면 서버가 요청을 처리하다 난 오류를 그 DSN으로 보냄. 요청은 MSW가 받아 밖으로 나가지 않음), `e2e/sentry.spec.ts`(DSN 없이 빌드한 앱은 브라우저에서 오류가 나도 앱 밖으로 요청을 보내지 않음).
- 빼려면 `src/shared/sentry/`, `e2e/sentry.spec.ts`, `process-env.sentry.d.ts`, `.env.example`의 Sentry 변수, `package.json`의 `@sentry/nextjs`를 지우고 세 조립 파일에서 Sentry의 조각을 지웁니다.

## 검색 노출(SEO)

`seo` Recipe로 넣었습니다. 검색 엔진과 메신저·SNS의 공유 카드에 보이는 정보(메타데이터, 공유 이미지, `/sitemap.xml`, `/robots.txt`)를 만듭니다.

| 위치                                      | 내용                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/shared/seo/site.ts`                  | 사이트 이름·설명·locale과 사이트 주소(`NEXT_PUBLIC_SITE_URL`)                                        |
| `src/shared/seo/metadata.ts`              | 모든 페이지가 물려받는 메타데이터의 기본값(`siteMetadata`). 루트 레이아웃(`src/app/layout.tsx`)이 씀 |
| `src/shared/seo/og-image.tsx`             | 공유 이미지를 그리는 `ogImage`와 그 글꼴(Pretendard Bold)                                            |
| `src/shared/seo/pretendard-license.txt`   | 글꼴의 저작권 표시와 SIL Open Font License 1.1 전문                                                  |
| `src/shared/seo/next-config.ts`           | 빌드 결과에 글꼴의 라이선스를 함께 담는 next.config 래퍼(`withSeo`, `next.config.plugins.ts`가 씀)   |
| `src/shared/seo/page-routes.ts`           | sitemap에 넣을 페이지를 `src/app`에서 찾는 `findPageRoutes`                                          |
| `src/app/sitemap.ts`, `src/app/robots.ts` | `/sitemap.xml`, `/robots.txt`                                                                        |
| `src/app/sitemap-rules.ts`                | 다른 Recipe가 자기 페이지에 대해 알린 sitemap·robots.txt의 규칙(Generator가 조립)                    |
| `src/app/opengraph-image.tsx`             | 사이트의 기본 공유 이미지. `src/app/products/opengraph-image.tsx`는 페이지별 공유 이미지의 예        |

- **사이트 주소**: `NEXT_PUBLIC_SITE_URL`(예: `https://www.example.com`)로 sitemap, robots.txt, canonical, og:url, 공유 이미지의 절대 주소를 만듭니다. 빌드할 때 코드에 박히므로 배포용 빌드를 만드는 환경에 넣습니다(`.env.example`). 없으면 엉뚱한 주소가 검색 엔진에 알려지지 않도록 빌드가 실패합니다. 개발 서버는 `.env.development`의 `http://localhost:3000`을 쓰고, 배포하지 않는 목 빌드(`API_MOCKING=enabled`. GitLab CI의 `build` 잡과 E2E)는 값이 없으면 같은 주소를 씁니다.

  ```sh
  NEXT_PUBLIC_SITE_URL=https://www.example.com API_BASE_URL=https://<백엔드 주소> npm run build  # 배포용 빌드
  docker build --build-arg NEXT_PUBLIC_SITE_URL=https://www.example.com -t my-app .           # 컨테이너 이미지(docker Recipe)
  ```

- **페이지의 메타데이터**: 루트 레이아웃의 `siteMetadata()`가 모든 페이지의 기본값을 정하므로, 페이지는 `metadata`에 `title`과 `description`만 적습니다.

  ```ts
  export const metadata: Metadata = {
    title: '주문', // <title>주문 | Starter</title>, og:title
    description: '주문 내역과 배송 상태를 확인합니다.', // description, og:description
  }
  ```

  - 제목 뒤에 사이트 이름이 붙고(`주문 | Starter`), 제목을 적지 않은 페이지(홈)는 사이트 이름이 제목입니다. 설명을 적지 않으면 사이트 설명을 씁니다.
  - canonical과 og:url은 페이지마다 그 페이지의 주소(쿼리 문자열 제외)입니다.
  - og:title·og:description과 Twitter 카드(`summary_large_image`)의 제목·설명·이미지는 Next.js가 페이지의 `title`·`description`과 공유 이미지로 채웁니다.
  - Next.js는 레이아웃과 페이지의 metadata를 항목 단위로 덮어씁니다. 페이지가 `openGraph`, `twitter`, `alternates`를 적으면 그 항목의 기본값(og:url, 공유 이미지, canonical)이 사라지므로, 꼭 적어야 하면 `alternates: { canonical: './', ... }`처럼 `siteMetadata()`의 기본값을 함께 적습니다.
  - 검색에 노출하지 않을 페이지(로그인, 내 정보 등)는 `robots: { index: false }`를 적고 `src/app/sitemap.ts`의 `EXCLUDED_ROUTES`에도 적습니다.

- **공유 이미지(OG 이미지)**: 페이지 폴더에 `opengraph-image.tsx`를 두면 그 페이지(와 아래 페이지)의 공유 이미지가 되고, 없으면 가장 가까운 위 폴더의 이미지, 끝내 사이트의 기본 이미지(`src/app/opengraph-image.tsx`)를 씁니다. 새 페이지의 이미지는 `src/app/products/opengraph-image.tsx`를 그 페이지 폴더에 복사해 제목을 바꿉니다.
  - 빌드할 때 한 번 그려 PNG로 둡니다(`dynamic = 'force-static'`). 주소에 확장자가 붙어(`/products/opengraph-image/image.png`) static-export의 정적 파일도 서버가 `image/png`로 응답합니다(`ogImageMetadata`).
  - 모양은 `ogImage`(`src/shared/seo/og-image.tsx`)가 정합니다. next/og는 CSS 변수를 읽지 못하므로 색은 디자인 토큰 파일(`src/shared/ui/tokens.css`)의 값을 읽어 씁니다.
  - 글꼴은 함께 넣은 Pretendard Bold(한글 11,172자, SIL Open Font License 1.1. `src/shared/seo/pretendard-license.txt`)입니다. next/og는 글꼴에 없는 글자를 만나면 빌드 중에 Google Fonts에서 글꼴을 받으므로, 네트워크가 막힌 CI에서도 같은 이미지가 나오도록 글꼴을 함께 둡니다. 한자, 일본어, 이모지는 이 글꼴에 없어 받으러 가므로 공유 이미지의 글에 쓰지 않습니다. 라이선스는 글꼴을 나눠 줄 때 저작권 표시와 라이선스를 함께 담게 하므로, 글꼴 옆에 둔 라이선스 파일(`pretendard-license.txt`)을 지우지 않습니다. server Starter의 빌드 결과(`.next/standalone`, 그것으로 만든 컨테이너 이미지)에도 글꼴이 담기므로 `withSeo`가 라이선스 파일을 함께 담습니다(`outputFileTracingIncludes`). 글꼴을 바꾸면 라이선스 파일과 `next-config.ts`의 경로도 함께 바꿉니다.
- **sitemap**: 빌드할 때 `src/app`의 페이지를 찾아 `/sitemap.xml`에 넣습니다. 다른 Recipe나 `npm run g -- page`가 더한 페이지도 `sitemap.ts`를 고치지 않고 들어갑니다.
  - 경로 그룹(`(admin)`)은 주소에서 빠집니다. 동적 세그먼트가 있는 페이지(`products/[productId]`)는 빌드할 때 주소를 알 수 없어 빠지므로, `sitemap.ts`에서 데이터를 가져와 주소를 더합니다(예: `listProducts`의 상품마다 `/products/<id>`).
  - 다른 Recipe가 더한 페이지의 규칙은 `src/app/sitemap-rules.ts`의 `sitemapRules`에 있습니다(Starter를 만들 때 Generator가 Recipe의 선언을 모아 씀). 규칙이 뺀 주소(`exclude`)와 robots.txt가 막는 주소(`disallow`)는 그 아래 주소까지 sitemap에 넣지 않고, locale을 받는 세그먼트(`locales`) 아래 페이지는 locale마다 넣어 같은 페이지의 locale별 주소를 서로 알리고(`<xhtml:link rel="alternate" hreflang>`), 기본 locale(`defaultValue`)이 있으면 그 주소를 지원하지 않는 언어의 사용자에게 보일 주소(`hreflang="x-default"`)로도 알립니다. 이 프로젝트의 규칙은 `sitemap.ts`의 `EXCLUDED_ROUTES`에 적거나 이 파일을 직접 고칩니다.
  - sitemap에는 다른 주소로 보내지 않고 200으로 응답하는 페이지만 넣습니다(`e2e/seo.spec.ts`가 하나씩 받아 봅니다). 로그인 페이지로 보내는 페이지나 다른 주소로 보내는 페이지는 규칙으로 뺍니다.
  - 빌드할 때 만들어 두므로 페이지를 더하거나 지우면 다시 빌드해야 반영됩니다.
- **robots.txt**: 모든 검색 엔진에 사이트를 열고 sitemap의 주소를 알립니다. 다른 Recipe가 규칙으로 막은 주소(`sitemapRules`의 `disallow`)만 `Disallow`로 막습니다. 로그인해야 들어가는 페이지는 robots.txt에 적지 않고 sitemap에서만 뺍니다(auth Recipe). robots.txt는 누구나 읽으므로 적으면 숨길 주소를 알려 줄 뿐이고, 그런 페이지는 로그인 페이지로 보내며 `noindex`로 검색 결과에서 빠집니다. 스테이징처럼 검색에 노출하지 않을 배포라면 `src/app/robots.ts`의 `rules`를 `{ userAgent: '*', disallow: '/' }`로 바꿉니다.
- Rendering Mode `server`와 `static-export` 모두에서 sitemap.xml, robots.txt, 공유 이미지를 빌드할 때 만듭니다. static-export는 `out/sitemap.xml`, `out/robots.txt`, `out/**/opengraph-image/image.png`로 내보냅니다.
- 사이트 이름, 설명, locale은 `src/shared/seo/site.ts`에서 바꿉니다. 루트 레이아웃의 `<html lang>`과 locale을 맞춥니다.
- `/products` 샘플을 지우면(위 "샘플 명세 바꾸기") `src/app/sitemap.test.ts`와 `e2e/seo.spec.ts`에서 `/products`를 확인하는 부분도 지웁니다.
- 테스트: `src/shared/seo/site.test.ts`(사이트 주소와 없을 때의 실패), `page-routes.test.ts`(sitemap에 넣을 페이지 찾기), `metadata.test.ts`(모든 페이지의 기본값), `og-image.test.tsx`(한글 공유 이미지를 네트워크 없이 그림), `src/app/sitemap.test.ts`(이 Starter의 sitemap과 규칙), `robots.test.ts`(robots.txt), `e2e/seo.spec.ts`(빌드한 앱의 메타데이터, 공유 이미지, sitemap.xml의 페이지가 모두 200으로 응답하는지, robots.txt).

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

## 관리자 대시보드

대시보드 Archetype으로 만들었습니다. `auth`(로그인과 역할), `table`(정렬·필터가 되는 목록), `chart`(차트) Recipe를 조합한 관리자 화면이 `/dashboard` 아래에 있습니다. 머리글의 "대시보드" 링크로 들어가고, 로그인하지 않았으면 로그인한 뒤 돌아옵니다.

| 화면                             | 하는 일                                                                                                             | 들어가는 사람        | 렌더링                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------- |
| `/dashboard`                     | 사용자 현황(전체·활성·초대됨·관리자 수, 상태별 사용자 수 차트)과 chart Recipe의 서비스 지표 차트                    | 로그인한 사용자 모두 | SSR(사용자 통계를 서버가 prefetch) |
| `/dashboard/users`               | 사용자 목록. 열 머리글로 정렬하고 검색어, 역할, 상태로 거른다. 관리자에게는 추가 링크와 줄마다 수정 링크가 보인다   | 로그인한 사용자 모두 | SSR(역할 확인) + 목록은 브라우저   |
| `/dashboard/users/new`           | 사용자 추가 폼. 추가한 사용자는 초대됨 상태로 시작하고, 추가하면 목록으로 돌아가 맨 앞에서 보인다                   | 관리자               | 미리 렌더링                        |
| `/dashboard/users/[userId]/edit` | 사용자 수정 폼. 지금 값으로 채워져 있고, 부서를 비우고 저장하면 부서를 지운다. 없는 사용자면 "찾는 화면이 없습니다" | 관리자               | SSR(사용자를 서버가 prefetch)      |

- 접근 규칙: `src/shared/auth/access-rules.ts`의 `PROTECTED_ROUTES`에 대시보드의 규칙이 들어 있습니다(`/dashboard`는 로그인한 사용자, 추가·수정 화면은 `admin` 역할). `[userId]`처럼 대괄호로 감싼 단계는 아무 값 하나와 맞습니다. 역할이 맞지 않으면 proxy가 주소는 그대로 둔 채 접근 권한 없음 페이지를 403으로 보여 줍니다. 화면은 같은 규칙을 보고 링크를 보이거나 숨깁니다(`src/shared/dashboard/dashboard-routes.ts`의 `canVisit`, `canManageUsers`). 백엔드도 accessToken으로 로그인과 역할을 확인해, 로그인하지 않은 요청은 401로, 관리자가 아닌 사용자의 추가·수정은 403으로 거절합니다(명세. 목 백엔드도 같습니다). 추가·수정 폼은 401·403을 받으면 알린 뒤 `router.refresh()`로 이 화면의 접근 규칙을 서버에서 다시 확인해, 로그인 페이지(돌아올 주소와 함께)나 접근 권한 없음 페이지로 갑니다(`src/features/user-form/access-denied.ts`). 폼을 연 뒤 로그인이 끝났거나 다른 계정으로 바뀐 경우입니다.
- 명세: `openapi.yaml`의 `users` tag에 `listUsers`, `createUser`, `getUserStats`, `getUser`, `updateUser`가 있습니다. 역할(`Role`)과 인증(`bearerAuth`)은 auth Recipe의 것을 그대로 씁니다.
- Query Domain: `src/queries/users/`는 `npm run g -- query listUsers`, `query getUserStats`, `query getUser`, `mutation createUser`, `mutation updateUser`를 차례로 실행해 만든 코드 그대로입니다. 사용자를 추가하거나 고치면 users Query Domain 전체를 무효화하므로 목록과 통계를 다시 가져옵니다.
- Feature: 사용자 현황 `src/features/user-stats/`(차트는 chart Recipe의 `ChartFigure`로 감싸 데이터 표를 함께 둔다), 사용자 목록 `src/features/user-table/`(table Recipe의 회원 테이블을 복사해 열과 파라미터를 바꾼 것), 추가·수정 폼 `src/features/user-form/`(`npm run g -- form createUser|updateUser --feature user-form`이 만든 폼에서 레이블, 지금 값 채우기, 저장한 뒤 목록으로 옮겨 가기, 같은 이메일 알림을 고친 것), 대시보드 안의 이동과 머리글 링크 `src/features/dashboard-nav/`.
- 목 백엔드: `src/shared/mocks/users.ts`가 처음 사용자 12명(auth의 목 계정 `user@example.com`, `admin@example.com` 포함)으로 시작해 추가·수정한 사용자를 서버 프로세스의 메모리에 기억합니다. 요청한 사용자는 auth의 목 백엔드가 발급한 accessToken으로 확인합니다(`mockUserOf`). 확장 지점 `mockHandlers`로 생성된 핸들러보다 앞에 두고, 생성된 핸들러처럼 목 백엔드 주소(`src/shared/api/base-url.ts`의 `MOCK_API_BASE_URL`)로 가는 요청만 받습니다. 서버를 다시 띄우면 처음 상태로 돌아갑니다. 실제 백엔드로 바꾸면 이 파일과 그 테스트(`users.test.ts`), `src/shared/mocks/handlers.ts`의 `usersHandlers`를 지웁니다.
- 테스트: `src/shared/mocks/users.test.ts`(로그인하지 않으면 401, 관리자가 아닌 사용자의 추가·수정은 403, 관리자는 추가·수정), `src/features/user-stats/user-stats-overview.test.tsx`, `src/features/user-table/user-table.test.tsx`(정렬·검색·역할·상태 필터가 요청 파라미터로 이어짐, 수정 링크), `src/features/user-form/*.test.tsx`(추가하면 목록을 무효화하고 목록으로 옮겨 감, 지금 값 채우기, 부서 지우기, 같은 이메일, 401·403이면 알리고 접근 규칙을 다시 확인), `src/shared/dashboard/dashboard-routes.test.ts`(역할마다 들어가는 화면), 폼과 차트의 스토리, `e2e/dashboard.spec.ts`(로그인 → 통계 확인 → 사용자 추가 → 목록과 통계에 반영 → 수정, 관리자가 아니면 추가·수정 화면에 들어가지 못함, BFF 프록시로 바로 보낸 요청도 401·403, 폼을 연 뒤 세션이 바뀌면 접근 권한 없음·로그인 페이지, 접근성). 컴포넌트 테스트는 `signInAsMockUser`(auth Recipe의 `src/shared/auth/mock-session.ts`)로 누구로 로그인했는지 정합니다.
- 대시보드를 지우려면 `src/app/dashboard/`, `src/features/user-stats/`, `user-table/`, `user-form/`, `dashboard-nav/`, `src/queries/users/`, `src/shared/dashboard/`, `src/shared/mocks/users.ts`와 `users.test.ts`(와 `handlers.ts`의 `usersHandlers`), `e2e/dashboard.spec.ts`를 지우고, `src/app/app-shell.tsx`의 `DashboardLink`, `access-rules.ts`의 대시보드 규칙, `openapi.yaml`의 `users` tag·경로·스키마를 뺀 뒤 `npm run api:gen`을 실행합니다.
