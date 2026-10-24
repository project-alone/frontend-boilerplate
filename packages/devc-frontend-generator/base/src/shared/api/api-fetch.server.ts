import 'server-only'
import { startBuildApiMocking } from './api-mocking'
import { backendFetch } from './backend-fetch'
import { MOCK_API_BASE_URL } from './base-url'

// 서버(서버 컴포넌트, Route Handler, proxy)가 백엔드로 보내는 API 요청(ADR-0006). apiFetch가 package.json의 imports
// (`#api-fetch.server`)로 불러오고, BFF 프록시(bff-proxy.ts)와 서버가 뜰 때의 설정 확인(api-instrumentation.ts)도 백엔드 주소를 여기서 얻는다.

/**
 * 서버가 백엔드를 직접 부를 때 쓰는 주소. BFF 프록시도 이 주소로 전달한다.
 * 서버에서만 읽는 환경 변수 API_BASE_URL에서 가져온다. API_BASE_URL이 없으면 MSW가 켜져 있을 때(API_MOCKING=enabled)만
 * MOCK_API_BASE_URL을 쓰고, MSW가 꺼져 있으면 엉뚱한 곳을 부르지 않도록 실패한다.
 * 서버가 뜰 때 api-instrumentation.ts가 한 번 불러서, 설정이 빠졌으면 요청을 받기 전에 알린다. next build에서는
 * 빌드할 때 데이터를 가져오는 페이지(SSG·ISR)가 부를 때 실패해 빌드를 멈춘다.
 */
export function backendBaseUrl(): string {
  const url = process.env.API_BASE_URL
  // .env 파일에 `NAME=`처럼 값 없이 적은 변수는 빈 문자열이 되므로 없는 것으로 본다.
  if (url !== undefined && url !== '') return url.replace(/\/+$/, '')
  if (process.env.API_MOCKING === 'enabled') return MOCK_API_BASE_URL
  // NEXT_PHASE는 next build가 넣는 단계 이름이다(next/constants의 PHASE_PRODUCTION_BUILD).
  throw new Error(
    process.env.NEXT_PHASE === 'phase-production-build'
      ? 'API_BASE_URL 환경 변수가 없습니다. 빌드할 때 데이터를 가져오는 페이지(SSG·ISR)는 API_BASE_URL의 백엔드를 부르므로, 배포용 빌드에는 백엔드 주소를 넣어 주세요. 배포하지 않는 검사용 빌드(GitLab CI의 build 잡 등)는 API_MOCKING=enabled로 목 응답을 받아 빌드합니다(README의 "실행과 배포").'
      : 'API_BASE_URL 환경 변수가 없습니다. MSW를 끈(API_MOCKING이 enabled가 아닌) 서버는 API_BASE_URL의 백엔드를 부르므로 백엔드 주소를 넣어 주세요(README의 "API 계층").',
  )
}

/**
 * 서버에서 부른 apiFetch의 요청을 백엔드로 보낸다(api-fetch.ts). 목 빌드(API_MOCKING=enabled로 실행한 next build)이면 보내기
 * 전에 MSW를 켜고(api-mocking.ts), Recipe가 더한 처리기(backend-fetch.ts, 예: auth의 토큰 첨부)를 거쳐 보낸다.
 */
export async function fetchFromServer(path: string, init: RequestInit): Promise<Response> {
  await startBuildApiMocking()
  return backendFetch(`${backendBaseUrl()}${path}`, init)
}
