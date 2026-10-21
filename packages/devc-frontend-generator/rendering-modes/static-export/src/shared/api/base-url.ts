// API 요청을 보낼 곳. Rendering Mode static-export에는 요청을 받는 서버가 없어 BFF 프록시(ADR-0006)를 두지 않으므로,
// 브라우저가 백엔드를 직접 부른다(README의 "API 계층").

/**
 * MSW가 요청을 받을 때 백엔드 주소가 없으면 대신 쓰는 주소(샘플 명세 openapi.yaml의 servers).
 * 이 주소로 가는 요청은 MSW가 받으므로 실제로 나가지 않는다.
 */
export const MOCK_API_BASE_URL = 'https://api.example.com'

/**
 * 서버 컴포넌트가 백엔드를 부를 때 쓰는 주소. static-export에서 서버 컴포넌트는 빌드할 때와 개발 서버에서만 실행된다.
 * 서버에서만 읽는 환경 변수 API_BASE_URL에서 가져온다. API_BASE_URL이 없으면 MSW가 켜져 있을 때(API_MOCKING=enabled)만
 * MOCK_API_BASE_URL을 쓰고, MSW가 꺼져 있으면 엉뚱한 곳을 부르지 않도록 실패한다. next build에서는 빌드할 때 데이터를
 * 가져오는 페이지(SSG)가 부를 때 실패해 빌드를 멈춘다.
 */
export function backendBaseUrl(): string {
  const url = nonEmpty(process.env.API_BASE_URL)
  if (url !== undefined) return withoutTrailingSlash(url)
  if (process.env.API_MOCKING === 'enabled') return MOCK_API_BASE_URL
  // NEXT_PHASE는 next build가 넣는 단계 이름이다(next/constants의 PHASE_PRODUCTION_BUILD).
  throw new Error(
    process.env.NEXT_PHASE === 'phase-production-build'
      ? 'API_BASE_URL 환경 변수가 없습니다. 빌드할 때 데이터를 가져오는 페이지(SSG)는 API_BASE_URL의 백엔드를 부르므로, 배포용 빌드에는 백엔드 주소를 넣어 주세요. 배포하지 않는 검사용 빌드(GitLab CI의 build 잡 등)는 API_MOCKING=enabled로 목 응답을 받아 빌드합니다(README의 "실행과 배포").'
      : 'API_BASE_URL 환경 변수가 없습니다. MSW를 끈(API_MOCKING이 enabled가 아닌) 서버는 API_BASE_URL의 백엔드를 부르므로 백엔드 주소를 넣어 주세요(README의 "API 계층").',
  )
}

/**
 * 브라우저가 부르는 백엔드 주소. NEXT_PUBLIC_API_BASE_URL에서 가져온다. NEXT_PUBLIC_ 값은 빌드할 때 코드에 박히므로
 * 바꾸면 다시 빌드해야 한다. NEXT_PUBLIC_API_BASE_URL이 없으면 브라우저의 MSW가 켜져 있을 때
 * (NEXT_PUBLIC_API_MOCKING=enabled)만 MOCK_API_BASE_URL을 쓰고, MSW가 꺼져 있으면 실패한다.
 */
export function browserBaseUrl(): string {
  const url = nonEmpty(process.env.NEXT_PUBLIC_API_BASE_URL)
  if (url !== undefined) return withoutTrailingSlash(url)
  if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') return MOCK_API_BASE_URL
  throw new Error(
    'NEXT_PUBLIC_API_BASE_URL 환경 변수가 없습니다. static-export에서는 브라우저가 백엔드를 직접 부르므로, 빌드할 때 백엔드 주소를 넣어 주세요(README의 "API 계층").',
  )
}

// .env 파일에 `NAME=`처럼 값 없이 적은 변수는 빈 문자열이 되므로 없는 것으로 본다.
function nonEmpty(value: string | undefined): string | undefined {
  return value === '' ? undefined : value
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}
