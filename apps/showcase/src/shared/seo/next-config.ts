// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/shared/seo/next-config.ts

import type { NextConfig } from 'next'

// 공유 이미지의 글꼴(pretendard-bold.woff)은 og-image.tsx가 읽으므로 server Starter의 빌드 결과(.next/standalone)에 함께 담기고,
// 그 결과로 만든 컨테이너 이미지와 함께 나눠 주게 된다. SIL Open Font License는 글꼴을 나눠 줄 때 저작권 표시와 라이선스를
// 함께 담게 하므로, 글꼴을 쓰는 공유 이미지 라우트의 빌드 결과에 라이선스 파일도 담는다.
const FONT_LICENSE = './src/shared/seo/pretendard-license.txt'
const OG_IMAGE_ROUTES = '/**/opengraph-image/**'

/** seo Recipe의 next.config 래퍼(확장 지점 nextConfig, next.config.plugins.ts). 빌드 결과에 글꼴의 라이선스를 함께 담는다. */
export function withSeo(config: NextConfig): NextConfig {
  const includes = config.outputFileTracingIncludes ?? {}
  return {
    ...config,
    outputFileTracingIncludes: { ...includes, [OG_IMAGE_ROUTES]: [...(includes[OG_IMAGE_ROUTES] ?? []), FONT_LICENSE] },
  }
}
