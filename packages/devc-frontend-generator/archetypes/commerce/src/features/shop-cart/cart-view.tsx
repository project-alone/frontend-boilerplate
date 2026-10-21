'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useId } from 'react'
import { getCartQueryOptions, useRemoveCartItemMutation, useUpdateCartItemMutation } from '@/queries/cart/cart.queries'
import type { CartItem } from '@/shared/api/generated/model'
import { currentCartQuery, useCartId, useForgetMissingCart } from '@/shared/shop/cart-id'
import { formatPrice } from '@/shared/shop/price'
import { isNotFound, shopFailureReason } from '@/shared/shop/shop-errors'
import { CHECKOUT_PATH, productPath, SHOP_PATH } from '@/shared/shop/shop-routes'
import { Button, buttonVariants } from '@/shared/ui/button'
import { useToast } from '@/shared/ui/toast'

// 명세(CartItem.quantity)가 받는 가장 큰 수량
const MAX_QUANTITY = 99

/**
 * 장바구니(getCart). 담긴 상품마다 수량을 줄이고 늘리거나 뺄 수 있고, 합계와 주문하기 링크를 보여 준다.
 *
 * 수량을 바꾸거나 빼면 cart Query Domain의 뮤테이션 훅(useUpdateCartItemMutation, useRemoveCartItemMutation)이 응답을 기다리지
 * 않고 장바구니 쿼리의 캐시를 고치므로(낙관적 업데이트) 줄의 수량, 금액, 합계, 쇼핑몰 안 이동의 수량이 바로 바뀐다. 백엔드가
 * 거절하면(재고 부족 등) 훅이 캐시를 되돌리고, 이 화면이 무엇을 왜 되돌렸는지 알림(Toast)으로 알린다. 성공하든 실패하든 끝나면
 * 훅이 장바구니를 다시 가져와 백엔드의 값으로 맞춘다.
 */
export function CartView() {
  const cartId = useCartId()
  const { data: cart, error, isError } = useQuery({ ...getCartQueryOptions(cartId ?? ''), ...currentCartQuery(cartId) })
  useForgetMissingCart(error)
  const summaryId = useId()
  const toast = useToast()
  // 뺀 줄은 응답 전에 사라지므로(낙관적 업데이트) 빼기는 줄 대신 목록이 맡는다. 줄이 사라진 뒤에도 실패를 알릴 수 있다.
  const remove = useRemoveCartItemMutation(cartId ?? '')

  // 서버가 렌더링할 때와 hydration 중에는 브라우저에 둔 장바구니 id를 아직 모른다.
  if (cartId === undefined) return <p role="status">장바구니를 불러오는 중입니다.</p>
  if (cartId !== null && isError && !isNotFound(error)) return <p role="alert">장바구니를 불러오지 못했습니다.</p>
  if (cartId !== null && cart === undefined && !isError) return <p role="status">장바구니를 불러오는 중입니다.</p>
  if (cartId === null || cart === undefined || cart.items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>장바구니가 비어 있습니다.</p>
        <Link href={SHOP_PATH} className="focus-ring rounded-sm underline underline-offset-4">
          상품 보러 가기
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <ul aria-label="담은 상품" className="flex flex-col gap-4">
        {cart.items.map((item) => (
          <CartLine
            key={item.productId}
            cartId={cart.id}
            item={item}
            onRemove={() => {
              remove.mutate(
                { cartId: cart.id, productId: item.productId },
                {
                  onError: (removeError) => {
                    toast.add({
                      type: 'error',
                      title: '장바구니에서 빼지 못해 되돌렸습니다',
                      description: `${item.name}: ${shopFailureReason(removeError)}`,
                    })
                  },
                },
              )
            }}
          />
        ))}
      </ul>
      <section aria-labelledby={summaryId} className="flex flex-col items-start gap-2">
        <h2 id={summaryId} className="text-md font-semibold">
          주문 금액
        </h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">상품 수량</dt>
          <dd>{cart.totalQuantity}개</dd>
          <dt className="text-muted-foreground">합계</dt>
          <dd className="font-semibold">{formatPrice(cart.totalPrice)}</dd>
        </dl>
        <Link href={CHECKOUT_PATH} className={buttonVariants()}>
          주문하기
        </Link>
      </section>
    </div>
  )
}

/**
 * 담은 상품 한 줄. 줄마다 수량을 바꾸는 뮤테이션 훅을 따로 써서, 여러 상품을 잇달아 바꿔도 저장 중인지를 줄마다 보여 준다
 * (aria-busy). 수량은 줄마다의 상태 문구(output)라 바뀌면 스크린 리더가 읽는다.
 */
function CartLine({ cartId, item, onRemove }: Readonly<{ cartId: string; item: CartItem; onRemove: () => void }>) {
  const toast = useToast()
  const update = useUpdateCartItemMutation(cartId)

  const changeQuantity = (quantity: number) => {
    update.mutate(
      { cartId, productId: item.productId, cartItemUpdate: { quantity } },
      {
        // 캐시는 뮤테이션 훅이 이미 되돌렸다. 화면은 무엇이 왜 되돌아갔는지 알리기만 한다.
        onError: (error) => {
          toast.add({
            type: 'error',
            title: '수량을 바꾸지 못해 되돌렸습니다',
            description: `${item.name}: ${shopFailureReason(error)}`,
          })
        },
      },
    )
  }

  return (
    <li
      aria-busy={update.isPending}
      className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border p-4"
    >
      <div className="flex min-w-48 flex-1 flex-col">
        <Link
          href={productPath(item.productId)}
          className="focus-ring rounded-sm font-semibold underline-offset-4 hover:underline"
        >
          {item.name}
        </Link>
        <span className="text-sm text-muted-foreground">{formatPrice(item.price)}</span>
      </div>
      <div role="group" aria-label={`${item.name} 수량`} className="flex items-center gap-2">
        {/* 1개에서는 줄이지 못한다. 키보드 포커스가 사라지지 않도록 끈 버튼도 포커스를 받는다. */}
        <Button
          variant="secondary"
          size="sm"
          aria-label={`${item.name} 수량 줄이기`}
          disabled={item.quantity <= 1}
          focusableWhenDisabled
          onClick={() => {
            changeQuantity(item.quantity - 1)
          }}
        >
          <span aria-hidden="true">−</span>
        </Button>
        <output className="min-w-8 text-center">{item.quantity}</output>
        <Button
          variant="secondary"
          size="sm"
          aria-label={`${item.name} 수량 늘리기`}
          disabled={item.quantity >= MAX_QUANTITY}
          focusableWhenDisabled
          onClick={() => {
            changeQuantity(item.quantity + 1)
          }}
        >
          <span aria-hidden="true">+</span>
        </Button>
      </div>
      <span className="min-w-24 text-right font-semibold">{formatPrice(item.price * item.quantity)}</span>
      <Button variant="secondary" size="sm" aria-label={`${item.name} 빼기`} onClick={onRemove}>
        빼기
      </Button>
      {update.isPending && <span className="text-sm text-muted-foreground">저장 중</span>}
    </li>
  )
}
