import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect, fn } from 'storybook/test'
import AppError from './error'

// 앱 수준의 오류 화면(src/app/error.tsx). 루트 레이아웃에서 난 오류를 받는 global-error.tsx도 이 화면을 그린다.
const meta = {
  title: 'Pages/Error',
  component: AppError,
  args: { error: new Error('페이지를 그리다 난 오류'), retry: fn() },
} satisfies Meta<typeof AppError>

export default meta

export const Default: StoryObj<typeof meta> = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: '문제가 생겼습니다' })).toBeVisible()
    await expect(canvas.getByRole('alert')).toHaveTextContent('페이지를 불러오지 못했습니다.')

    await userEvent.click(canvas.getByRole('button', { name: '다시 시도' }))

    await expect(args.retry).toHaveBeenCalledTimes(1)
  },
}
