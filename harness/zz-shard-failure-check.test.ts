import { expect, it } from 'vitest'

// #104 확인용 임시 파일. 머지하지 않는다.
it('fails on purpose so that one harness shard fails', () => {
  expect(1).toBe(2)
})
