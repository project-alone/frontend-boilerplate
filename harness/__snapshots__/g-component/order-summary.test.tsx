import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { OrderSummary } from './order-summary'

test('제목을 보여 준다', () => {
  render(<OrderSummary title="OrderSummary" />)

  expect(screen.getByRole('heading', { name: 'OrderSummary' })).toBeInTheDocument()
})
