import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { StatusBadge } from './status-badge'

const meta = {
  title: 'Shared/UI/StatusBadge',
  component: StatusBadge,
  args: { children: 'StatusBadge' },
} satisfies Meta<typeof StatusBadge>

export default meta

type Story = StoryObj<typeof meta>

// 변형마다 스토리를 둔다. npm run test:storybook이 스토리마다 접근성(axe)을 검사한다.
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('StatusBadge')).toBeVisible()
  },
}

export const Muted: Story = {
  args: { variant: 'muted' },
}
