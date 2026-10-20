// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/.storybook/preview.tsx, recipes/dark-mode/.storybook/preview.tsx.patch

import type { Preview } from '@storybook/nextjs-vite'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'
import { applyTheme, isThemeChoice, THEME_CHOICES, THEME_LABELS } from '@/shared/theme/theme'
import { ToastProvider } from '@/shared/ui/toast'
import '@/shared/ui/styles.css'

const preview: Preview = {
  // 앱 레이아웃(src/app/layout.tsx)처럼 Tailwind와 디자인 토큰을 불러오고 알림을 띄울 수 있게 감싼다.
  decorators: [
    (Story, { globals }) => {
      // 툴바에서 고른 테마를 적용한다. 시스템 설정이면 운영체제(브라우저) 설정을 따른다.
      applyTheme(isThemeChoice(globals['theme']) ? globals['theme'] : 'system')
      return (
        <ToastProvider>
          <Story />
        </ToastProvider>
      )
    },
  ],
  globalTypes: {
    theme: {
      description: '테마',
      toolbar: {
        title: '테마',
        icon: 'mirror',
        items: THEME_CHOICES.map((choice) => ({ value: choice, title: THEME_LABELS[choice] })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'system',
  },
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
