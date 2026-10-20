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
