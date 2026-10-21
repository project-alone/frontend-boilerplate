// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/shared/mocks/shop.test.ts

import { beforeEach, expect, test } from 'vitest'
import {
  addCartItem,
  confirmOrderPayment,
  createCart,
  getCart,
  getCatalogProduct,
  getOrder,
  listCatalogProducts,
  placeOrder,
  removeCartItem,
  updateCartItem,
} from '@/shared/api/generated'
import type { NewOrder } from '@/shared/api/generated/model'
import { server } from '@/shared/mocks/node'
import { createShopHandlers, resetMockShop } from './shop'

// 커머스의 목 백엔드는 실제 백엔드처럼 장바구니와 주문을 기억하고 재고를 확인한다. 테스트는 재생성 계층의 fetch 함수로 부르고,
// 요청은 Vitest의 MSW(@/shared/mocks/node)가 받는다. 장바구니를 바꾸는 요청을 기다리지 않도록 지연 없는 핸들러를 앞에 둔다.

const SHIPPING: Omit<NewOrder, 'cartId'> = {
  recipient: '홍길동',
  phone: '010-1234-5678',
  postalCode: '04524',
  address: '서울특별시 중구 세종대로 110',
  paymentMethod: 'card',
  agreedToPurchase: true,
}

// 명세의 example: 1번 티셔츠(19,000원, 재고 50), 4번 토트백(25,000원, 재고 30), 5번 머플러(품절), 6번 머그(18,000원, 재고 2)
const T_SHIRT = 1
const TOTE_BAG = 4
const MUFFLER = 5
const MUG = 6

beforeEach(() => {
  resetMockShop()
  server.use(...createShopHandlers({ saveDelayMs: 0 }))
})

test('상품 목록과 상세는 명세의 example이고, 없는 상품은 404다', async () => {
  await expect(listCatalogProducts()).resolves.toHaveLength(6)
  await expect(getCatalogProduct(MUG)).resolves.toMatchObject({ name: '한정판 세라믹 머그', stock: 2 })
  await expect(getCatalogProduct(999)).rejects.toMatchObject({ name: 'ApiError', status: 404 })
})

test('처음 담는 상품으로 장바구니를 만들고, 담고 수량을 바꾸고 빼면 합계를 다시 계산한다', async () => {
  const created = await createCart({ productId: T_SHIRT, quantity: 2 })
  expect(created).toMatchObject({ totalQuantity: 2, totalPrice: 38000 })
  expect(created.id).toMatch(/^[\da-f-]{36}$/)

  await addCartItem(created.id, { productId: TOTE_BAG, quantity: 1 })
  // 이미 담긴 상품을 다시 담으면 수량을 더한다.
  await expect(addCartItem(created.id, { productId: T_SHIRT, quantity: 1 })).resolves.toMatchObject({
    items: [
      { productId: T_SHIRT, name: '오가닉 코튼 티셔츠', price: 19000, quantity: 3 },
      { productId: TOTE_BAG, name: '캔버스 토트백', price: 25000, quantity: 1 },
    ],
    totalQuantity: 4,
    totalPrice: 82000,
  })
  await expect(updateCartItem(created.id, TOTE_BAG, { quantity: 2 })).resolves.toMatchObject({
    totalQuantity: 5,
    totalPrice: 107000,
  })
  await expect(removeCartItem(created.id, T_SHIRT)).resolves.toMatchObject({
    items: [{ productId: TOTE_BAG, quantity: 2 }],
    totalPrice: 50000,
  })
  await expect(getCart(created.id)).resolves.toMatchObject({ totalQuantity: 2 })
})

test('재고보다 많이 담거나 품절된 상품을 담으면 409로 거절하고 장바구니를 바꾸지 않는다', async () => {
  const cart = await createCart({ productId: MUG, quantity: 2 })

  await expect(addCartItem(cart.id, { productId: MUG, quantity: 1 })).rejects.toMatchObject({
    status: 409,
    body: { message: '재고가 부족합니다. 남은 수량은 2개입니다.' },
  })
  await expect(updateCartItem(cart.id, MUG, { quantity: 3 })).rejects.toMatchObject({ status: 409 })
  await expect(addCartItem(cart.id, { productId: MUFFLER, quantity: 1 })).rejects.toMatchObject({
    status: 409,
    body: { message: '품절된 상품입니다.' },
  })
  await expect(createCart({ productId: MUG, quantity: 3 })).rejects.toMatchObject({ status: 409 })

  await expect(getCart(cart.id)).resolves.toMatchObject({ items: [{ productId: MUG, quantity: 2 }], totalQuantity: 2 })
})

test('없는 장바구니는 404이고, 장바구니에 없는 상품의 수량을 바꾸거나 빼도 404다', async () => {
  await expect(getCart('unknown-cart')).rejects.toMatchObject({ status: 404 })
  await expect(addCartItem('unknown-cart', { productId: T_SHIRT, quantity: 1 })).rejects.toMatchObject({
    status: 404,
  })
  const cart = await createCart({ productId: T_SHIRT, quantity: 1 })
  await expect(updateCartItem(cart.id, TOTE_BAG, { quantity: 2 })).rejects.toMatchObject({ status: 404 })
  await expect(removeCartItem(cart.id, TOTE_BAG)).rejects.toMatchObject({ status: 404 })
})

test('주문하면 장바구니의 상품으로 결제 대기 주문을 만들고, 결제를 확인하면 결제 완료가 되고 장바구니를 지운다', async () => {
  const cart = await createCart({ productId: T_SHIRT, quantity: 2 })

  const order = await placeOrder({ ...SHIPPING, cartId: cart.id })

  expect(order.id).toMatch(/^ORD-[\dA-F]{12}$/)
  expect(order).toEqual({
    id: order.id,
    status: 'pending',
    items: [{ productId: T_SHIRT, name: '오가닉 코튼 티셔츠', price: 19000, quantity: 2 }],
    totalQuantity: 2,
    totalPrice: 38000,
    recipient: '홍길동',
    phone: '010-1234-5678',
    postalCode: '04524',
    address: '서울특별시 중구 세종대로 110',
    paymentMethod: 'card',
  })
  // 결제가 끝날 때까지 장바구니는 그대로다(결제창에서 취소하면 장바구니로 돌아간다).
  await expect(getCart(cart.id)).resolves.toMatchObject({ totalQuantity: 2 })

  const paid = await confirmOrderPayment(order.id, { paymentKey: `fake-${order.id}`, amount: 38000 })

  expect(paid).toMatchObject({ id: order.id, status: 'paid' })
  await expect(getOrder(order.id)).resolves.toMatchObject({ status: 'paid' })
  await expect(getCart(cart.id)).rejects.toMatchObject({ status: 404 })
})

test('결제 금액이 주문 금액과 다르면 400, 이미 결제한 주문이면 409로 거절한다', async () => {
  const cart = await createCart({ productId: T_SHIRT, quantity: 1 })
  const order = await placeOrder({ ...SHIPPING, cartId: cart.id })

  await expect(confirmOrderPayment(order.id, { paymentKey: 'fake', amount: 1000 })).rejects.toMatchObject({
    status: 400,
    body: { message: '결제 금액이 주문 금액과 다릅니다.' },
  })
  await expect(getOrder(order.id)).resolves.toMatchObject({ status: 'pending' })

  await confirmOrderPayment(order.id, { paymentKey: 'fake', amount: 19000 })
  await expect(confirmOrderPayment(order.id, { paymentKey: 'fake', amount: 19000 })).rejects.toMatchObject({
    status: 409,
  })
})

test('비었거나 없는 장바구니는 주문하지 못하고, 없는 주문은 404다', async () => {
  const cart = await createCart({ productId: T_SHIRT, quantity: 1 })
  await removeCartItem(cart.id, T_SHIRT)

  await expect(placeOrder({ ...SHIPPING, cartId: cart.id })).rejects.toMatchObject({ status: 409 })
  await expect(placeOrder({ ...SHIPPING, cartId: 'unknown-cart' })).rejects.toMatchObject({ status: 404 })
  await expect(getOrder('ORD-UNKNOWN')).rejects.toMatchObject({ status: 404 })
})
