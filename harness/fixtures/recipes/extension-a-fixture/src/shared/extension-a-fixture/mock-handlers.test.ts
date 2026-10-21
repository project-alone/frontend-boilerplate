import { afterEach, expect, test, vi } from 'vitest'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import { getBeta } from '@/shared/api/generated'

// 이 파일은 브라우저(jsdom)에서 실행된다. 요청은 MSW가 Starter의 핸들러 목록(src/shared/mocks/handlers.ts)으로 받는다.
// 확장 지점 mockHandlers: b(order 100) → a(order 200)의 핸들러가 명세에서 생성된 핸들러보다 앞에 놓인다.
afterEach(() => {
  vi.unstubAllEnvs()
})

test('Recipe가 직접 만든 핸들러는 생성된 핸들러보다 앞에 놓여 같은 요청을 덮어쓰고, 나머지 요청은 생성된 핸들러가 받는다', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', MOCK_API_BASE_URL)

  expect(await getBeta(42)).toEqual({ id: 42, label: 'a가 덮어쓴 베타' })
  expect(await getBeta(7)).toEqual({ id: 7, label: '베타' })
})

test('여러 Recipe의 핸들러는 order 순으로 놓여, 같은 요청에는 order가 작은 Recipe의 핸들러가 응답한다', async () => {
  const response = await fetch(`${MOCK_API_BASE_URL}/fixture-mock-order`)

  expect(await response.json()).toBe('b')
})
