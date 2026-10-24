'use client'

import { useQuery } from '@tanstack/react-query'
import { listChannelSalesQueryOptions, listDailyVisitsQueryOptions } from '@/queries/stats/stats.queries'
import { ChannelSalesChart } from './channel-sales-chart'
import { DailyVisitsChart } from './daily-visits-chart'

/**
 * 대시보드의 통계 차트(chart Recipe). 브라우저가 통계 API에서 데이터를 가져와 그린다(CSR). 차트는 브라우저에서만 그릴 수
 * 있고 검색 노출이 필요 없으므로, 서버가 보낸 HTML에는 불러오는 중 상태가 담긴다. 그래서 Rendering Mode server와
 * static-export에서 같은 코드로 동작한다. 차트마다 따로 가져오므로 한 차트가 실패해도 다른 차트는 보인다.
 */
export function StatsCharts() {
  const visits = useQuery(listDailyVisitsQueryOptions())
  const sales = useQuery(listChannelSalesQueryOptions())

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {visits.isPending ? (
        <p role="status">일별 방문 수를 불러오는 중입니다.</p>
      ) : visits.isError ? (
        <p role="alert">일별 방문 수를 불러오지 못했습니다.</p>
      ) : (
        <DailyVisitsChart visits={visits.data} />
      )}
      {sales.isPending ? (
        <p role="status">판매 채널별 매출을 불러오는 중입니다.</p>
      ) : sales.isError ? (
        <p role="alert">판매 채널별 매출을 불러오지 못했습니다.</p>
      ) : (
        <ChannelSalesChart sales={sales.data} />
      )}
    </div>
  )
}
