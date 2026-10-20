import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import HomePage from './page'

test('홈 페이지는 제목을 보여 준다', () => {
  render(<HomePage />)

  expect(screen.getByRole('heading', { level: 1, name: 'Starter' })).toBeInTheDocument()
})
