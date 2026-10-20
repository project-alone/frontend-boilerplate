import type { Preview } from '@storybook/nextjs-vite'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { ToastProvider } from '@/shared/ui/toast'
import '@/shared/ui/styles.css'

const preview: Preview = {
  // 앱 레이아웃(src/app/layout.tsx)처럼 Tailwind와 디자인 토큰을 불러오고 알림을 띄울 수 있게 감싼다.
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  parameters: {
    a11y: {
      // 위반이 하나라도 있으면 스토리 테스트(npm run test:storybook)를 실패시킨다.
      test: 'error',
      options: {
        runOnly: { type: 'tag', values: WCAG_22_AA_TAGS },
      },
    },
  },
}

export default preview
