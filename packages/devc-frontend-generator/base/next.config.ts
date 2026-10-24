import type { NextConfig } from 'next'
import { withPlugins } from './config/next.config.plugins'

const nextConfig: NextConfig = {
  // 특정 배포 방식에 묶이지 않도록, 필요한 파일만 모아 Node로 바로 띄우는 서버(.next/standalone)를 함께 만든다.
  // `next start`로도 실행된다(README의 실행과 배포 참고).
  output: 'standalone',
  // 서버의 MSW(msw/node)는 번들에 넣지 않고 node_modules에서 불러온다. 라우트의 번들에 넣으면 MSW가 파일에서 읽는
  // WebAssembly(HTTP 파서)의 경로가 바뀌어, 목 빌드에서 SSG·ISR 페이지가 MSW를 켜지 못한다(src/shared/api/api-mocking.ts).
  serverExternalPackages: ['msw'],
}

// Recipe가 더한 설정 래퍼(예: next-intl, Sentry의 플러그인)를 씌운다(config/next.config.plugins.ts).
export default withPlugins(nextConfig)
