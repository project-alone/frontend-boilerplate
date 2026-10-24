import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { ProductList } from '@/features/product-list/product-list'
import { DemoPage } from '@/features/rendering-demo/demo-page'
import { RenderedAt } from '@/features/rendering-demo/rendered-at'
import { listProductsQueryOptions } from '@/queries/products/products.queries'
import { delay } from '@/shared/lib/async'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '스트리밍 · 라우트별 Rendering Mode',
}

// 느린 백엔드를 흉내 내려고 상품 목록을 가져오기 전에 기다리는 시간
const SLOW_BACKEND_DELAY_MS = 2_000

// 스트리밍: 요청마다 렌더링하는 라우트(SSR)에서 느린 부분만 <Suspense>로 감싼다. 서버는 나머지와 대체 UI(fallback)를 먼저
// 보내고, 느린 부분이 준비되면 같은 응답에 이어 보낸다. 라우트 전체의 대체 UI는 loading.tsx로 둔다.
export default async function StreamingPage() {
  await connection()

  return (
    <DemoPage title="스트리밍">
      <p>
        페이지의 나머지는 바로 보내고, 느린 데이터(여기서는 2초 걸리는 상품 목록)는 <code>&lt;Suspense&gt;</code>의 대체
        UI를 먼저 보낸 뒤 준비되면 같은 응답에 이어 보냅니다. 첫 화면이 가장 느린 데이터를 기다리지 않습니다.
        새로고침하면 불러오는 중이라는 안내가 먼저 보였다가 상품 목록으로 바뀝니다.
      </p>
      <RenderedAt />
      <Suspense fallback={<p role="status">상품을 불러오는 중입니다.</p>}>
        <SlowProducts />
      </Suspense>
    </DemoPage>
  )
}

// 서버에서 상품 목록을 가져와(prefetch) 클라이언트 컴포넌트에 hydration으로 넘긴다(/products와 같은 방식). <Suspense>가 이
// 부분만 기다리도록 따로 렌더링하는 async 컴포넌트로 둔다.
async function SlowProducts() {
  await delay(SLOW_BACKEND_DELAY_MS)
  const queryClient = getQueryClient()
  await queryClient.query(listProductsQueryOptions())

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductList />
    </HydrationBoundary>
  )
}
