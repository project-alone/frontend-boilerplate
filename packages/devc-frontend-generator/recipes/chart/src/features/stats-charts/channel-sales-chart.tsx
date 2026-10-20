'use client'

import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChannelSales } from '@/shared/api/generated/model'
import { ChartFigure } from '@/shared/chart/chart-figure'
import { CHART_COLORS, CHART_GRID_PROPS, CHART_PROPS, CHART_TOOLTIP_STYLE } from '@/shared/chart/chart-theme'
import { formatCompact, formatWon } from './stats-format'

// 계열마다 이름과 모양. 시간 순서대로 지난달을 앞(왼쪽)에, 이번 달을 뒤에 둔다. 두 계열의 색은 서로 명도 대비가 낮으므로
// 지난달은 테두리만 그려(안쪽은 배경색) 색을 구별하지 못해도 나뉘어 보이게 한다.
const SERIES = [
  { dataKey: 'previousMonth', name: '지난달', fill: CHART_COLORS.surface, stroke: CHART_COLORS.secondarySeries },
  { dataKey: 'currentMonth', name: '이번 달', fill: CHART_COLORS.primarySeries, stroke: CHART_COLORS.primarySeries },
] as const

/** 이번 달과 지난달의 매출 합계를 한 문장으로 알린다. */
function summarize(sales: readonly ChannelSales[]): string {
  const total = (month: 'currentMonth' | 'previousMonth') => sales.reduce((sum, channel) => sum + channel[month], 0)
  return `이번 달 합계 ${formatWon(total('currentMonth'))}, 지난달 합계 ${formatWon(total('previousMonth'))}`
}

/** 막대와 같은 모양의 견본을 붙인 범례. 글자는 계열 색 대신 본문 글자색으로 써서 계열 색이 바뀌어도 읽힌다. */
function SeriesLegend() {
  return (
    <ul className="flex justify-center gap-4 text-sm text-foreground">
      {SERIES.map((series) => (
        <li key={series.dataKey} className="flex items-center gap-1">
          <span className="size-3 border-2" style={{ backgroundColor: series.fill, borderColor: series.stroke }} />
          {series.name}
        </li>
      ))}
    </ul>
  )
}

/** 판매 채널마다 지난달과 이번 달 매출을 나란히 놓은 막대 차트(비교)로 그린다. */
export function ChannelSalesChart({ sales }: Readonly<{ sales: readonly ChannelSales[] }>) {
  return (
    <ChartFigure
      title="판매 채널별 매출"
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
      <BarChart {...CHART_PROPS} data={sales} barGap={4}>
        <CartesianGrid {...CHART_GRID_PROPS} />
        <XAxis dataKey="channel" stroke={CHART_COLORS.axis} />
        <YAxis width={56} tickFormatter={formatCompact} stroke={CHART_COLORS.axis} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          cursor={{ fill: CHART_COLORS.highlight }}
          formatter={(value) => (typeof value === 'number' ? formatWon(value) : '')}
          // 이름순 대신 막대와 같은 순서(지난달, 이번 달)로 계열을 놓는다.
          itemSorter={(item) => SERIES.findIndex((series) => series.dataKey === item.dataKey)}
        />
        <Legend content={<SeriesLegend />} />
        {SERIES.map((series) => (
          <Bar
            key={series.dataKey}
            dataKey={series.dataKey}
            name={series.name}
            fill={series.fill}
            stroke={series.stroke}
            strokeWidth={2}
          />
        ))}
      </BarChart>
    </ChartFigure>
  )
}
