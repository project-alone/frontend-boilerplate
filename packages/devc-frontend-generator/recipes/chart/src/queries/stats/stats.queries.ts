import { queryOptions } from '@tanstack/react-query'
import { listDailyVisits, listChannelSales } from '@/shared/api/generated'
import { statsKeys } from './stats.keys'

// stats Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function listDailyVisitsQueryOptions() {
  return queryOptions({
    queryKey: statsKeys.listDailyVisits(),
    queryFn: ({ signal }) => listDailyVisits({ signal }),
  })
}

export function listChannelSalesQueryOptions() {
  return queryOptions({
    queryKey: statsKeys.listChannelSales(),
    queryFn: ({ signal }) => listChannelSales({ signal }),
  })
}
