// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/infinite-list/src/features/article-list/article-infinite-list.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { articlesKeys } from '@/queries/articles/articles.keys'
import { server } from '@/shared/mocks/node'
import { ArticleInfiniteList } from './article-infinite-list'

// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로, 개발 서버와 E2E처럼 브라우저의 요청을 MSW가 받는
// 빌드를 흉내 낸다(server에서는 쓰이지 않는다). 요청은 Vitest의 MSW(@/shared/mocks/node)가 받고, infinite-list Recipe의
// 핸들러(src/shared/mocks/articles.ts)가 고정된 게시글 46개를 페이지 번호대로 나눠 돌려준다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/**
 * jsdom은 화면을 그리지 않아 IntersectionObserver가 없다. 목록 끝의 표시 요소를 지켜보다가, 테스트가 scrollToEnd()를 부르면
 * 그 요소가 화면에 들어온 것처럼 알리는 가짜다. 실제 브라우저의 동작은 E2E가 본다.
 */
class FakeIntersectionObserver {
  static readonly observing = new Set<FakeIntersectionObserver>()
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = []
  readonly #targets = new Set<Element>()
  readonly #callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback
  }

  observe(target: Element) {
    this.#targets.add(target)
    FakeIntersectionObserver.observing.add(this)
  }

  unobserve(target: Element) {
    this.#targets.delete(target)
  }

  disconnect() {
    this.#targets.clear()
    FakeIntersectionObserver.observing.delete(this)
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  intersect() {
    const entries = [...this.#targets].map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry)
    if (entries.length > 0) this.#callback(entries, this as unknown as IntersectionObserver)
  }
}

/** 목록 끝까지 스크롤해 지켜보던 요소가 화면에 들어온 것처럼 한다. */
function scrollToEnd() {
  act(() => {
    for (const observer of [...FakeIntersectionObserver.observing]) observer.intersect()
  })
}

function renderArticleInfiniteList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ArticleInfiniteList />
    </QueryClientProvider>,
  )
  return { queryClient }
}

/** 목록이 게시글 목록(listArticles)을 요청할 때마다 보낸 쿼리 파라미터를 모은다. */
function recordArticleRequests(): Record<string, string>[] {
  const requests: Record<string, string>[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/articles')) requests.push(Object.fromEntries(url.searchParams))
  })
  onTestFinished(() => {
    server.events.removeAllListeners()
  })
  return requests
}

/** 지금 목록에 있는 게시글의 제목 */
function articleTitles(): string[] {
  const list = screen.queryByRole('list', { name: '게시글 목록' })
  if (list === null) return []
  return within(list)
    .getAllByRole('heading')
    .map((heading) => heading.textContent)
}

/** 불러온 결과는 목록 끝의 상태 문구(role="status")로 알린다. */
async function waitForStatus(status: string) {
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent(status)
  })
}

test('불러오는 중임을 알린 뒤 최근 게시글 10개를 보여 주고, 목록 끝까지 스크롤하면 다음 페이지를 불러와 이어 붙인다', async () => {
  const requests = recordArticleRequests()
  renderArticleInfiniteList()

  expect(screen.getByRole('status')).toHaveTextContent('게시글 목록을 불러오는 중입니다.')
  await waitForStatus('게시글 10개를 불러왔습니다.')
  const firstPage = articleTitles()
  expect(firstPage).toHaveLength(10)
  expect(firstPage[0]).toBe('릴리스 노트 46호')
  expect(firstPage[9]).toBe('릴리스 노트 37호')

  scrollToEnd()

  await waitForStatus('게시글 20개를 불러왔습니다.')
  expect(articleTitles().slice(0, 10)).toEqual(firstPage)
  expect(articleTitles()[10]).toBe('개발 블로그 36호')
  expect(requests).toEqual([
    { page: '1', pageSize: '10' },
    { page: '2', pageSize: '10' },
  ])
})

test('마지막 페이지 뒤의 빈 페이지를 받으면 모두 불러왔다고 알리고, 더 스크롤해도 다시 요청하지 않는다', async () => {
  const requests = recordArticleRequests()
  renderArticleInfiniteList()
  await waitForStatus('게시글 10개를 불러왔습니다.')

  for (const loaded of [20, 30, 40, 46]) {
    scrollToEnd()
    await waitForStatus(`게시글 ${String(loaded)}개를 불러왔습니다.`)
  }
  // 46번째 게시글이 다섯째 페이지의 마지막이지만, 다음 페이지가 비어 있는지 받아 봐야 끝을 안다.
  scrollToEnd()
  await waitForStatus('게시글 46개를 모두 불러왔습니다.')
  scrollToEnd()

  expect(articleTitles()).toHaveLength(46)
  expect(articleTitles().at(-1)).toBe('릴리스 노트 1호')
  expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument()
  expect(requests).toEqual([1, 2, 3, 4, 5, 6].map((page) => ({ page: String(page), pageSize: '10' })))
})

test('스크롤하지 않고 더 보기 버튼으로도 다음 페이지를 불러오고, 새로 불러온 첫 게시글로 포커스를 옮긴다', async () => {
  const user = userEvent.setup()
  renderArticleInfiniteList()
  await waitForStatus('게시글 10개를 불러왔습니다.')

  await user.click(screen.getByRole('button', { name: '더 보기' }))

  await waitForStatus('게시글 20개를 불러왔습니다.')
  expect(screen.getByRole('heading', { name: '개발 블로그 36호' }).closest('li')).toHaveFocus()
})

test('키보드로 더 보기 버튼에 온 동안에는 목록 끝이 보여도 스크롤로 불러오지 않고, 버튼을 눌러야 불러온다', async () => {
  const user = userEvent.setup()
  const requests = recordArticleRequests()
  renderArticleInfiniteList()
  await waitForStatus('게시글 10개를 불러왔습니다.')
  const loadMore = screen.getByRole('button', { name: '더 보기' })

  // 버튼에 포커스가 가면 브라우저가 버튼을 화면에 보이도록 스크롤하므로 목록 끝도 화면에 들어온다.
  loadMore.focus()
  scrollToEnd()
  expect(requests).toHaveLength(1)

  await user.keyboard('{Enter}')
  await waitForStatus('게시글 20개를 불러왔습니다.')
  expect(requests).toHaveLength(2)
})

test('다음 페이지를 불러오지 못하면 알리고 스크롤로는 다시 요청하지 않으며, 다시 시도하면 이어서 불러온다', async () => {
  const user = userEvent.setup()
  const requests = recordArticleRequests()
  // 둘째 페이지의 첫 요청만 실패한다. 나머지 요청은 이 핸들러가 응답하지 않으므로 Recipe의 핸들러가 받는다.
  let failed = false
  server.use(
    http.get('*/articles', ({ request }) => {
      if (failed || new URL(request.url).searchParams.get('page') !== '2') return undefined
      failed = true
      return HttpResponse.json({ message: '점검 중' }, { status: 503 })
    }),
  )
  renderArticleInfiniteList()
  await waitForStatus('게시글 10개를 불러왔습니다.')

  scrollToEnd()

  expect(await screen.findByRole('alert')).toHaveTextContent('다음 페이지를 불러오지 못했습니다.')
  expect(articleTitles()).toHaveLength(10)
  scrollToEnd()
  expect(requests).toHaveLength(2)

  await user.click(screen.getByRole('button', { name: '다시 시도' }))

  await waitForStatus('게시글 20개를 불러왔습니다.')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '개발 블로그 36호' }).closest('li')).toHaveFocus()
})

test('창에 돌아와 받아 둔 페이지를 다시 가져오다 실패해도 목록을 그대로 두고, 스크롤로 계속 불러온다', async () => {
  const { queryClient } = renderArticleInfiniteList()
  await waitForStatus('게시글 10개를 불러왔습니다.')
  server.use(http.get('*/articles', () => HttpResponse.json({ message: '점검 중' }, { status: 503 }), { once: true }))

  // 다른 탭에 갔다가 돌아오면 받아 둔 페이지를 다시 가져온다(TanStack Query의 refetchOnWindowFocus).
  act(() => {
    window.dispatchEvent(new Event('visibilitychange'))
  })
  await waitFor(() => {
    expect(queryClient.getQueryState(articlesKeys.listArticlesInfinite({ pageSize: 10 }))?.status).toBe('error')
  })
  // 실패한 결과는 다음 매크로태스크에 컴포넌트에 알려지므로, 그 뒤에 그려진 화면을 본다.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))

  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(articleTitles()).toHaveLength(10)
  scrollToEnd()
  await waitForStatus('게시글 20개를 불러왔습니다.')
})

test('첫 페이지를 불러오지 못하면 알리고, 다시 시도할 수 있다', async () => {
  const user = userEvent.setup()
  let failed = false
  server.use(
    http.get('*/articles', () => {
      if (failed) return undefined
      failed = true
      return HttpResponse.json({ message: '점검 중' }, { status: 503 })
    }),
  )
  renderArticleInfiniteList()

  expect(await screen.findByRole('alert')).toHaveTextContent('게시글 목록을 불러오지 못했습니다.')

  await user.click(screen.getByRole('button', { name: '다시 시도' }))

  await waitForStatus('게시글 10개를 불러왔습니다.')
  expect(articleTitles()).toHaveLength(10)
})

test('게시글이 하나도 없으면 비어 있다고 알린다', async () => {
  server.use(http.get('*/articles', () => HttpResponse.json([])))
  renderArticleInfiniteList()

  await waitForStatus('게시글 목록이 비어 있습니다.')
  expect(screen.queryByRole('list', { name: '게시글 목록' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument()
})
