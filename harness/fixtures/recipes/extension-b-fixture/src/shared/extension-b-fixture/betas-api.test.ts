import { expect, test } from 'vitest'
import { getBeta, getProduct } from '@/shared/api/generated'

// 이 파일은 브라우저(jsdom)에서 실행된다. Vitest에서는 두 Rendering Mode 모두 브라우저가 목 백엔드를 부르고(server는
// src/shared/api/base-url.ts, static-export는 config/vitest.setup.ts), 요청은 MSW가 받는다.

test('명세 조각이 더한 tag와 Base의 tag에 더한 operation 모두 fetch 함수와 MSW 핸들러가 동작한다', async () => {
  expect(await getBeta(7)).toEqual({ id: 7, label: '베타' })
  expect(await getProduct(1)).toEqual({ id: 1, name: '기본 티셔츠', price: 19000 })
})
