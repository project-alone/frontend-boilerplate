import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { server } from '@/shared/mocks/node'
import { StatsCharts } from './stats-charts'

// 차트는 브라우저가 데이터를 가져와 그린다. Rendering Mode static-export의 브라우저는 BFF 프록시 대신 백엔드를 직접
// 부르고, 백엔드 주소가 없으면 MSW가 켜진 빌드에서만 목 주소를 쓰므로 그 빌드를 흉내 낸다. server에서는 쓰이지 않는다.
// Vitest에서는 어느 주소로 가든 @/shared/mocks/node가 받는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

/** 스크린 리더가 읽는 표를 행마다 칸의 글자로 읽는다. 첫 행은 열 제목이다. */
function readTable(table: HTMLElement): string[][] {
  return within(table)
    .getAllByRole('row')
    .map((row) => Array.from((row as HTMLTableRowElement).cells, (cell) => cell.textContent))
}

test('일별 방문 수 시계열 차트는 MSW가 돌려준 샘플 명세의 값을 스크린 리더용 표로도 제공한다', async () => {
  const { container } = renderWithQueryClient(<StatsCharts />)

  const table = await screen.findByRole('table', { name: '일별 방문 수' })
  await screen.findByRole('table', { name: '판매 채널별 매출' })
  // 그림은 보조 기술에서 숨기고 같은 값을 표로 알린다. 렌더링된 선·막대의 명도 대비는 E2E가 실제 브라우저에서 잰다.
  expect(await axeViolations(container)).toEqual([])
  const rows = readTable(table)
  expect(rows[0]).toEqual(['날짜', '방문 수'])
  expect(rows).toHaveLength(15)
  expect(rows[1]).toEqual(['10월 1일', '1,320회'])
  expect(rows[14]).toEqual(['10월 14일', '1,680회'])
  // 날짜가 행의 제목이라 스크린 리더가 값마다 날짜를 함께 읽는다.
  expect(
    within(table)
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent),
  ).toContain('10월 4일')
})

test('판매 채널별 매출 비교 차트는 채널마다 지난달과 이번 달 매출을 스크린 리더용 표로도 제공한다', async () => {
  renderWithQueryClient(<StatsCharts />)

  const table = await screen.findByRole('table', { name: '판매 채널별 매출' })
  expect(readTable(table)).toEqual([
    ['판매 채널', '지난달', '이번 달'],
    ['온라인 스토어', '41,500,000원', '48,200,000원'],
    ['모바일 앱', '38,100,000원', '36,900,000원'],
    ['오프라인 매장', '25,800,000원', '22,400,000원'],
    ['제휴 마켓', '9,300,000원', '12,700,000원'],
  ])
})

test('차트마다 제목을 그림의 이름으로, 요점을 그림의 설명으로 보여 준다', async () => {
  renderWithQueryClient(<StatsCharts />)

  expect(await screen.findByRole('figure', { name: '일별 방문 수' })).toHaveAccessibleDescription(
    '가장 많은 날 10월 14일 1,680회, 가장 적은 날 10월 4일 910회',
  )
  expect(await screen.findByRole('figure', { name: '판매 채널별 매출' })).toHaveAccessibleDescription(
    '이번 달 합계 120,200,000원, 지난달 합계 114,700,000원',
  )
})

test('불러오는 동안 알리고, 한 차트의 API가 실패해도 그 차트만 불러오지 못했다고 알린다', async () => {
  server.use(http.get('*/stats/channel-sales', () => HttpResponse.json({ message: '점검 중' }, { status: 503 })))

  renderWithQueryClient(<StatsCharts />)

  expect(screen.getByText('일별 방문 수를 불러오는 중입니다.')).toHaveAttribute('role', 'status')
  expect(await screen.findByRole('alert')).toHaveTextContent('판매 채널별 매출을 불러오지 못했습니다.')
  expect(await screen.findByRole('table', { name: '일별 방문 수' })).toBeInTheDocument()
})
