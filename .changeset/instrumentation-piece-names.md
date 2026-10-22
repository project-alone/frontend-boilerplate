---
"devc-frontend-generator": patch
---

Generator가 확장 지점의 조각을 모아 만드는 `src/instrumentation.ts`와 `src/instrumentation-client.ts`가 조각을 "훅"이 아니라 "조각"이라고 부른다. 타입 `InstrumentationHook`·`ClientInstrumentationHook`은 `InstrumentationPiece`·`ClientInstrumentationPiece`로, 조각의 목록 `hooks`는 `pieces`로 이름만 바뀌었고 동작은 같다. 이미 만든 Starter는 고치지 않아도 된다.
