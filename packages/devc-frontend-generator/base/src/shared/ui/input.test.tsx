import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { Field, FieldLabel } from './field'
import { Input } from './input'

// 입력 요소는 레이블이 있어야 하므로 Field와 FieldLabel로 감싼다.
function renderInput({ disabled = false }: { disabled?: boolean } = {}) {
  return render(
    <Field>
      <FieldLabel>이름</FieldLabel>
      <Input placeholder="홍길동" disabled={disabled} />
    </Field>,
  )
}

test('레이블과 이어져 있어 레이블을 누르면 입력 요소에 포커스가 가고 입력할 수 있다', async () => {
  const user = userEvent.setup()
  const { container } = renderInput()
  const input = screen.getByRole('textbox', { name: '이름' })

  await user.click(screen.getByText('이름'))
  expect(input).toHaveFocus()
  await user.type(input, '김하나')
  expect(input).toHaveValue('김하나')
  expect(await axeViolations(container)).toEqual([])
})

test('비활성 입력 요소는 비활성으로 알린다', async () => {
  const { container } = renderInput({ disabled: true })

  expect(screen.getByRole('textbox', { name: '이름' })).toBeDisabled()
  expect(await axeViolations(container)).toEqual([])
})
