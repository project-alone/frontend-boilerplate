// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/landing/src/features/landing/landing.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from 'storybook/test'
import { MOCK_LANDING_PAGES } from '@/shared/mocks/landing'
import { Landing } from './landing'

const meta = {
  title: 'Features/Landing',
  component: Landing,
  // 목 백엔드(src/shared/mocks/landing.ts)가 돌려주는 콘텐츠
  args: { content: MOCK_LANDING_PAGES.ko },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Landing>

export default meta

type Story = StoryObj<typeof meta>

// test:storybook은 모든 스토리를 axe로 검사한다. dark-mode Recipe가 있으면 다크 모드 브라우저에서도 한 번 더 실행된다.

/** 자주 묻는 질문은 질문을 누르면 답이 펼쳐진다. 펼친 답도 axe가 검사한다. 키보드로 펼치는 것은 E2E가 본다. */
export const Korean: Story = {
  play: async ({ canvas, userEvent }) => {
    const answer = canvas.getByText(/OpenAPI 명세에서 만든 목 응답으로/)
    await expect(answer).not.toBeVisible()

    await userEvent.click(canvas.getByText('백엔드가 준비되지 않았어도 개발할 수 있나요?'))

    await expect(answer).toBeVisible()
  },
}

/** 영어 콘텐츠도 같은 섹션으로 그린다. */
export const English: Story = {
  args: { content: MOCK_LANDING_PAGES.en },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'A clean frontend project from the first commit' }),
    ).toBeVisible()
    for (const name of ['Key features', 'What early teams say', 'Frequently asked questions']) {
      await expect(canvas.getByRole('region', { name })).toBeVisible()
    }
  },
}
