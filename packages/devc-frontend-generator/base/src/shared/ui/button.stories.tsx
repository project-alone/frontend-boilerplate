import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn } from 'storybook/test'
import { Button } from './button'

const meta = {
  title: 'Shared/UI/Button',
  component: Button,
  args: { children: '저장', onClick: fn() },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: '저장' })

    await userEvent.click(button)
    await expect(args.onClick).toHaveBeenCalledTimes(1)

    // 키보드로 포커스를 옮겨 Enter와 Space로 누를 수 있다.
    button.blur()
    await userEvent.tab()
    await expect(button).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    await expect(args.onClick).toHaveBeenCalledTimes(3)
  },
}

export const Secondary: Story = {
  args: { variant: 'secondary', children: '취소' },
}

export const Danger: Story = {
  args: { variant: 'danger', children: '삭제' },
}

export const Small: Story = {
  args: { size: 'sm' },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: '저장' })

    await expect(button).toBeDisabled()
    await userEvent.click(button)
    await expect(args.onClick).not.toHaveBeenCalled()
  },
}
