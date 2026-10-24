import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import HomePage from './page'

test('홈 페이지는 제목을 보여 주고 접근성 위반이 없다', async () => {
  const { container } = render(<HomePage />)

  expect(screen.getByRole('heading', { level: 1, name: 'Starter' })).toBeInTheDocument()
  expect(await axeViolations(container)).toEqual([])
})
