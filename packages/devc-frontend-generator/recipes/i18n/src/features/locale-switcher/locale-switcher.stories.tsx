import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { getRouter } from '@storybook/nextjs-vite/navigation.mock'
import { expect, screen, waitFor } from 'storybook/test'
import { I18nProvider } from '@/shared/i18n/i18n-provider'
import { LocaleSwitcher } from './locale-switcher'

// 지금 locale은 주소의 [locale]에서 읽으므로(I18nProvider) 스토리마다 App Router의 주소를 정한다.
// segments는 주소의 동적 세그먼트(useParams)다. 번역하지 않은 페이지([locale] 밖)에는 없다.
const meta = {
  title: 'Features/LocaleSwitcher',
  component: LocaleSwitcher,
  decorators: [
    (Story) => (
      <I18nProvider>
        <Story />
      </I18nProvider>
    ),
  ],
  parameters: {
    nextjs: { appDirectory: true, navigation: { pathname: '/ko/i18n', segments: [['locale', 'ko']] } },
  },
} satisfies Meta<typeof LocaleSwitcher>

export default meta

type Story = StoryObj<typeof meta>

/** 번역한 페이지에서 다른 locale을 고르면 같은 페이지의 그 locale 주소로 간다. */
export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: '언어' })
    await expect(trigger).toHaveTextContent('한국어')

    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('option', { name: 'English' }))

    await expect(getRouter().replace).toHaveBeenCalledWith('/en/i18n')
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  },
}

/** 영어 페이지에서는 전환 UI도 영어로 보인다. */
export const English: Story = {
  parameters: {
    nextjs: { navigation: { pathname: '/en/i18n', segments: [['locale', 'en']] } },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox', { name: 'Language' })).toHaveTextContent('English')
  },
}

/** 번역하지 않은 페이지는 기본 locale(ko)로 보이고, 다른 locale을 고르면 그 locale의 홈으로 간다. */
export const UntranslatedPage: Story = {
  parameters: {
    nextjs: { navigation: { pathname: '/products', segments: [] } },
  },
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('combobox', { name: '언어' })
    await expect(trigger).toHaveTextContent('한국어')

    await userEvent.click(trigger)
    await userEvent.click(await screen.findByRole('option', { name: 'English' }))

    await expect(getRouter().replace).toHaveBeenCalledWith('/en')
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  },
}
