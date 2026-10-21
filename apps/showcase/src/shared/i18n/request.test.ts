// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/src/shared/i18n/request.test.ts

import { expect, test } from 'vitest'
import { MESSAGES } from './messages'
import { i18nRequestConfig } from './request'

test('서버 컴포넌트가 넘긴 locale의 메시지와 시간대로 번역한다', () => {
  expect(i18nRequestConfig('en')).toEqual({ locale: 'en', messages: MESSAGES.en, timeZone: 'Asia/Seoul' })
})

test('locale 없이 부르면 기본 locale로 조용히 그리지 않고, locale을 넘기라고 알리며 실패한다', () => {
  expect(() => i18nRequestConfig(undefined)).toThrow('getTranslations({ locale, namespace })')
})

test('지원하지 않는 locale은 받지 않는다', () => {
  expect(() => i18nRequestConfig('fr')).toThrow('fr')
})
