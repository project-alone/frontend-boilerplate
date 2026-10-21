'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useId } from 'react'
import { getOrderQueryOptions } from '@/queries/orders/orders.queries'
import { PAYMENT_METHOD_LABELS } from '@/shared/shop/shop-labels'
import { orderPaymentPath, SHOP_PATH } from '@/shared/shop/shop-routes'
import { buttonVariants } from '@/shared/ui/button'
import { OrderLines } from './order-lines'

/**
 * 주문 완료(getOrder). `npm run g -- page shop/orders/[orderId] --mode ssr --query getOrder`가 만든 보기에서 주문 번호, 주문한
 * 상품, 배송 정보, 결제 수단을 보여 주게 고쳤다. 아직 결제하지 않은 주문이면 결제창으로 안내한다.
 */
export function OrderComplete({ orderId }: Readonly<{ orderId: string }>) {
  const { data: order, isPending, isError } = useQuery(getOrderQueryOptions(orderId))
  const shippingId = useId()

  if (isPending) return <p role="status">주문을 불러오는 중입니다.</p>
  if (isError) return <p role="alert">주문을 불러오지 못했습니다.</p>

  if (order.status === 'pending') {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>아직 결제하지 않은 주문입니다(주문 번호 {order.id}).</p>
        <Link href={orderPaymentPath(order.id)} className={buttonVariants()}>
          결제하기
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-6">
      <p>
        주문해 주셔서 감사합니다. 주문 번호는 <strong>{order.id}</strong>입니다.
      </p>
      <OrderLines caption="주문한 상품" lines={order.items} totalPrice={order.totalPrice} />
      <section aria-labelledby={shippingId} className="flex flex-col gap-2">
        <h2 id={shippingId} className="text-md font-semibold">
          배송과 결제
        </h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">받는 사람</dt>
          <dd>{order.recipient}</dd>
          <dt className="text-muted-foreground">연락처</dt>
          <dd>{order.phone}</dd>
          <dt className="text-muted-foreground">주소</dt>
          <dd>{[order.postalCode, order.address, order.addressDetail ?? ''].join(' ').trim()}</dd>
          <dt className="text-muted-foreground">결제 수단</dt>
          <dd>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</dd>
        </dl>
      </section>
      <Link href={SHOP_PATH} className="focus-ring rounded-sm underline underline-offset-4">
        쇼핑 계속하기
      </Link>
    </div>
  )
}
