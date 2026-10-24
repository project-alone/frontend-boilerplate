import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { StatusBadge } from './status-badge'

// 변형마다 내용을 보여 주고 접근성 위반이 없는지 본다. 변형을 더하면 여기에도 더한다.
test.each(['default', 'muted'] as const)('%s 변형은 내용을 보여 주고 접근성 위반이 없다', async (variant) => {
  const { container } = render(<StatusBadge variant={variant}>StatusBadge</StatusBadge>)

  expect(screen.getByText('StatusBadge')).toBeInTheDocument()
  expect(await axeViolations(container)).toEqual([])
})
