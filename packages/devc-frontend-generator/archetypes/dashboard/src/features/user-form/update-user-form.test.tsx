import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, expect, onTestFinished, test, vi } from 'vitest'
import { getUserQueryOptions } from '@/queries/users/users.queries'
import { getUser } from '@/shared/api/generated'
import { signInAsMockUser } from '@/shared/auth/mock-session'
import { resetMockUsers } from '@/shared/mocks/users'
import { ToastProvider } from '@/shared/ui/toast'
import { DUPLICATE_EMAIL_MESSAGE } from './duplicate-email'
import { UpdateUserForm } from './update-user-form'

// 요청은 Vitest의 MSW(@/shared/mocks/node)가 받고, 대시보드의 목 백엔드(src/shared/mocks/users.ts)가 고친 사용자를 기억한다.
// 목 백엔드는 실제 백엔드처럼 사용자 수정을 관리자에게만 허락하므로, 폼을 그릴 때 누구로 로그인했는지 정한다(signInAsMockUser).
// 페이지가 서버에서 가져와 넘기는 사용자의 지금 값은 QueryClient에 미리 넣어 둔다.
const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>(), refresh: vi.fn<() => void>() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

beforeEach(() => {
  resetMockUsers()
  router.push.mockClear()
  router.refresh.mockClear()
})

/** email의 목 사용자로 로그인해(기본은 관리자) userId의 사용자를 고치는 폼을 그린다. 로그인은 테스트가 끝나면 되돌린다. */
async function renderForm(userId: number, email = 'admin@example.com') {
  onTestFinished(signInAsMockUser(email))
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

test('누구를 고치는지 알리고, 사용자의 지금 값으로 입력을 채운다', async () => {
  await renderForm(1)

  expect(screen.getByText('김사용(user@example.com)님의 정보를 고칩니다.')).toBeInTheDocument()
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

  expect(await screen.findByText(DUPLICATE_EMAIL_MESSAGE)).toBeInTheDocument()
  expect(email).toHaveAttribute('aria-invalid', 'true')
  expect(router.push).not.toHaveBeenCalled()
})

test('관리자가 아닌 사용자가 보내면 목 백엔드가 403으로 거절하고, 알린 뒤 이 화면의 접근 규칙을 서버에서 다시 확인한다', async () => {
  const user = userEvent.setup()
  await renderForm(1, 'user@example.com')

  await user.click(screen.getByRole('combobox', { name: '상태' }))
  await user.click(await screen.findByRole('option', { name: '정지' }))
  await user.click(screen.getByRole('button', { name: '사용자 수정' }))

  expect(await screen.findByText('사용자를 추가하고 고치는 것은 관리자만 할 수 있습니다.')).toBeInTheDocument()
  expect(router.refresh).toHaveBeenCalledTimes(1)
  expect(router.push).not.toHaveBeenCalled()
  await expect(getUser(1)).resolves.toMatchObject({ status: 'active' })
})
