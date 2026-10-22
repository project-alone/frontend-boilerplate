---
"devc-frontend-generator": patch
---

응답 스키마에 선택 속성(`required`에 없는 속성)이 있어도 `npm run api:gen`이 만든 MSW 목이 Starter의 `typecheck`를 통과한다. 목이 선택 속성에 값 대신 `undefined`를 넣어 `exactOptionalPropertyTypes`에서 TS2322·TS2375로 실패했고, 목 함수가 돌려준 값을 그대로 쓰면 `.exactOptional()`로 만든 Zod 스키마도 거부했다. 이제 Base의 `orval.config.ts`가 orval의 `override.mock.exactOptional`을 켜, 목은 선택 속성을 응답마다 값과 함께 넣거나 키째 뺀다. 이미 만든 Starter는 `orval.config.ts`의 `override`에 `mock: { exactOptional: true }`를 더하고 `npm run api:gen`을 다시 실행하면 된다.
