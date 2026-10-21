// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/mocks/mock-readiness.test.ts

import { expect, test } from 'vitest'
import { setMockReadiness, waitForMocks } from './mock-readiness'

// 테스트는 순서대로 실행되고, 앞의 테스트가 알린 약속은 페이지(globalThis)에 남는다.

test('브라우저의 MSW를 켜지 않았으면 바로 끝난다', async () => {
  await expect(waitForMocks()).resolves.toBeUndefined()
})

test('MSW를 켜는 쪽이 알린 약속이 끝날 때까지 기다린다', async () => {
  const { promise, resolve } = Promise.withResolvers<undefined>()
  setMockReadiness(promise)
  let ready = false

  const waiting = waitForMocks().then(() => {
    ready = true
  })
  await Promise.resolve()
  expect(ready).toBe(false)

  resolve(undefined)
  await waiting
  expect(ready).toBe(true)
})

test('서비스 워커를 띄우지 못하면 그 오류로 실패한다', async () => {
  const failure = Promise.reject(new Error('서비스 워커를 등록하지 못했습니다.'))
  failure.catch(() => undefined)
  setMockReadiness(failure)

  await expect(waitForMocks()).rejects.toThrow('서비스 워커를 등록하지 못했습니다.')
})
