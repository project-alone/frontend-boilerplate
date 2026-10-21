'use client'

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import type { UserStatusCount } from '@/shared/api/generated/model'
import { ChartFigure } from '@/shared/chart/chart-figure'
import { CHART_COLORS, CHART_GRID_PROPS, CHART_PROPS, CHART_TOOLTIP_STYLE } from '@/shared/chart/chart-theme'
import { USER_STATUS_LABELS } from '@/shared/dashboard/user-labels'
import { formatPeople } from './user-stats-format'

/** 상태마다 사용자 수를 막대 차트로 그린다(chart Recipe의 ChartFigure로 감싸 같은 값을 데이터 표로도 둔다). */
export function UserStatusChart({ byStatus }: Readonly<{ byStatus: readonly UserStatusCount[] }>) {
  const rows = byStatus.map(({ status, count }) => ({ status, label: USER_STATUS_LABELS[status], count }))

  return (
    <ChartFigure
      title="상태별 사용자 수"
      summary={rows.map(({ label, count }) => `${label} ${formatPeople(count)}`).join(', ')}
      rows={rows}
      rowKey={(row) => row.status}
      columns={[
        { header: '상태', cell: (row) => row.label },
        { header: '사용자 수', cell: (row) => formatPeople(row.count) },
      ]}
    >
      <BarChart {...CHART_PROPS} data={rows}>
        <CartesianGrid {...CHART_GRID_PROPS} />
        <XAxis dataKey="label" stroke={CHART_COLORS.axis} />
        <YAxis width={40} allowDecimals={false} stroke={CHART_COLORS.axis} />
        <Tooltip
          {...CHART_TOOLTIP_STYLE}
          cursor={{ fill: CHART_COLORS.highlight }}
          formatter={(value) => (typeof value === 'number' ? formatPeople(value) : '')}
        />
        <Bar dataKey="count" name="사용자 수" fill={CHART_COLORS.primarySeries} />
      </BarChart>
    </ChartFigure>
  )
}
