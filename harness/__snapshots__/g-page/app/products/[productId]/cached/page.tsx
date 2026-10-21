import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GetProductView } from '@/features/product-detail/get-product-view'
import { getProductQueryOptions } from '@/queries/products/products.queries'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '상품 상세',
}

// ISR: 빌드할 때 렌더링해 둔 HTML을 보내다가, 렌더링한 지 revalidate초가 지난 뒤 요청이 오면 그 요청에는 이전 HTML을
// 보내고 뒤에서 다시 렌더링한다. Next.js가 빌드할 때 읽으므로 값은 상수로 적는다.
export const revalidate = 60

// 빌드할 때 미리 렌더링할 경로. 빈 목록이면 빌드할 때는 렌더링하지 않고, 처음 요청이 온 경로를 렌더링해 두었다가
// 다음 요청부터 보낸다. 빌드할 때 렌더링할 경로가 있으면 { productId: '1' }처럼 돌려준다.
export function generateStaticParams(): { productId: string }[] {
  return []
}

interface ProductsProductIdCachedPageProps {
  params: Promise<{ productId: string }>
}

// getProduct의 데이터는 렌더링할 때 서버에서 가져와(prefetch) GetProductView에 hydration으로 넘긴다. 가져온 지
// staleTime(src/shared/query-client/get-query-client.ts)이 지난 데이터는 브라우저가 화면을 연 뒤 다시 가져온다.
// generateStaticParams가 돌려준 경로는 빌드할 때 렌더링하며 백엔드를 부르므로, 그런 경로가 있으면 배포용 빌드에
// API_BASE_URL(백엔드 주소)을 넣는다. API_MOCKING=enabled로 만든 목 빌드는 배포하지 않는다(README의 "실행과 배포").
// 화면은 Feature의 컴포넌트를 조합해 그린다(ADR-0005).
export default async function ProductsProductIdCachedPage({ params }: ProductsProductIdCachedPageProps) {
  const { productId: productIdParam } = await params
  const productId = Number(productIdParam)
  // 경로의 productId가 정수가 아니면 없는 페이지로 본다.
  if (!Number.isInteger(productId)) notFound()
  const queryClient = getQueryClient()
  await queryClient.query(getProductQueryOptions(productId))

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">상품 상세</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <GetProductView productId={productId} />
      </HydrationBoundary>
    </main>
  )
}
