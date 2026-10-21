---
"devc-frontend-generator": patch
---

개발 서버에서 코드를 고친 뒤 서버의 MSW가 요청을 받지 못하던 문제를 고친다. Next.js 개발 서버는 라우트의 서버 번들을 다시 쓸 때(새 모듈을 import하거나, 컴파일 오류를 고치거나, `.env` 파일을 고칠 때 등) `globalThis.fetch`를 MSW를 켜기 전의 것으로 되돌려, 그 뒤로 서버 컴포넌트와 BFF 프록시의 요청이 목 백엔드(`https://mock.api.test`)를 찾지 못하고 실패했다. 이제 Base의 `src/shared/api/api-mocking.ts`가 개발 서버에서 그 대입을 MSW가 씌운 `fetch`로 바꿔 넣어, 개발 서버를 다시 띄우지 않아도 MSW가 요청을 계속 받는다.
