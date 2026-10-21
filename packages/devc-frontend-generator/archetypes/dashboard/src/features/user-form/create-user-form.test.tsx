import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http } from 'msw'
import { beforeEach, expect, test, vi } from 'vitest'
import { listUsersQueryOptions } from '@/queries/users/users.queries'
import { REQUIRED_MESSAGE } from '@/shared/form/form-resolver'
import { server } from '@/shared/mocks/node'
import { resetMockUsers } from '@/shared/mocks/users'
import { ToastProvider } from '@/shared/ui/toast'
import { CreateUserForm } from './create-user-form'
import { DUPLICATE_EMAIL_MESSAGE } from './duplicate-email'

// 요청은 Vitest의 MSW(@/shared/mocks/node)가 받고, 대시보드의 목 백엔드(src/shared/mocks/users.ts)가 추가한 사용자를 기억한다.
// 추가한 뒤 옮겨 가는 사용자 목록은 Next.js의 라우터가 없는 테스트이므로 router.push를 기록해 확인한다.
const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

beforeEach(() => {
  resetMockUsers()
  router.push.mockClear()
})

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CreateUserForm />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { queryClient }
}

/** 폼이 보낸 요청 본문을 모은다. 응답은 돌려주지 않으므로 목 백엔드가 이어 받아 답한다. */
function receivedBodies(): unknown[] {
  const bodies: unknown[] = []
  server.use(
    http.post('*/users', async ({ request }) => {
      bodies.push(await request.clone().json())
    }),
  )
  return bodies
}

async function fillForm(values: { name: string; email: string; role: string; department?: string }) {
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: '이름' }), values.name)
  await user.type(screen.getByRole('textbox', { name: '이메일' }), values.email)
  await user.click(screen.getByRole('combobox', { name: '역할' }))
  await user.click(await screen.findByRole('option', { name: values.role }))
  if (values.department !== undefined) await user.type(screen.getByRole('textbox', { name: '부서' }), values.department)
  await user.click(screen.getByRole('button', { name: '사용자 추가' }))
}

test('입력한 값으로 사용자를 추가하고, 알린 뒤 사용자 목록으로 옮겨 가며, 목록을 다시 가져오게 한다', async () => {
  const bodies = receivedBodies()
  const { queryClient } = renderForm()
  // 앞서 받아 둔 사용자 목록. 추가하면 users Query Domain을 무효화하므로 다시 가져와야 하는 상태가 된다.
  await queryClient.query(listUsersQueryOptions())

  await fillForm({ name: '신입사', email: 'newbie@example.com', role: '사용자', department: '개발팀' })

  expect(await screen.findByText('사용자를 추가했습니다')).toBeInTheDocument()
  expect(router.push).toHaveBeenCalledWith('/dashboard/users')
  expect(bodies).toEqual([{ name: '신입사', email: 'newbie@example.com', role: 'user', department: '개발팀' }])
  await waitFor(() => {
    expect(queryClient.getQueryState(listUsersQueryOptions().queryKey)?.isInvalidated).toBe(true)
  })
  // 목 백엔드도 추가한 사용자를 목록의 맨 앞(최근에 추가한 순)에 둔다.
  const page = await queryClient.query({ ...listUsersQueryOptions(), staleTime: 0 })
  expect(page.items[0]).toMatchObject({ name: '신입사', status: 'invited' })
})

test('비워 둔 필수 입력은 보내지 않고, 입력 요소마다 오류를 알린다', async () => {
  const user = userEvent.setup()
  const bodies = receivedBodies()
  renderForm()

  await user.click(screen.getByRole('button', { name: '사용자 추가' }))

  const requiredError = new RegExp(RegExp.escape(REQUIRED_MESSAGE))
  for (const control of [
    screen.getByRole('textbox', { name: '이름' }),
    screen.getByRole('textbox', { name: '이메일' }),
    screen.getByRole('combobox', { name: '역할' }),
  ]) {
    expect(control).toHaveAttribute('aria-invalid', 'true')
    expect(control).toHaveAccessibleDescription(requiredError)
  }
  expect(bodies).toEqual([])
  expect(router.push).not.toHaveBeenCalled()
})

test('같은 이메일의 사용자가 이미 있으면 이메일 입력에 알리고 옮겨 가지 않는다', async () => {
  renderForm()

  await fillForm({ name: '김중복', email: 'USER@example.com', role: '사용자' })

  const email = screen.getByRole('textbox', { name: '이메일' })
  await waitFor(() => {
    expect(email).toHaveAccessibleDescription(DUPLICATE_EMAIL_MESSAGE)
  })
  expect(email).toHaveAttribute('aria-invalid', 'true')
  expect(router.push).not.toHaveBeenCalled()
})
