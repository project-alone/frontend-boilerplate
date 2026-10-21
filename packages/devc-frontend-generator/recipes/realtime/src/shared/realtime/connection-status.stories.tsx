import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { ConnectionStatus } from './connection-status'

// 연결 상태마다 글자로 상태를 알리는지 보고, 스토리마다 axe 접근성 검사를 한다(vitest.config.ts의 storybook 프로젝트).
const meta = {
  title: 'Shared/Realtime/ConnectionStatus',
  component: ConnectionStatus,
  args: { status: 'open' },
} satisfies Meta<typeof ConnectionStatus>

export default meta

type Story = StoryObj<typeof meta>

export const Connecting: Story = {
  args: { status: 'connecting' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('실시간 연결 중')
  },
}

export const Open: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('실시간 연결됨')
  },
}

export const Reconnecting: Story = {
  args: { status: 'reconnecting' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('연결이 끊겨 다시 연결하는 중')
  },
}
