// Starter의 OpenAPI 명세와 그 명세로 만든 재생성 API 계층(ADR-0003). `dcgen new`가 명세 조각을 병합할 때(openapi-fragments.ts)와
// Schematic이 operation과 재생성 계층의 코드를 찾을 때(schematics/starter-project.ts) 함께 쓴다.

/** Starter 최상위의 OpenAPI 명세. overlay 최상위에 같은 이름으로 둔 파일은 이 명세에 병합할 명세 조각이다. */
export const OPENAPI_SPEC = 'openapi.yaml'

/** 명세로 만든 재생성 API 계층(orval). Starter 최상위 기준이다. */
export const GENERATED_API_DIR = 'src/shared/api/generated'

/** path item에서 operation을 담는 키(HTTP 메서드) */
export const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]
