import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { StatusBadge } from './status-badge'

test('내용을 보여 준다', () => {
  render(<StatusBadge>StatusBadge</StatusBadge>)

  expect(screen.getByText('StatusBadge')).toBeInTheDocument()
})
