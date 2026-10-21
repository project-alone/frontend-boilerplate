// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/app/shop/page.tsx

import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { CatalogProductList } from '@/features/shop-catalog/catalog-product-list'
import { listCatalogProductsQueryOptions } from '@/queries/catalog/catalog.queries'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '상품',
  description: '판매하는 상품을 둘러보고 장바구니에 담습니다.',
}

// ISR: 빌드할 때 렌더링해 둔 HTML을 보내다가, 렌더링한 지 revalidate초가 지난 뒤 요청이 오면 그 요청에는 이전 HTML을
// 보내고 뒤에서 다시 렌더링한다. Next.js가 빌드할 때 읽으므로 값은 상수로 적는다.
// 커머스 Archetype: 진열하는 상품이 바뀌는 일은 드물어 5분으로 둔다. 가격과 재고는 늦게 보여도 장바구니에 담을 때와 주문할 때
// 백엔드가 다시 확인한다.
export const revalidate = 300

// `npm run g -- page shop --mode isr --query listCatalogProducts --feature shop-catalog`로 만든 페이지다.
// listCatalogProducts의 데이터는 렌더링할 때 서버에서 가져와(prefetch) CatalogProductList에 hydration으로 넘긴다. 가져온 지
// staleTime(src/shared/query-client/get-query-client.ts)이 지난 데이터는 브라우저가 화면을 연 뒤 다시 가져온다.
// 빌드할 때 서버 컴포넌트가 백엔드를 부르므로 배포용 빌드에는 API_BASE_URL(백엔드 주소)을 넣는다. API_MOCKING=enabled로
// 빌드하면(GitLab CI의 build 잡) MSW의 목 응답으로 렌더링하므로 그 결과는 배포하지 않는다(README의 "실행과 배포").
// 화면은 Feature의 컴포넌트를 조합해 그린다(ADR-0005).
export default async function ShopPage() {
  const queryClient = getQueryClient()
  await queryClient.query(listCatalogProductsQueryOptions())

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">상품</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CatalogProductList />
      </HydrationBoundary>
    </main>
  )
}
