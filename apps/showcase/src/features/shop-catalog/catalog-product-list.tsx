// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/features/shop-catalog/catalog-product-list.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { listCatalogProductsQueryOptions } from '@/queries/catalog/catalog.queries'
import { formatPrice } from '@/shared/shop/price'
import { productPath } from '@/shared/shop/shop-routes'
import { StockLabel } from './stock-label'

/**
 * 상품 목록(listCatalogProducts). `npm run g -- page shop --mode isr --query listCatalogProducts`가 만든 보기에서 상품마다
 * 이름(상세로 가는 링크), 소개, 가격, 재고를 보여 주게 고쳤다. 페이지(ISR)가 렌더링할 때 서버에서 가져와(prefetch)
 * hydration으로 넘긴 데이터를 그대로 그린다.
 */
export function CatalogProductList() {
  const { data, isPending, isError } = useQuery(listCatalogProductsQueryOptions())

  if (isPending) return <p role="status">상품을 불러오는 중입니다.</p>
  if (isError) return <p role="alert">상품을 불러오지 못했습니다.</p>
  if (data.length === 0) return <p>판매하는 상품이 없습니다.</p>

  return (
    <ul aria-label="상품 목록" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((product) => (
        <li key={product.id} className="flex flex-col gap-1 rounded-lg border border-border p-4">
          <h2 className="text-md font-semibold">
            <Link href={productPath(product.id)} className="focus-ring rounded-sm underline-offset-4 hover:underline">
              {product.name}
            </Link>
          </h2>
          <p className="text-sm text-muted-foreground">{product.summary}</p>
          <p className="font-semibold">{formatPrice(product.price)}</p>
          <StockLabel stock={product.stock} />
        </li>
      ))}
    </ul>
  )
}
