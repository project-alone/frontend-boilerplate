// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/file-upload/src/shared/upload/api-upload.ts

import { ApiError, type ApiRequestInit } from '@/shared/api/api-fetch'
import { browserBaseUrl } from '@/shared/api/base-url'
import { parseBody } from '@/shared/lib/http'
import { waitForMocks } from '@/shared/mocks/mock-readiness'

/** 업로드 요청의 본문을 보낸 정도. 바이트 단위이고, total은 multipart 경계 등을 포함한 본문 전체의 크기다. */
export interface UploadProgress {
  loaded: number
  total: number
}

/** apiUpload의 옵션 */
export interface ApiUploadInit<T> {
  /** 보낼 본문. 파일 업로드 operation은 생성된 fetch 함수처럼 FormData에 필드를 담는다. */
  body: FormData
  /** 응답 본문을 검증할 Zod 스키마(명세에서 생성한 src/shared/api/generated/model의 스키마) */
  schema?: ApiRequestInit<T>['schema']
  /** abort하면 요청을 멈추고 signal의 reason(기본은 AbortError)으로 실패한다. */
  signal?: AbortSignal | undefined
  /** 본문을 보내는 동안 여러 번 불린다. */
  onProgress?: ((progress: UploadProgress) => void) | undefined
}

/**
 * 업로드 진행률을 알 수 있는 POST 요청. 재생성 계층의 fetch 함수(apiFetch)는 fetch로 보내는데, fetch는 보낸 본문의 양을 알려 주지
 * 않으므로 진행률이 필요한 파일 업로드는 XMLHttpRequest로 보낸다. 보내는 곳과 결과는 apiFetch와 같다.
 *
 * - 주소: 브라우저의 apiFetch와 같은 주소(base-url.ts의 browserBaseUrl)다. server에서는 BFF 프록시(/api/proxy)를 거치고,
 *   static-export에서는 NEXT_PUBLIC_API_BASE_URL의 백엔드를 직접 부른다. 쿠키는 apiFetch(fetch)처럼 같은 출처에만 보낸다.
 * - 결과: 2xx가 아니면 ApiError로 실패하고, 2xx의 본문은 schema로 검증해 돌려준다.
 *
 * 브라우저에서만 쓴다. XMLHttpRequest는 서버에 없으므로 서버 컴포넌트에서는 생성된 fetch 함수로 올린다.
 * 다른 출처로 보낼 때(static-export) upload 이벤트를 들으면 브라우저가 먼저 preflight(OPTIONS)를 보내므로, 백엔드는 이 operation의
 * CORS preflight에 답해야 한다(README의 "파일 업로드"). 그래서 onProgress가 있을 때만 upload 이벤트를 듣는다.
 * 브라우저의 MSW(static-export의 서비스 워커)가 켜진 빌드에서는 MSW가 요청을 받을 준비가 될 때까지 기다린 뒤 보낸다. fetch와 달리
 * XMLHttpRequest는 준비되는 동안 붙잡아 둘 수 없어, 페이지를 열자마자 올리면 MSW를 거치지 않고 나가기 때문이다(waitForMocks).
 */
export async function apiUpload<T>(path: string, { body, schema, signal, onProgress }: ApiUploadInit<T>): Promise<T> {
  if (typeof window === 'undefined') {
    throw new Error('apiUpload는 브라우저에서만 씁니다. 서버에서는 생성된 fetch 함수로 올립니다.')
  }
  signal?.throwIfAborted()
  await waitForMocks()
  // 기다리는 동안 취소했으면 보내지 않는다.
  signal?.throwIfAborted()

  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest()
    const abort = () => {
      request.abort()
    }
    request.open('POST', `${browserBaseUrl()}${path}`)
    // upload의 이벤트는 send 전에 들어야 발생한다.
    if (onProgress !== undefined) {
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress({ loaded: event.loaded, total: event.total })
      })
    }
    request.addEventListener('loadend', () => {
      signal?.removeEventListener('abort', abort)
    })
    request.addEventListener('load', () => {
      try {
        // apiFetch처럼 JSON 응답이면 JSON으로, 아니면 글자 그대로 읽고, 본문이 없으면 undefined다.
        const responseBody = parseBody(request.responseText, request.getResponseHeader('content-type'))
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
