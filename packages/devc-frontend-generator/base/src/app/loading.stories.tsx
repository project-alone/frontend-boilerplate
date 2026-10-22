import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import Loading from './loading'

const meta = {
  title: 'Pages/Loading',
  component: Loading,
} satisfies Meta<typeof Loading>

export default meta

export const Default: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('불러오는 중입니다.')
  },
}
