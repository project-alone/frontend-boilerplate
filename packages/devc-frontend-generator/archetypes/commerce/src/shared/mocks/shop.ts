import { delay, http, HttpResponse } from 'msw'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import { getListCatalogProductsResponseMock } from '@/shared/api/generated/catalog/catalog.msw'
import {
  type Cart,
  type CartItem,
  CartItemUpdate,
  type CatalogProduct,
  NewCartItem,
  NewOrder,
  Order,
  OrderPayment,
  type ShopError,
} from '@/shared/api/generated/model'

// 커머스 Archetype: 상품 카탈로그, 장바구니, 주문(catalog·cart·orders tag)을 흉내 내는 목 백엔드. 명세에서 생성한 핸들러는 늘
// 같은 example을 돌려주므로, 만든 장바구니와 주문을 기억하고 재고를 확인하는 핸들러를 따로 둔다. 확장 지점 mockHandlers
// (Archetype의 extensions.json)로 선언해, MSW의 핸들러 목록(src/shared/mocks/handlers.ts)이 생성된 핸들러보다 앞에 둔다.
// 생성된 핸들러처럼 목 백엔드 주소(MOCK_API_BASE_URL)로 가는 요청만 받는다(ADR-0013). Vitest, 개발 서버, 목 빌드, E2E 대상
// 서버가 모두 이 핸들러를 쓴다. 장바구니와 주문은 서버 프로세스의 메모리에만 있어 서버를 다시 띄우면 처음 상태로 돌아간다.
// 실제 백엔드로 바꾸면 쓰이지 않는다.
//
// - 상품은 명세의 example(listCatalogProducts)이다. 재고(stock)보다 많이 담거나 주문하면 실제 백엔드처럼 409로 거절한다.
//   재고가 2개인 한정판 머그(6번)를 세 개째 담으면 늘 거절되므로, 개발 서버와 E2E가 테스트만을 위한 코드 없이 낙관적 업데이트의
//   되돌리기를 재현한다. 주문해도 재고는 줄이지 않아 몇 번을 주문해도 같은 상황이 된다.
// - 장바구니를 바꾸는 요청(createCart, addCartItem, updateCartItem, removeCartItem)은 SAVE_DELAY_MS 뒤에 답한다. 응답이 늦어야
//   낙관적 업데이트가 응답 전에 화면을 바꾸고, 실패하면 되돌리는 것이 눈에 보인다.
// - 장바구니 id는 추측할 수 없는 UUID다(손님 장바구니는 id만으로 찾는다). 결제를 확인하면 주문한 장바구니를 지운다.
// - 결제(confirmOrderPayment)는 PG를 연동하지 않은 가짜 결제다. paymentKey는 확인하지 않고, 결제 금액이 주문 금액과 같은지만 본다.

/** 장바구니를 바꾸는 요청에 답하기까지 걸리는 시간(ms) */
const SAVE_DELAY_MS = 1000

// 주문서(NewOrder)에서 주문(Order)에 그대로 담는 값
const ORDER_DETAILS = Order.pick({
  recipient: true,
  phone: true,
  postalCode: true,
  address: true,
  addressDetail: true,
  deliveryMemo: true,
  paymentMethod: true,
})

let products: CatalogProduct[] = getListCatalogProductsResponseMock()
// 장바구니 id → 담긴 상품(처음 담은 순서)
const carts = new Map<string, CartItem[]>()
// 주문 번호 → 주문과 그 주문을 만든 장바구니의 id
const orders = new Map<string, { order: Order; cartId: string }>()

/** 목 백엔드를 처음 상태(명세의 상품, 장바구니와 주문 없음)로 되돌린다. 테스트가 서로 영향을 주지 않게 쓴다. */
export function resetMockShop(): void {
  products = getListCatalogProductsResponseMock()
  carts.clear()
  orders.clear()
}

/**
 * 목 백엔드의 핸들러. saveDelayMs는 장바구니를 바꾸는 요청에 답하기까지의 시간이다. Vitest의 테스트는 기다리지 않도록
 * server.use(...createShopHandlers({ saveDelayMs: 0 }))로 앞에 둔다(같은 메모리를 쓴다).
 */
export function createShopHandlers({ saveDelayMs = SAVE_DELAY_MS }: { saveDelayMs?: number } = {}) {
  return [
    http.get(`${MOCK_API_BASE_URL}/catalog/products`, () => HttpResponse.json(products)),
    http.get<{ productId: string }>(`${MOCK_API_BASE_URL}/catalog/products/:productId`, ({ params }) => {
      const product = productOf(params.productId)
      return product === undefined ? fail(404, '상품이 없습니다.') : HttpResponse.json(product)
    }),

    http.post(`${MOCK_API_BASE_URL}/carts`, async ({ request }) => {
      await delay(saveDelayMs)
      // 실제 백엔드처럼 명세에 맞지 않는 요청 본문은 400으로 거절한다.
      const body = NewCartItem.safeParse(await request.json())
      if (!body.success) return fail(400, body.error.message)
      const result = withItem([], body.data.productId, body.data.quantity)
      if (!Array.isArray(result)) return result
      const cartId = crypto.randomUUID()
      carts.set(cartId, result)
      return HttpResponse.json(cartOf(cartId), { status: 201 })
    }),
    http.get<{ cartId: string }>(`${MOCK_API_BASE_URL}/carts/:cartId`, ({ params }) =>
      carts.has(params.cartId) ? HttpResponse.json(cartOf(params.cartId)) : fail(404, '장바구니가 없습니다.'),
    ),
    http.post<{ cartId: string }>(`${MOCK_API_BASE_URL}/carts/:cartId/items`, async ({ params, request }) => {
      await delay(saveDelayMs)
      const items = carts.get(params.cartId)
      if (items === undefined) return fail(404, '장바구니가 없습니다.')
      const body = NewCartItem.safeParse(await request.json())
      if (!body.success) return fail(400, body.error.message)
      const { productId, quantity } = body.data
      const inCart = items.find((item) => item.productId === productId)?.quantity ?? 0
      const result = withItem(items, productId, inCart + quantity)
      if (!Array.isArray(result)) return result
      carts.set(params.cartId, result)
      return HttpResponse.json(cartOf(params.cartId))
    }),
    http.patch<{ cartId: string; productId: string }>(
      `${MOCK_API_BASE_URL}/carts/:cartId/items/:productId`,
      async ({ params, request }) => {
        await delay(saveDelayMs)
        const items = carts.get(params.cartId)
        if (items === undefined) return fail(404, '장바구니가 없습니다.')
        const item = items.find(({ productId }) => String(productId) === params.productId)
        if (item === undefined) return fail(404, '장바구니에 없는 상품입니다.')
        const body = CartItemUpdate.safeParse(await request.json())
        if (!body.success) return fail(400, body.error.message)
        const result = withItem(items, item.productId, body.data.quantity)
        if (!Array.isArray(result)) return result
        carts.set(params.cartId, result)
        return HttpResponse.json(cartOf(params.cartId))
      },
    ),
    http.delete<{ cartId: string; productId: string }>(
      `${MOCK_API_BASE_URL}/carts/:cartId/items/:productId`,
      async ({ params }) => {
        await delay(saveDelayMs)
        const items = carts.get(params.cartId)
        if (items === undefined) return fail(404, '장바구니가 없습니다.')
        if (!items.some(({ productId }) => String(productId) === params.productId)) {
          return fail(404, '장바구니에 없는 상품입니다.')
        }
        carts.set(
          params.cartId,
          items.filter(({ productId }) => String(productId) !== params.productId),
        )
        return HttpResponse.json(cartOf(params.cartId))
      },
    ),

    http.post(`${MOCK_API_BASE_URL}/orders`, async ({ request }) => {
      const body = NewOrder.safeParse(await request.json())
      if (!body.success) return fail(400, body.error.message)
      const { cartId } = body.data
      const items = carts.get(cartId)
      if (items === undefined) return fail(404, '장바구니가 없습니다.')
      if (items.length === 0) return fail(409, '장바구니가 비어 있습니다.')
      // 담은 뒤에 재고가 줄었을 수 있으므로 주문할 때 다시 확인한다.
      for (const item of items) {
        const result = withItem(items, item.productId, item.quantity)
        if (!Array.isArray(result)) return result
      }
      const { totalQuantity, totalPrice } = cartOf(cartId)
      const order: Order = {
        id: `ORD-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
        status: 'pending',
        items: items.map((item) => ({ ...item })),
        totalQuantity,
        totalPrice,
        // 주문서의 배송 정보와 결제 수단을 담는다(장바구니 id와 구매 동의는 주문에 담지 않는다).
        ...ORDER_DETAILS.parse(body.data),
      }
      orders.set(order.id, { order, cartId })
      return HttpResponse.json(order, { status: 201 })
    }),
    http.get<{ orderId: string }>(`${MOCK_API_BASE_URL}/orders/:orderId`, ({ params }) => {
      const stored = orders.get(params.orderId)
      return stored === undefined ? fail(404, '주문이 없습니다.') : HttpResponse.json(stored.order)
    }),
    http.post<{ orderId: string }>(`${MOCK_API_BASE_URL}/orders/:orderId/payment`, async ({ params, request }) => {
      const stored = orders.get(params.orderId)
      if (stored === undefined) return fail(404, '주문이 없습니다.')
      const body = OrderPayment.safeParse(await request.json())
      if (!body.success) return fail(400, body.error.message)
      if (stored.order.status === 'paid') return fail(409, '이미 결제한 주문입니다.')
      if (body.data.amount !== stored.order.totalPrice) return fail(400, '결제 금액이 주문 금액과 다릅니다.')
      const paid: Order = { ...stored.order, status: 'paid' }
      orders.set(paid.id, { ...stored, order: paid })
      carts.delete(stored.cartId)
      return HttpResponse.json(paid)
    }),
  ]
}

export const shopHandlers = createShopHandlers()

function productOf(productId: number | string): CatalogProduct | undefined {
  return products.find(({ id }) => String(id) === String(productId))
}

/**
 * 장바구니 items에서 productId 상품의 수량을 quantity로 정한 결과. 상품이 없으면 404, 재고보다 많으면 409 응답이다.
 * 이미 담긴 상품이면 그 자리에서 바꾸고, 처음 담는 상품이면 지금의 이름과 가격으로 끝에 더한다.
 */
function withItem(
  items: readonly CartItem[],
  productId: number,
  quantity: number,
): CartItem[] | ReturnType<typeof fail> {
  const product = productOf(productId)
  if (product === undefined) return fail(404, '상품이 없습니다.')
  if (quantity > product.stock) {
    return fail(
      409,
      product.stock === 0 ? '품절된 상품입니다.' : `재고가 부족합니다. 남은 수량은 ${String(product.stock)}개입니다.`,
    )
  }
  if (!items.some((item) => item.productId === productId)) {
    return [...items, { productId, name: product.name, price: product.price, quantity }]
  }
  return items.map((item) => (item.productId === productId ? { ...item, quantity } : item))
}

function cartOf(cartId: string): Cart {
  const items = carts.get(cartId) ?? []
  return {
    id: cartId,
    items,
    totalQuantity: items.reduce((sum, { quantity }) => sum + quantity, 0),
    totalPrice: items.reduce((sum, { price, quantity }) => sum + price * quantity, 0),
  }
}

/** 명세의 ShopError로 실패 이유를 알리는 응답 */
function fail(status: number, message: string) {
  return HttpResponse.json<ShopError>({ message }, { status })
}
