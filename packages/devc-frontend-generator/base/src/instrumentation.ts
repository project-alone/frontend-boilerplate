// Next.js 서버가 뜰 때 한 번 실행된다.
// API_MOCKING=enabled이면 서버 컴포넌트와 Route Handler가 보내는 요청을 MSW가 받는다.
// 개발 서버는 .env.development에서, E2E 대상 서버는 playwright.config.ts에서 이 값을 켠다.
// 실제로 배포하는 서버에서는 켜지 않는다(msw는 devDependency다).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.API_MOCKING === 'enabled') {
    const { server } = await import('@/shared/mocks/node')
    // 핸들러가 없는 요청은 실제 네트워크로 보낸다.
    server.listen({ onUnhandledFrame: 'bypass' })
  }
}
