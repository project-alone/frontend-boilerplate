// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/extensions.json, recipes/sentry/extensions.json, recipes/seo/extensions.json

import type { NextConfig } from 'next'
import { withI18n } from '../src/shared/i18n/next-config'
import { withSentry } from '../src/shared/sentry/sentry-next-config'
import { withSeo } from '../src/shared/seo/next-config'

// Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 만든 파일이다. 이제는 이 프로젝트의 코드이므로 직접 고친다.
// next.config.ts의 설정을 감싸는 래퍼(예: next-intl, Sentry의 플러그인). Provider처럼 위에 적힌 래퍼가 바깥을 감싼다.
// 그래서 아래의 래퍼부터 차례로 씌운다.
const plugins: readonly ((config: NextConfig) => NextConfig)[] = [withSentry, withI18n, withSeo]

/** next.config.ts가 설정을 내보내기 전에 래퍼를 씌운다. */
export function withPlugins(config: NextConfig): NextConfig {
  return plugins.reduceRight((wrapped, plugin) => plugin(wrapped), config)
}
