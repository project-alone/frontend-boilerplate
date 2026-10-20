// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/api/base-url.ts

// API 요청을 보낼 곳(ADR-0006). 서버와 브라우저가 서로 다른 주소를 쓴다.

/** 브라우저의 API 요청을 백엔드로 전달하는 BFF 프록시의 경로(src/app/api/proxy/[...path]/route.ts) */
export const BFF_PROXY_PATH = '/api/proxy'

/**
 * MSW가 요청을 받을 때 백엔드 주소가 없으면 대신 쓰는 주소(샘플 명세 openapi.yaml의 servers).
 * 이 주소로 가는 요청은 MSW가 받으므로 실제로 나가지 않는다.
 */
export const MOCK_API_BASE_URL = 'https://api.example.com'

/**
 * 서버(서버 컴포넌트, Route Handler)가 백엔드를 직접 부를 때 쓰는 주소. BFF 프록시도 이 주소로 전달한다.
 * 서버에서만 읽는 환경 변수 API_BASE_URL에서 가져온다. API_BASE_URL이 없으면 MSW가 켜져 있을 때(API_MOCKING=enabled)만
 * MOCK_API_BASE_URL을 쓰고, MSW가 꺼져 있으면 엉뚱한 곳을 부르지 않도록 실패한다.
 * 서버가 뜰 때 src/instrumentation.ts가 한 번 불러서, 설정이 빠졌으면 요청을 받기 전에 알린다.
 */
export function backendBaseUrl(): string {
  const url = nonEmpty(process.env.API_BASE_URL)
  if (url !== undefined) return withoutTrailingSlash(url)
  if (process.env.API_MOCKING === 'enabled') return MOCK_API_BASE_URL
  throw new Error(
    'API_BASE_URL 환경 변수가 없습니다. MSW를 끈(API_MOCKING이 enabled가 아닌) 서버는 API_BASE_URL의 백엔드를 부르므로 백엔드 주소를 넣어 주세요(README의 "API 계층").',
  )
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
