import { queryOptions } from '@tanstack/react-query'
import { listDeliveries } from '@/shared/api/generated'
import { deliveriesKeys } from './deliveries.keys'

// deliveries Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function listDeliveriesQueryOptions() {
  return queryOptions({
    queryKey: deliveriesKeys.listDeliveries(),
    queryFn: ({ signal }) => listDeliveries({ signal }),
  })
}
