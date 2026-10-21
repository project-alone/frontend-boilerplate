import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http } from 'msw'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, onTestFinished, test } from 'vitest'
import { getCartQueryOptions } from '@/queries/cart/cart.queries'
import { getCatalogProductQueryOptions } from '@/queries/catalog/catalog.queries'
import { createCart, getCart } from '@/shared/api/generated'
import { getGetCatalogProductResponseMock } from '@/shared/api/generated/catalog/catalog.msw'
import { server } from '@/shared/mocks/node'
import { createShopHandlers, resetMockShop } from '@/shared/mocks/shop'
import { forgetCartId, rememberCartId } from '@/shared/shop/cart-id'
import { ToastProvider } from '@/shared/ui/toast'
import { AddToCartForm } from './add-to-cart-form'

// 요청은 Vitest의 MSW가 받고, 커머스의 목 백엔드(src/shared/mocks/shop.ts)가 장바구니를 기억하고 재고를 확인한다. 응답 전의
// 화면을 보려는 테스트는 목 백엔드 앞에 응답을 붙잡아 두는 핸들러를 더한다(답하지 않으면 목 백엔드가 이어 받는다).

// 명세의 example: 1번 티셔츠(재고 50), 5번 머플러(품절), 6번 머그(재고 2)
const T_SHIRT = 1
const MUFFLER = 5
const MUG = 6

beforeEach(() => {
  resetMockShop()
  server.use(...createShopHandlers({ saveDelayMs: 0 }))
})

afterEach(() => {
  forgetCartId()
})

function renderForm(productId: number) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AddToCartForm productId={productId} />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { queryClient }
}

/** 장바구니에 담는 요청(addCartItem)을 release를 부를 때까지 붙잡아 둔다. */
function holdAddRequests() {
  const held = Promise.withResolvers<undefined>()
  server.use(
    http.post('*/carts/:cartId/items', async () => {
      await held.promise
    }),
  )
  return {
    release: () => {
      held.resolve(undefined)
    },
  }
}

async function addToCart(quantity: number) {
  const user = userEvent.setup()
  const input = await screen.findByRole('spinbutton', { name: '수량' })
  await user.clear(input)
  await user.type(input, String(quantity))
  await user.click(screen.getByRole('button', { name: '장바구니에 담기' }))
}

test('장바구니가 없으면 처음 담는 상품으로 장바구니를 만들고, 그 id를 이 브라우저에 저장한 뒤 담았다고 알린다', async () => {
  renderForm(T_SHIRT)

  await addToCart(2)

  expect(await screen.findByRole('status')).toHaveTextContent('오가닉 코튼 티셔츠 2개를 장바구니에 담았습니다.')
  expect(within(screen.getByRole('status')).getByRole('link', { name: '장바구니 보기' })).toHaveAttribute(
    'href',
    '/shop/cart',
  )
  const cartId = localStorage.getItem('shop-cart-id')
  expect(cartId).not.toBeNull()
  await expect(getCart(cartId ?? '')).resolves.toMatchObject({ items: [{ productId: T_SHIRT, quantity: 2 }] })
})

test('장바구니가 있으면 응답을 기다리지 않고 장바구니 쿼리의 수량을 늘리고, 응답 뒤 백엔드의 값으로 맞춘다', async () => {
  const cart = await createCart({ productId: T_SHIRT, quantity: 2 })
  rememberCartId(cart.id)
  const { release } = holdAddRequests()
  const { queryClient } = renderForm(T_SHIRT)
  // 쇼핑몰 안의 이동(ShopNav)이 보고 있는 장바구니
  await queryClient.query(getCartQueryOptions(cart.id))

  await addToCart(1)

  // 응답은 아직 오지 않았다. 담는 훅(useAddCartItemMutation)이 장바구니 쿼리를 먼저 고쳤다.
  await waitFor(() => {
    expect(queryClient.getQueryData(getCartQueryOptions(cart.id).queryKey)).toMatchObject({
      items: [{ productId: T_SHIRT, quantity: 3 }],
      totalQuantity: 3,
      totalPrice: 57000,
    })
  })
  expect(screen.getByRole('status')).toHaveTextContent('오가닉 코튼 티셔츠 1개를 장바구니에 담았습니다.')

  release()

  await waitFor(() => {
    expect(queryClient.getQueryState(getCartQueryOptions(cart.id).queryKey)?.isInvalidated).toBe(true)
  })
  await expect(getCart(cart.id)).resolves.toMatchObject({ totalQuantity: 3 })
})

test('백엔드가 거절하면(재고 부족) 늘렸던 수량을 되돌리고, 무엇을 왜 담지 못했는지 알린다', async () => {
  const cart = await createCart({ productId: MUG, quantity: 2 })
  rememberCartId(cart.id)
  const { release } = holdAddRequests()
  const { queryClient } = renderForm(MUG)
  await queryClient.query(getCartQueryOptions(cart.id))

  await addToCart(1)

  await waitFor(() => {
    expect(queryClient.getQueryData(getCartQueryOptions(cart.id).queryKey)).toMatchObject({ totalQuantity: 3 })
  })

  release()

  const toasts = screen.getByRole('region', { name: '알림' })
  expect(await within(toasts).findByText('장바구니에 담지 못했습니다')).toBeInTheDocument()
  expect(within(toasts).getByText('한정판 세라믹 머그: 재고가 부족합니다. 남은 수량은 2개입니다.')).toBeInTheDocument()
  expect(queryClient.getQueryData(getCartQueryOptions(cart.id).queryKey)).toMatchObject({ totalQuantity: 2 })
  expect(screen.getByRole('status')).toHaveTextContent('')
})

test('저장한 장바구니가 백엔드에 없으면 담지 못했다고 알리고 저장한 id를 지운다(다시 담으면 새 장바구니를 만든다)', async () => {
  rememberCartId('expired-cart')
  renderForm(T_SHIRT)

  await addToCart(1)

  expect(await screen.findByText('오가닉 코튼 티셔츠: 장바구니가 없습니다.')).toBeInTheDocument()
  expect(localStorage.getItem('shop-cart-id')).toBeNull()
})

test('수량은 명세의 범위(1~99)로 검증하고, 맞지 않으면 담지 않는다', async () => {
  renderForm(T_SHIRT)

  await addToCart(0)

  const input = screen.getByRole('spinbutton', { name: '수량' })
  await waitFor(() => {
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })
  expect(localStorage.getItem('shop-cart-id')).toBeNull()
})

test('미리 렌더링한 HTML에서는 수량 입력과 담기 버튼이 꺼져 있다가, hydration을 마치면 켜진다', async () => {
  // 상품 상세(ISR)처럼 서버가 상품을 가져와 넘긴 폼. hydration 전에 입력한 수량은 hydration 때 React Hook Form이 쓰는 처음
  // 값(1)에 덮어쓰이거나 이어 붙으므로(2를 입력하면 12), 그동안은 입력하지 못하게 한다.
  const queryClient = new QueryClient()
  queryClient.setQueryData(getCatalogProductQueryOptions(T_SHIRT).queryKey, getGetCatalogProductResponseMock())
  const form = (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AddToCartForm productId={T_SHIRT} />
      </ToastProvider>
    </QueryClientProvider>
  )
  const container = document.createElement('div')
  container.innerHTML = renderToString(form)
  document.body.append(container)
  onTestFinished(() => {
    container.remove()
  })
  const quantity = within(container).getByRole('spinbutton', { name: '수량' })
  const submit = within(container).getByRole('button', { name: '장바구니에 담기' })
  expect(quantity).toBeDisabled()
  expect(submit).toBeDisabled()

  render(form, { container, hydrate: true })

  await waitFor(() => {
    expect(quantity).toBeEnabled()
  })
  expect(quantity).toHaveValue(1)
  expect(submit).toBeEnabled()
})

test('품절된 상품은 담는 폼 대신 담을 수 없다고 알린다', async () => {
  renderForm(MUFFLER)

  expect(await screen.findByText('품절된 상품이라 장바구니에 담을 수 없습니다.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '장바구니에 담기' })).not.toBeInTheDocument()
})
