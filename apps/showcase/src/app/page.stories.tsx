// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/app/page.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import HomePage from './page'

const meta = {
  title: 'Pages/Home',
  component: HomePage,
} satisfies Meta<typeof HomePage>

export default meta

export const Default: StoryObj<typeof meta> = {}
