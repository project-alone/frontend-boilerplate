// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/features/shop-checkout/checkout-form.stories.tsx

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, screen, waitFor } from 'storybook/test'
import { getCartQueryOptions } from '@/queries/cart/cart.queries'
import { getGetCartResponseMock } from '@/shared/api/generated/cart/cart.msw'
import { REQUIRED_MESSAGE } from '@/shared/form/form-resolver'
import { forgetCartId, rememberCartId } from '@/shared/shop/cart-id'
import { CheckoutForm } from './checkout-form'

// 주문서는 이 브라우저의 장바구니를 불러와 그린다. 스토리에는 백엔드가 없으므로 명세의 example 장바구니를 캐시에 넣어 두고
// 다시 가져오지 않는다. 주문과 결제는 테스트(checkout-form.test.tsx)와 E2E가 목 백엔드로 확인한다.
const cart = getGetCartResponseMock()
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
queryClient.setQueryData(getCartQueryOptions(cart.id).queryKey, cart)

const meta = {
  title: 'Features/ShopCheckout/CheckoutForm',
  component: CheckoutForm,
  // 주문하면 결제창으로 옮겨 가므로 App Router(next/navigation)를 쓴다.
  parameters: { nextjs: { appDirectory: true } },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  // 앞 스토리가 남긴 입력을 지우고 첫 단계부터 그린다.
  beforeEach: () => {
    sessionStorage.clear()
    rememberCartId(cart.id)
    return () => {
      forgetCartId()
    }
  },
} satisfies Meta<typeof CheckoutForm>

export default meta

type Story = StoryObj<typeof meta>

// test:storybook은 모든 스토리를 axe로 검사한다. dark-mode Recipe가 있으면 다크 모드 브라우저에서도 한 번 더 실행된다.
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 2, name: '배송 정보 (4단계 중 1단계)' })).toBeVisible()
    await expect(canvas.getByRole('listitem', { current: 'step' })).toHaveTextContent('배송 정보')
  },
}

// 비워 둔 채 다음을 눌러 이 단계의 검증 오류를 보여 준다. 오류가 보이는 화면도 접근성(axe)을 검사한다.
export const ValidationErrors: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '다음' }))

    const recipient = canvas.getByRole('textbox', { name: '받는 사람' })
    await waitFor(() => expect(recipient).toHaveAttribute('aria-invalid', 'true'))
    await expect(recipient).toHaveAccessibleDescription(expect.stringContaining(REQUIRED_MESSAGE))
    await expect(recipient).toHaveFocus()
  },
}

// 두 단계를 채워 주문 확인 단계(주문 상품 표, 단계마다의 입력, 구매 동의)를 보여 준다.
export const Review: Story = {
  play: async ({ canvas, userEvent }) => {
    const next = () => userEvent.click(canvas.getByRole('button', { name: '다음' }))

    await userEvent.type(await canvas.findByRole('textbox', { name: '받는 사람' }), '홍길동')
    await userEvent.type(canvas.getByRole('textbox', { name: '연락처' }), '010-1234-5678')
    await userEvent.type(canvas.getByRole('textbox', { name: '우편번호' }), '04524')
    await userEvent.type(canvas.getByRole('textbox', { name: '주소' }), '서울특별시 중구 세종대로 110')
    await next()
    await userEvent.click(await canvas.findByRole('combobox', { name: '결제 수단' }))
    // 선택지 목록은 포털로 캔버스 밖(문서의 body)에 그려진다.
    await userEvent.click(await screen.findByRole('option', { name: '신용·체크카드' }))
    await next()

    await expect(await canvas.findByRole('heading', { level: 2, name: '주문 확인 (4단계 중 3단계)' })).toHaveFocus()
    await expect(canvas.getByRole('table', { name: '주문 상품' })).toHaveTextContent('₩63,000')
  },
}
