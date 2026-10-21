'use client'

import { useQuery } from '@tanstack/react-query'
import { getUserStatsQueryOptions } from '@/queries/users/users.queries'
import type { Role, UserStats, UserStatus } from '@/shared/api/generated/model'
import { ROLE_LABELS, USER_STATUS_LABELS } from '@/shared/dashboard/user-labels'
import { formatPeople } from './user-stats-format'
import { UserStatusChart } from './user-status-chart'

/** 한눈에 볼 숫자: 전체, 활성, 초대됨, 관리자 수 */
function figuresOf({ total, byStatus, byRole }: UserStats): { label: string; count: number }[] {
  const statusCount = (status: UserStatus) => byStatus.find((item) => item.status === status)?.count ?? 0
  const roleCount = (role: Role) => byRole.find((item) => item.role === role)?.count ?? 0
  return [
    { label: '전체 사용자', count: total },
    { label: USER_STATUS_LABELS.active, count: statusCount('active') },
    { label: USER_STATUS_LABELS.invited, count: statusCount('invited') },
    { label: ROLE_LABELS.admin, count: roleCount('admin') },
  ]
}

/**
 * 대시보드 개요의 사용자 현황: 한눈에 볼 숫자와 상태별 사용자 수 차트. 데이터는 users Query Domain의 getUserStatsQueryOptions로
 * 가져온다. 페이지가 서버에서 가져와(prefetch) hydration으로 넘긴 데이터가 있으면 그대로 그린다. 사용자를 추가하거나 고치면
 * 뮤테이션 훅이 users Query Domain을 무효화하므로 다시 가져온다.
 */
export function UserStatsOverview() {
  const { data: stats, isPending, isError } = useQuery(getUserStatsQueryOptions())

  if (isPending) return <p role="status">사용자 통계를 불러오는 중입니다.</p>
  if (isError) return <p role="alert">사용자 통계를 불러오지 못했습니다.</p>

  return (
    <section aria-labelledby="user-stats-heading" className="flex flex-col gap-4">
      <h2 id="user-stats-heading" className="font-semibold">
        사용자 현황
      </h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {figuresOf(stats).map(({ label, count }) => (
          <div key={label} className="flex flex-col gap-1 rounded-md border border-border p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold">{formatPeople(count)}</dd>
          </div>
        ))}
      </dl>
      <UserStatusChart byStatus={stats.byStatus} />
    </section>
  )
}
