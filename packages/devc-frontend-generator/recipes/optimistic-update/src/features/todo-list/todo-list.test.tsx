import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { todosKeys } from '@/queries/todos/todos.keys'
import { type Todo, TodoUpdate } from '@/shared/api/generated/model'
import {
  getListTodosMockHandler,
  getListTodosResponseMock,
  getUpdateTodoMockHandler,
} from '@/shared/api/generated/todos/todos.msw'
import { server } from '@/shared/mocks/node'
import { ToastProvider } from '@/shared/ui/toast'
import { TodoList } from './todo-list'

// Rendering Mode static-export에서는 브라우저가 백엔드를 직접 부르므로, 개발 서버와 E2E처럼 브라우저의 요청을 MSW가 받는
// 빌드를 흉내 낸다(server에서는 쓰이지 않는다). 요청은 Vitest의 MSW(@/shared/mocks/node)가 받는다.
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

/** 앱 레이아웃(src/app/app-shell.tsx)처럼 쿼리 클라이언트와 알림으로 감싸 할 일 목록을 그린다. */
function renderTodoList() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TodoList />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { queryClient }
}

/** 체크박스가 든 할 일 항목(listitem) */
function itemOf(checkbox: HTMLElement): HTMLElement {
  const item = checkbox.closest('li')
  if (item === null) throw new Error('체크박스가 할 일 항목 안에 없습니다.')
  return item
}

test('불러오는 중임을 알린 뒤, 할 일을 만든 순서로 보여 주고 몇 개를 끝냈는지 알린다', async () => {
  renderTodoList()

  expect(screen.getByRole('status')).toHaveTextContent('할 일을 불러오는 중입니다.')
  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('할 일 4개 중 1개를 끝냈습니다.')
  })
  const items = within(screen.getByRole('list', { name: '할 일 목록' })).getAllByRole('listitem')
  expect(items.map((item) => item.textContent)).toEqual([
    '디자인 시안 검토하기',
    '회의록 공유하기',
    '배포 일정 정하기',
    '보안 점검 결과 승인하기(보안 담당자만 바꿀 수 있음)',
  ])
  expect(screen.getByRole('checkbox', { name: '디자인 시안 검토하기' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: '회의록 공유하기' })).not.toBeChecked()
})

test('체크하면 저장 응답을 기다리지 않고 바로 끝낸 할 일로 보여 주고, 응답이 오면 목록을 서버의 값으로 다시 맞춘다', async () => {
  // 서버의 할 일. 저장하는 동안 동료가 할 일을 하나 더했다. 저장 응답은 response를 풀 때까지 오지 않는다.
  let serverTodos: Todo[] = [
    { id: 1, title: '디자인 시안 검토하기', done: true },
    { id: 2, title: '회의록 공유하기', done: false },
  ]
  const response = Promise.withResolvers<undefined>()
  server.use(
    getListTodosMockHandler(() => serverTodos),
    getUpdateTodoMockHandler(async ({ request }) => {
      await response.promise
      const { done } = TodoUpdate.parse(await request.json())
      const updated = { id: 2, title: '회의록 공유하기', done }
      serverTodos = [
        { id: 1, title: '디자인 시안 검토하기', done: true },
        updated,
        { id: 5, title: '회고 일정 잡기', done: false },
      ]
      return updated
    }),
  )
  const user = userEvent.setup()
  const { queryClient } = renderTodoList()
  const checkbox = await screen.findByRole('checkbox', { name: '회의록 공유하기' })
  expect(checkbox).not.toBeChecked()

  await user.click(checkbox)

  // 응답은 아직 오지 않았다. 화면은 Query Domain의 목록 캐시를 고친 값을 보여 준다.
  await waitFor(() => {
    expect(checkbox).toBeChecked()
  })
  expect(queryClient.getQueryData(todosKeys.listTodos())).toEqual([
    { id: 1, title: '디자인 시안 검토하기', done: true },
    { id: 2, title: '회의록 공유하기', done: true },
  ])
  expect(screen.getByRole('status')).toHaveTextContent('할 일 2개 중 2개를 끝냈습니다.')
  expect(itemOf(checkbox)).toHaveAttribute('aria-busy', 'true')
  expect(within(itemOf(checkbox)).getByText('저장 중')).toBeInTheDocument()

  response.resolve(undefined)

  await waitFor(() => {
    expect(screen.getByRole('status')).toHaveTextContent('할 일 3개 중 2개를 끝냈습니다.')
  })
  expect(screen.getByRole('checkbox', { name: '회의록 공유하기' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: '회고 일정 잡기' })).not.toBeChecked()
  expect(screen.queryByText('저장 중')).not.toBeInTheDocument()
})

test('서버가 거절하면 목록을 다시 가져오기 전에 미리 바꾼 체크를 되돌리고, 무엇을 왜 되돌렸는지 알림으로 알린다', async () => {
  // 실패한 뒤에 목록을 다시 가져오는 요청은 refetch를 풀 때까지 답하지 않는다. 그동안 보이는 값은 뮤테이션 훅이 되돌린 캐시다.
  const response = Promise.withResolvers<undefined>()
  const refetch = Promise.withResolvers<undefined>()
  onTestFinished(() => {
    refetch.resolve(undefined)
  })
  let listRequests = 0
  server.use(
    getListTodosMockHandler(async () => {
      listRequests += 1
      if (listRequests > 1) await refetch.promise
      return getListTodosResponseMock()
    }),
    http.patch('*/todos/:todoId', async () => {
      await response.promise
      return HttpResponse.json({ message: '보안 점검 결과는 보안 담당자만 승인할 수 있습니다.' }, { status: 403 })
    }),
  )
  const user = userEvent.setup()
  const { queryClient } = renderTodoList()
  const checkbox = await screen.findByRole('checkbox', { name: '보안 점검 결과 승인하기(보안 담당자만 바꿀 수 있음)' })

  await user.click(checkbox)

  await waitFor(() => {
    expect(checkbox).toBeChecked()
  })
  expect(screen.getByRole('status')).toHaveTextContent('할 일 4개 중 2개를 끝냈습니다.')

  response.resolve(undefined)

  await waitFor(() => {
    expect(checkbox).not.toBeChecked()
  })
  expect(screen.getByRole('status')).toHaveTextContent('할 일 4개 중 1개를 끝냈습니다.')
  expect(queryClient.getQueryData(todosKeys.listTodos())).toEqual(getListTodosResponseMock())
  expect(listRequests).toBe(2)

  // 뮤테이션은 다시 가져온 목록을 받은 뒤에 끝나고(onSettled), 그때 알림이 뜬다.
  refetch.resolve(undefined)

  const toasts = screen.getByRole('region', { name: '알림' })
  expect(await within(toasts).findByText('할 일을 바꾸지 못해 되돌렸습니다')).toBeInTheDocument()
  expect(
    within(toasts).getByText(
      '보안 점검 결과 승인하기(보안 담당자만 바꿀 수 있음): 보안 점검 결과는 보안 담당자만 승인할 수 있습니다.',
    ),
  ).toBeInTheDocument()
})

test('서버가 이유를 알리지 않고 실패하면(네트워크 오류 등) 되돌린 뒤 다시 시도하라고 알린다', async () => {
  server.use(http.patch('*/todos/:todoId', () => HttpResponse.error()))
  const user = userEvent.setup()
  renderTodoList()
  const checkbox = await screen.findByRole('checkbox', { name: '배포 일정 정하기' })

  await user.click(checkbox)

  const toasts = screen.getByRole('region', { name: '알림' })
  expect(await within(toasts).findByText('배포 일정 정하기: 잠시 뒤에 다시 시도해 주세요.')).toBeInTheDocument()
  expect(checkbox).not.toBeChecked()
})

test('할 일 목록을 불러오지 못하면 알린다', async () => {
  server.use(http.get('*/todos', () => HttpResponse.json({ message: '점검 중' }, { status: 503 })))

  renderTodoList()

  expect(await screen.findByRole('alert')).toHaveTextContent('할 일을 불러오지 못했습니다.')
  expect(screen.queryByRole('list', { name: '할 일 목록' })).not.toBeInTheDocument()
})
