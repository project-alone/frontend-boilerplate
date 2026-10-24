import 'server-only'

/**
 * Next.js 서버가 뜰 때 한 번 실행된다(src/instrumentation.ts가 부른다).
 * API_MOCKING=enabled이면 서버 컴포넌트와 Route Handler가 보내는 요청을 MSW가 받는다.
 * 개발 서버는 .env.development에서, E2E 대상 서버는 config/playwright.config.ts에서 이 값을 켠다.
 * 실제로 배포하는 서버에서는 켜지 않는다(msw는 devDependency다).
 * Next.js가 instrumentation을 실행하지 않는 프로세스(next build의 빌드 워커, 개발 서버가 generateStaticParams를 실행하는
 * 정적 경로 워커)에서는 서버의 apiFetch가 요청을 보내기 전에 MSW를 켠다(api-mocking.ts).
 */
export const apiInstrumentation = {
  async register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return

    if (process.env.API_MOCKING === 'enabled') {
      const { startApiMocking } = await import('./api-mocking')
      await startApiMocking()
      return
    }

    // MSW를 끈 서버는 API_BASE_URL의 백엔드를 부른다. 주소가 없으면 backendBaseUrl()이 여기서 실패해, 서버가
    // 요청을 처리하지 않고 무엇을 넣어야 하는지 알린다.
    const { backendBaseUrl } = await import('./api-fetch.server')
    backendBaseUrl()
  },
}
