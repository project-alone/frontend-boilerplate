import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { GetProductView } from '@/features/product-detail/get-product-view'
import { getProductQueryOptions } from '@/queries/products/products.queries'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '상품 상세',
}

interface ProductsProductIdPageProps {
  params: Promise<{ productId: string }>
}

// SSR: 요청마다 서버에서 렌더링한다. connection()을 기다리면 Next.js가 이 라우트를 빌드할 때 미리 렌더링하지 않는다.
// 페이지가 데이터를 기다리는 동안에는 loading.tsx를 먼저 보낸다.
// getProduct의 데이터는 서버에서 가져와(prefetch) GetProductView에 hydration으로 넘기므로 브라우저가 다시 요청하지 않는다.
// 화면은 Feature의 컴포넌트를 조합해 그린다(ADR-0005).
export default async function ProductsProductIdPage({ params }: ProductsProductIdPageProps) {
  await connection()
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
