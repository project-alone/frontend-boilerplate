---
"devc-frontend-generator": patch
---

MSW를 켠 Starter의 서버(개발 서버, E2E 대상 서버)와 Vitest가 Node.js 24에서 `CipherJob<AESCipherTraits>::ToResult … Assertion failed: errors->Empty()`로 가끔 죽던 문제를 고친다. 서버의 MSW는 목 백엔드(`https://mock.api.test`)와의 TLS 연결을 흉내 내면서 해석할 수 없는 가짜 TLS 세션을 내보내고, Node.js의 `fetch`(undici)는 그 세션을 같은 주소로 여는 다음 연결에 넘긴다. Node.js 24는 그 세션을 오류 없이 버리면서 OpenSSL의 오류를 남겨 두고, 그사이에 끝난 WebCrypto의 AES 작업(auth Recipe의 세션 쿠키 암호화·복호화 등)이 그 오류를 자기 것으로 알아 프로세스를 끝냈다. 이제 Base의 `src/shared/mocks/node.ts`가 목 백엔드로 여는 TLS 연결에는 앞 연결의 세션을 넘기지 않는다. MSW를 켜지 않은 서버는 바뀌지 않는다.
