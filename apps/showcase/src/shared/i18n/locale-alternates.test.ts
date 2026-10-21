// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/src/shared/i18n/locale-alternates.test.ts

import { expect, test } from 'vitest'
import { localeAlternates } from './locale-alternates'

test('번역한 페이지는 자기 주소를 canonical로, 같은 페이지의 locale별 주소를 언어별 주소로 알린다', () => {
  expect(localeAlternates('/')).toEqual({ canonical: './', languages: { ko: '/ko', en: '/en' } })
  expect(localeAlternates('/i18n')).toEqual({ canonical: './', languages: { ko: '/ko/i18n', en: '/en/i18n' } })
})
