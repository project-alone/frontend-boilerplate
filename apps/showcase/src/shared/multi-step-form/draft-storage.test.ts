// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/multi-step-form/src/shared/multi-step-form/draft-storage.test.ts

import { afterEach, expect, test, vi } from 'vitest'
import { readDraft, removeDraft, writeDraft } from './draft-storage'

const KEY = 'sample-draft'

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

test('저장한 단계와 값을 그대로 읽고, 지우면 읽을 것이 없다', () => {
  writeDraft(KEY, 2, { name: '하늘상회', count: 3, agreed: true })

  expect(readDraft(KEY)).toEqual({ step: 2, values: { name: '하늘상회', count: 3, agreed: true } })

  removeDraft(KEY)

  expect(readDraft(KEY)).toBeUndefined()
})

test('비운 숫자 입력(NaN)처럼 입력 요소에 넣을 수 없는 값은 읽을 때 뺀다', () => {
  writeDraft(KEY, 0, { name: '하늘상회', count: Number.NaN })
  sessionStorage.setItem(
    'edited-draft',
    JSON.stringify({ step: 1, values: { name: '하늘상회', tags: ['a'], address: { city: '서울' }, memo: null } }),
  )

  expect(readDraft(KEY)).toEqual({ step: 0, values: { name: '하늘상회' } })
  expect(readDraft('edited-draft')).toEqual({ step: 1, values: { name: '하늘상회' } })
})

test('JSON이 아니거나 모양이 다른 값은 저장한 것이 없는 것으로 본다', () => {
  for (const stored of ['{', '"text"', JSON.stringify({ step: -1, values: {} }), JSON.stringify({ step: 1 })]) {
    sessionStorage.setItem(KEY, stored)

    expect(readDraft(KEY), stored).toBeUndefined()
  }
})

test('저장소를 쓸 수 없으면(용량 초과, 저장소를 막은 브라우저) 오류 없이 넘어가고 읽을 것이 없다', () => {
  const denied = () => {
    throw new DOMException('저장소를 쓸 수 없습니다', 'SecurityError')
  }
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied)
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied)
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied)

  expect(() => {
    writeDraft(KEY, 1, { name: '하늘상회' })
    removeDraft(KEY)
  }).not.toThrow()
  expect(readDraft(KEY)).toBeUndefined()
})
