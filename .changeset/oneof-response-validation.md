---
"devc-frontend-generator": patch
---

응답 스키마가 이름 있는 스키마가 아니라 그 자리에 적은 `oneOf`·`anyOf`인 operation(스키마 둘 중 하나, 그런 항목의 배열, 스키마 또는 `null` 등)이 있어도 `npm run api:gen`의 결과가 Starter의 `typecheck`를 통과하고, fetch 함수가 응답을 Zod 스키마로 검증한다. orval은 이런 응답의 타입을 `CardPayment | BankPayment`처럼 적기만 하고 이름 있는 Zod 스키마를 만들지 않아, fetch 함수가 응답을 검증하지 않은 채 요청 옵션(`ApiRequestInit<unknown>`)을 넘기다 TS2379로 실패했다. 이제 Base의 `orval.config.ts`가 orval의 `override.aliasCombinedTypes`를 켜, 이런 응답과 요청 본문의 타입과 Zod 스키마를 `<operationId><상태 코드>`(예: `GetPayment200`, 배열의 항목은 `ListPayments200Item`)와 `<operationId>Body` 이름으로 만든다. 그래서 이런 operation의 fetch 함수는 반환 타입과 요청 본문 인자의 타입 이름이 바뀐다(모양은 같다). 이미 만든 Starter는 `orval.config.ts`의 `override`에 `aliasCombinedTypes: true`를 더하고 `npm run api:gen`을 다시 실행하면 된다.
