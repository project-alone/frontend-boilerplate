// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/lib/http.test.ts

import { expect, test } from 'vitest'
import { parseBody, readJsonBody, searchParamsOf } from './http'

test('parseBody는 JSON 응답을 JSON으로, 다른 응답을 글 그대로 읽고, 본문이 없으면 undefined다', () => {
  expect(parseBody('{"id":1}', 'application/json; charset=utf-8')).toEqual({ id: 1 })
  expect(parseBody('{"id":1}', 'application/problem+json')).toEqual({ id: 1 })
  expect(parseBody('완료', 'text/plain')).toBe('완료')
  expect(parseBody('완료', null)).toBe('완료')
  expect(parseBody('', 'application/json')).toBeUndefined()
  expect(() => parseBody('{', 'application/json')).toThrow(SyntaxError)
})

test('readJsonBody는 요청 본문을 JSON으로 읽고, 본문이 없거나 JSON이 아니면 undefined다', async () => {
  const post = (body: string | null = null) => new Request('https://mock.api.test/items', { method: 'POST', body })

  expect(await readJsonBody(post('{"name":"하늘"}'))).toEqual({ name: '하늘' })
  expect(await readJsonBody(post('이름'))).toBeUndefined()
  expect(await readJsonBody(post())).toBeUndefined()
})

test('searchParamsOf는 쿼리 파라미터를 객체로 읽고, 숫자 파라미터만 숫자로 바꾼다', () => {
  const url = new URL('https://mock.api.test/items?q=12&page=2&pageSize=10')

  expect(searchParamsOf(url, ['page', 'pageSize', 'missing'])).toEqual({ q: '12', page: 2, pageSize: 10 })
  expect(searchParamsOf(url)).toEqual({ q: '12', page: '2', pageSize: '10' })
})
