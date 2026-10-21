import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { addCartItem, createCart } from '@/shared/api/generated'
import { server } from '@/shared/mocks/node'
import { createShopHandlers, resetMockShop } from '@/shared/mocks/shop'
import { forgetCartId, rememberCartId } from '@/shared/shop/cart-id'
import { ShopNav } from './shop-nav'

// 장바구니는 커머스의 목 백엔드(src/shared/mocks/shop.ts)가 기억한다. 지금 주소는 Next.js의 라우터가 없는 테스트이므로 정해 둔다.
const navigation = vi.hoisted(() => ({ pathname: '/shop' }))
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))

beforeEach(() => {
  resetMockShop()
  server.use(...createShopHandlers({ saveDelayMs: 0 }))
  navigation.pathname = '/shop'
})

afterEach(() => {
  forgetCartId()
})

function renderNav() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ShopNav />
    </QueryClientProvider>,
  )
}

test('장바구니가 없으면 장바구니 링크에 수량을 붙이지 않고, 지금 화면의 링크를 알린다', () => {
  navigation.pathname = '/shop/cart'

  renderNav()

  const nav = screen.getByRole('navigation', { name: '쇼핑몰 화면' })
  expect(nav).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '장바구니' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: '상품' })).not.toHaveAttribute('aria-current')
})

test('장바구니 링크는 담은 수량의 합을 알린다', async () => {
  const cart = await createCart({ productId: 1, quantity: 2 })
  await addCartItem(cart.id, { productId: 4, quantity: 1 })
  rememberCartId(cart.id)

  renderNav()

  // 링크의 이름은 보이는 글자(장바구니와 수량 배지)와 스크린 리더에만 읽히는 단위(개)다.
  expect(await screen.findByRole('link', { name: /^장바구니\s*3\s*개$/ })).toHaveAttribute('href', '/shop/cart')
  expect(screen.getByRole('link', { name: '상품' })).toHaveAttribute('aria-current', 'page')
})

test('저장한 장바구니가 백엔드에 없으면 저장한 id를 지운다', async () => {
  rememberCartId('expired-cart')

  renderNav()

  await waitFor(() => {
    expect(localStorage.getItem('shop-cart-id')).toBeNull()
  })
  expect(screen.getByRole('link', { name: '장바구니' })).toBeInTheDocument()
})
