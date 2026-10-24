import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from './button'

const meta = {
  title: 'Shared/UI/Button',
  component: Button,
  args: { children: 'Button' },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

// 컴포넌트가 보일 수 있는 상태(변형, 비활성, 오류 등)마다 스토리를 더한다. npm run test:storybook이 스토리마다 접근성(axe)을
// 검사하고, play 함수에 적은 상호작용도 확인한다.
export const Default: Story = {}
