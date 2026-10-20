/** 시험용 backendFetch 처리기: 서버가 백엔드로 보내는 요청에 자기 이름을 덧붙이고, 받은 응답에도 덧붙인다. */
export async function fixtureBBackendFetch(
  url: string,
  init: RequestInit,
  next: (url: string, init: RequestInit) => Promise<Response>,
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.append('x-fixture-backend', 'b')
  const response = await next(url, { ...init, headers })
  // fetch가 돌려준 응답의 헤더는 고칠 수 없으므로 헤더를 복사한 새 응답을 만든다.
  const responseHeaders = new Headers([...response.headers])
  responseHeaders.append('x-fixture-backend-response', 'b')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}
