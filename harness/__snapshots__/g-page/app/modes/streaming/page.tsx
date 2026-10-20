import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { ListProductsView } from '@/features/catalog/list-products-view'
import { listProductsQueryOptions } from '@/queries/products/products.queries'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '상품 목록',
}

// 스트리밍: SSR처럼 요청마다 렌더링하고, 느린 부분만 <Suspense>로 감싼다. 서버는 나머지와 대체 UI(fallback)를 먼저 보내고,
// 느린 부분이 준비되면 같은 응답에 이어 보낸다.
// listProducts의 데이터는 서버에서 가져와(prefetch) ListProductsView에 hydration으로 넘기므로 브라우저가 다시 요청하지 않는다.
// 화면은 Feature의 컴포넌트를 조합해 그린다(ADR-0005).
export default async function ModesStreamingPage() {
  await connection()

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">상품 목록</h1>
      <Suspense fallback={<p role="status">불러오는 중입니다.</p>}>
        <PrefetchedListProducts />
      </Suspense>
    </main>
  )
}

// listProducts의 데이터를 서버에서 가져와(prefetch) ListProductsView에 hydration으로 넘긴다. 이 컴포넌트가 데이터를 기다리는
// 동안 페이지는 <Suspense>의 대체 UI를 먼저 보낸다.
async function PrefetchedListProducts() {
  const queryClient = getQueryClient()
  await queryClient.query(listProductsQueryOptions())

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ListProductsView />
    </HydrationBoundary>
  )
}
