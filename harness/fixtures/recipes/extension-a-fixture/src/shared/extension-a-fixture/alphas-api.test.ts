import { afterEach, expect, test, vi } from 'vitest'
import { listAlphas } from '@/shared/api/generated'

// 이 파일은 브라우저(jsdom)에서 실행된다. 두 Rendering Mode 모두 브라우저가 이 주소를 부르게 하고, 요청은 MSW가 받는다.
afterEach(() => {
  vi.unstubAllEnvs()
})

test('명세 조각의 operation으로 만든 fetch 함수와 MSW 핸들러가 동작한다', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.com')

  expect(await listAlphas()).toEqual([{ id: 1, name: '알파' }])
})
