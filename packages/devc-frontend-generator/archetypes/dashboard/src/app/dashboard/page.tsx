import { dehydrate, HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { StatsCharts } from '@/features/stats-charts/stats-charts'
import { UserStatsOverview } from '@/features/user-stats/user-stats-overview'
import { getUserStatsQueryOptions } from '@/queries/users/users.queries'
import { requireServerSession } from '@/shared/auth/server-session'
import { getQueryClient } from '@/shared/query-client/get-query-client'

export const metadata: Metadata = {
  title: '개요',
}

// 대시보드 Archetype의 개요. 로그인한 사용자만 들어온다. 사용자 통계(getUserStats)는 서버 컴포넌트가 세션의 accessToken을
// 붙여 백엔드를 직접 불러(prefetch) hydration으로 넘기고, chart Recipe의 통계 차트(StatsCharts)는 브라우저가 가져와 그린다.
// 세션을 읽으므로 요청마다 렌더링한다(SSR).
export default async function DashboardPage() {
  // 데이터를 가져오기 전에 세션을 읽어야 이 렌더링의 API 요청에 accessToken이 붙는다.
  await requireServerSession()
  const queryClient = getQueryClient()
  await queryClient.query(getUserStatsQueryOptions())

  return (
    <main className="flex flex-col gap-8 p-4">
      <h1 className="text-lg font-semibold">대시보드</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <UserStatsOverview />
      </HydrationBoundary>
      <section aria-labelledby="service-stats-heading" className="flex flex-col gap-4">
        <h2 id="service-stats-heading" className="font-semibold">
          서비스 지표
        </h2>
        <StatsCharts />
      </section>
    </main>
  )
}
