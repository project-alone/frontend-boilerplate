// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/lib/json.test.ts

import { expect, test } from 'vitest'
import { parseJson } from './json'

test('parseJson은 JSON을 읽고, 글이 없거나 JSON이 아니면 undefined다', () => {
  expect(parseJson('{"step":1}')).toEqual({ step: 1 })
  expect(parseJson('null')).toBeNull()
  expect(parseJson(null)).toBeUndefined()
  expect(parseJson(undefined)).toBeUndefined()
  expect(parseJson('{')).toBeUndefined()
})
