import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { Checkbox } from './checkbox'
import { Field, FieldLabel } from './field'

const meta = {
  title: 'Shared/UI/Checkbox',
  component: Checkbox,
  // 체크박스는 레이블이 있어야 하므로 스토리마다 FieldLabel로 감싼다.
  render: (args) => (
    <Field>
      <FieldLabel>
        <Checkbox {...args} />
        약관에 동의합니다
      </FieldLabel>
    </Field>
  ),
} satisfies Meta<typeof Checkbox>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const checkbox = canvas.getByRole('checkbox', { name: '약관에 동의합니다' })
    await expect(checkbox).not.toBeChecked()

    // 레이블을 눌러도 체크된다.
    await userEvent.click(canvas.getByText('약관에 동의합니다'))
    await expect(checkbox).toBeChecked()

    // 키보드로 포커스를 옮겨 Space로 바꿀 수 있다.
    await userEvent.click(document.body)
    await userEvent.tab()
    await expect(checkbox).toHaveFocus()
    await userEvent.keyboard(' ')
    await expect(checkbox).not.toBeChecked()
  },
}

export const Indeterminate: Story = {
  args: { indeterminate: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox', { name: '약관에 동의합니다' })).toBePartiallyChecked()
  },
}

export const Disabled: Story = {
  args: { disabled: true, defaultChecked: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('checkbox', { name: '약관에 동의합니다' })).toHaveAttribute('aria-disabled', 'true')
  },
}
