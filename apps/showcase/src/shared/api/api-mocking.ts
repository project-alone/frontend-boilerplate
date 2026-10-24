// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/api/api-mocking.ts

import 'server-only'

// 서버(Next.js 서버, next build)가 보내는 API 요청을 MSW(msw/node)가 받게 한다(README의 "API 목킹(MSW)").
// API_MOCKING=enabled일 때만 쓰며, MSW는 이때 처음 불러온다. 목을 끈 서버와 빌드는 MSW 코드를 실행하지 않는다.

// 한 프로세스에서 MSW를 켠 결과. 번들마다 이 모듈을 따로 불러와도 MSW를 한 번만 켜도록 모듈 변수 대신 globalThis에 둔다.
const processState = globalThis as typeof globalThis & { starterApiMocking?: Promise<void> }

/** MSW를 켠다. 같은 프로세스에서 이미 켰으면 처음 켠 결과를 기다린다. */
export function startApiMocking(): Promise<void> {
  processState.starterApiMocking ??= import('@/shared/mocks/node').then(({ server }) => {
    const unmockedFetch = globalThis.fetch
    // 핸들러가 없는 요청은 실제 네트워크로 보낸다.
    server.listen({ onUnhandledFrame: 'bypass' })
    if (process.env.NODE_ENV === 'development') keepFetchMocked(unmockedFetch)
  })
  return processState.starterApiMocking
}

/**
 * Next.js 개발 서버가 globalThis.fetch를 MSW를 켜기 전의 fetch로 되돌려도 서버의 fetch 요청을 MSW가 계속 받게 한다.
 *
 * 개발 서버는 고친 코드 때문에 라우트의 서버 번들을 다시 쓰면(새 모듈을 import하거나, 컴파일 오류를 고치거나, .env 파일을 고칠
 * 때 등) fetch에 자기 래퍼를 다시 씌우려고 globalThis.fetch를 서버가 뜰 때 기억해 둔 값으로 되돌린다. 그 값은 instrumentation이
 * MSW를 켜기 전의 fetch라 MSW가 씌운 fetch가 빠진다. 그러면 MSW가 이미 받은 목 백엔드 연결을 keep-alive로 다시 쓰는 몇 초 동안만
 * 응답이 오고, 그 뒤의 요청은 MSW를 거치지 않고 실제 네트워크로 나가 목 백엔드 주소(MOCK_API_BASE_URL)를 찾지 못한다.
 * 그래서 globalThis.fetch에 MSW를 켜기 전의 fetch를 넣는 대입만 MSW가 씌운 fetch로 바꿔 넣고, 다른 값(Next.js가 다시 씌우는
 * 래퍼 등)은 그대로 넣는다.
 */
function keepFetchMocked(unmockedFetch: typeof fetch): void {
  const mockedFetch = globalThis.fetch
  let currentFetch = mockedFetch
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    enumerable: true,
    get: () => currentFetch,
    set: (nextFetch: typeof fetch) => {
      currentFetch = nextFetch === unmockedFetch ? mockedFetch : nextFetch
    },
  })
}

/**
 * 목 빌드(API_MOCKING=enabled로 실행한 next build)이면 MSW를 켠다. 서버의 apiFetch가 요청을 보내기 전에 부른다.
 * Next.js는 빌드할 때 instrumentation을 실행하지 않아 api-instrumentation.ts가 MSW를 켜지 못하므로, 빌드할 때 데이터를
 * 가져오는 SSG·ISR 페이지의 요청은 여기서 켠 MSW가 받는다. MSW는 빌드 프로세스와 함께 끝나 빌드 결과를 띄운 서버(next start)에는
 * 남지 않는다. 다만 미리 렌더링한 페이지에는 목 응답이 담기므로 목 빌드의 결과는 배포하지 않는다(README의 "실행과 배포").
 */
export async function startBuildApiMocking(): Promise<void> {
  // NEXT_PHASE는 next build가 빌드 워커까지 넣는 단계 이름이다(next/constants의 PHASE_PRODUCTION_BUILD).
  if (process.env.NEXT_PHASE !== 'phase-production-build' || process.env.API_MOCKING !== 'enabled') return
  if (processState.starterApiMocking === undefined) {
    console.warn(
      'API_MOCKING=enabled로 빌드합니다. 빌드할 때 서버 컴포넌트가 보내는 API 요청을 MSW가 받아, 미리 렌더링한 페이지에 목 응답이 담깁니다. 이 빌드 결과는 배포하지 마세요(README의 "실행과 배포").',
    )
  }
  await startApiMocking()
}
