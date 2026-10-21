// 브라우저와 서버의 Sentry SDK가 함께 쓰는 초기화 조건과 설정(README의 "오류 보고(Sentry)").

/**
 * dsn으로 SDK를 켜도 되면 dsn을, 아니면 undefined를 돌려준다. undefined이면 SDK를 초기화하지 않으므로 Sentry로 아무것도
 * 보내지 않는다. SDK는 배포용 빌드와 그 결과를 띄운 서버(NODE_ENV=production)에서 DSN이 있을 때만 켠다.
 * - 개발 서버(next dev)와 테스트(Vitest)는 DSN을 넣어 두어도 켜지 않는다.
 * - 목 빌드(API_MOCKING=enabled로 실행한 next build. E2E와 GitLab CI의 build 잡)는 배포하지 않으므로 켜지 않는다. 빌드할 때
 *   sentry-next-config.ts가 SENTRY_MOCK_BUILD를 코드에 박아 두므로, 빌드하는 환경에 DSN이 있어도 E2E는 보내지 않는다.
 */
export function enabledSentryDsn(dsn: string | undefined): string | undefined {
  if (process.env.NODE_ENV !== 'production' || process.env.SENTRY_MOCK_BUILD === 'true') return undefined
  return dsn === '' ? undefined : dsn
}

/** 브라우저와 서버가 함께 쓰는 SDK 설정. 성능 추적(tracesSampleRate)과 Session Replay는 켜지 않는다. */
export const SENTRY_OPTIONS = {
  // 사용자의 IP 주소, 쿠키, 요청 헤더 같은 개인정보를 이벤트에 담지 않는다(Sentry의 기본값을 드러내 적어 둔다).
  sendDefaultPii: false,
} as const
