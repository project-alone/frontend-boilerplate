import createNextIntlPlugin from 'next-intl/plugin'

/**
 * i18n Recipe의 next.config 래퍼(config/next.config.plugins.ts). next-intl의 서버 API가 쓸 설정 파일(request.ts)을 알린다.
 * 경로는 Starter 최상위 기준이다.
 */
export const withI18n = createNextIntlPlugin('./src/shared/i18n/request.ts')
