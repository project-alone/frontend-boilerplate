// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/dialog.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen, waitFor } from 'storybook/test'
import { Button } from './button'
import { Dialog, DialogClose, DialogDescription, DialogPopup, DialogTitle, DialogTrigger } from './dialog'

const meta = {
  title: 'Shared/UI/Dialog',
  component: Dialog,
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger render={<Button variant="danger" />}>회원 탈퇴</DialogTrigger>
      <DialogPopup>
        <DialogTitle>회원을 탈퇴할까요?</DialogTitle>
        <DialogDescription>탈퇴하면 작성한 글이 모두 지워집니다.</DialogDescription>
        <div className="flex justify-end gap-2">
          <DialogClose render={<Button variant="secondary" />}>취소</DialogClose>
          <DialogClose render={<Button variant="danger" />}>탈퇴</DialogClose>
        </div>
      </DialogPopup>
    </Dialog>
  ),
} satisfies Meta<typeof Dialog>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: '회원 탈퇴' })

    // 키보드로 열면 포커스가 대화상자 안으로 들어간다.
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', { name: '회원을 탈퇴할까요?' })
    await expect(dialog).toHaveAccessibleDescription('탈퇴하면 작성한 글이 모두 지워집니다.')
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement))

    // Esc로 닫으면 포커스가 트리거로 돌아온다.
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await expect(trigger).toHaveFocus()
  },
}

export const Open: Story = {
  args: { defaultOpen: true },
  play: async () => {
    await expect(await screen.findByRole('dialog', { name: '회원을 탈퇴할까요?' })).toBeVisible()
  },
}
