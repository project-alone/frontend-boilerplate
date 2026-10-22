---
"devc-frontend-generator": patch
---

응답 스키마의 속성이 컴포넌트의 string enum을 `$ref`로 가리켜도 `npm run api:gen`이 만든 MSW 목이 명세의 enum 값만 돌려준다. 목이 그 속성의 값을 `Object.values(<enum>)`에서 골랐는데, 재생성 계층은 enum을 Zod enum으로 만들어 Zod 내부 값이 골라졌다. typecheck는 통과하지만 fetch 함수의 Zod 검증이 `invalid_value`로 실패했다(필수 속성이면 늘, 선택 속성과 배열 항목이면 값이 들어간 응답마다). 이제 Base의 `orval.config.ts`가 orval의 `override.enumGenerationType`을 `'union'`으로 정해, 목이 명세의 enum 값을 바로 적은 배열에서 고른다. 타입과 Zod 스키마, fetch 함수는 바뀌지 않는다. 이미 만든 Starter는 `orval.config.ts`의 `override`에 `enumGenerationType: 'union'`을 더하고 `npm run api:gen`을 다시 실행하면 된다.
