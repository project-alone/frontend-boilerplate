# 인증은 Auth.js 대신 자체 BFF 세션을 쓰고, 브라우저 요청은 BFF 프록시를 거친다

accessToken과 refreshToken은 별도 백엔드가 발급하고, 프론트엔드는 DB를 임의로 쓸 수 없다. Next.js Route Handler가 로그인·로그아웃을 백엔드에 중계하고 두 토큰을 암호화한 httpOnly 쿠키에 보관하며, refresh는 동시 요청이 와도 한 번만 실행되도록 묶는다. 브라우저의 JavaScript는 토큰을 읽을 수 없으므로 브라우저의 API 요청은 `/api/proxy/*`를 거쳐 토큰이 붙은 채 백엔드로 전달되고, 서버 컴포넌트는 백엔드를 직접 호출한다. 이 방식은 백엔드에 쿠키 기반 refresh 같은 추가 요구를 하지 않아 고객사마다 다른 백엔드에 맞추기 쉽다.

## Considered Options

- **Auth.js v5**: DB 없는 JWT 세션으로 같은 제약을 만족할 수 있지만, 2026년 10월 기준 여전히 beta이고 2025년 9월부터 Better Auth 팀이 보안 패치만 하는 유지보수 상태다. refresh 로직을 `jwt` 콜백 안에 우회해 넣어야 한다.
- **Better Auth**: 자체 DB가 필요하다.
- **accessToken은 브라우저 메모리, refreshToken은 httpOnly 쿠키**: 백엔드가 쿠키 기반 refresh를 지원해야 한다.

## Consequences

- 구현은 `auth` Recipe에 있다. 쿠키 암호화는 세션 쿠키 전용인 iron-session을 쓰고, 비밀 값(`SESSION_SECRET`)이 없는 서버는 요청을 받지 않는다.
- 서버 컴포넌트는 쿠키를 고칠 수 없으므로 refresh하지 않는다. 대신 페이지 요청은 proxy가 accessToken이 만료되기 전에 미리 refresh하고, BFF 프록시는 401을 받으면 refresh한 뒤 다시 보낸다. 서버 컴포넌트의 API 요청에는 그 렌더링이 세션을 읽었을 때만 토큰을 붙여, 로그인과 상관없는 SSG·ISR 페이지가 요청마다 렌더링되지 않게 한다.
- refresh를 한 번으로 묶는 범위는 서버 프로세스 하나다. 서버를 여러 대 띄우면 백엔드가 같은 refreshToken을 잠시 다시 받아 주거나(reuse interval) 같은 사용자의 요청을 한 서버로 보내야 한다.
- BFF 프록시와 서버의 `apiFetch`가 토큰을 붙이는 자리는 확장 지점 `backendFetch`다(ADR-0010).
- Rendering Mode `server`의 브라우저가 백엔드를 직접 부르게 하는 설정은 두지 않는다. 그런 요청은 BFF가 붙이는 토큰 없이 나가 auth Recipe와 함께 쓰면 401을 받는다(#93). 브라우저가 부를 백엔드 주소(`NEXT_PUBLIC_API_BASE_URL`)는 BFF 프록시가 없는 `static-export`만 쓴다.
- BFF 프록시는 백엔드의 응답을 그대로 돌려주므로, 응답에 토큰이 담기는 operation(login, refresh)은 BFF가 직접 부른 요청만 백엔드로 보낸다. 브라우저가 `/api/proxy/*`로 부르면 403으로 답해 토큰이 브라우저의 JavaScript에 닿지 않는다. BFF가 직접 부른 요청인지는 요청 헤더가 아니라 서버 안의 실행 문맥(AsyncLocalStorage)으로 가리므로 브라우저가 흉내 낼 수 없다. 백엔드가 토큰을 발급하는 operation을 더하면 그 목록(auth Recipe의 `token-operations.ts`)에 더한다.
