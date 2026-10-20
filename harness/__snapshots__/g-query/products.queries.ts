import { queryOptions } from '@tanstack/react-query'
import { listProducts, getProduct } from '@/shared/api/generated'
import type { ListProductsParams } from '@/shared/api/generated/model'
import { productsKeys } from './products.keys'

// products Query Domain의 queryOptions. 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 같은 옵션을 쓴다.

export function listProductsQueryOptions(params: ListProductsParams = {}) {
  return queryOptions({
    queryKey: productsKeys.listProducts(params),
    queryFn: ({ signal }) => listProducts(params, { signal }),
  })
}

export function getProductQueryOptions(productId: number) {
  return queryOptions({
    queryKey: productsKeys.getProduct(productId),
    queryFn: ({ signal }) => getProduct(productId, { signal }),
  })
}
