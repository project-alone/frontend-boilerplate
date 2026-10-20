# 인증은 Auth.js 대신 자체 BFF 세션을 쓰고, 브라우저 요청은 BFF 프록시를 거친다

accessToken과 refreshToken은 별도 백엔드가 발급하고, 프론트엔드는 DB를 임의로 쓸 수 없다. Next.js Route Handler가 로그인·로그아웃을 백엔드에 중계하고 두 토큰을 암호화한 httpOnly 쿠키에 보관하며, refresh는 동시 요청이 와도 한 번만 실행되도록 묶는다. 브라우저의 JavaScript는 토큰을 읽을 수 없으므로 브라우저의 API 요청은 `/api/proxy/*`를 거쳐 토큰이 붙은 채 백엔드로 전달되고, 서버 컴포넌트는 백엔드를 직접 호출한다. 이 방식은 백엔드에 쿠키 기반 refresh 같은 추가 요구를 하지 않아 고객사마다 다른 백엔드에 맞추기 쉽다.

## Considered Options

- **Auth.js v5**: DB 없는 JWT 세션으로 같은 제약을 만족할 수 있지만, 2026년 10월 기준 여전히 beta이고 2025년 9월부터 Better Auth 팀이 보안 패치만 하는 유지보수 상태다. refresh 로직을 `jwt` 콜백 안에 우회해 넣어야 한다.
- **Better Auth**: 자체 DB가 필요하다.
- **accessToken은 브라우저 메모리, refreshToken은 httpOnly 쿠키**: 백엔드가 쿠키 기반 refresh를 지원해야 한다.
