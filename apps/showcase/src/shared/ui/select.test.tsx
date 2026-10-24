// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/select.test.tsx

import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { expect, test, vi } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { Select } from './select'

function renderSelect(props: Partial<ComponentProps<typeof Select>> = {}) {
  render(
    <Select
      label="지역"
      placeholder="지역을 고르세요"
      options={[
        { value: 'seoul', label: '서울' },
        { value: 'busan', label: '부산' },
        { value: 'jeju', label: '제주', disabled: true },
      ]}
      {...props}
    />,
  )
  return screen.getByRole('combobox', { name: '지역' })
}

test('목록을 열어 고른 항목을 보여 주고 목록을 닫는다. 연 목록에도 접근성 위반이 없다', async () => {
  const user = userEvent.setup()
  const trigger = renderSelect()
  expect(trigger).toHaveTextContent('지역을 고르세요')

  await user.click(trigger)
  const option = await screen.findByRole('option', { name: '부산' })
  // 선택 목록은 포털로 문서의 body에 그린다.
  expect(await axeViolations(document.body)).toEqual([])
  await user.click(option)

  expect(trigger).toHaveTextContent('부산')
  await waitFor(() => {
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

test('키보드만으로 목록을 열고 항목을 골라 닫는다', async () => {
  const user = userEvent.setup()
  const trigger = renderSelect()

  await user.tab()
  expect(trigger).toHaveFocus()
  await user.keyboard('{ArrowDown}')
  const listbox = await screen.findByRole('listbox')
  await waitFor(() => {
    expect(listbox).toContainElement(document.activeElement as HTMLElement)
  })
  await user.keyboard('{ArrowDown}')
  await user.keyboard('{Enter}')

  expect(trigger).toHaveTextContent('부산')
  await waitFor(() => {
    expect(trigger).toHaveFocus()
  })
})

test('비활성 선택 목록은 비활성으로 알린다', async () => {
  const trigger = renderSelect({ disabled: true })

  expect(trigger).toHaveAttribute('data-disabled')
  expect(await axeViolations(document.body)).toEqual([])
})

// 값을 비우는 선택지(clearLabel)가 있으면 고른 값을 다시 비울 수 있다. 비운 값은 null이다(onValueChange).
test('값을 비우는 선택지로 고른 값을 비운다', async () => {
  const user = userEvent.setup()
  const onValueChange = vi.fn()
  const trigger = renderSelect({ clearLabel: '선택 안 함', defaultValue: 'seoul', onValueChange })
  expect(trigger).toHaveTextContent('서울')

  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: '선택 안 함' }))

  expect(trigger).toHaveTextContent('선택 안 함')
  expect(onValueChange).toHaveBeenLastCalledWith(null, expect.anything())
  await waitFor(() => {
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
