import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/shared/mocks/node'
import { UserStatsOverview } from './user-stats-overview'

// 요청은 Vitest의 MSW(@/shared/mocks/node)가 받는다. 사용자 통계는 대시보드의 목 백엔드(src/shared/mocks/users.ts)가 처음
// 사용자 12명(활성 8, 초대됨 2, 정지 2, 관리자 3)으로 계산한다.

function renderOverview() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UserStatsOverview />
    </QueryClientProvider>,
  )
}

test('전체·활성·초대됨·관리자 수를 보여 주고, 상태별 사용자 수를 차트의 데이터 표와 요약으로 알린다', async () => {
  renderOverview()

  const figures = await screen.findByRole('region', { name: '사용자 현황' })
  const terms = within(figures).getAllByRole('term')
  expect(terms.map((term) => `${term.textContent} ${term.nextElementSibling?.textContent ?? ''}`)).toEqual([
    '전체 사용자 12명',
    '활성 8명',
    '초대됨 2명',
    '관리자 3명',
  ])

  const table = screen.getByRole('table', { name: '상태별 사용자 수' })
  expect(
    within(table)
      .getAllByRole('row')
      .map((row) => row.textContent),
  ).toEqual(['상태사용자 수', '활성8명', '초대됨2명', '정지2명'])
  expect(screen.getByText('활성 8명, 초대됨 2명, 정지 2명')).toBeInTheDocument()
})

test('통계를 받지 못하면 알린다', async () => {
  server.use(http.get('*/users/stats', () => HttpResponse.json({ message: '실패' }, { status: 500 })))
  renderOverview()

  expect(await screen.findByRole('alert')).toHaveTextContent('사용자 통계를 불러오지 못했습니다.')
})
