import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { Button } from './button'

test('누르면 onClick을 부르고, 키보드로 포커스를 옮겨 Enter와 Space로도 누를 수 있다', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  render(<Button onClick={onClick}>저장</Button>)
  const button = screen.getByRole('button', { name: '저장' })

  await user.click(button)
  expect(onClick).toHaveBeenCalledTimes(1)

  button.blur()
  await user.tab()
  expect(button).toHaveFocus()
  await user.keyboard('{Enter}')
  await user.keyboard(' ')
  expect(onClick).toHaveBeenCalledTimes(3)
})

test('비활성 버튼은 눌러도 onClick을 부르지 않는다', async () => {
  const user = userEvent.setup()
  const onClick = vi.fn()
  render(
    <Button disabled onClick={onClick}>
      저장
    </Button>,
  )
  const button = screen.getByRole('button', { name: '저장' })

  expect(button).toBeDisabled()
  await user.click(button)
  expect(onClick).not.toHaveBeenCalled()
})

test('변형과 크기마다 접근성 위반이 없다', async () => {
  const { container } = render(
    <>
      <Button>저장</Button>
      <Button variant="secondary">취소</Button>
      <Button variant="danger">삭제</Button>
      <Button size="sm">작게</Button>
      <Button disabled>보내는 중</Button>
    </>,
  )

  expect(await axeViolations(container)).toEqual([])
})
