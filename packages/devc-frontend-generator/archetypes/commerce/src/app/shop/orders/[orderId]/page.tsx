import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { OrderComplete } from '@/features/shop-checkout/order-complete'
import { getOrderQueryOptions } from '@/queries/orders/orders.queries'
import { isApiError } from '@/shared/api/api-fetch'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '주문 완료',
  robots: { index: false },
}

interface OrderPageProps {
  params: Promise<{ orderId: string }>
}

// 커머스 Archetype의 주문 완료. `npm run g -- page shop/orders/[orderId] --mode ssr --query getOrder --feature shop-checkout`으로
// 만든 페이지다. SSR: 요청마다 서버에서 렌더링하며, 결제를 마친 주문(getOrder)을 서버에서 가져와(prefetch) OrderComplete에
// hydration으로 넘긴다. 없는 주문이면 찾을 수 없음으로 답한다.
export default async function OrderPage({ params }: OrderPageProps) {
  await connection()
  const { orderId } = await params
  const queryClient = getQueryClient()
  const order = await queryClient.query(getOrderQueryOptions(orderId)).catch((error: unknown) => {
    if (isApiError(error, 404)) notFound()
    throw error
  })

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">{order.status === 'paid' ? '주문 완료' : '결제 대기 중인 주문'}</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <OrderComplete orderId={orderId} />
      </HydrationBoundary>
    </main>
  )
}
