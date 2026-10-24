---
"devc-frontend-generator": minor
---

Starter의 서버 전용 모듈은 `import 'server-only'`로, 컴포넌트가 아니면서 브라우저에서만 실행되는 모듈은 `import 'client-only'`로 시작한다. 파일 맨 위만 봐도 어디서 실행되는지 알 수 있고, 클라이언트 컴포넌트가 서버 전용 모듈(예: auth Recipe의 세션)을, 서버 컴포넌트가 브라우저 전용 모듈을 import하면 `next build`가 실패한다. 표시한 모듈은 Base의 `src/shared/api/`(`api-fetch.server.ts`, `api-instrumentation.ts`, `api-mocking.ts`, `backend-fetch.ts`, `bff-proxy.ts`)와 `src/shared/mocks/node.ts`, auth·i18n·seo·sentry Recipe의 서버 모듈, analytics·sentry Recipe와 Rendering Mode `static-export`의 브라우저 모듈이다. `'use server'`는 Server Function을 여는 지시어이므로 이 용도로 쓰지 않는다. 쓰는 법은 Starter README의 "서버와 브라우저의 경계"에 있다.

함께 바뀌는 것(0.x의 깨지는 변경):

- 서버가 백엔드를 부르는 주소 `backendBaseUrl()`이 `src/shared/api/base-url.ts`에서 서버 전용 `src/shared/api/api-fetch.server.ts`로 옮겨 간다. `base-url.ts`에는 브라우저 코드, MSW 핸들러, 테스트가 함께 쓰는 값만 남는다.
- `apiFetch`는 서버의 요청을 `package.json`의 `imports`(`#api-fetch.server`)로 불러온다. 서버 컴포넌트, Route Handler, proxy, instrumentation은 `api-fetch.server.ts`를, 서버에서 렌더링하는 클라이언트 컴포넌트는 `api-fetch.ssr.ts`를 고른다. 서버에서 렌더링하는 클라이언트 컴포넌트가 API를 부르면 이제 백엔드에 요청하지 않고, 서버 컴포넌트에서 가져와 넘기라고 알리며 실패한다. Starter의 화면은 모두 서버 컴포넌트에서 가져오므로 동작이 달라지지 않는다.
- auth Recipe의 세션 쿠키 이름 `SESSION_COOKIE`가 `session.ts`에서 `auth-client.ts`로 옮겨 간다. E2E처럼 Next.js 밖에서 실행되는 코드는 `server-only`로 시작하는 모듈을 import할 수 없기 때문이다.

이미 만든 Starter에 적용하려면:

1. `npm install server-only@0.0.1`(브라우저 전용 모듈에 표시하려면 `client-only@0.0.1`도)을 실행한다.
2. 새 Generator로 같은 Recipe를 넣은 Starter를 만들어 `package.json`의 `imports`, `src/shared/api/`의 `api-fetch.ts`·`api-fetch.server.ts`·`api-fetch.ssr.ts`·`base-url.ts`·`bff-proxy.ts`·`api-instrumentation.ts`, `vitest.config.ts`의 unit 프로젝트에 더한 `resolve.alias`를 옮긴다. 고치지 않은 파일은 그대로 덮어써도 된다.
3. 서버에서만 실행되는 모듈의 맨 위에 `import 'server-only'`를 더한다. auth Recipe를 넣었다면 `SESSION_COOKIE`를 `auth-client.ts`로 옮기고 import를 고친다.
4. `npm run typecheck`, `npm test`, `API_MOCKING=enabled npm run build`로 확인한다. 빌드가 `"server-only"`나 `"client-only"`를 알리며 실패하면, 알린 import 경로를 따라가 반대쪽 모듈을 import하는 곳을 고친다.
