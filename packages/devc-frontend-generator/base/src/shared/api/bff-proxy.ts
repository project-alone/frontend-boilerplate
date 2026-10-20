import { BFF_PROXY_PATH, backendBaseUrl } from './base-url'

// 백엔드로 넘기지 않는 요청 헤더. 연결 단위(hop-by-hop) 헤더와, 백엔드 주소로 다시 정해지는 host다.
// accept-encoding도 빼서 서버의 fetch가 직접 풀 수 있는 압축만 받게 한다.
const REQUEST_HEADERS_TO_DROP = [
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'accept-encoding',
]

// 서버의 fetch가 응답 본문의 압축을 이미 풀었으므로 압축·길이와 연결 단위 헤더는 브라우저로 넘기지 않는다.
const RESPONSE_HEADERS_TO_DROP = ['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive']

/**
 * BFF 프록시(ADR-0006). 브라우저가 `/api/proxy/<경로>`로 보낸 요청을 `API_BASE_URL/<경로>`로 그대로 전달하고,
 * 백엔드의 응답(상태, 헤더, 본문)을 그대로 돌려준다. 토큰 첨부와 refresh는 auth Recipe가 여기에 더한다.
 */
export async function forwardToBackend(request: Request): Promise<Response> {
  const { pathname, search } = new URL(request.url)
  const headers = new Headers(request.headers)
  for (const name of REQUEST_HEADERS_TO_DROP) headers.delete(name)
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'

  const response = await fetch(`${backendBaseUrl()}${pathname.slice(BFF_PROXY_PATH.length)}${search}`, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : null,
    redirect: 'manual',
    cache: 'no-store',
  })

  const responseHeaders = new Headers(response.headers)
  for (const name of RESPONSE_HEADERS_TO_DROP) responseHeaders.delete(name)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}
