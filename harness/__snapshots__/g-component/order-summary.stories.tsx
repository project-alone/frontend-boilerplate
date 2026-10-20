import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { OrderSummary } from './order-summary'

const meta = {
  title: 'Features/Orders/OrderSummary',
  component: OrderSummary,
  args: { title: 'OrderSummary' },
} satisfies Meta<typeof OrderSummary>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'OrderSummary' })).toBeVisible()
  },
}
