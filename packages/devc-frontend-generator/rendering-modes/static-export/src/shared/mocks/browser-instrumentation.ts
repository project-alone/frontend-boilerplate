/**
 * 브라우저에서 앱 코드보다 먼저 한 번 실행된다(src/instrumentation-client.ts가 부른다).
 * NEXT_PUBLIC_API_MOCKING=enabled로 만든 빌드(개발 서버, E2E)에서는 브라우저가 백엔드로 보내는 API 요청을 MSW 서비스 워커가
 * 받는다. 이 값은 빌드할 때 코드에 박히므로, 이 값 없이 만든 배포용 빌드에서는 아래 if 안의 코드와 MSW가 빌드 결과에서 빠진다.
 * 조기 return으로 바꾸면 빌드가 MSW를 덜어 내지 못하므로 if로 감싼다.
 */
export const browserMockingInstrumentation = {
  register() {
    if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') {
      // 서비스 워커가 준비되기 전에 나간 요청은 MSW가 받지 못하고 실제 네트워크로 나간다. 그래서 준비될 때까지 fetch를
      // 붙잡아 두었다가, 준비되면 원래 fetch로 되돌린다. 서비스 워커를 띄우지 못하면 붙잡아 둔 요청도 그 오류로 실패한다.
      const originalFetch = window.fetch.bind(window)
      const mocking = import('./browser').then(({ worker }) =>
        // 핸들러가 없는 요청은 실제 네트워크로 보낸다.
        worker.start({ onUnhandledFrame: 'bypass' }),
      )
      window.fetch = async (...args) => {
        await mocking
        return originalFetch(...args)
      }
      void mocking.then(() => {
        window.fetch = originalFetch
      })
    }
  },
}
