// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/queries/products/products.queries.ts

import { queryOptions } from '@tanstack/react-query'
import { listProducts } from '@/shared/api/generated'
import type { ListProductsParams } from '@/shared/api/generated/model'
import { productsKeys } from './products.keys'

// products Query Domain의 queryOptions. 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 같은 옵션을 쓴다.

export function listProductsQueryOptions(params: ListProductsParams = {}) {
  return queryOptions({
    queryKey: productsKeys.listProducts(params),
    queryFn: ({ signal }) => listProducts(params, { signal }),
  })
}
