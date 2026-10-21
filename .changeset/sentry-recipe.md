---
"devc-frontend-generator": minor
---

`sentry` Recipe를 더한다(`dcgen new --recipe sentry`, `server`와 `static-export`). `@sentry/nextjs`로 브라우저에서 처리하지 못한 오류와, 서버가 요청을 처리하다 난 오류(`onRequestError`)를 Sentry에 보낸다. 확장 지점(`next.config`의 `withSentryConfig`, instrumentation, instrumentation-client)에 조각만 더하고 Base 파일은 고치지 않는다. SDK는 `NODE_ENV`가 `production`이고 DSN(`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`)이 있을 때만 초기화하므로 DSN이 없거나 개발 서버·테스트에서는 아무것도 보내지 않는다. 소스맵은 빌드하는 환경에 `SENTRY_AUTH_TOKEN`이 있을 때만 만들어 올리고, 빌드 도구의 사용 통계 전송은 끈다. `static-export`에서는 브라우저의 오류만 보낸다.
