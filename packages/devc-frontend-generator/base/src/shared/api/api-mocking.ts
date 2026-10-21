// 서버(Next.js 서버, next build)가 보내는 API 요청을 MSW(msw/node)가 받게 한다(README의 "API 목킹(MSW)").
// API_MOCKING=enabled일 때만 쓰며, MSW는 이때 처음 불러온다. 목을 끈 서버와 빌드는 MSW 코드를 실행하지 않는다.
// 서버에서만 쓰는 모듈이다. 브라우저 번들에 들어가지 않도록 서버에서만 실행되는 코드에서 동적 import로 불러온다(api-fetch.ts).

// 한 프로세스에서 MSW를 켠 결과. 번들마다 이 모듈을 따로 불러와도 MSW를 한 번만 켜도록 모듈 변수 대신 globalThis에 둔다.
const processState = globalThis as typeof globalThis & { starterApiMocking?: Promise<void> }

/** MSW를 켠다. 같은 프로세스에서 이미 켰으면 처음 켠 결과를 기다린다. */
export function startApiMocking(): Promise<void> {
  processState.starterApiMocking ??= import('@/shared/mocks/node').then(({ server }) => {
    // 핸들러가 없는 요청은 실제 네트워크로 보낸다.
    server.listen({ onUnhandledFrame: 'bypass' })
  })
  return processState.starterApiMocking
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
