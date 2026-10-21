import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { getUserQueryOptions } from '@/queries/users/users.queries'
import { getUser } from '@/shared/api/generated'
import { resetMockUsers } from '@/shared/mocks/users'
import { ToastProvider } from '@/shared/ui/toast'
import { UpdateUserForm } from './update-user-form'

// 요청은 Vitest의 MSW(@/shared/mocks/node)가 받고, 대시보드의 목 백엔드(src/shared/mocks/users.ts)가 고친 사용자를 기억한다.
// 페이지가 서버에서 가져와 넘기는 사용자의 지금 값은 QueryClient에 미리 넣어 둔다.
const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

beforeEach(() => {
  resetMockUsers()
  router.push.mockClear()
})

async function renderForm(userId: number) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await queryClient.query(getUserQueryOptions(userId))
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <UpdateUserForm userId={userId} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

test('사용자의 지금 값으로 입력을 채운다', async () => {
  await renderForm(1)

  expect(screen.getByRole('textbox', { name: '이름' })).toHaveValue('김사용')
  expect(screen.getByRole('textbox', { name: '이메일' })).toHaveValue('user@example.com')
  expect(screen.getByRole('combobox', { name: '역할' })).toHaveTextContent('사용자')
  expect(screen.getByRole('combobox', { name: '상태' })).toHaveTextContent('활성')
  expect(screen.getByRole('textbox', { name: '부서' })).toHaveValue('영업팀')
})

test('고친 값을 보내고 알린 뒤 사용자 목록으로 옮겨 가며, 비운 부서는 지운다', async () => {
  const user = userEvent.setup()
  await renderForm(1)

  await user.click(screen.getByRole('combobox', { name: '상태' }))
  await user.click(await screen.findByRole('option', { name: '정지' }))
  await user.clear(screen.getByRole('textbox', { name: '부서' }))
  await user.click(screen.getByRole('button', { name: '사용자 수정' }))

  expect(await screen.findByText('사용자를 고쳤습니다')).toBeInTheDocument()
  expect(router.push).toHaveBeenCalledWith('/dashboard/users')
  expect(await getUser(1)).toEqual({
    id: 1,
    name: '김사용',
    email: 'user@example.com',
    role: 'user',
    status: 'suspended',
    joinedAt: '2025-01-15',
  })
})

test('다른 사용자의 이메일로 바꾸려 하면 이메일 입력에 알리고 옮겨 가지 않는다', async () => {
  const user = userEvent.setup()
  await renderForm(1)

  const email = screen.getByRole('textbox', { name: '이메일' })
  await user.clear(email)
  await user.type(email, 'admin@example.com')
  await user.click(screen.getByRole('button', { name: '사용자 수정' }))

  expect(await screen.findByText('이미 다른 사용자가 쓰는 이메일입니다.')).toBeInTheDocument()
  expect(email).toHaveAttribute('aria-invalid', 'true')
  expect(router.push).not.toHaveBeenCalled()
})
