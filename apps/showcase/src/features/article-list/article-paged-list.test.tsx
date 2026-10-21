// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/infinite-list/src/features/article-list/article-paged-list.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { server } from '@/shared/mocks/node'
import { ArticlePagedList } from './article-paged-list'

// 무한 스크롤 목록(article-infinite-list.test.tsx)과 같은 게시글 46개를 쪽 번호로 나눠 본다. 요청은 Vitest의
// MSW(@/shared/mocks/node)가 받고, static-export처럼 브라우저가 백엔드를 직접 부르는 빌드를 흉내 낸다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function renderArticlePagedList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ArticlePagedList />
    </QueryClientProvider>,
  )
}

/** 목록이 게시글 목록(listArticles)을 요청할 때마다 보낸 쿼리 파라미터를 모은다. */
function recordArticleRequests(): string[] {
  const requests: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/articles')) requests.push(url.search)
  })
  onTestFinished(() => {
    server.events.removeAllListeners()
  })
  return requests
}

function articleTitles(): string[] {
  return within(screen.getByRole('list', { name: '게시글 목록' }))
    .getAllByRole('heading')
    .map((heading) => heading.textContent)
}

async function waitForStatus(status: string) {
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent(status)
  })
}

test('전체 게시글 수로 쪽 수를 정하고, 첫 쪽의 최근 게시글 10개를 보여 준다', async () => {
  renderArticlePagedList()

  expect(screen.getByRole('status')).toHaveTextContent('게시글 목록을 불러오는 중입니다.')
  await waitForStatus('게시글 46개 중 1–10번째')
  expect(articleTitles()).toHaveLength(10)
  expect(articleTitles()[0]).toBe('릴리스 노트 46호')
  const pages = screen.getByRole('navigation', { name: '게시글 목록 페이지' })
  expect(
    within(pages)
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(['이전', '1', '2', '3', '4', '5', '다음'])
  expect(within(pages).getByRole('button', { name: '1 쪽' })).toHaveAttribute('aria-current', 'page')
})

test('쪽 번호와 이전·다음으로 그 쪽을 요청해 보여 준다. 무한 스크롤 목록의 같은 페이지와 같은 게시글이다', async () => {
  const user = userEvent.setup()
  const requests = recordArticleRequests()
  renderArticlePagedList()
  await waitForStatus('게시글 46개 중 1–10번째')

  await user.click(screen.getByRole('button', { name: '3 쪽' }))

  await waitForStatus('게시글 46개 중 21–30번째')
  expect(articleTitles()[0]).toBe('운영 공지 26호')
  expect(screen.getByRole('button', { name: '3 쪽' })).toHaveAttribute('aria-current', 'page')

  await user.click(screen.getByRole('button', { name: '5 쪽' }))

  await waitForStatus('게시글 46개 중 41–46번째')
  expect(articleTitles()).toHaveLength(6)
  expect(articleTitles().at(-1)).toBe('릴리스 노트 1호')
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()

  await user.click(screen.getByRole('button', { name: '이전' }))

  await waitForStatus('게시글 46개 중 31–40번째')
  expect(requests).toEqual(['?page=1&pageSize=10', '?page=3&pageSize=10', '?page=5&pageSize=10', '?page=4&pageSize=10'])
})

test('한 쪽을 불러오지 못하면 알리고, 쪽 번호는 남겨 두어 다시 시도하거나 다른 쪽으로 옮길 수 있다', async () => {
  const user = userEvent.setup()
  server.use(
    http.get('*/articles', ({ request }) =>
      new URL(request.url).searchParams.get('page') === '2'
        ? HttpResponse.json({ message: '점검 중' }, { status: 503 })
        : undefined,
    ),
  )
  renderArticlePagedList()
  await waitForStatus('게시글 46개 중 1–10번째')

  await user.click(screen.getByRole('button', { name: '2 쪽' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('게시글 목록을 불러오지 못했습니다.')
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '3 쪽' }))

  await waitForStatus('게시글 46개 중 21–30번째')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('게시글 수를 불러오지 못하면 알리고, 다시 시도할 수 있다', async () => {
  const user = userEvent.setup()
  let failed = false
  server.use(
    http.get('*/articles/count', () => {
      if (failed) return undefined
      failed = true
      return HttpResponse.json({ message: '점검 중' }, { status: 503 })
    }),
  )
  renderArticlePagedList()

  expect(await screen.findByRole('alert')).toHaveTextContent('게시글 목록을 불러오지 못했습니다.')
  expect(screen.queryByRole('navigation', { name: '게시글 목록 페이지' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '다시 시도' }))

  await waitForStatus('게시글 46개 중 1–10번째')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
