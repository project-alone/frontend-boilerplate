import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createCart, getOrder } from '@/shared/api/generated'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { MUST_CHECK_MESSAGE, REQUIRED_MESSAGE } from '@/shared/form/form-resolver'
import { server } from '@/shared/mocks/node'
import { createShopHandlers, resetMockShop } from '@/shared/mocks/shop'
import { forgetCartId, rememberCartId } from '@/shared/shop/cart-id'
import { ToastProvider } from '@/shared/ui/toast'
import { CheckoutForm } from './checkout-form'

// 요청은 Vitest의 MSW가 받고, 커머스의 목 백엔드(src/shared/mocks/shop.ts)가 장바구니와 주문을 기억한다. 주문한 뒤 결제창으로
// 옮겨 가는 것은 Next.js의 라우터가 없는 테스트이므로 router.push를 기록해 확인한다.
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

/** 백엔드에 티셔츠 2개를 담은 장바구니를 만들고 이 브라우저의 장바구니로 저장한다. */
async function cartWithTwoTShirts(): Promise<string> {
  const cart = await createCart({ productId: 1, quantity: 2 })
  rememberCartId(cart.id)
  return cart.id
}

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CheckoutForm />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/** 폼이 보낸 주문(placeOrder)의 요청 본문을 모은다. 응답은 돌려주지 않으므로 목 백엔드가 이어 받아 답한다. */
function placedOrders(): unknown[] {
  const bodies: unknown[] = []
  server.use(
    http.post('*/orders', async ({ request }) => {
      bodies.push(await request.clone().json())
    }),
  )
  return bodies
}

const user = () => userEvent.setup()

async function fillShipping() {
  const u = user()
  await u.type(await screen.findByRole('textbox', { name: '받는 사람' }), '홍길동')
  await u.type(screen.getByRole('textbox', { name: '연락처' }), '010-1234-5678')
  await u.type(screen.getByRole('textbox', { name: '우편번호' }), '04524')
  await u.type(screen.getByRole('textbox', { name: '주소' }), '서울특별시 중구 세종대로 110')
  await u.click(screen.getByRole('button', { name: '다음' }))
}

async function choosePayment(method: string) {
  const u = user()
  await u.click(await screen.findByRole('combobox', { name: '결제 수단' }))
  await u.click(await screen.findByRole('option', { name: method }))
  await u.click(screen.getByRole('button', { name: '다음' }))
}

test('장바구니가 없으면 주문서 대신 장바구니로 안내한다', async () => {
  renderForm()

  expect(
    await screen.findByText('주문할 상품이 없습니다. 장바구니에 상품을 담은 뒤 주문해 주세요.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '장바구니로' })).toHaveAttribute('href', '/shop/cart')
})

test('비워 둔 채 다음을 누르면 이 단계의 필수 입력만 오류로 알리고 첫 오류 필드로 포커스를 옮긴다. 처음 화면과 오류 화면에 접근성 위반이 없다', async () => {
  await cartWithTwoTShirts()
  renderForm()

  const next = await screen.findByRole('button', { name: '다음' })
  expect(await axeViolations(document.body)).toEqual([])
  await user().click(next)

  const recipient = screen.getByRole('textbox', { name: '받는 사람' })
  await waitFor(() => {
    expect(recipient).toHaveFocus()
  })
  const required = new RegExp(RegExp.escape(REQUIRED_MESSAGE))
  for (const name of ['받는 사람', '연락처', '우편번호', '주소']) {
    expect(screen.getByRole('textbox', { name })).toHaveAccessibleDescription(required)
  }
  // 선택 입력(상세 주소, 배송 메모)은 비워도 된다.
  expect(screen.getByRole('textbox', { name: '상세 주소' })).not.toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByRole('heading', { level: 2, name: '배송 정보 (4단계 중 1단계)' })).toBeInTheDocument()
  // 오류가 보이는 화면에도 접근성 위반이 없다.
  expect(await axeViolations(document.body)).toEqual([])
})

test('배송 정보 → 결제 수단 → 주문 확인을 거쳐 장바구니 id와 함께 주문하고, 그 주문의 결제창으로 간다', async () => {
  const cartId = await cartWithTwoTShirts()
  const bodies = placedOrders()
  renderForm()

  await fillShipping()
  expect(await screen.findByRole('heading', { level: 2, name: '결제 수단 (4단계 중 2단계)' })).toHaveFocus()
  await choosePayment('계좌이체')

  expect(await screen.findByRole('heading', { level: 2, name: '주문 확인 (4단계 중 3단계)' })).toHaveFocus()
  const table = screen.getByRole('table', { name: '주문 상품' })
  expect(within(table).getByRole('rowheader', { name: '오가닉 코튼 티셔츠' })).toBeInTheDocument()
  expect(table).toHaveTextContent('결제 금액₩38,000')
  expect(screen.getByRole('region', { name: '배송 정보' })).toHaveTextContent('주소04524 서울특별시 중구 세종대로 110')
  expect(screen.getByRole('region', { name: '결제 수단' })).toHaveTextContent('계좌이체')
  expect(await axeViolations(document.body)).toEqual([])

  // 구매 동의는 명세의 const: true라 체크해야 주문한다.
  await user().click(screen.getByRole('button', { name: '결제하기' }))
  const agreement = screen.getByRole('checkbox', { name: '주문 내용을 확인했고 결제에 동의합니다' })
  await waitFor(() => {
    expect(agreement).toHaveAccessibleDescription(new RegExp(RegExp.escape(MUST_CHECK_MESSAGE)))
  })
  expect(bodies).toEqual([])

  await user().click(agreement)
  await user().click(screen.getByRole('button', { name: '결제하기' }))

  await waitFor(() => {
    expect(router.push).toHaveBeenCalledOnce()
  })
  const paymentPath = String(router.push.mock.calls[0]?.[0])
  expect(paymentPath).toMatch(/^\/shop\/orders\/ORD-[\dA-F]{12}\/payment$/)
  expect(bodies).toEqual([
    {
      cartId,
      recipient: '홍길동',
      phone: '010-1234-5678',
      postalCode: '04524',
      address: '서울특별시 중구 세종대로 110',
      paymentMethod: 'transfer',
      agreedToPurchase: true,
    },
  ])
  const orderId = /ORD-[\dA-F]{12}/.exec(paymentPath)?.[0] ?? ''
  await expect(getOrder(orderId)).resolves.toMatchObject({ status: 'pending', totalPrice: 38000 })
})

test('이전으로 돌아가도 입력한 값이 남고, 확인 단계의 수정으로 그 단계에 돌아간다', async () => {
  await cartWithTwoTShirts()
  renderForm()
  await fillShipping()
  await choosePayment('휴대폰 결제')

  await user().click(await screen.findByRole('button', { name: '배송 정보 수정' }))

  expect(await screen.findByRole('textbox', { name: '받는 사람' })).toHaveValue('홍길동')
  await user().click(screen.getByRole('button', { name: '다음' }))
  await user().click(await screen.findByRole('button', { name: '이전' }))
  expect(await screen.findByRole('textbox', { name: '우편번호' })).toHaveValue('04524')
})

test('백엔드가 주문을 거절하면(재고 부족 등) 이유를 알리고 결제창으로 가지 않는다', async () => {
  await cartWithTwoTShirts()
  server.use(
    http.post('*/orders', () =>
      HttpResponse.json({ message: '재고가 부족합니다. 남은 수량은 1개입니다.' }, { status: 409 }),
    ),
  )
  renderForm()
  await fillShipping()
  await choosePayment('신용·체크카드')

  await user().click(await screen.findByRole('checkbox', { name: '주문 내용을 확인했고 결제에 동의합니다' }))
  await user().click(screen.getByRole('button', { name: '결제하기' }))

  const toasts = screen.getByRole('region', { name: '알림' })
  expect(await within(toasts).findByText('주문하지 못했습니다')).toBeInTheDocument()
  expect(within(toasts).getByText('재고가 부족합니다. 남은 수량은 1개입니다.')).toBeInTheDocument()
  expect(router.push).not.toHaveBeenCalled()
})
