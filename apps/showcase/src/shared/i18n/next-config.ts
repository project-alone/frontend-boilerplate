// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/src/shared/i18n/next-config.ts

import createNextIntlPlugin from 'next-intl/plugin'

/**
 * i18n Recipe의 next.config 래퍼(next.config.plugins.ts). next-intl의 서버 API가 쓸 설정 파일(request.ts)을 알린다.
 * 경로는 Starter 최상위 기준이다.
 */
export const withI18n = createNextIntlPlugin('./src/shared/i18n/request.ts')
