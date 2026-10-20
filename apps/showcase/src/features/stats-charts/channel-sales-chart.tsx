// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/chart/src/features/stats-charts/channel-sales-chart.tsx

'use client'

import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChannelSales } from '@/shared/api/generated/model'
import { ChartFigure } from '@/shared/chart/chart-figure'
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from '@/shared/chart/chart-theme'
import { formatCompact, formatWon } from './stats-format'

const CHANNEL_SALES_TITLE = '판매 채널별 매출'

// 계열마다 이름과 색. 시간 순서대로 지난달을 앞(왼쪽)에, 이번 달을 뒤에 둔다.
const SERIES = [
  { dataKey: 'previousMonth', name: '지난달', color: CHART_COLORS.secondarySeries },
  { dataKey: 'currentMonth', name: '이번 달', color: CHART_COLORS.primarySeries },
] as const

/** 이번 달과 지난달의 매출 합계를 한 문장으로 알린다. */
function summarize(sales: readonly ChannelSales[]): string {
  const total = (month: 'currentMonth' | 'previousMonth') => sales.reduce((sum, channel) => sum + channel[month], 0)
  return `이번 달 합계 ${formatWon(total('currentMonth'))}, 지난달 합계 ${formatWon(total('previousMonth'))}`
}

/** 판매 채널마다 지난달과 이번 달 매출을 나란히 놓은 막대 차트(비교)로 그린다. */
export function ChannelSalesChart({ sales }: Readonly<{ sales: readonly ChannelSales[] }>) {
  return (
    <ChartFigure
      title={CHANNEL_SALES_TITLE}
      summary={summarize(sales)}
      rows={sales}
      rowKey={(channel) => channel.channel}
      columns={[
        { header: '판매 채널', cell: (channel) => channel.channel },
        ...SERIES.map((series) => ({
          header: series.name,
          cell: (channel: ChannelSales) => formatWon(channel[series.dataKey]),
        })),
      ]}
    >
      <BarChart
        responsive
        accessibilityLayer={false}
        data={sales}
        barGap={2}
        style={{ width: '100%', height: '100%' }}
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
        <XAxis dataKey="channel" stroke={CHART_COLORS.axis} />
        <YAxis width={56} tickFormatter={formatCompact} stroke={CHART_COLORS.axis} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          cursor={{ fill: CHART_COLORS.highlight }}
          formatter={(value) => (typeof value === 'number' ? formatWon(value) : '')}
          // 툴팁과 범례는 이름순 대신 막대와 같은 순서(지난달, 이번 달)로 계열을 놓는다.
          itemSorter={(item) => SERIES.findIndex((series) => series.dataKey === item.dataKey)}
        />
        {/* 범례 글자는 계열 색 대신 본문 글자색으로 써서, 계열 색이 바뀌어도 읽힌다. */}
        <Legend itemSorter={null} formatter={(name) => <span className="text-foreground">{name}</span>} />
        {SERIES.map((series) => (
          <Bar
            key={series.dataKey}
            dataKey={series.dataKey}
            name={series.name}
            fill={series.color}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartFigure>
  )
}
