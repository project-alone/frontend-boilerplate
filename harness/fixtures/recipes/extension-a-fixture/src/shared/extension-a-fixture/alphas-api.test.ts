import { expect, test } from 'vitest'
import { listAlphas } from '@/shared/api/generated'

// 이 파일은 브라우저(jsdom)에서 실행된다. Vitest에서는 두 Rendering Mode 모두 브라우저가 목 백엔드를 부르고(server는
// src/shared/api/base-url.ts, static-export는 config/vitest.setup.ts), 요청은 MSW가 받는다.

test('명세 조각의 operation으로 만든 fetch 함수와 MSW 핸들러가 동작한다', async () => {
  expect(await listAlphas()).toEqual([{ id: 1, name: '알파' }])
})
