import 'server-only'

// 서버(Next.js 서버와 그 워커, next build)가 보내는 API 요청을 MSW(msw/node)가 받게 한다(README의 "API 목킹(MSW)").
// API_MOCKING=enabled일 때만 쓰며, MSW는 이때 처음 불러온다. 목을 끈 서버와 빌드는 MSW 코드를 실행하지 않는다.

// 한 프로세스에서 MSW를 켠 결과. 번들마다 이 모듈을 따로 불러와도 MSW를 한 번만 켜도록 모듈 변수 대신 globalThis에 둔다.
const processState = globalThis as typeof globalThis & { starterApiMocking?: Promise<void> }

/** MSW를 켠다. 같은 프로세스에서 이미 켰으면 처음 켠 결과를 기다린다. */
export function startApiMocking(): Promise<void> {
  processState.starterApiMocking ??= import('@/shared/mocks/node').then(({ server }) => {
    const unmockedFetch = globalThis.fetch
    // 핸들러가 없는 요청은 실제 네트워크로 보낸다.
    server.listen({ onUnhandledFrame: 'bypass' })
    if (process.env.NODE_ENV !== 'development') return
    // Next.js 개발 서버가 globalThis.fetch를 MSW를 켜기 전의 fetch로 되돌려도 서버의 fetch 요청을 MSW가 계속 받게 한다.
    //
    // 개발 서버는 고친 코드 때문에 라우트의 서버 번들을 다시 쓰면(새 모듈을 import하거나, 컴파일 오류를 고치거나, .env 파일을 고칠
    // 때 등) fetch에 자기 래퍼를 다시 씌우려고 globalThis.fetch를 서버가 뜰 때 기억해 둔 값으로 되돌린다. 그 값은 instrumentation이
    // MSW를 켜기 전의 fetch라 MSW가 씌운 fetch가 빠진다. 그러면 MSW가 이미 받은 목 백엔드 연결을 keep-alive로 다시 쓰는 몇 초 동안만
    // 응답이 오고, 그 뒤의 요청은 MSW를 거치지 않고 실제 네트워크로 나가 목 백엔드 주소(MOCK_API_BASE_URL)를 찾지 못한다.
    // 그래서 globalThis.fetch에 MSW를 켜기 전의 fetch를 넣는 대입만 MSW가 씌운 fetch로 바꿔 넣고, 다른 값(Next.js가 다시 씌우는
    // 래퍼 등)은 그대로 넣는다.
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
  })
  return processState.starterApiMocking
}

/**
 * API_MOCKING=enabled이면 이 프로세스에서 MSW를 켠다. 서버의 apiFetch가 요청을 보내기 전에 부른다.
 * Next.js는 instrumentation을 실행하지 않는 프로세스에서도 서버 코드를 실행한다. next build의 빌드 워커가 SSG·ISR 페이지를
 * 미리 렌더링하고, 개발 서버는 generateStaticParams를 서버와 다른 프로세스(정적 경로 워커)에서 실행한다. 그 프로세스에서는
 * api-instrumentation.ts가 MSW를 켜지 못하므로 여기서 켜고, instrumentation이 이미 켠 프로세스(개발 서버, next start)에서는 그
 * 결과를 기다리기만 한다. 목 빌드(API_MOCKING=enabled로 실행한 next build)의 MSW는 빌드 프로세스와 함께 끝나 빌드 결과를 띄운
 * 서버(next start)에는 남지 않는다. 다만 미리 렌더링한 페이지에는 목 응답이 담기므로 목 빌드의 결과는 배포하지 않는다(README의
 * "실행과 배포").
 */
export async function startApiMockingIfEnabled(): Promise<void> {
  // Vitest는 설정 파일(config/vitest.setup.ts)이 MSW를 켜 둔다. 켜져 있는 MSW를 다시 켜면 MSW가 오류를 던지므로 여기서는 켜지 않는다.
  if (process.env.API_MOCKING !== 'enabled' || process.env.VITEST === 'true') return
  // 목 빌드의 경고는 next build에서만, 빌드 워커마다 한 번 남긴다. NEXT_PHASE는 next build가 빌드 워커까지 넣는 단계 이름이다
  // (next/constants의 PHASE_PRODUCTION_BUILD).
  if (process.env.NEXT_PHASE === 'phase-production-build' && processState.starterApiMocking === undefined) {
    console.warn(
      'API_MOCKING=enabled로 빌드합니다. 빌드할 때 서버 컴포넌트가 보내는 API 요청을 MSW가 받아, 미리 렌더링한 페이지에 목 응답이 담깁니다. 이 빌드 결과는 배포하지 마세요(README의 "실행과 배포").',
    )
  }
  await startApiMocking()
}
