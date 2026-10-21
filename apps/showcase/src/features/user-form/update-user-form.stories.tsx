// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/features/user-form/update-user-form.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, waitFor } from 'storybook/test'
import { getUserQueryOptions } from '@/queries/users/users.queries'
import { getGetUserResponseMock } from '@/shared/api/generated/users/users.msw'
import { UpdateUserForm } from './update-user-form'

// 페이지가 서버에서 가져와 hydration으로 넘기는 사용자의 지금 값(샘플 명세 getUser의 example)을 미리 넣어 둔다.
const user = getGetUserResponseMock()
const queryClient = new QueryClient()
queryClient.setQueryData(getUserQueryOptions(user.id).queryKey, user)

const meta = {
  title: 'Features/UserForm/UpdateUserForm',
  component: UpdateUserForm,
  args: { userId: user.id },
  // 스토리는 모양과 검증 오류만 보여 주고, 수정은 테스트(update-user-form.test.tsx)와 E2E가 목 백엔드로 확인한다.
  // 폼이 저장한 뒤 App Router(next/navigation)로 사용자 목록에 옮겨 가므로 Storybook의 App Router 흉내를 켠다.
  parameters: { nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof UpdateUserForm>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox', { name: '이름' })).toHaveValue(user.name)
    await expect(canvas.getByRole('button', { name: '사용자 수정' })).toBeVisible()
  },
}

// 이름을 비우고 제출해 검증 오류를 보여 준다. npm run test:storybook이 오류가 보이는 화면도 접근성(axe)을 검사한다.
export const ValidationErrors: Story = {
  play: async ({ canvas, userEvent }) => {
    const control = canvas.getByRole('textbox', { name: '이름' })
    await userEvent.clear(control)
    await userEvent.click(canvas.getByRole('button', { name: '사용자 수정' }))

    await waitFor(() => expect(control).toHaveAttribute('aria-invalid', 'true'))
    await expect(control).toHaveAccessibleDescription()
  },
}
