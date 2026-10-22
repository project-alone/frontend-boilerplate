// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/app/shop/orders/[orderId]/payment/page.tsx

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { FakePayment } from '@/features/shop-checkout/fake-payment'
import { getOrderQueryOptions } from '@/queries/orders/orders.queries'
import { ApiError } from '@/shared/api/api-fetch'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '결제',
  robots: { index: false },
}

interface OrderPaymentPageProps {
  params: Promise<{ orderId: string }>
}

// 커머스 Archetype의 가짜 결제 단계(주문서의 마지막 단계). SSR: 요청마다 서버에서 렌더링하며, 결제할 주문(getOrder)을 서버에서
// 가져와(prefetch) 테스트 결제창(FakePayment)에 hydration으로 넘긴다. 없는 주문이면 찾을 수 없음으로 답한다.
export default async function OrderPaymentPage({ params }: OrderPaymentPageProps) {
  await connection()
  const { orderId } = await params
  const queryClient = getQueryClient()
  await queryClient.query(getOrderQueryOptions(orderId)).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  })

  return (
    <main className="flex flex-col gap-6 p-4">
      <h1 className="text-lg font-semibold">결제</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <FakePayment orderId={orderId} />
      </HydrationBoundary>
    </main>
  )
}
