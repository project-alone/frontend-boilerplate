import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { ListProductsView } from '@/features/catalog/list-products-view'
import { listProductsQueryOptions } from '@/queries/products/products.queries'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '상품 목록',
}

// SSG: 빌드할 때 렌더링해 둔 HTML을 모든 요청에 그대로 보낸다. 'error'는 이 라우트가 요청마다 달라지는 값
// (cookies(), headers(), searchParams 등)을 읽으면 SSR로 바뀌는 대신 빌드를 실패시켜 SSG임을 지킨다.
export const dynamic = 'error'

// listProducts의 데이터는 렌더링할 때 서버에서 가져와(prefetch) ListProductsView에 hydration으로 넘긴다. 가져온 지
// staleTime(src/shared/query-client/get-query-client.ts)이 지난 데이터는 브라우저가 화면을 연 뒤 다시 가져온다.
// 빌드할 때 서버 컴포넌트가 백엔드를 부르므로 배포용 빌드에는 API_BASE_URL(백엔드 주소)을 넣는다. API_MOCKING=enabled로
// 빌드하면(GitLab CI의 build 잡) MSW의 목 응답으로 렌더링하므로 그 결과는 배포하지 않는다(README의 "실행과 배포").
// 화면은 Feature의 컴포넌트를 조합해 그린다(ADR-0005).
export default async function ModesSsgPage() {
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
