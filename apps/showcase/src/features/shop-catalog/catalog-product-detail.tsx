// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/features/shop-catalog/catalog-product-detail.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import { getCatalogProductQueryOptions } from '@/queries/catalog/catalog.queries'
import { formatPrice } from '@/shared/shop/price'
import { StockLabel } from './stock-label'

/**
 * 상품 상세(getCatalogProduct)의 가격, 재고, 설명. `npm run g -- page shop/products/[productId] --mode isr --query
 * getCatalogProduct`가 만든 보기에서 보여 줄 값을 고쳤다. 상품 이름은 페이지의 제목이다. 장바구니에 담는 폼은 장바구니
 * Feature(src/features/shop-cart)의 것을 페이지가 함께 놓는다.
 */
export function CatalogProductDetail({ productId }: Readonly<{ productId: number }>) {
  const { data: product, isPending, isError } = useQuery(getCatalogProductQueryOptions(productId))

  if (isPending) return <p role="status">상품을 불러오는 중입니다.</p>
  if (isError) return <p role="alert">상품을 불러오지 못했습니다.</p>

  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg font-semibold">{formatPrice(product.price)}</p>
      <StockLabel stock={product.stock} />
      <p>{product.description}</p>
    </div>
  )
}
