// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/features/shop-cart/cart-view.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, beforeEach, expect, onTestFinished, test } from 'vitest'
import { addCartItem, createCart } from '@/shared/api/generated'
import { server } from '@/shared/mocks/node'
import { createShopHandlers, resetMockShop } from '@/shared/mocks/shop'
import { forgetCartId, rememberCartId } from '@/shared/shop/cart-id'
import { ToastProvider } from '@/shared/ui/toast'
import { CartView } from './cart-view'

// 요청은 Vitest의 MSW가 받고, 커머스의 목 백엔드(src/shared/mocks/shop.ts)가 장바구니를 기억하고 재고를 확인한다. 응답 전의
// 화면을 보려는 테스트는 목 백엔드 앞에 응답을 붙잡아 두는 핸들러를 더한다(답하지 않으면 목 백엔드가 이어 받는다).

// 명세의 example: 1번 티셔츠(19,000원), 4번 토트백(25,000원), 6번 머그(18,000원, 재고 2)
const T_SHIRT = 1
const TOTE_BAG = 4
const MUG = 6

beforeEach(() => {
  resetMockShop()
  server.use(...createShopHandlers({ saveDelayMs: 0 }))
})

afterEach(() => {
  forgetCartId()
})

/** 백엔드에 장바구니를 만들고 이 브라우저의 장바구니로 저장한다. */
async function cartWith(items: readonly { productId: number; quantity: number }[]): Promise<string> {
  const [first, ...rest] = items
  if (first === undefined) throw new Error('장바구니에 담을 상품이 없습니다.')
  const cart = await createCart(first)
  for (const item of rest) await addCartItem(cart.id, item)
  rememberCartId(cart.id)
  return cart.id
}

function renderCart() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CartView />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { queryClient }
}

/** 상품 이름의 줄(listitem) */
async function lineOf(name: string): Promise<HTMLElement> {
  const lines = within(await screen.findByRole('list', { name: '담은 상품' })).getAllByRole('listitem')
  const line = lines.find((item) => within(item).queryByRole('link', { name }) !== null)
  if (line === undefined) throw new Error(`${name}의 줄이 없습니다.`)
  return line
}

/** 줄의 수량(줄마다의 상태 문구) */
function quantityOf(name: string): HTMLElement {
  return within(screen.getByRole('group', { name: `${name} 수량` })).getByRole('status')
}

/** 장바구니를 바꾸는 요청(method의 /carts/:cartId/items/:productId)을 release를 부를 때까지 붙잡아 둔다. */
function holdItemRequests(method: 'patch' | 'delete') {
  const held = Promise.withResolvers<undefined>()
  onTestFinished(() => {
    held.resolve(undefined)
  })
  server.use(
    http[method]('*/carts/:cartId/items/:productId', async () => {
      await held.promise
    }),
  )
  return {
    release: () => {
      held.resolve(undefined)
    },
  }
}

test('장바구니가 없으면 비어 있다고 알리고 상품 목록으로 안내한다', async () => {
  renderCart()

  expect(await screen.findByText('장바구니가 비어 있습니다.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '상품 보러 가기' })).toHaveAttribute('href', '/shop')
})

test('담은 상품마다 가격, 수량, 금액을 보여 주고, 합계와 주문하기 링크를 둔다', async () => {
  await cartWith([
    { productId: T_SHIRT, quantity: 2 },
    { productId: TOTE_BAG, quantity: 1 },
  ])
  renderCart()

  const tShirt = await lineOf('오가닉 코튼 티셔츠')
  expect(within(tShirt).getByRole('link', { name: '오가닉 코튼 티셔츠' })).toHaveAttribute('href', '/shop/products/1')
  expect(tShirt).toHaveTextContent('₩19,000')
  expect(tShirt).toHaveTextContent('₩38,000')
  expect(quantityOf('오가닉 코튼 티셔츠')).toHaveTextContent('2')
  const summary = screen.getByRole('region', { name: '주문 금액' })
  expect(summary).toHaveTextContent('상품 수량3개')
  expect(summary).toHaveTextContent('합계₩63,000')
  expect(within(summary).getByRole('link', { name: '주문하기' })).toHaveAttribute('href', '/shop/checkout')
  // 1개에서는 줄이지 못하지만, 키보드 포커스를 잃지 않도록 포커스는 받는다.
  const decrease = screen.getByRole('button', { name: '캔버스 토트백 수량 줄이기' })
  expect(decrease).toHaveAttribute('aria-disabled', 'true')
})

test('수량을 늘리면 응답을 기다리지 않고 수량, 금액, 합계를 바꾸고, 저장하는 동안 저장 중이라고 보여 준다', async () => {
  await cartWith([{ productId: T_SHIRT, quantity: 2 }])
  const { release } = holdItemRequests('patch')
  const user = userEvent.setup()
  renderCart()
  const line = await lineOf('오가닉 코튼 티셔츠')

  await user.click(screen.getByRole('button', { name: '오가닉 코튼 티셔츠 수량 늘리기' }))

  // 응답은 아직 오지 않았다. 화면은 cart Query Domain의 장바구니 캐시를 고친 값을 보여 준다.
  await waitFor(() => {
    expect(quantityOf('오가닉 코튼 티셔츠')).toHaveTextContent('3')
  })
  expect(line).toHaveTextContent('₩57,000')
  expect(screen.getByRole('region', { name: '주문 금액' })).toHaveTextContent('합계₩57,000')
  expect(line).toHaveAttribute('aria-busy', 'true')
  expect(within(line).getByText('저장 중')).toBeInTheDocument()

  release()

  await waitFor(() => {
    expect(within(line).queryByText('저장 중')).not.toBeInTheDocument()
  })
  expect(quantityOf('오가닉 코튼 티셔츠')).toHaveTextContent('3')
})

test('백엔드가 거절하면(재고 부족) 장바구니를 다시 가져오기 전에 수량을 되돌리고, 무엇을 왜 되돌렸는지 알린다', async () => {
  const cartId = await cartWith([{ productId: MUG, quantity: 2 }])
  const { release } = holdItemRequests('patch')
  // 실패한 뒤 장바구니를 다시 가져오는 요청은 refetch를 풀 때까지 답하지 않는다. 그동안 보이는 값은 뮤테이션 훅이 되돌린 캐시다.
  const refetch = Promise.withResolvers<undefined>()
  onTestFinished(() => {
    refetch.resolve(undefined)
  })
  let cartRequests = 0
  server.use(
    http.get(`*/carts/${cartId}`, async () => {
      cartRequests += 1
      if (cartRequests > 1) await refetch.promise
    }),
  )
  const user = userEvent.setup()
  renderCart()
  await lineOf('한정판 세라믹 머그')

  await user.click(screen.getByRole('button', { name: '한정판 세라믹 머그 수량 늘리기' }))

  await waitFor(() => {
    expect(quantityOf('한정판 세라믹 머그')).toHaveTextContent('3')
  })

  release()

  await waitFor(() => {
    expect(quantityOf('한정판 세라믹 머그')).toHaveTextContent('2')
  })
  expect(cartRequests).toBe(2)
  expect(screen.getByRole('region', { name: '주문 금액' })).toHaveTextContent('합계₩36,000')

  // 뮤테이션은 다시 가져온 장바구니를 받은 뒤에 끝나고(onSettled), 그때 알림이 뜬다.
  refetch.resolve(undefined)

  const toasts = screen.getByRole('region', { name: '알림' })
  expect(await within(toasts).findByText('수량을 바꾸지 못해 되돌렸습니다')).toBeInTheDocument()
  expect(within(toasts).getByText('한정판 세라믹 머그: 재고가 부족합니다. 남은 수량은 2개입니다.')).toBeInTheDocument()
})

test('빼면 응답을 기다리지 않고 줄을 지우고, 마지막 상품을 빼면 비어 있다고 알린다', async () => {
  await cartWith([
    { productId: T_SHIRT, quantity: 1 },
    { productId: TOTE_BAG, quantity: 1 },
  ])
  const { release } = holdItemRequests('delete')
  const user = userEvent.setup()
  renderCart()
  await lineOf('캔버스 토트백')

  await user.click(screen.getByRole('button', { name: '캔버스 토트백 빼기' }))

  await waitFor(() => {
    expect(screen.queryByRole('link', { name: '캔버스 토트백' })).not.toBeInTheDocument()
  })
  expect(screen.getByRole('region', { name: '주문 금액' })).toHaveTextContent('합계₩19,000')
  release()

  await user.click(screen.getByRole('button', { name: '오가닉 코튼 티셔츠 빼기' }))

  expect(await screen.findByText('장바구니가 비어 있습니다.')).toBeInTheDocument()
})

test('저장한 장바구니가 백엔드에 없으면(오래되어 지웠거나 주문을 마침) 저장한 id를 지우고 비어 있다고 알린다', async () => {
  rememberCartId('expired-cart')

  renderCart()

  expect(await screen.findByText('장바구니가 비어 있습니다.')).toBeInTheDocument()
  expect(localStorage.getItem('shop-cart-id')).toBeNull()
})
