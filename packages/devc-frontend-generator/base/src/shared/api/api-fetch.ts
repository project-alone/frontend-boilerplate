import { backendBaseUrl, browserBaseUrl } from './base-url'

/**
 * apiFetch의 옵션. orval이 만든 fetch 함수가 응답의 Zod 스키마를 schema로 넘긴다.
 * schema는 Zod 스키마(ZodType<T>) 대신 parse만 요구한다. 응답 본문이 없는(204) operation의 fetch 함수는 schema 없이
 * 요청 옵션(ApiRequestInit<unknown>)을 그대로 넘기는데, ZodType<unknown>은 ZodType<void> 자리에 넣을 수 없지만
 * 반환 타입이 void인 함수 자리에는 어떤 함수든 넣을 수 있다.
 */
export interface ApiRequestInit<T = unknown> extends RequestInit {
  schema?: { parse: (body: unknown) => T }
}

/** 백엔드가 2xx가 아닌 응답을 돌려주면 던진다. 응답 본문은 body에 담긴다. */
export class ApiError extends Error {
  override readonly name = 'ApiError'

  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API 요청이 ${String(status)} 응답으로 실패했습니다.`)
  }
}

/**
 * 재생성 계층(src/shared/api/generated)의 fetch 함수가 모두 거치는 fetch 클라이언트(orval mutator).
 * 서버에서는 백엔드를 직접, 브라우저에서는 BFF 프록시를 부른다(base-url.ts). 호출하는 쪽은 실행 환경을 신경 쓰지 않는다.
 * 응답은 명세에서 만든 Zod 스키마로 검증해 돌려준다.
 */
export async function apiFetch<T>(path: string, { schema, ...init }: ApiRequestInit<T> = {}): Promise<T> {
  let baseUrl: string
  if (typeof window === 'undefined') {
    // 목 빌드(API_MOCKING=enabled로 실행한 next build)이면 요청을 보내기 전에 MSW를 켠다(api-mocking.ts). Next.js는
    // 브라우저 번들의 `typeof window`를 값으로 바꾸므로, 이 블록 안에서 불러오는 모듈과 MSW는 브라우저 번들에서 빠진다.
    const { startBuildApiMocking } = await import('./api-mocking')
    await startBuildApiMocking()
    baseUrl = backendBaseUrl()
  } else {
    baseUrl = browserBaseUrl()
  }
  const response = await fetch(`${baseUrl}${path}`, init)
  const body = await readBody(response)
  if (!response.ok) throw new ApiError(response.status, body)
  return schema === undefined ? (body as T) : schema.parse(body)
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text === '') return undefined
  const isJson = response.headers.get('content-type')?.includes('json') ?? false
  return isJson ? JSON.parse(text) : text
}
