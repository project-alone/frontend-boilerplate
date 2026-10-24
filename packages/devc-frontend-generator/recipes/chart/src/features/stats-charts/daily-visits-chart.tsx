'use client'

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { DailyVisits } from '@/shared/api/generated/model'
import { ChartFigure } from '@/shared/chart/chart-figure'
import { CHART_COLORS, CHART_GRID_PROPS, CHART_PROPS, CHART_TOOLTIP_STYLE } from '@/shared/chart/chart-theme'
import { formatCount, formatLongDate, formatShortDate, formatVisits } from './stats-format'

/** 일별 방문 수를 시간 순서의 선 차트(시계열)로 그린다. */
export function DailyVisitsChart({ visits }: Readonly<{ visits: readonly DailyVisits[] }>) {
  // 하루 방문 수가 가장 많은 날과 가장 적은 날을 한 문장으로 알린다.
  let summary = '방문 기록이 없습니다.'
  const [first, ...rest] = visits
  if (first !== undefined) {
    let highest = first
    let lowest = first
    for (const day of rest) {
      if (day.visits > highest.visits) highest = day
      if (day.visits < lowest.visits) lowest = day
    }
    summary = `가장 많은 날 ${formatLongDate(highest.date)} ${formatVisits(highest.visits)}, 가장 적은 날 ${formatLongDate(lowest.date)} ${formatVisits(lowest.visits)}`
  }

  return (
    <ChartFigure
      title="일별 방문 수"
      summary={summary}
      rows={visits}
      rowKey={(day) => day.date}
      columns={[
        { header: '날짜', cell: (day) => formatLongDate(day.date) },
        { header: '방문 수', cell: (day) => formatVisits(day.visits) },
      ]}
    >
      <LineChart {...CHART_PROPS} data={visits}>
        <CartesianGrid {...CHART_GRID_PROPS} />
        <XAxis dataKey="date" tickFormatter={formatShortDate} stroke={CHART_COLORS.axis} />
        <YAxis width={48} tickFormatter={formatCount} stroke={CHART_COLORS.axis} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          cursor={{ stroke: CHART_COLORS.grid }}
          labelFormatter={(date) => (typeof date === 'string' ? formatLongDate(date) : '')}
          formatter={(value) => (typeof value === 'number' ? formatVisits(value) : '')}
        />
        <Line
          type="monotone"
          dataKey="visits"
          name="방문 수"
          stroke={CHART_COLORS.primarySeries}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART_COLORS.surface, stroke: CHART_COLORS.primarySeries, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: CHART_COLORS.primarySeries, stroke: CHART_COLORS.surface, strokeWidth: 2 }}
        />
      </LineChart>
    </ChartFigure>
  )
}
