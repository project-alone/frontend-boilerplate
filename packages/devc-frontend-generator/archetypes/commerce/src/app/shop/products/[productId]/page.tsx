import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AddToCartForm } from '@/features/shop-cart/add-to-cart-form'
import { CatalogProductDetail } from '@/features/shop-catalog/catalog-product-detail'
import { getCatalogProductQueryOptions, listCatalogProductsQueryOptions } from '@/queries/catalog/catalog.queries'
import { ApiError } from '@/shared/api/api-fetch'
import { getQueryClient } from '@/shared/query-client/get-query-client'

// ISR: 빌드할 때 렌더링해 둔 HTML을 보내다가, 렌더링한 지 revalidate초가 지난 뒤 요청이 오면 그 요청에는 이전 HTML을
// 보내고 뒤에서 다시 렌더링한다. Next.js가 빌드할 때 읽으므로 값은 상수로 적는다.
// 커머스 Archetype: 상세는 사려는 사람이 가격과 재고를 보는 화면이라 목록(5분)보다 짧은 1분으로 둔다. 그래도 늦을 수 있는 재고는
// 장바구니에 담을 때 백엔드가 다시 확인한다.
export const revalidate = 60

// 빌드할 때 진열한 모든 상품의 상세를 미리 렌더링한다. 빌드한 뒤에 더한 상품은 처음 요청이 올 때 렌더링해 두었다가 다음
// 요청부터 보낸다(dynamicParams의 기본값). 상품이 아주 많으면 많이 보는 상품만 돌려준다. 빌드할 때 백엔드를 부르므로 배포용
// 빌드에는 API_BASE_URL(백엔드 주소)을 넣고, API_MOCKING=enabled로 만든 목 빌드는 배포하지 않는다(README의 "실행과 배포").
export async function generateStaticParams(): Promise<{ productId: string }[]> {
  const products = await getQueryClient().query(listCatalogProductsQueryOptions())
  return products.map(({ id }) => ({ productId: String(id) }))
}

interface ProductPageProps {
  params: Promise<{ productId: string }>
}

// 검색 결과와 공유 카드에 상품 이름과 소개가 보이게 한다. 상품을 가져오지 못하면 레이아웃의 제목을 쓰고, 없는 상품은 페이지가
// 찾을 수 없음으로 답한다.
export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const productId = Number((await params).productId)
  if (!Number.isInteger(productId)) return {}
  const product = await getQueryClient()
    .query(getCatalogProductQueryOptions(productId))
    .catch(() => undefined)
  return product === undefined ? {} : { title: product.name, description: product.summary }
}

// `npm run g -- page shop/products/[productId] --mode isr --query getCatalogProduct --feature shop-catalog`로 만든 페이지에
// 상품 이름 제목과 장바구니에 담는 폼(shop-cart Feature)을 더했다. 상품은 렌더링할 때 서버에서 가져와(prefetch) hydration으로
// 넘기고, 상세와 담는 폼이 같은 쿼리(getCatalogProduct)를 쓴다. 화면은 Feature의 컴포넌트를 조합해 그린다(ADR-0005).
export default async function ProductPage({ params }: ProductPageProps) {
  const { productId: productIdParam } = await params
  const productId = Number(productIdParam)
  // 경로의 productId가 정수가 아니거나 그런 상품이 없으면 없는 페이지로 본다.
  if (!Number.isInteger(productId)) notFound()
  const queryClient = getQueryClient()
  const product = await queryClient.query(getCatalogProductQueryOptions(productId)).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  })

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">{product.name}</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CatalogProductDetail productId={productId} />
        <AddToCartForm productId={productId} />
      </HydrationBoundary>
    </main>
  )
}
