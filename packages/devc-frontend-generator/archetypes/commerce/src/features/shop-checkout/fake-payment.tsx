'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId } from 'react'
import { getOrderQueryOptions, useConfirmOrderPaymentMutation } from '@/queries/orders/orders.queries'
import { removeDraft } from '@/shared/multi-step-form/draft-storage'
import { StepIndicator } from '@/shared/multi-step-form/step-indicator'
import { forgetCartId } from '@/shared/shop/cart-id'
import { formatPrice } from '@/shared/shop/price'
import { shopFailureReason } from '@/shared/shop/shop-errors'
import { PAYMENT_METHOD_LABELS } from '@/shared/shop/shop-labels'
import { CHECKOUT_PATH, orderPath } from '@/shared/shop/shop-routes'
import { Button, buttonVariants } from '@/shared/ui/button'
import { useToast } from '@/shared/ui/toast'
import { CHECKOUT_DRAFT_KEY, CHECKOUT_STEP_TITLES } from './checkout-steps'

/**
 * 주문서의 마지막 단계인 가짜 결제(테스트 결제창). PG(결제대행사)를 연동하지 않으므로 결제 수단과 상관없이 이 화면이 PG의
 * 결제창을 대신한다. "결제 승인"을 누르면 결제창이 결제 키를 돌려준 것처럼 orders Query Domain의
 * useConfirmOrderPaymentMutation으로 결제를 확인하고(명세의 confirmOrderPayment), 주문 완료 화면으로 간다. 결제를 마치면
 * 백엔드가 주문한 장바구니를 지우므로 이 브라우저에 둔 장바구니 id와 입력하던 주문서도 지운다. "결제 취소"는 입력한 값이 남은
 * 주문서로 돌아간다.
 *
 * 실제 PG를 연동할 때는 "결제 승인" 대신 PG의 결제창(SDK)을 열고, PG가 돌려준 paymentKey로 같은 뮤테이션을 부른다. 백엔드가
 * PG에 결제를 승인받고 금액(amount)이 주문 금액과 같은지 확인한다. 비밀 키가 필요한 승인 요청은 브라우저가 아니라 백엔드가 보낸다.
 */
export function FakePayment({ orderId }: Readonly<{ orderId: string }>) {
  const { data: order, isPending, isError } = useQuery(getOrderQueryOptions(orderId))
  const confirm = useConfirmOrderPaymentMutation()
  const router = useRouter()
  const toast = useToast()
  const headingId = useId()

  if (isPending) return <p role="status">주문을 불러오는 중입니다.</p>
  if (isError) return <p role="alert">주문을 불러오지 못했습니다.</p>
  if (order.status === 'paid') {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>이미 결제한 주문입니다.</p>
        <Link href={orderPath(order.id)} className="focus-ring rounded-sm underline underline-offset-4">
          주문 내역 보기
        </Link>
      </div>
    )
  }

  const approve = () => {
    confirm.mutate(
      { orderId: order.id, orderPayment: { paymentKey: `fake-${order.id}`, amount: order.totalPrice } },
      {
        onSuccess: () => {
          forgetCartId()
          removeDraft(CHECKOUT_DRAFT_KEY)
          router.push(orderPath(order.id))
        },
        onError: (error) => {
          toast.add({ type: 'error', title: '결제하지 못했습니다', description: shopFailureReason(error) })
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator label="주문 단계" steps={CHECKOUT_STEP_TITLES} current={CHECKOUT_STEP_TITLES.length - 1} />
      <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-lg border border-border p-4">
        <h2 id={headingId} className="text-md font-semibold">
          테스트 결제창
        </h2>
        <p className="text-sm text-muted-foreground">
          PG(결제대행사)를 연동하지 않은 가짜 결제창입니다. 승인해도 실제로 결제되지 않습니다.
        </p>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">주문 번호</dt>
          <dd>{order.id}</dd>
          <dt className="text-muted-foreground">결제 수단</dt>
          <dd>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</dd>
          <dt className="text-muted-foreground">결제 금액</dt>
          <dd className="font-semibold">{formatPrice(order.totalPrice)}</dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          {/* 결제를 확인하고 주문 완료 화면으로 옮겨 가는 동안에는 다시 누르지 못한다. */}
          <Button onClick={approve} disabled={confirm.isPending || confirm.isSuccess}>
            결제 승인
          </Button>
          <Link href={CHECKOUT_PATH} className={buttonVariants({ variant: 'secondary' })}>
            결제 취소
          </Link>
        </div>
      </section>
    </div>
  )
}
