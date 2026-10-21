import type { Metadata } from 'next'
import { StatsCharts } from '@/features/stats-charts/stats-charts'

export const metadata: Metadata = {
  title: '차트',
}

// chart Recipe: 대시보드용 차트 패턴. 페이지 뼈대는 빌드할 때 미리 렌더링하고, 차트의 데이터는 브라우저가 가져와 그린다
// (src/features/stats-charts). 그래서 Rendering Mode server와 static-export에서 같은 페이지로 동작한다.
export default function ChartsPage() {
  return (
    <main className="flex flex-col gap-6 p-4">
      <h1 className="text-lg font-semibold">차트</h1>
      <StatsCharts />
    </main>
  )
}
