'use client'

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { DailyVisits } from '@/shared/api/generated/model'
import { ChartFigure } from '@/shared/chart/chart-figure'
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from '@/shared/chart/chart-theme'
import { formatLongDate, formatShortDate, formatVisits } from './stats-format'

const DAILY_VISITS_TITLE = '일별 방문 수'

/** 하루 방문 수가 가장 많은 날과 가장 적은 날을 한 문장으로 알린다. */
function summarize(visits: readonly DailyVisits[]): string {
  const [first, ...rest] = visits
  if (first === undefined) return '방문 기록이 없습니다.'
  let highest = first
  let lowest = first
  for (const day of rest) {
    if (day.visits > highest.visits) highest = day
    if (day.visits < lowest.visits) lowest = day
  }
  return `가장 많은 날 ${formatLongDate(highest.date)} ${formatVisits(highest.visits)}, 가장 적은 날 ${formatLongDate(lowest.date)} ${formatVisits(lowest.visits)}`
}

/** 일별 방문 수를 시간 순서의 선 차트(시계열)로 그린다. */
export function DailyVisitsChart({ visits }: Readonly<{ visits: readonly DailyVisits[] }>) {
  return (
    <ChartFigure
      title={DAILY_VISITS_TITLE}
      summary={summarize(visits)}
      rows={visits}
      rowKey={(day) => day.date}
      columns={[
        { header: '날짜', cell: (day) => formatLongDate(day.date) },
        { header: '방문 수', cell: (day) => formatVisits(day.visits) },
      ]}
    >
      <LineChart
        responsive
        accessibilityLayer={false}
        data={visits}
        style={{ width: '100%', height: '100%' }}
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={formatShortDate} stroke={CHART_COLORS.axis} />
        <YAxis width={48} tickFormatter={(value: number) => value.toLocaleString('ko-KR')} stroke={CHART_COLORS.axis} />
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
