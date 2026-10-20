import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, waitFor } from 'storybook/test'
import { Field, FieldDescription, FieldError, FieldLabel } from './field'
import { Input } from './input'

const meta = {
  title: 'Shared/UI/Field',
  component: Field,
} satisfies Meta<typeof Field>

export default meta

type Story = StoryObj<typeof meta>

export const WithDescriptionAndError: Story = {
  args: { validationMode: 'onBlur' },
  render: (args) => (
    <Field {...args}>
      <FieldLabel>이메일</FieldLabel>
      <Input type="email" required />
      <FieldDescription>로그인할 때 씁니다.</FieldDescription>
      <FieldError match="valueMissing">이메일을 입력해 주세요.</FieldError>
    </Field>
  ),
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: '이메일' })
    await expect(input).toHaveAccessibleDescription('로그인할 때 씁니다.')

    // 입력한 값을 지우고 포커스를 옮기면 오류를 보여 주고, 스크린 리더가 읽도록 입력 요소의 설명에 넣는다.
    await userEvent.type(input, 'a')
    await userEvent.clear(input)
    await userEvent.tab()
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'))
    await waitFor(() => expect(input).toHaveAccessibleDescription(expect.stringContaining('이메일을 입력해 주세요.')))
  },
}
