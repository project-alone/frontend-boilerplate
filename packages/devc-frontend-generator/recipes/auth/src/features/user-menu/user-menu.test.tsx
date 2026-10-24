import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { authKeys } from '@/queries/auth/auth.keys'
import { axeViolations } from '@/shared/a11y/axe-violations'
import type { User } from '@/shared/api/generated/model'
import { UserMenu } from './user-menu'

const USER: User = { id: 1, email: 'user@example.com', name: '김사용', roles: ['user'] }

/** 로그인 세션을 미리 넣어 둔 QueryClient로 그린다. BFF에 묻지 않는다. */
function renderMenu(user: User | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  queryClient.setQueryData(authKeys.session(), user)
  return render(
    <QueryClientProvider client={queryClient}>
      <UserMenu onLoggedOut={() => undefined} />
    </QueryClientProvider>,
  )
}

test('로그인하지 않았으면 로그인 링크를 보여 준다', async () => {
  const { container } = renderMenu(null)

  expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login')
  expect(await axeViolations(container)).toEqual([])
})

test('로그인했으면 내 정보로 가는 이름 링크와 로그아웃 버튼을 보여 준다', async () => {
  const { container } = renderMenu(USER)

  expect(screen.getByRole('link', { name: USER.name })).toHaveAttribute('href', '/account')
  expect(screen.getByRole('button', { name: '로그아웃' })).toBeEnabled()
  expect(await axeViolations(container)).toEqual([])
})
