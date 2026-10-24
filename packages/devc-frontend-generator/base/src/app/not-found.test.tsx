import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import AppNotFound from './not-found'

test('찾는 화면이 없다고 알리고 홈으로 가는 링크를 둔다. 접근성 위반이 없다', async () => {
  const { container } = render(<AppNotFound />)

  expect(screen.getByRole('heading', { level: 1, name: '찾는 화면이 없습니다' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
  expect(await axeViolations(container)).toEqual([])
})
