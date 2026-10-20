---
"devc-frontend-generator": minor
---

Recipe가 Base 파일을 패치하지 않고 자기 조각만 더하는 확장 지점을 더한다. Provider와 머리글(`src/app/app-shell.tsx`), proxy 처리기(`src/proxy.ts`), `next.config` 래퍼(`next.config.plugins.ts`), 서버·브라우저 instrumentation(`src/instrumentation.ts`, `src/instrumentation-client.ts`)은 Base와 Recipe의 선언으로 조립하고, Recipe의 OpenAPI 명세 조각은 Base 명세에 병합해 재생성 API 계층까지 다시 만들며, 환경 변수 파일은 변수 단위로 병합한다(같은 변수에 서로 다른 값을 적은 조합은 무엇을 만들기 전에 거부한다). Starter에는 배포할 때 넣는 환경 변수를 모은 `.env.example`이 더해지고, Base의 서버 instrumentation은 `src/shared/api/api-instrumentation.ts`로 옮겨졌다.
