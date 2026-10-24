import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { OrderSummary } from './order-summary'

test('제목을 보여 주고 접근성 위반이 없다', async () => {
  const { container } = render(<OrderSummary title="OrderSummary" />)

  expect(screen.getByRole('heading', { name: 'OrderSummary' })).toBeInTheDocument()
  expect(await axeViolations(container)).toEqual([])
})
