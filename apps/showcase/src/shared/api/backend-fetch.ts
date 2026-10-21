// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/extensions.json

import { authBackendFetch } from '@/shared/auth/auth-backend-fetch'

// Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 만든 파일이다. 이제는 이 프로젝트의 코드이므로 직접 고친다.
// 서버가 백엔드로 보내는 요청(서버에서 부른 apiFetch, BFF 프록시가 전달하는 브라우저의 요청)을 처리기에 위에서부터 차례로
// 통과시킨 뒤 fetch로 보낸다. 처리기는 요청을 고쳐 next로 넘기고(예: 토큰 첨부), 받은 응답을 고치거나 요청을 다시 보내
// 돌려준다(예: 401이면 토큰을 새로 받아 다시 보냄). 응답은 아래의 처리기부터 거꾸로 거쳐 돌아온다.
type BackendFetchHandler = (
  url: string,
  init: RequestInit,
  next: (url: string, init: RequestInit) => Promise<Response>,
) => Promise<Response>

const handlers: readonly BackendFetchHandler[] = [authBackendFetch]

/** 서버에서 백엔드로 요청을 보낸다. fetch와 같은 인자를 받는다(src/shared/api/api-fetch.ts, bff-proxy.ts가 쓴다). */
export function backendFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const run = (index: number, currentUrl: string, currentInit: RequestInit): Promise<Response> => {
    const handler = handlers[index]
    if (handler === undefined) return fetch(currentUrl, currentInit)
    return handler(currentUrl, currentInit, (nextUrl, nextInit) => run(index + 1, nextUrl, nextInit))
  }
  return run(0, url, init)
}
