// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/features/login-form/login-form.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, waitFor } from 'storybook/test'
import { REQUIRED_MESSAGE } from '@/shared/form/form-resolver'
import { LoginForm } from './login-form'

const queryClient = new QueryClient()

const meta = {
  title: 'Features/Auth/LoginForm',
  component: LoginForm,
  args: { returnPath: '/account' },
  // 폼이 뮤테이션 훅을 쓰므로 QueryClient로 감싼다. 스토리는 모양과 검증 오류만 보여 주고, 로그인은 테스트(login-form.test.tsx)와
  // E2E(e2e/auth.spec.ts)가 확인한다.
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof LoginForm>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '로그인' })).toBeVisible()
  },
}

// 비워 둔 채 제출해 검증 오류를 보여 준다. npm run test:storybook이 오류가 보이는 화면도 접근성(axe)을 검사한다.
export const ValidationErrors: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '로그인' }))

    const control = canvas.getByRole('textbox', { name: '이메일' })
    await waitFor(() => expect(control).toHaveAttribute('aria-invalid', 'true'))
    await expect(control).toHaveAccessibleDescription(expect.stringContaining(REQUIRED_MESSAGE))
  },
}
