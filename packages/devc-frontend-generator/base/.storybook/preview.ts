import type { Preview } from '@storybook/nextjs-vite'
import { WCAG_22_AA_TAGS } from '@/shared/a11y/wcag-tags'

const preview: Preview = {
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
