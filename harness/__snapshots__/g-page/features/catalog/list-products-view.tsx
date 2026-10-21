'use client'

import { useQuery } from '@tanstack/react-query'
import { listProductsQueryOptions } from '@/queries/products/products.queries'

/**
 * listProducts(상품 목록)의 결과를 보여 준다. 데이터는 products Query Domain의 listProductsQueryOptions로 가져온다.
 * 페이지가 서버에서 가져와(prefetch) hydration으로 넘긴 데이터가 있으면 그대로 그리고, 없으면(CSR) 브라우저가 가져온다.
 * 항목마다 name을 보여 준다. 보여 줄 값과 모양은 화면에 맞게 고친다.
 */
export function ListProductsView() {
  const { data, isPending, isError } = useQuery(listProductsQueryOptions())

  if (isPending) return <p role="status">불러오는 중입니다.</p>
  if (isError) return <p role="alert">불러오지 못했습니다.</p>
  if (data.length === 0) return <p>항목이 없습니다.</p>

  return (
    <ul className="list-disc pl-6">
      {data.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  )
}
