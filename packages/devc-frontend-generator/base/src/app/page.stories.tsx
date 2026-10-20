import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import HomePage from './page'

const meta = {
  title: 'Pages/Home',
  component: HomePage,
} satisfies Meta<typeof HomePage>

export default meta

export const Default: StoryObj<typeof meta> = {}
