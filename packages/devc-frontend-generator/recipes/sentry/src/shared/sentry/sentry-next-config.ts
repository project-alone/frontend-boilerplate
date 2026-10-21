import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'

/**
 * next.config.ts의 설정을 Sentry의 빌드 설정으로 감싼다(next.config.plugins.ts가 가장 바깥에 씌운다). Next.js가 설정을 읽을 때
 * Node.js에서 실행된다.
 *
 * 소스맵은 빌드하는 환경에 Sentry 인증 토큰(SENTRY_AUTH_TOKEN)이 있을 때만 만들어 Sentry에 올리고, 올린 뒤에는 빌드 결과에서
 * 지운다. 토큰이 없으면(개발, GitLab CI 등) 소스맵을 만들지도 올리지도 않아 빌드가 Sentry에 접속하지 않는다. 막지 않으면
 * Sentry가 브라우저용 소스맵을 만들고, 토큰이 없어 올리지 못한 소스맵이 배포 결과에 남아 소스 코드가 드러난다.
 */
export function withSentry(config: NextConfig): NextConfig {
  const uploadSourceMaps = (process.env.SENTRY_AUTH_TOKEN ?? '') !== ''
  return withSentryConfig(
    {
      ...config,
      // 목 빌드(API_MOCKING=enabled로 실행한 next build)인지를 브라우저와 서버의 코드에 박아 둔다. 목 빌드는 배포하지 않으므로
      // DSN이 있어도 SDK를 켜지 않는다(sentry-options.ts).
      env: { ...config.env, SENTRY_MOCK_BUILD: String(process.env.API_MOCKING === 'enabled') },
    },
    {
      // 빌드 도구가 Sentry에 사용 통계를 보내지 않는다.
      telemetry: false,
      sourcemaps: { disable: !uploadSourceMaps },
      // 릴리스(배포 버전)도 소스맵을 올릴 때만 만든다. 조직과 프로젝트는 SENTRY_ORG, SENTRY_PROJECT에서 읽는다.
      release: { create: uploadSourceMaps },
      // 올리지 않을 때는 빌드 도구의 로그를 끈다. 끄지 않으면 CI가 커밋 SHA로 정한 릴리스 이름(GitLab CI의 CI_COMMIT_SHA)을
      // 보고 "인증 토큰이 없어 릴리스를 만들지 않는다"는 경고를 빌드마다 낸다.
      silent: !uploadSourceMaps,
    },
  )
}
