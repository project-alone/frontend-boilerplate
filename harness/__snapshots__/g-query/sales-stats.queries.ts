import { queryOptions } from '@tanstack/react-query'
import { getSalesStats } from '@/shared/api/generated'
import { salesStatsKeys } from './sales-stats.keys'

// sales-stats Query Domain의 queryOptions. 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 같은 옵션을 쓴다.

export function getSalesStatsQueryOptions() {
  return queryOptions({
    queryKey: salesStatsKeys.getSalesStats(),
    queryFn: ({ signal }) => getSalesStats({ signal }),
  })
}
