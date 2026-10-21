import { setMockReadiness } from './mock-readiness'

/**
 * 브라우저에서 앱 코드보다 먼저 한 번 실행된다(src/instrumentation-client.ts가 부른다).
 * NEXT_PUBLIC_API_MOCKING=enabled로 만든 빌드(개발 서버, E2E)에서는 브라우저가 백엔드로 보내는 API 요청을 MSW 서비스 워커가
 * 받는다. 이 값은 빌드할 때 코드에 박히므로, 이 값 없이 만든 배포용 빌드에서는 아래 if 안의 코드와 MSW가 빌드 결과에서 빠진다.
 * 조기 return으로 바꾸면 빌드가 MSW를 덜어 내지 못하므로 if로 감싼다.
 */
export const browserMockingInstrumentation = {
  register() {
    if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') {
      // 서비스 워커가 준비되기 전에 나간 요청은 MSW가 받지 못하고 실제 네트워크로 나간다. 준비되면 끝나는 약속을 알려
      // (mock-readiness.ts) fetch를 쓰지 않는 요청(XMLHttpRequest 등)은 waitForMocks()로 기다리게 하고, fetch는 준비될 때까지
      // 붙잡아 두었다가 준비되면 원래 fetch로 되돌린다. 서비스 워커를 띄우지 못하면 기다리던 요청도 그 오류로 실패한다.
      const originalFetch = window.fetch.bind(window)
      const ready = import('./browser').then(async ({ worker }) => {
        // 핸들러가 없는 요청은 실제 네트워크로 보낸다.
        await worker.start({ onUnhandledFrame: 'bypass' })
      })
      setMockReadiness(ready)
      window.fetch = async (...args) => {
        await ready
        return originalFetch(...args)
      }
      void ready.then(() => {
        window.fetch = originalFetch
      })
    }
  },
}
