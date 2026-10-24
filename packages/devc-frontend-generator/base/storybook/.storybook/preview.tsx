import type { Preview } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { ToastProvider } from '@/shared/ui/toast'
import '@/shared/ui/styles.css'

// 스토리마다 따로 쓰는 QueryClient. 앞 스토리의 캐시가 다음 스토리에 남지 않게 한다. Storybook에는 백엔드가 없으므로 실패한
// 요청을 다시 보내지 않는다. 스토리가 보여 줄 데이터는 스토리의 decorators에서 데이터를 넣은 QueryClient로 감싸 정한다(README의 "Storybook").
const queryClients = new Map<string, QueryClient>()

const preview: Preview = {
  // 앱 레이아웃(src/app/layout.tsx)처럼 Tailwind와 디자인 토큰을 불러오고, TanStack Query와 알림을 쓸 수 있게 감싼다.
  decorators: [
    (Story, { id }) => {
      const queryClient = queryClients.get(id) ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
      queryClients.set(id, queryClient)
      return (
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <Story />
          </ToastProvider>
        </QueryClientProvider>
      )
    },
  ],
  parameters: {
    // 앱은 App Router만 쓰므로 next/navigation(useRouter, usePathname 등)을 App Router로 흉내 낸다.
    nextjs: { appDirectory: true },
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
