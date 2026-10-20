// Starter가 읽는 환경 변수. tsconfig의 noPropertyAccessFromIndexSignature 때문에 선언하지 않은 이름은
// process.env.<이름>으로 읽을 수 없다. 대괄호 표기로 바꾸지 않고 여기에 선언하는 것은 Next.js가
// process.env.NEXT_RUNTIME 같은 점 표기를 빌드할 때 값으로 바꿔 런타임별로 쓰지 않는 코드를 덜어 내기 때문이다.
// 환경 변수를 새로 읽으면 여기에 함께 적는다.
declare namespace NodeJS {
  interface ProcessEnv {
    /** Next.js가 넣는 서버 런타임 이름 */
    readonly NEXT_RUNTIME?: 'nodejs' | 'edge'
    /** enabled이면 Next.js 서버가 보내는 API 요청을 MSW가 받는다(src/instrumentation.ts). */
    readonly API_MOCKING?: 'enabled' | 'disabled'
    /** 서버(서버 컴포넌트, BFF 프록시)가 부르는 백엔드 주소(src/shared/api/base-url.ts). API_MOCKING이 enabled가 아니면 꼭 넣는다. */
    readonly API_BASE_URL?: string
    /** 브라우저가 BFF 프록시 대신 직접 부를 백엔드 주소. 서버가 없는 static-export에서 쓴다(src/shared/api/base-url.ts). */
    readonly NEXT_PUBLIC_API_BASE_URL?: string
    /** enabled로 빌드하면 브라우저의 API 요청을 MSW 서비스 워커가 받는다. static-export에서 쓴다(src/instrumentation-client.ts). */
    readonly NEXT_PUBLIC_API_MOCKING?: 'enabled' | 'disabled'
    /** E2E 대상 서버의 포트(playwright.config.ts). 없으면 3100을 쓴다. */
    readonly E2E_PORT?: string
    /** CI 서비스가 넣는다. 있으면 E2E에서 test.only를 막고 서버를 매번 새로 띄운다. */
    readonly CI?: string
  }
}
