// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/lib/async.test.ts

import { afterEach, expect, test, vi } from 'vitest'
import { delay } from './async'

afterEach(() => {
  vi.useRealTimers()
})

test('delay는 ms가 지나면 끝나고, signal이 abort되면 남은 시간을 기다리지 않는다', async () => {
  vi.useFakeTimers()
  const finished: string[] = []
  const controller = new AbortController()
  void delay(1000).then(() => finished.push('시간이 지남'))
  void delay(1000, controller.signal).then(() => finished.push('abort'))

  controller.abort()
  await vi.advanceTimersByTimeAsync(0)
  expect(finished).toEqual(['abort'])

  await vi.advanceTimersByTimeAsync(1000)
  expect(finished).toEqual(['abort', '시간이 지남'])
})

test('delay는 이미 abort된 signal이면 바로 끝난다', async () => {
  vi.useFakeTimers()
  const controller = new AbortController()
  controller.abort()
  let finished = false
  void delay(1000, controller.signal).then(() => {
    finished = true
  })

  await vi.advanceTimersByTimeAsync(0)
  expect(finished).toBe(true)
})
