// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/file-upload/src/features/file-uploader/file-uploader.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, waitFor } from 'storybook/test'
import { FileUploader } from './file-uploader'

// 업로드는 files Query Domain의 뮤테이션으로 보내므로 QueryClient로 감싼다.
const queryClient = new QueryClient()

const meta = {
  title: 'Features/FileUploader',
  component: FileUploader,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof FileUploader>

export default meta

type Story = StoryObj<typeof meta>

// test:storybook은 모든 스토리를 axe로 검사한다. dark-mode Recipe가 있으면 다크 모드 브라우저에서도 한 번 더 실행된다.
export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    // 파일 선택 버튼은 키보드로 갈 수 있고, 받는 형식과 크기를 설명으로 읽어 준다.
    const pick = canvas.getByRole('button', { name: '파일 선택' })
    await userEvent.tab()
    await expect(pick).toHaveFocus()
    await expect(pick).toHaveAccessibleDescription(/PNG, JPEG, PDF, 텍스트 파일을 5MB까지 올릴 수 있습니다\./)
  },
}

// 받지 않는 파일은 보내지 않으므로, 네트워크 없이 거절한 항목의 모양과 알림을 본다.
export const RejectedFile: Story = {
  play: async ({ canvas }) => {
    // 브라우저가 끌어 놓을 때처럼 파일을 담은 DataTransfer로 drop 이벤트를 보낸다.
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' }))

    canvas
      .getByText(/파일을 여기에 끌어 놓거나/)
      .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }))

    const message = '올릴 수 없는 파일입니다. PNG, JPEG, PDF, 텍스트 파일만 올릴 수 있습니다.'
    await expect(await canvas.findByRole('list', { name: '업로드 목록' })).toHaveTextContent(message)
    await expect(canvas.getByRole('button', { name: 'setup.exe 지우기' })).toBeVisible()
    await waitFor(() => expect(canvas.getByRole('status')).toHaveTextContent(`setup.exe: ${message}`))
  },
}
