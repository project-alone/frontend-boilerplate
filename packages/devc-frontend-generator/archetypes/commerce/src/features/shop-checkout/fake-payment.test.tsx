import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { confirmOrderPayment, createCart, getCart, getOrder, placeOrder } from '@/shared/api/generated'
import type { Order } from '@/shared/api/generated/model'
import { server } from '@/shared/mocks/node'
import { createShopHandlers, resetMockShop } from '@/shared/mocks/shop'
import { forgetCartId, rememberCartId } from '@/shared/shop/cart-id'
import { ToastProvider } from '@/shared/ui/toast'
import { CHECKOUT_DRAFT_KEY } from './checkout-steps'
import { FakePayment } from './fake-payment'
import { OrderComplete } from './order-complete'

// 요청은 Vitest의 MSW가 받고, 커머스의 목 백엔드(src/shared/mocks/shop.ts)가 장바구니와 주문을 기억한다. 결제한 뒤 주문 완료
// 화면으로 옮겨 가는 것은 Next.js의 라우터가 없는 테스트이므로 router.push를 기록해 확인한다.
const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

beforeEach(() => {
  resetMockShop()
  server.use(...createShopHandlers({ saveDelayMs: 0 }))
  router.push.mockClear()
})

afterEach(() => {
  forgetCartId()
  sessionStorage.clear()
})

/** 티셔츠 2개를 담은 장바구니로 결제 대기 주문을 만든다. 장바구니는 이 브라우저의 장바구니로 저장한다. */
async function pendingOrder(): Promise<Order> {
  const cart = await createCart({ productId: 1, quantity: 2 })
  rememberCartId(cart.id)
  return placeOrder({
    cartId: cart.id,
    recipient: '홍길동',
    phone: '010-1234-5678',
    postalCode: '04524',
    address: '서울특별시 중구 세종대로 110',
    addressDetail: '3층',
    paymentMethod: 'mobile',
    agreedToPurchase: true,
  })
}

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  )
}

test('테스트 결제창은 주문 번호, 결제 수단, 결제 금액을 보여 주고 주문서의 마지막(결제) 단계임을 알린다', async () => {
  const order = await pendingOrder()

  renderWithQueryClient(<FakePayment orderId={order.id} />)

  const panel = await screen.findByRole('region', { name: '테스트 결제창' })
  expect(panel).toHaveTextContent(`주문 번호${order.id}`)
  expect(panel).toHaveTextContent('결제 수단휴대폰 결제')
  expect(panel).toHaveTextContent('결제 금액₩38,000')
  expect(screen.getByRole('list', { name: '주문 단계' })).toBeInTheDocument()
  expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('결제')
  expect(within(panel).getByRole('link', { name: '결제 취소' })).toHaveAttribute('href', '/shop/checkout')
})

test('결제를 승인하면 주문 금액으로 결제를 확인하고, 장바구니 id와 입력하던 주문서를 지운 뒤 주문 완료 화면으로 간다', async () => {
  const order = await pendingOrder()
  sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ step: 2, values: { recipient: '홍길동' } }))
  const payments: unknown[] = []
  server.use(
    http.post('*/orders/:orderId/payment', async ({ request }) => {
      payments.push(await request.clone().json())
    }),
  )
  renderWithQueryClient(<FakePayment orderId={order.id} />)

  await userEvent.setup().click(await screen.findByRole('button', { name: '결제 승인' }))

  await waitFor(() => {
    expect(router.push).toHaveBeenCalledWith(`/shop/orders/${order.id}`)
  })
  expect(payments).toEqual([{ paymentKey: `fake-${order.id}`, amount: 38000 }])
  await expect(getOrder(order.id)).resolves.toMatchObject({ status: 'paid' })
  expect(localStorage.getItem('shop-cart-id')).toBeNull()
  expect(sessionStorage.getItem(CHECKOUT_DRAFT_KEY)).toBeNull()
})

test('결제를 확인하지 못하면 이유를 알리고 주문 완료 화면으로 가지 않는다', async () => {
  const order = await pendingOrder()
  server.use(
    http.post('*/orders/:orderId/payment', () =>
      HttpResponse.json({ message: '결제 금액이 주문 금액과 다릅니다.' }, { status: 400 }),
    ),
  )
  renderWithQueryClient(<FakePayment orderId={order.id} />)

  await userEvent.setup().click(await screen.findByRole('button', { name: '결제 승인' }))

  const toasts = screen.getByRole('region', { name: '알림' })
  expect(await within(toasts).findByText('결제하지 못했습니다')).toBeInTheDocument()
  expect(within(toasts).getByText('결제 금액이 주문 금액과 다릅니다.')).toBeInTheDocument()
  expect(router.push).not.toHaveBeenCalled()
  expect(localStorage.getItem('shop-cart-id')).not.toBeNull()
})

test('이미 결제한 주문의 결제창은 결제 버튼 대신 주문 내역으로 안내한다', async () => {
  const order = await pendingOrder()
  await confirmOrderPayment(order.id, { paymentKey: 'fake', amount: order.totalPrice })

  renderWithQueryClient(<FakePayment orderId={order.id} />)

  expect(await screen.findByText('이미 결제한 주문입니다.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '주문 내역 보기' })).toHaveAttribute('href', `/shop/orders/${order.id}`)
  expect(screen.queryByRole('button', { name: '결제 승인' })).not.toBeInTheDocument()
})

test('주문 완료 화면은 결제한 주문의 번호, 상품, 배송 정보, 결제 수단을 보여 주고, 장바구니는 비었다', async () => {
  const order = await pendingOrder()
  const cartId = localStorage.getItem('shop-cart-id') ?? ''
  await confirmOrderPayment(order.id, { paymentKey: 'fake', amount: order.totalPrice })

  renderWithQueryClient(<OrderComplete orderId={order.id} />)

  expect(await screen.findByText(order.id)).toBeInTheDocument()
  const table = screen.getByRole('table', { name: '주문한 상품' })
  expect(within(table).getByRole('row', { name: /오가닉 코튼 티셔츠/ })).toHaveTextContent('₩19,0002개₩38,000')
  const shipping = screen.getByRole('region', { name: '배송과 결제' })
  expect(shipping).toHaveTextContent('주소04524 서울특별시 중구 세종대로 110 3층')
  expect(shipping).toHaveTextContent('결제 수단휴대폰 결제')
  expect(screen.getByRole('link', { name: '쇼핑 계속하기' })).toHaveAttribute('href', '/shop')
  // 결제를 확인하면 백엔드가 주문한 장바구니를 지운다.
  await expect(getCart(cartId)).rejects.toMatchObject({ status: 404 })
})

test('아직 결제하지 않은 주문이면 결제창으로 안내한다', async () => {
  const order = await pendingOrder()

  renderWithQueryClient(<OrderComplete orderId={order.id} />)

  expect(await screen.findByRole('link', { name: '결제하기' })).toHaveAttribute(
    'href',
    `/shop/orders/${order.id}/payment`,
  )
})
