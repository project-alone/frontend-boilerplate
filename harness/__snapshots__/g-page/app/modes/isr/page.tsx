import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { ListProductsView } from '@/features/catalog/list-products-view'
import { listProductsQueryOptions } from '@/queries/products/products.queries'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '상품 목록',
}

// ISR: 빌드할 때 렌더링해 둔 HTML을 보내다가, 렌더링한 지 revalidate초가 지난 뒤 요청이 오면 그 요청에는 이전 HTML을
// 보내고 뒤에서 다시 렌더링한다. Next.js가 빌드할 때 읽으므로 값은 상수로 적는다.
export const revalidate = 60

// listProducts의 데이터는 렌더링할 때 서버에서 가져와(prefetch) ListProductsView에 hydration으로 넘긴다. 가져온 지
// staleTime(src/shared/query-client/get-query-client.ts)이 지난 데이터는 브라우저가 화면을 연 뒤 다시 가져온다.
// 빌드할 때 서버 컴포넌트가 백엔드를 부르므로 npm run build를 실행하는 환경에 API_BASE_URL(백엔드 주소)을 넣는다.
// 화면은 Feature의 컴포넌트를 조합해 그린다(ADR-0005).
export default async function ModesIsrPage() {
  const queryClient = getQueryClient()
  await queryClient.query(listProductsQueryOptions())

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">상품 목록</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ListProductsView />
      </HydrationBoundary>
    </main>
  )
}
