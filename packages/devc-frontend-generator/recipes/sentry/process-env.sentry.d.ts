// sentry Recipe가 읽는 환경 변수. TypeScript가 process-env.d.ts의 선언과 합친다(README의 "오류 보고(Sentry)").
declare namespace NodeJS {
  interface ProcessEnv {
    /** 서버가 오류를 보낼 Sentry DSN. 서버를 띄울 때 읽는다. 없으면 서버의 SDK를 초기화하지 않는다(src/shared/sentry/sentry-instrumentation.ts). */
    readonly SENTRY_DSN?: string
    /** 브라우저가 오류를 보낼 Sentry DSN. 빌드할 때 코드에 박힌다. 없으면 브라우저의 SDK를 초기화하지 않는다(src/shared/sentry/sentry-instrumentation-client.ts). */
    readonly NEXT_PUBLIC_SENTRY_DSN?: string
    /** 소스맵을 Sentry에 올릴 인증 토큰. 빌드하는 환경에만 넣는다. 없으면 소스맵을 만들지도 올리지도 않는다(src/shared/sentry/sentry-next-config.ts). */
    readonly SENTRY_AUTH_TOKEN?: string
    /**
     * 환경 변수가 아니라 빌드할 때 next.config가 코드에 박는 값(src/shared/sentry/sentry-next-config.ts). 목 빌드
     * (API_MOCKING=enabled)이면 'true'이고, 그 빌드는 DSN이 있어도 SDK를 켜지 않는다.
     */
    readonly SENTRY_MOCK_BUILD?: 'true' | 'false'
  }
}
