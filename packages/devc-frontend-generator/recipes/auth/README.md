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
