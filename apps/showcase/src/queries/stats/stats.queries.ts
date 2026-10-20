// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/chart/src/queries/stats/stats.queries.ts

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
