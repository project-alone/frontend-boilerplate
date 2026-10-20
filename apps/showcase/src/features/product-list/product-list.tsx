// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/features/product-list/product-list.tsx

'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { listProductsQueryOptions } from '@/queries/products/products.queries'

export function ProductList() {
  const { data: products } = useSuspenseQuery(listProductsQueryOptions())

  if (products.length === 0) return <p>등록된 상품이 없습니다.</p>

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>
          {product.name} · {product.price.toLocaleString('ko-KR')}원
        </li>
      ))}
    </ul>
  )
}
