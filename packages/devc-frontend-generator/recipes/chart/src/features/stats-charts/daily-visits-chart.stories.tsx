import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'
import { getListDailyVisitsResponseMock } from '@/shared/api/generated/stats/stats.msw'
import { contrastRatio, NON_TEXT_CONTRAST_MIN, TEXT_CONTRAST_MIN } from '@/shared/chart/chart-contrast'
import { DailyVisitsChart } from './daily-visits-chart'

const meta = {
  title: 'Features/StatsCharts/DailyVisitsChart',
  component: DailyVisitsChart,
  // 샘플 명세(openapi.yaml)의 listDailyVisits example
  args: { visits: getListDailyVisitsResponseMock() },
} satisfies Meta<typeof DailyVisitsChart>

export default meta

type Story = StoryObj<typeof meta>

// test:storybook은 모든 스토리를 axe로 검사한다. dark-mode Recipe가 있으면 다크 모드 브라우저에서도 한 번 더 실행된다.
export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    // 스크린 리더는 그림 대신 같은 값을 담은 표를 읽는다.
    const table = canvas.getByRole('table', { name: '일별 방문 수' })
    await expect(within(table).getAllByRole('row')).toHaveLength(15)

    // 선 차트를 그렸고, 그림은 보조 기술에서 숨겼다.
    const line = await waitFor(() => {
      const path = canvasElement.querySelector('.recharts-line-curve')
      if (path === null) throw new Error('선을 아직 그리지 않았습니다.')
      return path
    })
    await expect(line.closest('[aria-hidden="true"]')).not.toBeNull()

    // 선과 축 글자가 지금 테마의 배경 위에서 읽힌다.
    const background = getComputedStyle(document.body).backgroundColor
    await expect(contrastRatio(getComputedStyle(line).stroke, background)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST_MIN)
    const tick = canvasElement.querySelector('.recharts-cartesian-axis-tick-value')
    if (tick === null) throw new Error('축 눈금 글자가 없습니다.')
    await expect(contrastRatio(getComputedStyle(tick).fill, background)).toBeGreaterThanOrEqual(TEXT_CONTRAST_MIN)
  },
}
