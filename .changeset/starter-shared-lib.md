---
"devc-frontend-generator": patch
---

Starter에 여러 곳에서 쓰는 범용 함수를 모은 `src/shared/lib/`를 더한다. 주제마다 파일 하나씩 두며(`text.ts`의 `nonEmpty`·`withoutTrailingSlash`, `json.ts`의 `parseJson`, `http.ts`의 `parseBody`·`readJsonBody`·`searchParamsOf`, `array.ts`의 `range`·`slicePage`, `async.ts`의 `delay`), 서버와 브라우저가 함께 쓰도록 `server-only` 같은 표시가 없는 순수 함수만 둔다. Recipe가 더하는 범용 함수도 같은 곳에 자기 파일로 들어간다(file-upload의 `multipart.ts`). `src/shared/api/api-fetch.ts`는 `ApiError`를 다루는 `isApiError(error, ...statuses)`와 `apiErrorMessage(error, schema)`를 함께 내보내고, table Recipe는 정렬 아이콘을 `src/shared/ui/sort-icon.tsx`로 내보내 대시보드 Archetype의 사용자 테이블과 함께 쓴다.

Base·Recipe·Archetype 코드에서 한 번만 쓰던 작은 함수는 쓰는 함수 안으로 합쳤고, 여러 파일에 같은 내용으로 있던 함수(목 핸들러의 쿼리 파라미터 읽기, 응답 본문 읽기, 빈 환경 변수 값 거르기 등)는 `src/shared/lib/`의 함수로 바꿨다. 화면과 API의 동작은 달라지지 않는다. 이미 만든 Starter는 옮기지 않아도 된다.
