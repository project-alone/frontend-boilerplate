// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/token-operations.ts

import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import { getLoginUrl, getRefreshTokensUrl } from '@/shared/api/generated'

// 응답에 토큰이 담기는 인증 operation(login, refreshTokens)은 BFF(auth-backend.ts)만 부른다(ADR-0006). BFF 프록시가 브라우저의
// 요청을 이 operation으로 그대로 전달하면 응답의 토큰이 브라우저의 JavaScript로 가므로, backendFetch 처리기
// (auth-backend-fetch.ts)는 BFF가 callTokenOperation 안에서 보낸 요청이 아니면 백엔드로 보내지 않고 403으로 답한다.
// 서버 컴포넌트가 생성된 login을 직접 불러 토큰을 클라이언트 컴포넌트에 넘기는 실수도 같은 이유로 막는다.
// 서버에서만 쓰는 모듈이다(node:async_hooks).

/** 응답에 토큰이 담기는 operation의 경로. 명세(openapi.yaml)의 경로가 바뀌면 npm run api:gen으로 함께 바뀐다. */
const TOKEN_OPERATION_PATHS = [getLoginUrl(), getRefreshTokensUrl()]

// BFF 프록시(Route Handler)와 proxy는 따로 번들되어 이 모듈을 따로 불러오므로, 프로세스에 하나인 globalThis에 둔다
// (refresh-session.ts와 같은 이유).
const holder = globalThis as typeof globalThis & { authTokenOperationCalls?: AsyncLocalStorage<true> }
const bffCalls = (holder.authTokenOperationCalls ??= new AsyncLocalStorage<true>())

/** BFF가 토큰 operation을 부른다. call 안에서 보낸 요청만 backendFetch 처리기가 백엔드로 보낸다(auth-backend.ts가 쓴다). */
export function callTokenOperation<T>(call: () => Promise<T>): Promise<T> {
  return bffCalls.run(true, call)
}

/** url이 응답에 토큰이 담기는 operation인데 BFF가 callTokenOperation으로 보낸 요청이 아니면 true */
export function isRefusedTokenOperation(url: string): boolean {
  if (bffCalls.getStore() === true) return false
  const path = comparablePath(new URL(url).pathname)
  return TOKEN_OPERATION_PATHS.some((operationPath) => path.endsWith(comparablePath(operationPath)))
}

/** 막은 요청에 돌려줄 응답. BFF 프록시가 그대로 브라우저에 돌려준다. */
export function refusedTokenOperationResponse(): Response {
  return Response.json(
    {
      message:
        '응답에 토큰이 담기는 인증 operation(login, refreshTokens)은 BFF 프록시로 부를 수 없습니다. 토큰이 브라우저의 ' +
        'JavaScript로 가기 때문입니다. 로그인은 /api/session으로 합니다(README의 "인증").',
    },
    { status: 403 },
  )
}

// 백엔드마다 경로를 읽는 규칙이 달라도 같은 operation으로 보이도록 고친다: 퍼센트 인코딩(%6Cogin), 대소문자, 경로 매개변수
// (;jsessionid=…), 겹친 슬래시, 끝의 슬래시, 역슬래시. 막는 쪽으로만 넓게 본다.
function comparablePath(pathname: string): string {
  let decoded = pathname
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    // 잘못 인코딩된 경로는 그대로 비교한다.
  }
  return decoded
    .replaceAll('\\', '/')
    .replace(/;[^/]*/g, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase()
}
