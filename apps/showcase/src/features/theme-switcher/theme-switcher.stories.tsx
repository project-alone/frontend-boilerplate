// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/dark-mode/src/features/theme-switcher/theme-switcher.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, screen, waitFor } from 'storybook/test'
import { THEME_STORAGE_KEY } from '@/shared/theme/theme'
import { ThemeSwitcher } from './theme-switcher'

const meta = {
  title: 'Features/ThemeSwitcher',
  component: ThemeSwitcher,
  // 스토리가 고른 테마를 저장소에 남기지 않는다.
  beforeEach: () => {
    localStorage.removeItem(THEME_STORAGE_KEY)
    return () => {
      localStorage.removeItem(THEME_STORAGE_KEY)
    }
  },
} satisfies Meta<typeof ThemeSwitcher>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    // 툴바의 기본값(시스템 설정)이면 운영체제 설정을 따른다. test:storybook은 다크 모드 브라우저에서도 실행된다.
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    await expect(document.documentElement).toHaveAttribute('data-theme', systemTheme)

    const trigger = canvas.getByRole('combobox', { name: '테마' })
    await expect(trigger).toHaveTextContent('시스템 설정')

    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('option', { name: '다크' }))

    await expect(trigger).toHaveTextContent('다크')
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  },
}

export const Light: Story = {
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: '테마' })

    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('option', { name: '라이트' }))

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  },
}
