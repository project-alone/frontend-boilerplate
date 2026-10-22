// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/orval.config.ts

import { defineConfig } from 'orval'
import { MOCK_API_BASE_URL } from './src/shared/api/base-url'

// `npm run api:gen`이 읽는 설정. openapi.yaml에서 재생성 계층(src/shared/api/generated)을 만든다(ADR-0003).
// 재생성 계층은 손으로 고치지 않고, 명세를 고친 뒤 다시 생성한다.
//
// - 타입과 Zod 스키마: model/<스키마>.zod.ts. 타입은 Zod 스키마에서 뽑는다.
// - fetch 함수: <tag>/<tag>.ts. 모든 요청이 src/shared/api/api-fetch.ts의 apiFetch를 거치고, 응답은 Zod 스키마로 검증된다.
// - MSW 핸들러: <tag>/<tag>.msw.ts. src/shared/mocks/handlers.ts가 index.msw.ts를 통해 모두 모아 쓴다. 핸들러는 목 백엔드
//   주소(MOCK_API_BASE_URL)로 가는 요청만 받아 앱의 페이지 주소와 겹치지 않는다.
//
// TanStack Query 훅은 만들지 않는다(client: 'fetch'). 캐시 무효화 같은 판단이 들어가는 쿼리 키·queryOptions·
// 뮤테이션 훅은 src/queries/<Query Domain>에 두고 프로젝트가 직접 소유한다.
export default defineConfig({
  api: {
    input: { target: './openapi.yaml' },
    output: {
      mode: 'tags-split',
      target: './src/shared/api/generated/index.ts',
      schemas: { path: './src/shared/api/generated/model', type: 'zod' },
      client: 'fetch',
      httpClient: 'fetch',
      clean: true,
      formatter: 'prettier',
      // 명세의 example을 목 응답으로 쓴다. example이 없는 응답은 faker가 만든다.
      mock: { indexMockFiles: true, generators: [{ type: 'msw', useExamples: true, baseUrl: MOCK_API_BASE_URL }] },
      override: {
        mutator: { path: './src/shared/api/api-fetch.ts', name: 'apiFetch' },
        fetch: { includeHttpResponseReturnType: false, runtimeValidation: true },
        // fetch 함수는 응답 타입과 같은 이름의 Zod 스키마로 응답을 검증한다. 응답이 이름 있는 스키마가 아니라 그 자리에 적은
        // oneOf·anyOf(스키마 둘 중 하나, 스키마 또는 null 등)이면 orval은 타입을 `A | B`로만 적어 검증할 Zod 스키마가 없고,
        // fetch 함수는 응답을 검증하지 않은 채 typecheck에서 실패한다(TS2379). 그래서 이런 응답에도 `<operationId><상태 코드>`
        // (예: GetPayment200, 배열의 항목은 ListPayments200Item) 이름의 타입과 Zod 스키마를 만든다. 이런 요청 본문은 fetch 함수가
        // `A | B` 대신 `<operationId>Body` 타입으로 받는다.
        aliasCombinedTypes: true,
        includeZodSchemaInArguments: true,
        // 선택 속성(required에 없는 속성)은 값이 undefined인 키가 아니라 빠진 키로 다룬다. tsconfig의 exactOptionalPropertyTypes에
        // 맞춰 Zod 스키마는 .exactOptional()로 만들고, 목은 선택 속성을 응답마다 값과 함께 넣거나 키째 뺀다(undefined를 넣지 않는다).
        zod: { version: 4, exactOptional: true },
        mock: { exactOptional: true },
        // 컴포넌트의 string enum을 $ref로 가리키는 속성의 목은 명세의 enum 값을 바로 적은 배열에서 고른다. 기본값('const')이면
        // 목이 enum 상수 객체의 값(Object.values(<enum>))에서 고르는데, 스키마를 Zod로 만들면 그 이름은 Zod enum이라 Zod 내부 값이
        // 골라지고 응답의 Zod 검증이 실패한다. 타입과 Zod 스키마는 Zod로 만들므로 이 설정으로 바뀌지 않는다.
        enumGenerationType: 'union',
      },
    },
  },
})
