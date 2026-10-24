import { expect, test } from 'vitest'
import { parseJson } from './json'

test('parseJson은 JSON을 읽고, 글이 없거나 JSON이 아니면 undefined다', () => {
  expect(parseJson('{"step":1}')).toEqual({ step: 1 })
  expect(parseJson('null')).toBeNull()
  expect(parseJson(null)).toBeUndefined()
  expect(parseJson(undefined)).toBeUndefined()
  expect(parseJson('{')).toBeUndefined()
})
