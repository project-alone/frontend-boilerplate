import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { axeViolations } from '@/shared/a11y/axe-violations'
import { InfiniteList, type InfiniteListProps } from './infinite-list'

// 목록의 상태(불러오는 중, 마지막 페이지, 실패)마다 무엇을 알리는지와 접근성을 본다. 스크롤로 불러오는 것은 Feature의 테스트
// (src/features/article-list/article-infinite-list.test.tsx)와 실제 브라우저의 E2E가 본다.

interface SampleItem {
  id: number
  title: string
}

const ITEMS: SampleItem[] = Array.from({ length: 20 }, (_, index) => ({
  id: 20 - index,
  title: `게시글 ${String(20 - index)}`,
}))

// jsdom에는 IntersectionObserver가 없다. 이 테스트는 스크롤하지 않으므로 지켜보기만 하고 알리지 않는다.
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
    },
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderList(props: Partial<InfiniteListProps<SampleItem>> = {}) {
  const onLoadMore = vi.fn()
  const onRetry = vi.fn()
  const view = render(
    <InfiniteList<SampleItem>
      itemName="게시글"
      items={ITEMS}
      getKey={(item) => item.id}
      renderItem={(item) => <h2>{item.title}</h2>}
      hasNextPage
      isFetchingNextPage={false}
      isError={false}
      onLoadMore={onLoadMore}
      onRetry={onRetry}
      {...props}
    />,
  )
  return { onLoadMore, onRetry, ...view }
}

test('불러온 항목 수를 알리고, 더 보기 버튼에 포커스만 옮겨서는 불러오지 않으며 Enter로 불러온다', async () => {
  const user = userEvent.setup()
  const { onLoadMore, container } = renderList()

  expect(screen.getByRole('status')).toHaveTextContent('게시글 20개를 불러왔습니다.')
  expect(await axeViolations(container)).toEqual([])

  screen.getByRole('button', { name: '더 보기' }).focus()
  expect(onLoadMore).not.toHaveBeenCalled()
  await user.keyboard('{Enter}')
  expect(onLoadMore).toHaveBeenCalledTimes(1)
})

test('다음 페이지를 불러오는 동안 알리고, 버튼은 포커스가 남도록 aria-disabled로 막는다', async () => {
  const { container } = renderList({ isFetchingNextPage: true })

  expect(screen.getByRole('status')).toHaveTextContent('다음 페이지를 불러오는 중입니다.')
  expect(screen.getByRole('list', { name: '게시글 목록' })).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('button', { name: '더 보기' })).toHaveAttribute('aria-disabled', 'true')
  expect(await axeViolations(container)).toEqual([])
})

test('마지막 페이지까지 불러왔으면 알리고 버튼을 두지 않는다', async () => {
  const { container } = renderList({ hasNextPage: false })

  expect(screen.getByRole('status')).toHaveTextContent('게시글 20개를 모두 불러왔습니다.')
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(await axeViolations(container)).toEqual([])
})

test('다음 페이지를 받지 못하면 알리고, 받은 항목은 그대로 두며 다시 시도 버튼으로 다시 보낸다', async () => {
  const user = userEvent.setup()
  const { onLoadMore, onRetry, container } = renderList({ isError: true })

  expect(screen.getByRole('alert')).toHaveTextContent('다음 페이지를 불러오지 못했습니다.')
  expect(within(screen.getByRole('list', { name: '게시글 목록' })).getAllByRole('listitem')).toHaveLength(20)
  expect(await axeViolations(container)).toEqual([])

  await user.click(screen.getByRole('button', { name: '다시 시도' }))

  expect(onRetry).toHaveBeenCalledTimes(1)
  expect(onLoadMore).not.toHaveBeenCalled()
})

test('첫 페이지를 받지 못하면 목록 대신 알리고 다시 시도 버튼을 둔다', async () => {
  const { container } = renderList({ items: undefined, isError: true })

  expect(screen.getByRole('alert')).toHaveTextContent('게시글 목록을 불러오지 못했습니다.')
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible()
  expect(await axeViolations(container)).toEqual([])
})
