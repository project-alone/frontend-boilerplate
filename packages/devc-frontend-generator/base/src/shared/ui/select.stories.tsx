import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen, waitFor } from 'storybook/test'
import { Select } from './select'

const meta = {
  title: 'Shared/UI/Select',
  component: Select,
  args: {
    label: '지역',
    placeholder: '지역을 고르세요',
    options: [
      { value: 'seoul', label: '서울' },
      { value: 'busan', label: '부산' },
      { value: 'jeju', label: '제주', disabled: true },
    ],
  },
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: '지역' })
    await expect(trigger).toHaveTextContent('지역을 고르세요')

    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('option', { name: '부산' }))

    await expect(trigger).toHaveTextContent('부산')
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  },
}

export const Keyboard: Story = {
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: '지역' })

    // 키보드만으로 목록을 열고 항목을 골라 닫는다.
    await userEvent.tab()
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    const listbox = await screen.findByRole('listbox')
    await waitFor(() => expect(listbox).toContainElement(document.activeElement as HTMLElement))
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')

    await expect(trigger).toHaveTextContent('부산')
    await waitFor(() => expect(trigger).toHaveFocus())
  },
}

export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox', { name: '지역' })).toHaveAttribute('data-disabled')
  },
}
