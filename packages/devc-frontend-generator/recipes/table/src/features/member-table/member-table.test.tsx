import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { membersKeys } from '@/queries/members/members.keys'
import { server } from '@/shared/mocks/node'
import { MemberTable } from './member-table'

// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로, 개발 서버와 E2E처럼 브라우저의 요청을 MSW가 받는
// 빌드를 흉내 낸다(server에서는 쓰이지 않는다). 요청은 Vitest의 MSW(@/shared/mocks/node)가 받는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function renderMemberTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemberTable />
    </QueryClientProvider>,
  )
  return { queryClient }
}

/** 테이블이 회원 목록(listMembers)을 요청할 때마다 보낸 쿼리 파라미터를 모은다. */
function recordMemberRequests(): Record<string, string>[] {
  const requests: Record<string, string>[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/members')) requests.push(Object.fromEntries(url.searchParams))
  })
  onTestFinished(() => {
    server.events.removeAllListeners()
  })
  return requests
}

/** 표의 본문 행마다 첫 칸(이름)을 읽는다. */
function memberNames(): string[] {
  const [, body] = screen.getAllByRole('rowgroup')
  if (body === undefined) throw new Error('표에 본문이 없습니다.')
  return within(body)
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '')
}

/** Tab 키만으로 element까지 포커스를 옮긴다. */
async function tabTo(user: UserEvent, element: HTMLElement) {
  for (let presses = 0; presses < 20 && document.activeElement !== element; presses += 1) await user.tab()
  expect(element).toHaveFocus()
}

/** 요청한 목록을 받아 그릴 때까지 기다린다. 받은 결과는 상태 문구(role="status")로 알린다. */
async function waitForSummary(summary: string) {
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent(summary)
  })
}

test('불러오는 중임을 알린 뒤, 가입한 순서로 첫 페이지 10명을 보여 주고 거른 회원 수를 알린다', async () => {
  renderMemberTable()

  expect(screen.getByRole('status')).toHaveTextContent('회원을 불러오는 중입니다.')
  await waitForSummary('회원 24명 중 1–10번째')
  expect(screen.getByRole('table', { name: '회원 목록' })).toBeInTheDocument()
  expect(memberNames()).toEqual([
    '김하늘',
    '이도윤',
    '박서연',
    '최민준',
    '정지우',
    '강예린',
    '조현우',
    '윤서아',
    '장민서',
    '임준호',
  ])
})

test('정렬 버튼을 누를 때마다 오름차순, 내림차순, 정렬 없음 순으로 서버에 정렬을 요청하고 정렬 상태를 aria-sort로 알린다', async () => {
  const user = userEvent.setup()
  const requests = recordMemberRequests()
  renderMemberTable()
  await waitForSummary('회원 24명 중 1–10번째')
  const nameHeader = screen.getByRole('columnheader', { name: '이름' })
  const sortByName = within(nameHeader).getByRole('button', { name: '이름' })
  expect(nameHeader).not.toHaveAttribute('aria-sort')

  await user.click(sortByName)

  await waitFor(() => {
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
  })
  await waitFor(() => {
    expect(memberNames()).toEqual([
      '강예린',
      '고은채',
      '권나연',
      '김하늘',
      '문시우',
      '박서연',
      '배지호',
      '서유진',
      '송재원',
      '신동현',
    ])
  })
  expect(requests.at(-1)).toEqual({ sort: 'name', order: 'asc', page: '1', pageSize: '10' })

  await user.click(sortByName)

  expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
  await waitFor(() => {
    expect(memberNames().slice(0, 3)).toEqual(['황태민', '홍길동', '한지민'])
  })
  expect(requests.at(-1)).toEqual({ sort: 'name', order: 'desc', page: '1', pageSize: '10' })

  await user.click(sortByName)

  expect(nameHeader).not.toHaveAttribute('aria-sort')
  await waitFor(() => {
    expect(memberNames().slice(0, 3)).toEqual(['김하늘', '이도윤', '박서연'])
  })
})

test('검색어를 입력하고 Enter를 누르면 서버에 검색어를 보내 이름이나 이메일에 검색어가 든 회원만 보여 준다', async () => {
  const user = userEvent.setup()
  const requests = recordMemberRequests()
  renderMemberTable()
  await waitForSummary('회원 24명 중 1–10번째')

  await user.type(screen.getByRole('searchbox', { name: '이름·이메일 검색' }), 'SEO{Enter}')

  await waitForSummary('회원 4명 중 1–4번째')
  expect(memberNames()).toEqual(['박서연', '윤서아', '장민서', '서유진'])
  expect(requests.at(-1)).toEqual({ q: 'SEO', page: '1', pageSize: '10' })
})

test('역할을 고르면 서버에 역할 필터를 보내 그 역할의 회원만 보여 주고, 전체를 고르면 필터를 지운다', async () => {
  const user = userEvent.setup()
  const requests = recordMemberRequests()
  renderMemberTable()
  await waitForSummary('회원 24명 중 1–10번째')
  const roleFilter = screen.getByRole('combobox', { name: '역할' })
  expect(roleFilter).toHaveTextContent('전체')

  await user.click(roleFilter)
  await user.click(await screen.findByRole('option', { name: '관리자' }))

  await waitForSummary('회원 4명 중 1–4번째')
  expect(memberNames()).toEqual(['김하늘', '강예린', '서유진', '홍길동'])
  expect(screen.getAllByRole('cell', { name: '관리자' })).toHaveLength(4)
  expect(requests.at(-1)).toEqual({ role: 'admin', page: '1', pageSize: '10' })

  await user.click(roleFilter)
  await user.click(await screen.findByRole('option', { name: '전체' }))

  await waitForSummary('회원 24명 중 1–10번째')
})

test('다음·이전 버튼으로 서버에 다른 페이지를 요청하고, 끝 페이지에서는 더 갈 수 없다', async () => {
  const user = userEvent.setup()
  const requests = recordMemberRequests()
  renderMemberTable()
  await waitForSummary('회원 24명 중 1–10번째')
  const pages = screen.getByRole('navigation', { name: '회원 목록 페이지' })
  const previous = within(pages).getByRole('button', { name: '이전' })
  const next = within(pages).getByRole('button', { name: '다음' })
  expect(pages).toHaveTextContent('1 / 3쪽')
  expect(previous).toBeDisabled()

  await user.click(next)

  await waitForSummary('회원 24명 중 11–20번째')
  expect(memberNames().slice(0, 3)).toEqual(['한지민', '오세훈', '서유진'])
  expect(requests.at(-1)).toEqual({ page: '2', pageSize: '10' })

  await user.click(next)

  await waitForSummary('회원 24명 중 21–24번째')
  expect(memberNames()).toEqual(['전수빈', '고은채', '문시우', '배지호'])
  expect(pages).toHaveTextContent('3 / 3쪽')
  expect(next).toBeDisabled()

  await user.click(previous)

  await waitForSummary('회원 24명 중 11–20번째')
})

test('정렬이나 필터를 바꾸면 첫 페이지부터 다시 보여 준다', async () => {
  const user = userEvent.setup()
  const requests = recordMemberRequests()
  renderMemberTable()
  await waitForSummary('회원 24명 중 1–10번째')
  await user.click(screen.getByRole('button', { name: '다음' }))
  await waitForSummary('회원 24명 중 11–20번째')

  await user.click(screen.getByRole('button', { name: '가입일' }))

  await waitForSummary('회원 24명 중 1–10번째')
  expect(memberNames().slice(0, 3)).toEqual(['문시우', '홍길동', '안소희'])
  expect(requests.at(-1)).toEqual({ sort: 'joinedAt', order: 'asc', page: '1', pageSize: '10' })

  await user.click(screen.getByRole('button', { name: '다음' }))
  await waitForSummary('회원 24명 중 11–20번째')
  await user.type(screen.getByRole('searchbox', { name: '이름·이메일 검색' }), 'kim{Enter}')

  await waitForSummary('회원 1명 중 1–1번째')
  expect(memberNames()).toEqual(['김하늘'])
  expect(requests.at(-1)).toEqual({ q: 'kim', sort: 'joinedAt', order: 'asc', page: '1', pageSize: '10' })
})

test('키보드만으로 정렬할 수 있다: Tab으로 정렬 버튼에 가서 Enter와 Space로 정렬 방향을 바꾼다', async () => {
  const user = userEvent.setup()
  renderMemberTable()
  await waitForSummary('회원 24명 중 1–10번째')
  const emailHeader = screen.getByRole('columnheader', { name: '이메일' })

  await tabTo(user, within(emailHeader).getByRole('button', { name: '이메일' }))
  await user.keyboard('{Enter}')

  expect(emailHeader).toHaveAttribute('aria-sort', 'ascending')
  await waitFor(() => {
    expect(memberNames().slice(0, 3)).toEqual(['신동현', '이도윤', '고은채'])
  })

  await user.keyboard(' ')

  expect(emailHeader).toHaveAttribute('aria-sort', 'descending')
  await waitFor(() => {
    expect(memberNames().slice(0, 3)).toEqual(['서유진', '강예린', '황태민'])
  })
})

test('정렬·필터·페이지 상태는 쿼리 키에 담기므로, 그 상태로 받은 결과를 Query Domain의 쿼리 키로 찾을 수 있다', async () => {
  const user = userEvent.setup()
  const { queryClient } = renderMemberTable()
  await waitForSummary('회원 24명 중 1–10번째')

  await user.click(screen.getByRole('button', { name: '이름' }))
  await user.click(screen.getByRole('combobox', { name: '역할' }))
  await user.click(await screen.findByRole('option', { name: '편집자' }))

  await waitForSummary('회원 7명 중 1–7번째')
  expect(memberNames()).toEqual(['고은채', '권나연', '송재원', '윤서아', '이도윤', '최민준', '한지민'])
  const key = membersKeys.listMembers({ role: 'editor', sort: 'name', order: 'asc', page: 1, pageSize: 10 })
  expect(queryClient.getQueryData(key)).toMatchObject({ total: 7, page: 1 })
})

test('조건에 맞는 회원이 없으면 안내하고 다른 페이지로 갈 수 없다', async () => {
  const user = userEvent.setup()
  renderMemberTable()
  await waitForSummary('회원 24명 중 1–10번째')

  await user.type(screen.getByRole('searchbox', { name: '이름·이메일 검색' }), '없는 회원{Enter}')

  await waitForSummary('조건에 맞는 회원이 없습니다.')
  expect(screen.getByRole('cell', { name: '조건에 맞는 회원이 없습니다.' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: '회원 목록 페이지' })).toHaveTextContent('1 / 1쪽')
  expect(screen.getByRole('button', { name: '다음' })).toBeDisabled()
})

test('백엔드가 실패하면 불러오지 못했다고 알린다', async () => {
  server.use(http.get('*/members', () => HttpResponse.json({ message: '점검 중' }, { status: 503 })))

  renderMemberTable()

  expect(await screen.findByRole('alert')).toHaveTextContent('회원 목록을 불러오지 못했습니다.')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})
