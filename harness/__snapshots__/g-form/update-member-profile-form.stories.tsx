import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, waitFor } from 'storybook/test'
import { UpdateMemberProfileForm } from './update-member-profile-form'

const queryClient = new QueryClient()

const meta = {
  title: 'Features/Members/UpdateMemberProfileForm',
  component: UpdateMemberProfileForm,
  // 폼이 뮤테이션 훅을 쓰므로 QueryClient로 감싼다. 스토리는 모양과 검증 오류만 보여 주고, 제출 성공은 테스트(update-member-profile-form.test.tsx)가 MSW로 확인한다.
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof UpdateMemberProfileForm>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '내 정보 수정' })).toBeVisible()
  },
}

// 검증 규칙에 맞지 않는 값을 넣고 제출해 검증 오류를 보여 준다. npm run test:storybook이 오류가 보이는 화면도 접근성(axe)을 검사한다.
export const ValidationErrors: Story = {
  play: async ({ canvas, userEvent }) => {
    const control = canvas.getByRole('textbox', { name: '별명' })
    await userEvent.type(control, 'aaaaaaaaaaa')
    await userEvent.click(canvas.getByRole('button', { name: '내 정보 수정' }))

    await waitFor(() => expect(control).toHaveAttribute('aria-invalid', 'true'))
    await expect(control).toHaveAccessibleDescription()
  },
}
