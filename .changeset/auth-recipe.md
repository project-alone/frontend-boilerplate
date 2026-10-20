---
"devc-frontend-generator": minor
---

`auth` Recipe를 더한다(`server`만). 백엔드가 발급한 accessToken·refreshToken으로 로그인하고, 두 토큰을 iron-session으로 암호화한 httpOnly 쿠키에 보관한다. 로그인·로그아웃은 Route Handler(`/api/session`)가 백엔드에 중계하고, BFF 프록시는 쿠키의 accessToken을 붙여 401이면 refresh한 뒤 다시 보낸다(동시에 여러 요청이 401을 받아도 refresh는 한 번). proxy는 보호된 라우트와 역할을 거르고 accessToken이 만료되기 전에 미리 refresh한다. 로그인 페이지, 머리글의 사용자 메뉴, 샘플 명세의 `auth` operation과 토큰을 기억하는 목 백엔드, E2E를 함께 넣는다. 세션 쿠키를 암호화하는 `SESSION_SECRET`이 없으면 서버가 요청을 처리하지 않는다.

이를 위해 서버가 백엔드로 보내는 요청(서버의 `apiFetch`, BFF 프록시의 전달)을 감싸는 확장 지점 `backendFetch`를 더한다. Base Starter에는 처리기가 없는 조립 파일 `src/shared/api/backend-fetch.ts`가 생기고, `apiFetch`와 BFF 프록시가 이 파일을 거쳐 백엔드를 부른다.
