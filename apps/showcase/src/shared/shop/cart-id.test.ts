// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/shared/shop/cart-id.test.ts

import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { forgetCartId, rememberCartId, useCartId } from './cart-id'

afterEach(() => {
  vi.restoreAllMocks()
  forgetCartId()
  localStorage.clear()
})

test('장바구니가 없으면 null이고, 저장한 id를 돌려주며, 지우면 다시 null이다', () => {
  const { result } = renderHook(() => useCartId())
  expect(result.current).toBeNull()

  act(() => {
    rememberCartId('cart-1')
  })
  expect(result.current).toBe('cart-1')
  // 다음 방문에도 같은 장바구니를 쓰도록 localStorage에 둔다.
  expect(localStorage.getItem('shop-cart-id')).toBe('cart-1')

  act(() => {
    forgetCartId()
  })
  expect(result.current).toBeNull()
  expect(localStorage.getItem('shop-cart-id')).toBeNull()
})

test('다른 탭이 장바구니 id를 바꾸면(storage 이벤트) 따라 바꾼다', () => {
  const { result } = renderHook(() => useCartId())

  act(() => {
    localStorage.setItem('shop-cart-id', 'cart-from-other-tab')
    window.dispatchEvent(new StorageEvent('storage', { key: 'shop-cart-id' }))
  })

  expect(result.current).toBe('cart-from-other-tab')
})

test('저장소를 쓸 수 없으면(저장소를 막은 브라우저) 오류 없이 메모리에 둔다', () => {
  const denied = () => {
    throw new DOMException('저장소를 쓸 수 없습니다', 'SecurityError')
  }
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied)
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied)
  const { result } = renderHook(() => useCartId())

  act(() => {
    rememberCartId('cart-in-memory')
  })

  expect(result.current).toBe('cart-in-memory')
})
