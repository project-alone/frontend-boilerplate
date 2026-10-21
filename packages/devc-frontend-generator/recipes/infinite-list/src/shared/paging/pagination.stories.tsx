import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn } from 'storybook/test'
import { Pagination } from './pagination'

const meta = {
  title: 'Shared/Paging/Pagination',
  component: Pagination,
  args: { label: '게시글 목록 페이지', page: 5, pageCount: 10, onPageChange: fn() },
} satisfies Meta<typeof Pagination>

export default meta

type Story = StoryObj<typeof meta>

// test:storybook은 모든 스토리를 axe로 검사한다. dark-mode Recipe가 있으면 다크 모드 브라우저에서도 한 번 더 실행된다.
export const Default: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('button', { name: '5 쪽' })).toHaveAttribute('aria-current', 'page')

    // 모든 버튼에 키보드로 갈 수 있다. 쪽 상태는 부르는 쪽이 들고 있으므로 바꿀 쪽만 알린다.
    await userEvent.tab()
    await expect(canvas.getByRole('button', { name: '이전' })).toHaveFocus()
    await userEvent.click(canvas.getByRole('button', { name: '다음' }))
    await userEvent.click(canvas.getByRole('button', { name: '10 쪽' }))

    await expect(args.onPageChange).toHaveBeenNthCalledWith(1, 6)
    await expect(args.onPageChange).toHaveBeenNthCalledWith(2, 10)
  },
}

export const FirstPage: Story = {
  args: { page: 1, pageCount: 5 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '이전' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: '1 쪽' })).toHaveAttribute('aria-current', 'page')
  },
}
