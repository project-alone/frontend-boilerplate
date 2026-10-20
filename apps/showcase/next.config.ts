// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/next.config.ts

import type { NextConfig } from 'next'
import { withPlugins } from './next.config.plugins'

const nextConfig: NextConfig = {
  // 특정 배포 방식에 묶이지 않도록, 필요한 파일만 모아 Node로 바로 띄우는 서버(.next/standalone)를 함께 만든다.
  // `next start`로도 실행된다(README의 실행과 배포 참고).
  output: 'standalone',
}

// Recipe가 더한 설정 래퍼(예: next-intl, Sentry의 플러그인)를 씌운다(next.config.plugins.ts).
export default withPlugins(nextConfig)
