import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { Pagination } from './pagination'

/** 페이지 이동 영역에 보이는 쪽 번호와 줄임표를 차례로 읽는다(이전·다음 버튼은 뺀다). 줄임표는 보조 기술에서 숨긴다. */
function pageItems(): string[] {
  return within(screen.getByRole('navigation', { name: '게시글 목록 페이지' }))
    .getAllByRole('listitem', { hidden: true })
    .map((item) => item.textContent)
    .filter((text) => text !== '이전' && text !== '다음')
}

function renderPagination(page: number, pageCount: number) {
  const onPageChange = vi.fn<(page: number) => void>()
  const view = render(
    <Pagination label="게시글 목록 페이지" page={page} pageCount={pageCount} onPageChange={onPageChange} />,
  )
  return { onPageChange, ...view }
}

test('일곱 쪽까지는 모든 쪽 번호를 보여 주고, 지금 쪽을 aria-current로 알린다', () => {
  renderPagination(2, 5)

  expect(pageItems()).toEqual(['1', '2', '3', '4', '5'])
  expect(screen.getByRole('button', { name: '2 쪽' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: '3 쪽' })).not.toHaveAttribute('aria-current')
})

test('쪽이 많으면 첫 쪽, 마지막 쪽과 지금 쪽의 앞뒤만 보여 주고 나머지는 줄임표로 줄인다', () => {
  const { rerender, onPageChange } = renderPagination(1, 10)
  const show = (page: number) => {
    rerender(<Pagination label="게시글 목록 페이지" page={page} pageCount={10} onPageChange={onPageChange} />)
    return pageItems()
  }

  expect(pageItems()).toEqual(['1', '2', '3', '4', '5', '…', '10'])
  expect(show(4)).toEqual(['1', '2', '3', '4', '5', '…', '10'])
  expect(show(5)).toEqual(['1', '…', '4', '5', '6', '…', '10'])
  expect(show(7)).toEqual(['1', '…', '6', '7', '8', '9', '10'])
  expect(show(10)).toEqual(['1', '…', '6', '7', '8', '9', '10'])
  // 줄임표는 보조 기술에 읽히지 않는다.
  expect(screen.getByText('…', { selector: '[aria-hidden="true"]' })).toBeInTheDocument()
})

test('쪽 번호와 이전·다음으로 쪽을 바꾸고, 첫 쪽에서는 이전을, 마지막 쪽에서는 다음을 누를 수 없다', async () => {
  const user = userEvent.setup()
  const { rerender, onPageChange } = renderPagination(1, 5)

  expect(screen.getByRole('button', { name: '이전' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: '3 쪽' }))
  await user.click(screen.getByRole('button', { name: '다음' }))
  expect(onPageChange.mock.calls).toEqual([[3], [2]])

  rerender(<Pagination label="게시글 목록 페이지" page={5} pageCount={5} onPageChange={onPageChange} />)

  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: '이전' }))
  expect(onPageChange).toHaveBeenLastCalledWith(4)
})

test.each([
  { page: 5, pageCount: 10 },
  { page: 1, pageCount: 5 },
])('$pageCount쪽 가운데 $page쪽의 페이지 이동 영역에 접근성 위반이 없다', async ({ page, pageCount }) => {
  const { container } = renderPagination(page, pageCount)

  expect(screen.getByRole('button', { name: `${String(page)} 쪽` })).toHaveAttribute('aria-current', 'page')
  expect(await axeViolations(container)).toEqual([])
})
