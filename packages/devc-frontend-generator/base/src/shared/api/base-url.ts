// API 요청을 보낼 곳(ADR-0006). 서버와 브라우저가 서로 다른 주소를 쓴다.

/** 브라우저의 API 요청을 백엔드로 전달하는 BFF 프록시의 경로(src/app/api/proxy/[...path]/route.ts) */
export const BFF_PROXY_PATH = '/api/proxy'

/**
 * 서버(서버 컴포넌트, Route Handler)가 백엔드를 직접 부를 때 쓰는 주소. BFF 프록시도 이 주소로 전달한다.
 * 서버에서만 읽는 환경 변수 API_BASE_URL에서 가져온다.
 */
export function backendBaseUrl(): string {
  const url = nonEmpty(process.env.API_BASE_URL)
  if (url === undefined) {
    throw new Error('API_BASE_URL 환경 변수가 없습니다. 서버가 부를 백엔드 주소를 넣어 주세요(README의 "API 계층").')
  }
  return withoutTrailingSlash(url)
}

/**
 * 브라우저가 API를 부를 때 쓰는 주소. 기본은 BFF 프록시다.
 * NEXT_PUBLIC_API_BASE_URL을 넣으면 브라우저가 그 주소(백엔드)를 직접 부른다. static-export처럼 서버가 없는
 * Rendering Mode에서 쓰는 설정이다. NEXT_PUBLIC_ 값은 빌드할 때 코드에 박히므로 바꾸면 다시 빌드해야 한다.
 */
export function browserBaseUrl(): string {
  return withoutTrailingSlash(nonEmpty(process.env.NEXT_PUBLIC_API_BASE_URL) ?? BFF_PROXY_PATH)
}

// .env 파일에 `NAME=`처럼 값 없이 적은 변수는 빈 문자열이 되므로 없는 것으로 본다.
function nonEmpty(value: string | undefined): string | undefined {
  return value === '' ? undefined : value
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}
