// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/chart/src/features/stats-charts/channel-sales-chart.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'
import { getListChannelSalesResponseMock } from '@/shared/api/generated/stats/stats.msw'
import { contrastRatio, NON_TEXT_CONTRAST_MIN } from '@/shared/chart/chart-contrast'
import { ChannelSalesChart } from './channel-sales-chart'

const meta = {
  title: 'Features/StatsCharts/ChannelSalesChart',
  component: ChannelSalesChart,
  // 샘플 명세(openapi.yaml)의 listChannelSales example
  args: { sales: getListChannelSalesResponseMock() },
} satisfies Meta<typeof ChannelSalesChart>

export default meta

type Story = StoryObj<typeof meta>

// test:storybook은 모든 스토리를 axe로 검사한다(범례 글자의 명도 대비 포함). dark-mode Recipe가 있으면 다크 모드
// 브라우저에서도 한 번 더 실행된다.
export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    // 스크린 리더는 그림 대신 같은 값을 담은 표를 읽는다. 채널마다 한 행이고, 지난달과 이번 달이 열이다.
    const table = canvas.getByRole('table', { name: '판매 채널별 매출' })
    await expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['판매 채널', '지난달', '이번 달'])
    await expect(within(table).getAllByRole('row')).toHaveLength(5)

    // 계열마다 채널 수만큼 막대를 그렸고, 그림은 보조 기술에서 숨겼다.
    const series = await waitFor(() => {
      const bars = [...canvasElement.querySelectorAll('.recharts-bar')].map((bar) => [
        ...bar.querySelectorAll('.recharts-rectangle'),
      ])
      if (bars.length !== 2 || bars.some((rectangles) => rectangles.length !== 4)) {
        throw new Error('막대를 아직 다 그리지 않았습니다.')
      }
      return bars
    })
    await expect(canvasElement.querySelector('.recharts-surface')?.closest('[aria-hidden="true"]')).not.toBeNull()

    // 두 계열은 색이 서로 다르고, 둘 다 지금 테마의 배경 위에서 읽힌다.
    const background = getComputedStyle(document.body).backgroundColor
    const fills = series.map(([first]) => (first === undefined ? '' : getComputedStyle(first).fill))
    await expect(new Set(fills).size).toBe(2)
    for (const fill of fills) {
      await expect(contrastRatio(fill, background)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST_MIN)
    }
  },
}
