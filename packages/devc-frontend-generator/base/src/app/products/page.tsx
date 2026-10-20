import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { ProductList } from '@/features/product-list/product-list'
import { listProductsQueryOptions } from '@/queries/products/products.queries'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '상품',
}

// API 계층 샘플: 서버 컴포넌트가 백엔드에서 데이터를 미리 가져오고(prefetch), 클라이언트 컴포넌트가
// hydration으로 이어받아 브라우저에서 다시 요청하지 않는다.
export default async function ProductsPage() {
  // 빌드할 때가 아니라 요청마다 렌더링한다(SSR). 빌드할 때는 부를 백엔드가 없다.
  await connection()
  const queryClient = getQueryClient()
  await queryClient.query(listProductsQueryOptions())

  return (
    <main>
      <h1>상품</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ProductList />
      </HydrationBoundary>
    </main>
  )
}
