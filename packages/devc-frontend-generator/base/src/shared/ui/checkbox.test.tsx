import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { Checkbox } from './checkbox'
import { Field, FieldLabel } from './field'

// 체크박스는 레이블이 있어야 하므로 FieldLabel로 감싼다.
function renderCheckbox(props: ComponentProps<typeof Checkbox> = {}) {
  return render(
    <Field>
      <FieldLabel>
        <Checkbox {...props} />
        약관에 동의합니다
      </FieldLabel>
    </Field>,
  )
}

test('레이블을 눌러도 체크되고, 키보드로 포커스를 옮겨 Space로 바꿀 수 있다', async () => {
  const user = userEvent.setup()
  const { container } = renderCheckbox()
  const checkbox = screen.getByRole('checkbox', { name: '약관에 동의합니다' })
  expect(checkbox).not.toBeChecked()

  await user.click(screen.getByText('약관에 동의합니다'))
  expect(checkbox).toBeChecked()

  await user.click(document.body)
  await user.tab()
  expect(checkbox).toHaveFocus()
  await user.keyboard(' ')
  expect(checkbox).not.toBeChecked()
  expect(await axeViolations(container)).toEqual([])
})

test('일부만 고른 상태를 보조 기술에 알린다', async () => {
  const { container } = renderCheckbox({ indeterminate: true })

  expect(screen.getByRole('checkbox', { name: '약관에 동의합니다' })).toBePartiallyChecked()
  expect(await axeViolations(container)).toEqual([])
})

test('비활성 체크박스는 비활성으로 알린다', async () => {
  const { container } = renderCheckbox({ disabled: true, defaultChecked: true })

  expect(screen.getByRole('checkbox', { name: '약관에 동의합니다' })).toHaveAttribute('aria-disabled', 'true')
  expect(await axeViolations(container)).toEqual([])
})
