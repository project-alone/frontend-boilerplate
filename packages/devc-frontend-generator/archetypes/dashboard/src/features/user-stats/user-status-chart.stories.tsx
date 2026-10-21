import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor, within } from 'storybook/test'
import { getGetUserStatsResponseMock } from '@/shared/api/generated/users/users.msw'
import { contrastRatio, NON_TEXT_CONTRAST_MIN } from '@/shared/chart/chart-contrast'
import { UserStatusChart } from './user-status-chart'

const meta = {
  title: 'Features/UserStats/UserStatusChart',
  component: UserStatusChart,
  // 샘플 명세(openapi.yaml)의 getUserStats example
  args: { byStatus: getGetUserStatsResponseMock().byStatus },
} satisfies Meta<typeof UserStatusChart>

export default meta

type Story = StoryObj<typeof meta>

// test:storybook은 모든 스토리를 axe로 검사한다. dark-mode Recipe가 있으면 다크 모드 브라우저에서도 한 번 더 실행된다.
export const Default: Story = {
  play: async ({ canvas, canvasElement }) => {
    // 스크린 리더는 그림 대신 같은 값을 담은 표를 읽는다. 상태마다 한 행이다.
    const table = canvas.getByRole('table', { name: '상태별 사용자 수' })
    await expect(within(table).getAllByRole('row')).toHaveLength(4)

    // 상태마다 막대를 그렸고, 그림은 보조 기술에서 숨겼다. 막대는 지금 테마의 배경 위에서 읽힌다.
    const bar = await waitFor(() => {
      const bars = canvasElement.querySelectorAll('.recharts-bar .recharts-rectangle')
      const [first] = bars
      if (bars.length !== 3 || first === undefined) throw new Error('막대를 아직 다 그리지 않았습니다.')
      return getComputedStyle(first)
    })
    await expect(canvasElement.querySelector('.recharts-surface')?.closest('[aria-hidden="true"]')).not.toBeNull()
    const background = getComputedStyle(document.body).backgroundColor
    await expect(contrastRatio(bar.fill, background)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST_MIN)
  },
}
