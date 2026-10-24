// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/api/api-fetch.ts

import { browserBaseUrl } from './base-url'

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
 * 서버에서는 백엔드를 직접(api-fetch.server.ts), 브라우저에서는 BFF 프록시를 부른다(base-url.ts). 호출하는 쪽은 실행 환경을
 * 신경 쓰지 않는다. 응답은 명세에서 만든 Zod 스키마로 검증해 돌려준다.
 */
export async function apiFetch<T>(path: string, { schema, ...init }: ApiRequestInit<T> = {}): Promise<T> {
  let response: Response
  if (typeof window === 'undefined') {
    // 서버의 요청은 서버 전용 모듈이 보낸다. package.json의 imports가 서버 컴포넌트, Route Handler, proxy, instrumentation
    // (react-server 조건)에서는 api-fetch.server.ts를, 서버에서 렌더링하는 클라이언트 컴포넌트에서는 api-fetch.ssr.ts를 고른다.
    // 클라이언트 컴포넌트가 import하는 모듈은 서버 전용 모듈을 불러올 수 없기 때문이다. Next.js는 브라우저 번들의
    // `typeof window`를 값으로 바꾸므로, 이 블록은 브라우저 번들에서 빠진다.
    const { fetchFromServer } = await import('#api-fetch.server')
    response = await fetchFromServer(path, init)
  } else {
    response = await fetch(`${browserBaseUrl()}${path}`, init)
  }
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
