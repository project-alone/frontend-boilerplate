// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/features/user-menu/user-menu.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect } from 'storybook/test'
import { authKeys } from '@/queries/auth/auth.keys'
import type { User } from '@/shared/api/generated/model'
import { UserMenu } from './user-menu'

const USER: User = { id: 1, email: 'user@example.com', name: '김사용', roles: ['user'] }

/** 로그인 세션을 미리 넣어 둔 QueryClient. 스토리에서는 BFF에 묻지 않는다. */
function withSession(user: User | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  queryClient.setQueryData(authKeys.session(), user)
  return queryClient
}

const meta = {
  title: 'Features/Auth/UserMenu',
  component: UserMenu,
  // 로그아웃해도 페이지를 옮기지 않는다.
  args: { onLoggedOut: () => undefined },
} satisfies Meta<typeof UserMenu>

export default meta

type Story = StoryObj<typeof meta>

export const LoggedOut: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={withSession(null)}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login')
  },
}

export const LoggedIn: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={withSession(USER)}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: USER.name })).toHaveAttribute('href', '/account')
    await expect(canvas.getByRole('button', { name: '로그아웃' })).toBeEnabled()
  },
}
