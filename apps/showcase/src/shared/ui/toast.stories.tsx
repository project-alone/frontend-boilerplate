// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/toast.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen, waitFor, within } from 'storybook/test'
import { Button } from './button'
import { useToast } from './toast'

// ToastProvider는 Storybook(.storybook/preview.tsx)이 모든 스토리에 감싸 두었다.
function SaveButton({ type }: { type?: 'error' }) {
  const toast = useToast()
  const message =
    type === 'error'
      ? { type, title: '저장하지 못했습니다', description: '잠시 뒤에 다시 시도해 주세요.' }
      : { title: '저장했습니다', description: '변경한 내용이 반영되었습니다.' }

  return <Button onClick={() => toast.add(message)}>저장</Button>
}

const meta = {
  title: 'Shared/UI/Toast',
  component: SaveButton,
} satisfies Meta<typeof SaveButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '저장' }))

    // 알림은 "알림" 영역에 나타난다.
    const region = screen.getByRole('region', { name: '알림' })
    const title = await within(region).findByText('저장했습니다')
    await expect(title).toBeVisible()

    // 키보드로 알림 영역(F6)에 들어가면 닫기 버튼이 나타나고, 그 버튼으로 닫는다.
    await userEvent.keyboard('{F6}')
    await userEvent.click(await within(region).findByRole('button', { name: '닫기' }))
    await waitFor(() => expect(title).not.toBeInTheDocument())
  },
}

export const Failed: Story = {
  args: { type: 'error' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '저장' }))

    const region = screen.getByRole('region', { name: '알림' })
    await expect(await within(region).findByText('저장하지 못했습니다')).toBeVisible()
  },
}
