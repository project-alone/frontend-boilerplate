import { ApiError, type ApiRequestInit } from '@/shared/api/api-fetch'
import { browserBaseUrl } from '@/shared/api/base-url'

/** 업로드 요청의 본문을 보낸 정도. 바이트 단위이고, total은 multipart 경계 등을 포함한 본문 전체의 크기다. */
export interface UploadProgress {
  loaded: number
  total: number
}

/** apiUpload의 옵션 */
export interface ApiUploadInit<T> {
  /** 보낼 본문. 파일 업로드 operation은 생성된 fetch 함수처럼 FormData에 필드를 담는다. */
  body: FormData
  /** 기본값은 POST */
  method?: 'POST' | 'PUT' | 'PATCH'
  /** 응답 본문을 검증할 Zod 스키마(명세에서 생성한 src/shared/api/generated/model의 스키마) */
  schema?: ApiRequestInit<T>['schema']
  /** abort하면 요청을 멈추고 signal의 reason(기본은 AbortError)으로 실패한다. */
  signal?: AbortSignal | undefined
  /** 본문을 보내는 동안 여러 번 불린다. */
  onProgress?: ((progress: UploadProgress) => void) | undefined
}

/**
 * 업로드 진행률을 알 수 있는 요청. 재생성 계층의 fetch 함수(apiFetch)는 fetch로 보내는데, fetch는 보낸 본문의 양을 알려 주지 않으므로
 * 진행률이 필요한 파일 업로드는 XMLHttpRequest로 보낸다. 보내는 곳과 결과는 apiFetch와 같다.
 *
 * - 주소: 브라우저의 apiFetch와 같은 주소(base-url.ts의 browserBaseUrl)다. server에서는 BFF 프록시(/api/proxy)를 거치고,
 *   static-export에서는 NEXT_PUBLIC_API_BASE_URL의 백엔드를 직접 부른다. 쿠키는 apiFetch(fetch)처럼 같은 출처에만 보낸다.
 * - 결과: 2xx가 아니면 ApiError로 실패하고, 2xx의 본문은 schema로 검증해 돌려준다.
 *
 * 브라우저에서만 쓴다. XMLHttpRequest는 서버에 없으므로 서버 컴포넌트에서는 생성된 fetch 함수로 올린다.
 * 다른 출처로 보낼 때(static-export) upload 이벤트를 들으면 브라우저가 먼저 preflight(OPTIONS)를 보내므로, 백엔드는 이 operation의
 * CORS preflight에 답해야 한다(README의 "파일 업로드").
 */
export function apiUpload<T>(
  path: string,
  { body, method = 'POST', schema, signal, onProgress }: ApiUploadInit<T>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (typeof window === 'undefined') {
      throw new Error('apiUpload는 브라우저에서만 씁니다. 서버에서는 생성된 fetch 함수로 올립니다.')
    }
    signal?.throwIfAborted()

    const request = new XMLHttpRequest()
    const abort = () => {
      request.abort()
    }
    request.open(method, `${browserBaseUrl()}${path}`)
    // upload의 이벤트는 send 전에 들어야 발생한다.
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.({ loaded: event.loaded, total: event.total })
    })
    request.addEventListener('loadend', () => {
      signal?.removeEventListener('abort', abort)
    })
    request.addEventListener('load', () => {
      try {
        const responseBody = readBody(request)
        if (request.status < 200 || request.status >= 300) throw new ApiError(request.status, responseBody)
        resolve(schema === undefined ? (responseBody as T) : schema.parse(responseBody))
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
    // fetch처럼 네트워크 오류(CORS 거절 포함)는 TypeError로, 취소는 signal의 reason으로 실패한다.
    request.addEventListener('error', () => {
      reject(new TypeError('네트워크 오류로 요청을 보내지 못했습니다.'))
    })
    request.addEventListener('abort', () => {
      reject(signal?.reason instanceof Error ? signal.reason : new DOMException('요청을 취소했습니다.', 'AbortError'))
    })
    signal?.addEventListener('abort', abort, { once: true })
    request.send(body)
  })
}

// apiFetch처럼 JSON 응답이면 JSON으로, 아니면 글자 그대로 읽고, 본문이 없으면 undefined다.
function readBody(request: XMLHttpRequest): unknown {
  const text = request.responseText
  if (text === '') return undefined
  const isJson = request.getResponseHeader('content-type')?.includes('json') ?? false
  return isJson ? JSON.parse(text) : text
}
