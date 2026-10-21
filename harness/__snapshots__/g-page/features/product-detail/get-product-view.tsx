'use client'

import { useQuery } from '@tanstack/react-query'
import { getProductQueryOptions } from '@/queries/products/products.queries'

export interface GetProductViewProps {
  /** 요청 경로의 productId */
  productId: number
}

/**
 * getProduct(상품 상세)의 결과를 보여 준다. 데이터는 products Query Domain의 getProductQueryOptions로 가져온다.
 * 페이지가 서버에서 가져와(prefetch) hydration으로 넘긴 데이터가 있으면 그대로 그리고, 없으면(CSR) 브라우저가 가져온다.
 * 응답의 속성마다 이름과 값을 보여 준다. 보여 줄 값과 모양은 화면에 맞게 고친다.
 */
export function GetProductView({ productId }: GetProductViewProps) {
  const { data, isPending, isError } = useQuery(getProductQueryOptions(productId))

  if (isPending) return <p role="status">불러오는 중입니다.</p>
  if (isError) return <p role="alert">불러오지 못했습니다.</p>

  return (
    <dl className="flex flex-col gap-1">
      {Object.entries(data).map(([name, value]) => (
        <div key={name} className="flex gap-2">
          <dt className="font-semibold">{name}</dt>
          <dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
        </div>
      ))}
    </dl>
  )
}
