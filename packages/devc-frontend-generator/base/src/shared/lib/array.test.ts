import { expect, test } from 'vitest'
import { range, slicePage } from './array'

test('range는 from부터 to까지의 정수이고, to가 from보다 작으면 비어 있다', () => {
  expect(range(1, 4)).toEqual([1, 2, 3, 4])
  expect(range(3, 3)).toEqual([3])
  expect(range(3, 2)).toEqual([])
})

test('slicePage는 1부터 센 쪽의 항목을 자르고, 마지막 쪽 뒤의 쪽은 비어 있다', () => {
  const items = range(1, 25)

  expect(slicePage(items, 1, 10)).toEqual(range(1, 10))
  expect(slicePage(items, 3, 10)).toEqual(range(21, 25))
  expect(slicePage(items, 4, 10)).toEqual([])
})
