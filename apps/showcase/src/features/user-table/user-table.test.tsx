// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/features/user-table/user-table.test.tsx

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { expect, onTestFinished, test } from 'vitest'
import { server } from '@/shared/mocks/node'
import { UserTable } from './user-table'

// 요청은 Vitest의 MSW(@/shared/mocks/node)가 받는다. 목록은 대시보드의 목 백엔드(src/shared/mocks/users.ts)가 처음 사용자
// 12명을 파라미터대로 거르고 정렬해 돌려준다.

function renderTable({ canEdit = false } = {}) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UserTable canEdit={canEdit} />
    </QueryClientProvider>,
  )
}

/** 테이블이 사용자 목록(listUsers)을 요청할 때마다 보낸 쿼리 파라미터를 모은다. */
function recordListRequests(): Record<string, string>[] {
  const requests: Record<string, string>[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith('/users')) requests.push(Object.fromEntries(url.searchParams))
  })
  onTestFinished(() => {
    server.events.removeAllListeners()
  })
  return requests
}

/** 표의 본문 행마다 첫 칸(이름)을 읽는다. */
function userNames(): string[] {
  const [, body] = screen.getAllByRole('rowgroup')
  if (body === undefined) throw new Error('표에 본문이 없습니다.')
  return within(body)
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent ?? '')
}

async function waitForSummary(summary: string) {
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent(summary)
  })
}

test('처음에는 최근에 추가한 사용자부터 한 페이지(10명)를 보여 준다', async () => {
  const requests = recordListRequests()
  renderTable()

  await waitForSummary('사용자 12명 중 1–10번째')
  expect(userNames()[0]).toBe('서하린')
  expect(requests).toEqual([{ page: '1', pageSize: '10' }])
})

test('열 머리글로 정렬하고, 검색어와 역할·상태로 거르면 그 조건을 요청 파라미터로 보낸다', async () => {
  const user = userEvent.setup()
  const requests = recordListRequests()
  renderTable()
  await waitForSummary('사용자 12명 중')

  await user.click(screen.getByRole('button', { name: '이름' }))
  await waitFor(() => {
    expect(userNames()[0]).toBe('강민지')
  })
  expect(screen.getByRole('columnheader', { name: '이름' })).toHaveAttribute('aria-sort', 'ascending')

  await user.click(screen.getByRole('combobox', { name: '상태' }))
  await user.click(await screen.findByRole('option', { name: '활성' }))
  await waitForSummary('사용자 8명 중')

  await user.click(screen.getByRole('combobox', { name: '역할' }))
  await user.click(await screen.findByRole('option', { name: '관리자' }))
  await waitForSummary('사용자 3명 중')
  expect(userNames()).toEqual(['박관리', '정하준', '한예준'])

  await user.type(screen.getByRole('searchbox', { name: '이름·이메일 검색' }), 'yejun')
  await user.click(screen.getByRole('button', { name: '검색' }))
  await waitForSummary('사용자 1명 중')
  expect(userNames()).toEqual(['한예준'])

  expect(requests.at(-1)).toEqual({
    q: 'yejun',
    role: 'admin',
    status: 'active',
    sort: 'name',
    order: 'asc',
    page: '1',
    pageSize: '10',
  })
})

test('사용자를 고칠 수 있으면 줄마다 그 사용자의 수정 링크를 두고, 아니면 두지 않는다', async () => {
  renderTable({ canEdit: true })
  await waitForSummary('사용자 12명 중')

  expect(screen.getByRole('link', { name: '서하린 수정' })).toHaveAttribute('href', '/dashboard/users/12/edit')
  expect(screen.getAllByRole('link', { name: / 수정$/ })).toHaveLength(10)
})

test('사용자를 고칠 수 없으면 수정 링크를 두지 않는다', async () => {
  renderTable()
  await waitForSummary('사용자 12명 중')

  expect(screen.queryByRole('link', { name: / 수정$/ })).not.toBeInTheDocument()
})

test('목록을 받지 못하면 알린다', async () => {
  server.use(http.get('*/users', () => HttpResponse.json({ message: '실패' }, { status: 500 })))
  renderTable()

  expect(await screen.findByRole('alert')).toHaveTextContent('사용자 목록을 불러오지 못했습니다.')
})
