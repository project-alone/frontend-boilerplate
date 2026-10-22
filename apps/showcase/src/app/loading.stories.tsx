// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/app/loading.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import Loading from './loading'

const meta = {
  title: 'Pages/Loading',
  component: Loading,
} satisfies Meta<typeof Loading>

export default meta

export const Default: StoryObj<typeof meta> = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('불러오는 중입니다.')
  },
}
