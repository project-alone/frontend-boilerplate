// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/src/shared/i18n/routing.ts

import { defineRouting } from 'next-intl/routing'

/*
 * 다국어 라우팅(next-intl). 번역한 페이지는 src/app/[locale]/ 아래에 두고 주소 앞에 늘 locale이 붙는다(/ko, /en/i18n).
 * [locale] 밖의 페이지(Base의 /products, 다른 Recipe의 페이지)는 번역하지 않은 페이지로, 주소와 화면이 그대로다.
 */
export const routing = defineRouting({
  locales: ['ko', 'en'],
  // 주소의 locale, 저장한 locale(NEXT_LOCALE 쿠키), 브라우저 언어(Accept-Language) 가운데 맞는 것이 없을 때 쓴다.
  defaultLocale: 'ko',
  // 번역한 페이지만 [locale] 아래에 있으므로, locale이 없는 주소를 기본 locale의 페이지로 보거나 그쪽으로 보내지 않는다.
  localePrefix: 'always',
  // next-intl proxy가 응답 헤더로 보내는 hreflang 링크는 locale이 없는 주소(x-default)도 가리키는데, 이 Starter에서 그런
  // 주소는 홈(/) 말고는 번역한 페이지로 이어지지 않는다. 검색 엔진에 locale별 주소를 알리려면 페이지의 metadata에 적는다.
  alternateLinks: false,
})

export type Locale = (typeof routing.locales)[number]

/** locale 전환 UI에 보이는 언어 이름. 고르는 사람이 알아볼 수 있게 그 언어로 적고, 번역하지 않는다. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = {
  ko: '한국어',
  en: 'English',
}
