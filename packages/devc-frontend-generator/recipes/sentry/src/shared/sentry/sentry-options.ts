// 브라우저와 서버의 Sentry SDK가 함께 쓰는 초기화 조건과 설정(README의 "오류 보고(Sentry)").

/**
 * SDK를 초기화할 DSN. 배포용 빌드와 그 결과를 띄운 서버(NODE_ENV=production)이고 DSN이 있을 때만 돌려준다.
 * undefined이면 SDK를 초기화하지 않으므로 Sentry로 아무것도 보내지 않는다. 그래서 개발 서버(next dev)와 테스트(Vitest)는
 * DSN을 넣어 두어도 보내지 않는다.
 */
export function sentryDsn(dsn: string | undefined): string | undefined {
  return process.env.NODE_ENV === 'production' && dsn !== undefined && dsn !== '' ? dsn : undefined
}

/** 브라우저와 서버가 함께 쓰는 SDK 설정. 성능 추적(tracesSampleRate)과 Session Replay는 켜지 않는다. */
export const SENTRY_OPTIONS = {
  // 사용자의 IP 주소, 쿠키, 요청 헤더 같은 개인정보를 이벤트에 담지 않는다(Sentry의 기본값을 드러내 적어 둔다).
  sendDefaultPii: false,
} as const
