// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/lib/text.test.ts

import { expect, test } from 'vitest'
import { nonEmpty, withoutTrailingSlash } from './text'

test('nonEmpty는 빈 문자열만 없는 값으로 바꾼다', () => {
  expect(nonEmpty('')).toBeUndefined()
  expect(nonEmpty(undefined)).toBeUndefined()
  expect(nonEmpty(' ')).toBe(' ')
  expect(nonEmpty('https://api.example.com')).toBe('https://api.example.com')
})

test('withoutTrailingSlash는 끝의 슬래시를 모두 떼고 가운데의 슬래시는 둔다', () => {
  expect(withoutTrailingSlash('https://api.example.com/v1//')).toBe('https://api.example.com/v1')
  expect(withoutTrailingSlash('https://api.example.com')).toBe('https://api.example.com')
})
