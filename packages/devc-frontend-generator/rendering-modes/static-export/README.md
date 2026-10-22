## 실행과 배포

이 Starter의 Rendering Mode는 `static-export`입니다. Next.js 서버 없이 정적 파일만으로 배포하며(`next.config.ts`의 `output: 'export'`), 특정 배포 방식에 묶이지 않도록 Vercel 같은 플랫폼 전용 설정은 두지 않습니다.

- `npm run build`는 모든 페이지를 빌드할 때 렌더링해 `out/`에 HTML·CSS·JS 같은 정적 파일로만 내보냅니다. 배포할 것은 `out/` 하나이고, 정적 파일을 서빙하는 어떤 서버나 호스팅에 올려도 됩니다. 브라우저가 부를 백엔드 주소(`NEXT_PUBLIC_API_BASE_URL`)는 빌드할 때 코드에 박히므로 빌드하는 환경에 넣습니다(아래 "API 계층").
- `npm run start`는 `out/`을 정적 파일 서버(sirv)로 띄웁니다. 기본 포트는 8080이고, `npm run start -- --port 3000`처럼 바꿉니다.
- `npm run test:e2e`는 브라우저의 MSW를 켜고 목으로 다시 빌드한 `out/`을 정적 파일 서버로 띄워 검사합니다(`playwright.config.ts`). 그래서 `npm run build`를 먼저 실행하지 않아도 되고, E2E가 남긴 `out/`은 배포하지 말고 배포용 빌드로 다시 만듭니다.
- 서버 컴포넌트는 빌드할 때 한 번만 실행됩니다. 동적 라우트(`[id]` 등)는 `generateStaticParams`로 만들 경로를 모두 정해 두어야 합니다.
- 요청을 받는 서버가 있어야 하는 기능은 쓸 수 없고, 쓰면 `npm run dev`나 `npm run build`에서 오류가 납니다. 예: Request를 읽는 Route Handler, `cookies()`, Proxy(`proxy.ts`), `next.config.ts`의 rewrites·redirects·headers, ISR, 서버 액션, 기본 로더를 쓰는 이미지 최적화. 같은 이유로 BFF 프록시(`/api/proxy/*`)도 없습니다.

### 배포용 빌드와 목 빌드

SSG 페이지가 데이터를 가져오면(예: `npm run g -- page <route> --mode ssg --query <operationId>`) 서버 컴포넌트가 빌드할 때 백엔드를 부르므로, 빌드는 그 요청을 어디로 보내느냐에 따라 둘로 나뉩니다.

```sh
API_BASE_URL=https://<백엔드 주소> NEXT_PUBLIC_API_BASE_URL=https://<백엔드 주소> npm run build  # 배포용 빌드
API_MOCKING=enabled npm run build  # 목 빌드: 빌드할 때의 요청에 MSW가 응답한다. GitLab CI의 build 잡이 쓴다
```

- 배포용 빌드는 MSW를 끕니다(`.env.production`의 `API_MOCKING=disabled`, `NEXT_PUBLIC_API_MOCKING=disabled`). 빌드할 때 데이터를 가져오는 페이지가 있는데 `API_BASE_URL`이 없으면, 엉뚱한 곳을 부르지 않도록 그 페이지를 렌더링할 때 무엇을 넣어야 하는지 알리며 빌드가 실패합니다.
- 목 빌드는 실제 백엔드 없이 빌드가 깨지지 않는지 확인할 때 씁니다. Next.js는 빌드할 때 instrumentation(`src/instrumentation.ts`)을 실행하지 않으므로, 서버의 `apiFetch`가 첫 요청을 보내기 전에 MSW를 켜고(`src/shared/api/api-mocking.ts`) 빌드 출력에 경고를 남깁니다. MSW는 빌드 프로세스 안에서만 돌고, 브라우저의 MSW는 `NEXT_PUBLIC_API_MOCKING=enabled`로 빌드할 때만(E2E) `out/`에 들어갑니다.
- **목 빌드의 결과는 배포하지 않습니다.** 미리 렌더링한 페이지의 HTML에 목 응답이 담기기 때문입니다. 배포할 `out/`은 목 빌드의 `.next/`를 지운 깨끗한 상태에서 배포용 빌드로 따로 만듭니다.

## GitLab CI

`.gitlab-ci.yml`이 들어 있어 사내 GitLab에 저장소를 올리면 바로 파이프라인이 돕니다. 잡은 모두 위의 npm 스크립트를 부르므로 실패한 잡은 로컬에서 같은 명령으로 재현할 수 있습니다.

- 단계: `check`(`lint`, `format:check`, `typecheck`, `test`, `test:storybook`) → `build` → `e2e`(`test:e2e`). `build` 잡은 `API_MOCKING=enabled`로 목 빌드를 만들어 실제 백엔드 없이 빌드가 깨지지 않는지 확인하고, 결과는 배포하지 않으므로 남기지 않습니다. 빌드 캐시에 목 응답이 남지 않도록 `.next/cache/fetch-cache`도 지웁니다. `e2e` 잡은 브라우저의 MSW까지 켜고 직접 다시 빌드한 결과로 돕니다(위 "실행과 배포").
- 배포 파이프라인을 더할 때는 `API_MOCKING`을 켜지 않고 `API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`을 CI/CD 변수로 넣은 잡에서 배포용 빌드를 따로 만들고 `out/`을 올립니다(위 "배포용 빌드와 목 빌드").
- 설치는 `npm ci`로 하므로 `package-lock.json`을 함께 커밋합니다. `dcgen new`가 Starter를 만들며 설치할 때 생기고, `--skip-install`로 만들었다면 처음 `npm install`할 때 생깁니다.
- Node는 `.nvmrc`와 같은 버전의 `node` 이미지를 씁니다. `.nvmrc`를 바꾸면 `.gitlab-ci.yml`의 `image`도 함께 바꿉니다. 이미지를 쓰므로 Docker(또는 Kubernetes) executor 러너가 필요합니다.
- npm 캐시(`.npm/`)는 `package-lock.json`이 바뀔 때까지, Next.js 빌드 캐시(`.next/cache/`)는 브랜치마다 캐시합니다. Playwright 브라우저(`.cache/ms-playwright/`)는 버전별 폴더로 받으므로 하나의 캐시를 계속 씁니다.
- E2E가 실패하면 Playwright trace가 담긴 `test-results/`를 잡 아티팩트로 내려받을 수 있습니다.

## API 계층

백엔드의 OpenAPI 명세(`openapi.yaml`)가 원본입니다. 명세에서 다시 만드는 계층과 프로젝트가 직접 소유하는 계층이 나뉩니다.

| 위치                         | 내용                                                                         | 누가 고치나                                    |
| ---------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| `src/shared/api/generated/`  | 타입, fetch 함수, Zod 스키마, MSW 핸들러                                     | `npm run api:gen`(orval)만. 손으로 고치지 않음 |
| `src/shared/api/`의 나머지   | fetch 클라이언트(`api-fetch.ts`), 요청 주소(`base-url.ts`)                   | 프로젝트                                       |
| `src/queries/<Query Domain>` | 쿼리 키(`<domain>.keys.ts`), queryOptions·뮤테이션 훅(`<domain>.queries.ts`) | 프로젝트                                       |
| `src/features/<Feature>`     | 쿼리를 써서 화면을 그리는 UI                                                 | 프로젝트                                       |
| `src/app`                    | 라우트                                                                       | 프로젝트                                       |

- `npm run api:gen`은 `orval.config.ts`대로 `src/shared/api/generated`를 지우고 다시 만듭니다. 같은 명세로 다시 실행하면 결과가 바뀌지 않으므로, 생성 결과는 git에 함께 올립니다. TanStack Query 훅은 만들지 않습니다.
- 생성 결과는 `lint`와 `format:check` 대상에서 빠집니다(`eslint.config.ts`, `.prettierignore`). 타입 검사는 받습니다.
- Query Domain 이름은 OpenAPI tag를 따르고, 쿼리 키는 `['products', 'listProducts', params]`처럼 계층으로 만듭니다. `src/queries`의 코드는 `npm run g -- query <operationId>`로 만들 수 있습니다(아래 "코드 생성(Schematic)").
- 샘플: `/products` 페이지(`src/app/products/page.tsx`)는 빌드할 때 페이지 뼈대만 만들고, `src/features/product-list`가 브라우저에서 `listProductsQueryOptions()`로 상품 목록을 가져옵니다(`e2e/products.spec.ts`).

### 요청이 가는 곳

생성된 fetch 함수는 모두 `src/shared/api/api-fetch.ts`의 `apiFetch`를 거칩니다. `apiFetch`는 실행 환경에 따라 주소를 고르고, 응답을 명세의 Zod 스키마로 검증합니다. 2xx가 아닌 응답은 `ApiError`로 던집니다.

- 브라우저: BFF 프록시 없이 `NEXT_PUBLIC_API_BASE_URL`의 백엔드를 직접 부릅니다. 빌드할 때 코드에 박히므로 바꾸면 다시 빌드하고, 백엔드가 이 앱의 출처에서 오는 CORS 요청을 허용해야 합니다. 브라우저의 MSW를 끈 빌드에 `NEXT_PUBLIC_API_BASE_URL`이 없으면 요청할 때 무엇을 넣어야 하는지 알리는 오류로 실패합니다.
- 서버 컴포넌트(빌드할 때, 개발 서버): `API_BASE_URL`의 백엔드를 부릅니다. MSW를 끈(`API_MOCKING`이 `enabled`가 아님) 개발 서버에 `API_BASE_URL`이 없으면 개발 서버가 오류를 내고 요청을 처리하지 않습니다. MSW를 끈 빌드에서 데이터를 가져오는 페이지(SSG)를 렌더링할 때 `API_BASE_URL`이 없으면 빌드가 실패합니다(위 "배포용 빌드와 목 빌드").

| 환경 변수                  | 읽는 곳                                                                                   | 값                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | 브라우저(빌드할 때 박힘)                                                                  | 백엔드 주소. 배포용 빌드에는 꼭 넣습니다                                              |
| `NEXT_PUBLIC_API_MOCKING`  | 브라우저(빌드할 때 박힘, `src/shared/mocks/browser-instrumentation.ts`)                   | `enabled`이면 브라우저의 요청을 MSW가 받음. 배포용 빌드는 `.env.production`이 끔      |
| `API_BASE_URL`             | 서버 컴포넌트(빌드할 때, 개발 서버)                                                       | 백엔드 주소. 빌드할 때 서버 컴포넌트가 백엔드를 부르면 배포용 빌드에 꼭 넣습니다      |
| `API_MOCKING`              | 개발 서버(`src/shared/api/api-instrumentation.ts`), 빌드(`src/shared/api/api-mocking.ts`) | `enabled`이면 서버 컴포넌트의 요청을 MSW가 받음. 배포용 빌드는 `.env.production`이 끔 |

### 샘플 명세 바꾸기

`openapi.yaml`은 API 계층이 어떻게 이어지는지 보여 주는 가상의 샘플입니다. 실제 프로젝트에서는 다음 순서로 바꿉니다.

1. `openapi.yaml`을 백엔드의 명세로 바꿉니다. `npm run g`도 이 파일을 읽으므로, 백엔드가 명세를 URL로 내주면 내려받아 이 파일에 저장합니다.
2. 샘플 코드를 지웁니다: `src/app/products/`, `src/features/product-list/`, `src/queries/products/`, `e2e/products.spec.ts`
3. `npm run api:gen`을 실행하고 생성 결과를 커밋합니다.
4. 배포용 빌드를 만드는 환경에 `NEXT_PUBLIC_API_BASE_URL`(빌드할 때 서버 컴포넌트가 백엔드를 부르면 `API_BASE_URL`도)을 넣습니다. 실제 백엔드로 개발하려면 `.env.development.local`에 아래 "API 목킹(MSW)"의 값을 넣습니다.

## API 목킹(MSW)

MSW가 쓰는 핸들러 목록은 `src/shared/mocks/handlers.ts`이고, 명세에서 생성한 핸들러(`src/shared/api/generated/<tag>/<tag>.msw.ts`)를 모두 담습니다. 핸들러는 명세의 `example`을 돌려주고, `example`이 없으면 faker가 스키마에 맞는 값을 만듭니다. 늘 같은 값이 필요하면 명세에 `example`을 적습니다. 요청에 따라 다른 값을 돌려줘야 하면(파라미터대로 거르기, 실패 흉내 등) 직접 만든 핸들러를 이 목록의 생성된 핸들러 앞에 둡니다. 앞의 핸들러가 먼저 응답합니다.

목 백엔드는 앱과 다른 출처의 주소(`src/shared/api/base-url.ts`의 `MOCK_API_BASE_URL`, `https://mock.api.test`)에 둡니다. 브라우저의 MSW를 켜고 `NEXT_PUBLIC_API_BASE_URL`을 넣지 않으면 브라우저가 이 주소로 요청하고, 생성된 핸들러는 이 주소로 가는 요청만 받습니다(`orval.config.ts`). 서비스 워커는 페이지를 열거나 새로 고치는 요청까지 핸들러에 보이지만, 핸들러가 `/products` 같은 페이지 주소와 겹치지 않고 목록 맨 앞의 `src/shared/mocks/page-navigation.ts`가 그런 요청을 목 응답 없이 그대로 보내므로 페이지 대신 목 응답이 열리지 않습니다. 직접 만든 핸들러도 ``http.get(`${MOCK_API_BASE_URL}/<경로>`, ...)``처럼 이 주소만 받게 씁니다. 테스트 하나에서 응답을 바꾸는 `server.use`에는 `*/<경로>`를 써도 됩니다.

- Vitest: 모든 테스트에서 켜져 있고, 핸들러가 없는 요청은 테스트를 실패시킵니다. `vitest.setup.ts`가 `NEXT_PUBLIC_API_BASE_URL`에 목 백엔드 주소를 넣어 브라우저 코드(jsdom)의 요청도 MSW가 받습니다. 테스트 하나에서만 응답을 바꾸려면 `@/shared/mocks/node`의 `server.use(...)`에 생성된 핸들러(예: `getListProductsMockHandler([])`)나 직접 만든 핸들러를 넘깁니다.
- 개발 서버: `.env.development`의 `API_MOCKING=enabled`(서버 컴포넌트의 요청)와 `NEXT_PUBLIC_API_MOCKING=enabled`(브라우저의 요청)로 켭니다.
- E2E: `playwright.config.ts`가 `API_MOCKING=enabled`(빌드할 때 서버 컴포넌트의 요청)와 `NEXT_PUBLIC_API_MOCKING=enabled`(브라우저의 요청)로 다시 빌드한 정적 파일을 띄웁니다.
- 목 빌드: `API_MOCKING=enabled`로 빌드하면 빌드할 때 서버 컴포넌트가 보내는 요청을 MSW가 받습니다(GitLab CI의 `build` 잡). 결과는 배포하지 않습니다(위 "배포용 빌드와 목 빌드").
- 배포용 빌드: `.env.production`의 `NEXT_PUBLIC_API_MOCKING=disabled` 때문에 MSW 코드가 빌드 결과에 들어가지 않습니다. `API_MOCKING=disabled`이므로 빌드할 때 서버 컴포넌트가 보내는 요청도 MSW가 받지 않습니다.

브라우저의 요청은 서비스 워커(`public/mockServiceWorker.js`)가 받습니다. `src/shared/mocks/browser-instrumentation.ts`가 앱 코드보다 먼저(`src/instrumentation-client.ts`가 부릅니다) 서비스 워커를 띄우고, 준비될 때까지 fetch 요청을 붙잡아 둡니다. XMLHttpRequest, EventSource, WebSocket처럼 fetch를 쓰지 않는 요청은 붙잡을 수 없으므로, 페이지를 연 직후에 이런 요청을 보내는 코드는 `src/shared/mocks/mock-readiness.ts`의 `waitForMocks()`를 기다린 뒤 보냅니다(목을 끈 빌드에서는 바로 끝납니다). 서비스 워커 파일은 MSW CLI가 만든 것이므로 고치지 않고, MSW를 올린 뒤에는 `npx msw init`으로 다시 만듭니다(`package.json`의 `msw.workerDirectory`).

실제 백엔드로 바꾸려면 `.env.development.local`에 다음 네 줄을 적고 개발 서버를 다시 띄웁니다. `API_MOCKING`만 끄고 `API_BASE_URL`을 빠뜨리면 개발 서버가 오류를 내고 요청을 처리하지 않습니다.

```sh
API_MOCKING=disabled
API_BASE_URL=https://<백엔드 주소>
NEXT_PUBLIC_API_MOCKING=disabled
NEXT_PUBLIC_API_BASE_URL=https://<백엔드 주소>
```
