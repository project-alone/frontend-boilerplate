// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/route-rendering/src/features/rendering-demo/browser-product-list.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import { listProductsQueryOptions } from '@/queries/products/products.queries'

/**
 * 브라우저가 상품 목록을 가져와 보여 준다(CSR). 서버가 미리 가져온 데이터가 없으므로 서버가 보낸 HTML에는 불러오는 중
 * 상태가 담기고, 브라우저가 BFF 프록시(/api/proxy)로 데이터를 받은 뒤에 목록을 그린다.
 */
export function BrowserProductList() {
  const { data: products, isPending, isError } = useQuery(listProductsQueryOptions())

  if (isPending) return <p role="status">상품을 불러오는 중입니다.</p>
  if (isError) return <p role="alert">상품을 불러오지 못했습니다.</p>
  if (products.length === 0) return <p>등록된 상품이 없습니다.</p>

  return (
    <ul className="list-disc pl-6">
      {products.map((product) => (
        <li key={product.id}>
          {product.name} · {product.price.toLocaleString('ko-KR')}원
        </li>
      ))}
    </ul>
  )
}
