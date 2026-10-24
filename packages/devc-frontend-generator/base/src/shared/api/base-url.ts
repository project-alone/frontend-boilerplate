// API 요청을 보낼 곳(ADR-0006). 서버는 백엔드를(api-fetch.server.ts의 backendBaseUrl), 브라우저는 BFF 프록시를 부른다.
// 브라우저 코드, MSW 핸들러, 테스트가 함께 쓰므로 서버에서만 쓰는 값은 두지 않는다.

/** 브라우저의 API 요청을 백엔드로 전달하는 BFF 프록시의 경로(src/app/api/proxy/[...path]/route.ts) */
export const BFF_PROXY_PATH = '/api/proxy'

/**
 * 목 백엔드(MSW)의 주소. MSW가 켜져 있고 백엔드 주소가 없으면 API 요청을 이 주소로 보내고, MSW 핸들러(src/shared/mocks/handlers.ts)는
 * 이 주소로 가는 요청만 받는다(orval.config.ts가 생성된 핸들러를 이 주소로 만든다). 앱과 다른 출처라 핸들러가 페이지 주소
 * (/products 등)와 겹치지 않으므로, 브라우저의 MSW(서비스 워커)가 페이지를 열거나 새로 고치는 요청에 목 응답을 돌려주지 않는다.
 * .test는 실제로 쓰이지 않도록 남겨 둔 최상위 도메인(RFC 6761)이라 MSW가 받지 않은 요청은 어디에도 닿지 않는다.
 */
export const MOCK_API_BASE_URL = 'https://mock.api.test'

/**
 * 브라우저가 API를 부를 때 쓰는 주소. 브라우저의 요청은 늘 BFF 프록시를 거쳐 서버에서 백엔드로 나간다. 브라우저가 백엔드를
 * 직접 부르면 BFF가 붙이는 것(auth Recipe의 토큰 등)이 빠지므로 주소를 바꾸는 설정을 두지 않는다.
 * Vitest(VITEST=true)에서만 목 백엔드(MSW)를 부른다. 테스트에는 BFF 프록시를 받을 Next.js 서버가 없다. VITEST는 NEXT_PUBLIC_
 * 값이 아니라 브라우저 번들에 박히지 않으므로, 빌드한 앱의 브라우저에서는 늘 BFF 프록시다.
 */
export function browserBaseUrl(): string {
  return process.env.VITEST === 'true' ? MOCK_API_BASE_URL : BFF_PROXY_PATH
}
