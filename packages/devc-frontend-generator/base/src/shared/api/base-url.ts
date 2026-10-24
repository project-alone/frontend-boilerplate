// API 요청을 보낼 곳(ADR-0006). 서버는 백엔드를, 브라우저는 BFF 프록시를 부른다.

/** 브라우저의 API 요청을 백엔드로 전달하는 BFF 프록시의 경로(src/app/api/proxy/[...path]/route.ts) */
export const BFF_PROXY_PATH = '/api/proxy'

/**
 * 목 백엔드(MSW)의 주소. MSW가 켜져 있고 백엔드 주소가 없으면 API 요청을 이 주소로 보내고, MSW 핸들러(src/shared/mocks/handlers.ts)는
 * 이 주소로 가는 요청만 받는다(config/orval.config.ts가 생성된 핸들러를 이 주소로 만든다). 앱과 다른 출처라 핸들러가 페이지 주소
 * (/products 등)와 겹치지 않으므로, 브라우저의 MSW(서비스 워커)가 페이지를 열거나 새로 고치는 요청에 목 응답을 돌려주지 않는다.
 * .test는 실제로 쓰이지 않도록 남겨 둔 최상위 도메인(RFC 6761)이라 MSW가 받지 않은 요청은 어디에도 닿지 않는다.
 */
export const MOCK_API_BASE_URL = 'https://mock.api.test'

/**
 * 서버(서버 컴포넌트, Route Handler)가 백엔드를 직접 부를 때 쓰는 주소. BFF 프록시도 이 주소로 전달한다.
 * 서버에서만 읽는 환경 변수 API_BASE_URL에서 가져온다. API_BASE_URL이 없으면 MSW가 켜져 있을 때(API_MOCKING=enabled)만
 * MOCK_API_BASE_URL을 쓰고, MSW가 꺼져 있으면 엉뚱한 곳을 부르지 않도록 실패한다.
 * 서버가 뜰 때 api-instrumentation.ts가 한 번 불러서, 설정이 빠졌으면 요청을 받기 전에 알린다. next build에서는
 * 빌드할 때 데이터를 가져오는 페이지(SSG·ISR)가 부를 때 실패해 빌드를 멈춘다.
 */
export function backendBaseUrl(): string {
  const url = nonEmpty(process.env.API_BASE_URL)
  if (url !== undefined) return withoutTrailingSlash(url)
  if (process.env.API_MOCKING === 'enabled') return MOCK_API_BASE_URL
  // NEXT_PHASE는 next build가 넣는 단계 이름이다(next/constants의 PHASE_PRODUCTION_BUILD).
  throw new Error(
    process.env.NEXT_PHASE === 'phase-production-build'
      ? 'API_BASE_URL 환경 변수가 없습니다. 빌드할 때 데이터를 가져오는 페이지(SSG·ISR)는 API_BASE_URL의 백엔드를 부르므로, 배포용 빌드에는 백엔드 주소를 넣어 주세요. 배포하지 않는 검사용 빌드(GitLab CI의 build 잡 등)는 API_MOCKING=enabled로 목 응답을 받아 빌드합니다(README의 "실행과 배포").'
      : 'API_BASE_URL 환경 변수가 없습니다. MSW를 끈(API_MOCKING이 enabled가 아닌) 서버는 API_BASE_URL의 백엔드를 부르므로 백엔드 주소를 넣어 주세요(README의 "API 계층").',
  )
}

/**
 * 브라우저가 API를 부를 때 쓰는 주소. 브라우저의 요청은 늘 BFF 프록시를 거쳐 서버에서 백엔드로 나간다. 브라우저가 백엔드를
 * 직접 부르면 BFF가 붙이는 것(auth Recipe의 토큰 등)이 빠지므로 주소를 바꾸는 설정을 두지 않는다.
 * Vitest(VITEST=true)에서만 목 백엔드(MSW)를 부른다. 테스트에는 BFF 프록시를 받을 Next.js 서버가 없다. VITEST는 NEXT_PUBLIC_
 * 값이 아니라 브라우저 번들에 박히지 않으므로, 빌드한 앱의 브라우저에서는 늘 BFF 프록시다.
 */
export function browserBaseUrl(): string {
  return process.env.VITEST === 'true' ? MOCK_API_BASE_URL : BFF_PROXY_PATH
}

// .env 파일에 `NAME=`처럼 값 없이 적은 변수는 빈 문자열이 되므로 없는 것으로 본다.
function nonEmpty(value: string | undefined): string | undefined {
  return value === '' ? undefined : value
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}
