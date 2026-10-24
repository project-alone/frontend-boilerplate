import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import AppError from './error'

test('오류를 알리고, 다시 시도를 누르면 화면을 다시 그리게 한다. 접근성 위반이 없다', async () => {
  const user = userEvent.setup()
  const retry = vi.fn()
  const { container } = render(<AppError error={new Error('페이지를 그리다 난 오류')} retry={retry} />)

  expect(screen.getByRole('heading', { level: 1, name: '문제가 생겼습니다' })).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('페이지를 불러오지 못했습니다.')
  expect(await axeViolations(container)).toEqual([])

  await user.click(screen.getByRole('button', { name: '다시 시도' }))

  expect(retry).toHaveBeenCalledTimes(1)
})
