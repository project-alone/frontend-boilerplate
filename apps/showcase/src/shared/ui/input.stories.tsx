// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/input.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { Field, FieldLabel } from './field'
import { Input } from './input'

const meta = {
  title: 'Shared/UI/Input',
  component: Input,
  args: { placeholder: '홍길동' },
  // 입력 요소는 레이블이 있어야 하므로 스토리마다 Field와 FieldLabel로 감싼다.
  render: (args) => (
    <Field>
      <FieldLabel>이름</FieldLabel>
      <Input {...args} />
    </Field>
  ),
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    // 레이블과 입력 요소가 이어져 있어 레이블 이름으로 찾을 수 있다.
    const input = canvas.getByRole('textbox', { name: '이름' })

    await userEvent.click(canvas.getByText('이름'))
    await expect(input).toHaveFocus()
    await userEvent.type(input, '김하나')
    await expect(input).toHaveValue('김하나')
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox', { name: '이름' })).toBeDisabled()
  },
}
