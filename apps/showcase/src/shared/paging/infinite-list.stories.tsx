// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/infinite-list/src/shared/paging/infinite-list.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn, waitFor, within } from 'storybook/test'
import { InfiniteList } from './infinite-list'

interface SampleItem {
  id: number
  title: string
}

// 스토리는 화면보다 긴 목록을 쓴다. 그래야 목록 끝이 처음에는 화면 밖에 있다.
const ITEMS: SampleItem[] = Array.from({ length: 20 }, (_, index) => ({
  id: 20 - index,
  title: `게시글 ${String(20 - index)}`,
}))

/** IntersectionObserver가 지켜보던 요소의 변화를 알릴 때까지(다음 화면 갱신 두 번) 기다린다. */
async function nextFrames() {
  for (let frame = 0; frame < 2; frame += 1) await new Promise(requestAnimationFrame)
}

const meta = {
  title: 'Shared/Paging/InfiniteList',
  component: InfiniteList<SampleItem>,
  args: {
    itemName: '게시글',
    items: ITEMS,
    getKey: (item) => item.id,
    renderItem: (item) => (
      <article className="rounded-md border border-border p-4">
        <h2 className="font-semibold">{item.title}</h2>
        <p className="text-sm text-muted-foreground">스크롤하면 다음 페이지를 불러옵니다.</p>
      </article>
    ),
    hasNextPage: true,
    isFetchingNextPage: false,
    isError: false,
    onLoadMore: fn(),
    onRetry: fn(),
  },
} satisfies Meta<typeof InfiniteList<SampleItem>>

export default meta

type Story = StoryObj<typeof meta>

// test:storybook은 모든 스토리를 axe로 검사한다. dark-mode Recipe가 있으면 다크 모드 브라우저에서도 한 번 더 실행된다.
export const ScrollToLoadMore: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('게시글 20개를 불러왔습니다.')
    await nextFrames()
    await expect(args.onLoadMore).not.toHaveBeenCalled()

    // 실제 브라우저에서 목록 끝까지 스크롤하면 IntersectionObserver가 알려 다음 페이지를 불러온다.
    canvas.getByRole('button', { name: '더 보기' }).scrollIntoView()

    await waitFor(() => expect(args.onLoadMore).toHaveBeenCalledTimes(1))
  },
}

export const KeyboardLoadMore: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const loadMore = canvas.getByRole('button', { name: '더 보기' })

    // 버튼에 포커스가 가면 브라우저가 버튼을 화면에 보이도록 스크롤하지만, 버튼에 온 사용자가 직접 불러오도록 기다린다.
    loadMore.focus()
    await nextFrames()
    await expect(args.onLoadMore).not.toHaveBeenCalled()

    await userEvent.keyboard('{Enter}')

    await expect(args.onLoadMore).toHaveBeenCalledTimes(1)
  },
}

export const FetchingNextPage: Story = {
  args: { isFetchingNextPage: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('다음 페이지를 불러오는 중입니다.')
    await expect(canvas.getByRole('list', { name: '게시글 목록' })).toHaveAttribute('aria-busy', 'true')
    // 불러오는 동안에도 버튼에 포커스가 남도록 disabled 대신 aria-disabled를 쓴다.
    await expect(canvas.getByRole('button', { name: '더 보기' })).toHaveAttribute('aria-disabled', 'true')
  },
}

export const LastPage: Story = {
  args: { hasNextPage: false },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('게시글 20개를 모두 불러왔습니다.')
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument()
  },
}

export const NextPageError: Story = {
  args: { isError: true },
  play: async ({ canvas, args, userEvent }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('다음 페이지를 불러오지 못했습니다.')
    await expect(within(canvas.getByRole('list', { name: '게시글 목록' })).getAllByRole('listitem')).toHaveLength(20)

    await userEvent.click(canvas.getByRole('button', { name: '다시 시도' }))

    await expect(args.onRetry).toHaveBeenCalledTimes(1)
    await expect(args.onLoadMore).not.toHaveBeenCalled()
  },
}

export const FirstPageError: Story = {
  args: { items: undefined, isError: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('게시글 목록을 불러오지 못했습니다.')
    await expect(canvas.getByRole('button', { name: '다시 시도' })).toBeVisible()
  },
}
