// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/app/not-found.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import NotFound from './not-found'

const meta = {
  title: 'Pages/NotFound',
  component: NotFound,
} satisfies Meta<typeof NotFound>

export default meta

export const Default: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: '찾는 화면이 없습니다' })).toBeVisible()
    await expect(canvas.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
  },
}
