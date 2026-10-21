// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/multi-step-form/src/features/partner-application/partner-application-form.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, screen, waitFor } from 'storybook/test'
import { REQUIRED_MESSAGE } from '@/shared/form/form-resolver'
import { PartnerApplicationForm } from './partner-application-form'

const queryClient = new QueryClient()

const meta = {
  title: 'Features/PartnerApplication/PartnerApplicationForm',
  component: PartnerApplicationForm,
  // 폼이 뮤테이션 훅을 쓰므로 QueryClient로 감싼다. 스토리는 단계의 모양, 검증 오류, 확인 단계를 보여 주고, 신청은
  // 테스트(partner-application-form.test.tsx)와 E2E가 MSW로 확인한다.
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  // 폼은 입력하던 값을 sessionStorage에 두므로, 앞 스토리가 남긴 값을 지우고 첫 단계부터 그린다.
  beforeEach: () => {
    sessionStorage.clear()
  },
} satisfies Meta<typeof PartnerApplicationForm>

export default meta

type Story = StoryObj<typeof meta>

// test:storybook은 모든 스토리를 axe로 검사한다. dark-mode Recipe가 있으면 다크 모드 브라우저에서도 한 번 더 실행된다.
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2, name: '사업자 정보 (4단계 중 1단계)' })).toBeVisible()
    await expect(canvas.getByRole('listitem', { current: 'step' })).toHaveTextContent('사업자 정보')
  },
}

// 비워 둔 채 다음을 눌러 이 단계의 검증 오류를 보여 준다. 오류가 보이는 화면도 접근성(axe)을 검사한다.
export const ValidationErrors: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '다음' }))

    const companyName = canvas.getByRole('textbox', { name: '상호' })
    await waitFor(() => expect(companyName).toHaveAttribute('aria-invalid', 'true'))
    await expect(companyName).toHaveAccessibleDescription(expect.stringContaining(REQUIRED_MESSAGE))
    await expect(companyName).toHaveFocus()
  },
}

// 세 단계를 채워 확인 단계를 보여 준다.
export const Review: Story = {
  play: async ({ canvas, userEvent }) => {
    const next = () => userEvent.click(canvas.getByRole('button', { name: '다음' }))

    await userEvent.type(canvas.getByRole('textbox', { name: '상호' }), '하늘상회')
    await userEvent.type(canvas.getByRole('textbox', { name: '사업자등록번호' }), '123-45-67890')
    await userEvent.click(canvas.getByRole('combobox', { name: '판매 분야' }))
    // 선택지 목록은 포털로 캔버스 밖(문서의 body)에 그려진다.
    await userEvent.click(await screen.findByRole('option', { name: '리빙' }))
    await next()
    await userEvent.type(await canvas.findByRole('textbox', { name: '담당자 이름' }), '김하늘')
    await userEvent.type(canvas.getByRole('textbox', { name: '이메일' }), 'haneul@example.com')
    await userEvent.type(canvas.getByRole('textbox', { name: '연락처' }), '010-1234-5678')
    await next()
    await userEvent.type(await canvas.findByRole('spinbutton', { name: '판매할 상품 수' }), '120')
    await userEvent.click(canvas.getByRole('checkbox', { name: '입점 약관에 동의합니다' }))
    await next()

    await expect(
      await canvas.findByRole('heading', { level: 2, name: '신청 내용 확인 (4단계 중 4단계)' }),
    ).toHaveFocus()
    await expect(canvas.getByRole('region', { name: '사업자 정보' })).toHaveTextContent('리빙')
  },
}
