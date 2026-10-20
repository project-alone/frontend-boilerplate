// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/orval.config.ts

import { defineConfig } from 'orval'

// `npm run api:gen`이 읽는 설정. openapi.yaml에서 재생성 계층(src/shared/api/generated)을 만든다(ADR-0003).
// 재생성 계층은 손으로 고치지 않고, 명세를 고친 뒤 다시 생성한다.
//
// - 타입과 Zod 스키마: model/<스키마>.zod.ts. 타입은 Zod 스키마에서 뽑는다.
// - fetch 함수: <tag>/<tag>.ts. 모든 요청이 src/shared/api/api-fetch.ts의 apiFetch를 거치고, 응답은 Zod 스키마로 검증된다.
// - MSW 핸들러: <tag>/<tag>.msw.ts. src/shared/mocks/handlers.ts가 index.msw.ts를 통해 모두 모아 쓴다.
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
      mock: { indexMockFiles: true, generators: [{ type: 'msw', useExamples: true }] },
      override: {
        mutator: { path: './src/shared/api/api-fetch.ts', name: 'apiFetch' },
        fetch: { includeHttpResponseReturnType: false, runtimeValidation: true },
        includeZodSchemaInArguments: true,
        zod: { version: 4, exactOptional: true },
      },
    },
  },
})
